/**
 * What a tool looks like to the trainer: its prefix, its binding table, its
 * copy-mode keys, and the shell commands it understands. `src/tools/` holds
 * one descriptor per tool; the engine, the key help overlay, and the key HUD
 * all read from the same table, so a binding exists in exactly one place.
 */
import type { KeyInput, TrainerMode, TrainerState } from "./state"

export type ToolId = "tmux" | "herdr"

/** A key or key group and what it does, in display spelling. */
export interface KeyHint {
  keys: string[]
  does: string
}

export interface Binding extends KeyHint {
  /** Matches labels the display keys cannot enumerate, e.g. every digit. */
  matches?: (label: string) => boolean
  run: (state: TrainerState, label: string) => void
}

export interface BindingGroup {
  name: string
  items: Binding[]
}

export interface CopyModeSpec {
  /** Label of the key that starts a selection. */
  select: string
  /** Label of the key that copies the selection and leaves. */
  copy: string
  /** Whether `/` and `?` start a history search and `n` / `N` repeat it. */
  search: boolean
  /** Keys that do something in copy mode, for the HUD. */
  hints: KeyHint[]
}

export interface ShellCommandRule {
  pattern: RegExp
  /** Mutates the cloned state and returns the lines the fake shell prints. */
  run: (state: TrainerState, match: RegExpExecArray) => string[]
}

export interface Tool {
  id: ToolId
  /** Display name: "tmux", "Herdr". */
  label: string
  /** Chord that arms the prefix, in display spelling. */
  prefix: string
  sessionName: string
  /** Shell command that reattaches after a detach. */
  attachCommand: string
  tab: { word: "window" | "tab"; firstNumber: 0 | 1 }
  hasWorkspaces: boolean
  hasSidebar: boolean
  /** Caption above the practice terminal. */
  caption: string
  /** Footer of the key help overlay: how the real tool shows this list. */
  helpNote: string
  bindings: BindingGroup[]
  copy: CopyModeSpec
  shellCommands: ShellCommandRule[]
}

export const PREFIX = "ctrl+b"

export function allBindings(tool: Tool): Binding[] {
  return tool.bindings.flatMap((group) => group.items)
}

export function findBinding(tool: Tool, label: string): Binding | undefined {
  return allBindings(tool).find((binding) =>
    binding.matches ? binding.matches(label) : binding.keys.includes(label),
  )
}

export function isPrefixChord(tool: Tool, label: string): boolean {
  return label === tool.prefix
}

export interface ModeHint {
  /** One sentence that says who receives the next key. */
  text: string
  /** Keys that do something in this mode, in display spelling. */
  keys: KeyHint[]
}

/** What the next key will do, given the current mode. */
export function modeHint(mode: TrainerMode, tool: Tool): ModeHint {
  switch (mode.kind) {
    case "terminal":
      return {
        text: `Keys go to the focused pane's shell. ${tool.label} ignores them until you press the prefix.`,
        keys: [{ keys: [tool.prefix], does: `arm the prefix, then ${tool.label} reads one key` }],
      }
    case "prefix":
      return {
        text: `${tool.label} is listening. The next key is a command, not shell input.`,
        keys: allBindings(tool),
      }
    case "copy":
      if (mode.search?.typing) {
        return {
          text: `Search ${mode.search.direction} through pane history. Type the term, then press enter.`,
          keys: [
            { keys: ["enter"], does: "run the search" },
            { keys: ["backspace"], does: "edit the term" },
            { keys: ["esc"], does: "cancel the search" },
          ],
        }
      }
      return {
        text: mode.selecting
          ? "Selection started. Move to extend it, then copy."
          : "Copy mode: navigation keys move through pane history. The process keeps running.",
        keys: tool.copy.hints,
      }
    case "rename":
      return {
        text: `Renaming the ${mode.target}. Keys go into the name field, not the shell.`,
        keys: [
          { keys: ["enter"], does: "save the name" },
          { keys: ["esc"], does: "cancel" },
        ],
      }
    case "resize":
      return {
        text: "Resize mode: each key nudges the split. No prefix needed until you leave.",
        keys: [
          { keys: ["h", "j", "k", "l"], does: "grow toward a direction" },
          { keys: ["enter", "esc"], does: "leave resize mode" },
        ],
      }
    case "workspace-picker":
      return {
        text: "Workspace navigation is open. Pick a project to switch every tab and pane at once.",
        keys: [
          { keys: ["↑", "↓"], does: "select" },
          { keys: ["enter"], does: "open workspace" },
          { keys: ["esc"], does: "close" },
        ],
      }
    case "help":
      return {
        text: "Key help lists the bindings that are active right now.",
        keys: [{ keys: ["q", "esc"], does: "close help" }],
      }
    case "goto":
      return {
        text: "Session navigator: jump to any workspace, tab, pane, or agent.",
        keys: [{ keys: ["esc"], does: "close" }],
      }
  }
}

/** Keys the lesson task names inside [brackets], minus the prefix itself. */
export function taskKeys(task: string, prefix: string = PREFIX): string[] {
  const found = [...task.matchAll(/\[([^\]]+)\]/g)].map((match) => match[1])
  return [...new Set(found.filter((key) => key !== prefix))]
}

export type { KeyInput }
