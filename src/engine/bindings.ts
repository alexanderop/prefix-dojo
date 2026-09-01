/**
 * Reference table of the bindings the trainer implements. The key help
 * overlay and the key HUD render from this, so it must match
 * `multiplexer.ts`. Keys use the same [bracket] spelling as lesson text.
 */
import type { Keymap, TrainerMode } from "./multiplexer"

export interface Binding {
  keys: string[]
  does: string
}

export interface BindingGroup {
  name: string
  items: Binding[]
}

export const PREFIX = "ctrl+b"

export const bindings: Record<Keymap, BindingGroup[]> = {
  tmux: [
    {
      name: "Session",
      items: [
        { keys: ["?"], does: "list key bindings" },
        { keys: ["d"], does: "detach client, keep the session" },
        { keys: [PREFIX], does: "send a literal ctrl+b to the shell" },
      ],
    },
    {
      name: "Panes",
      items: [
        { keys: ["%"], does: "split pane left / right" },
        { keys: ['"'], does: "split pane top / bottom" },
        { keys: ["←", "→", "↑", "↓"], does: "move focus by direction" },
        { keys: ["o"], does: "cycle to the next pane" },
        { keys: ["z"], does: "zoom / unzoom the focused pane" },
        { keys: ["x"], does: "close the focused pane" },
      ],
    },
    {
      name: "Windows",
      items: [
        { keys: ["c"], does: "create a window" },
        { keys: ["n"], does: "next window" },
        { keys: ["p"], does: "previous window" },
        { keys: ["0"], does: "…9 jump to a window by number (counts from 0)" },
      ],
    },
    {
      name: "History",
      items: [{ keys: ["["], does: "enter copy mode" }],
    },
  ],
  herdr: [
    {
      name: "Session",
      items: [
        { keys: ["?"], does: "key help for the active config" },
        { keys: ["q"], does: "detach client, keep the server" },
        { keys: ["b"], does: "toggle the agent sidebar" },
        { keys: ["g"], does: "open the session navigator" },
        { keys: ["o"], does: "jump to the visible notification" },
      ],
    },
    {
      name: "Panes",
      items: [
        { keys: ["v"], does: "split right (vertical divider)" },
        { keys: ["-"], does: "split down (horizontal divider)" },
        { keys: ["h", "j", "k", "l"], does: "move focus left / down / up / right" },
        { keys: ["shift+h", "shift+j", "shift+k", "shift+l"], does: "swap with the neighbor" },
        { keys: ["tab", "shift+tab"], does: "cycle to the next / previous pane" },
        { keys: ["z"], does: "zoom / unzoom the focused pane" },
        { keys: ["r"], does: "enter resize mode" },
        { keys: ["shift+p"], does: "rename the focused pane" },
        { keys: ["x"], does: "close the focused pane" },
      ],
    },
    {
      name: "Tabs",
      items: [
        { keys: ["c"], does: "create a tab" },
        { keys: ["n"], does: "next tab" },
        { keys: ["p"], does: "previous tab" },
        { keys: ["1"], does: "…9 jump to a tab by number (counts from 1)" },
        { keys: ["shift+t"], does: "rename the tab" },
        { keys: ["shift+x"], does: "close the tab" },
      ],
    },
    {
      name: "Workspaces and Git",
      items: [
        { keys: ["shift+n"], does: "create a workspace" },
        { keys: ["w"], does: "workspace navigation" },
        { keys: ["shift+w"], does: "rename the workspace" },
        { keys: ["shift+d"], does: "close the workspace" },
        { keys: ["shift+g"], does: "create a Git worktree" },
      ],
    },
    {
      name: "History",
      items: [{ keys: ["["], does: "enter copy mode" }],
    },
  ],
}

export interface ModeHint {
  /** One sentence that says who receives the next key. */
  text: string
  /** Keys that do something in this mode, in display spelling. */
  keys: Binding[]
}

const TOOL: Record<Keymap, string> = { tmux: "tmux", herdr: "Herdr" }

/** What the next key will do, given the current mode. */
export function modeHint(mode: TrainerMode, keymap: Keymap): ModeHint {
  const tool = TOOL[keymap]
  switch (mode.kind) {
    case "terminal":
      return {
        text: `Keys go to the focused pane's shell. ${tool} ignores them until you press the prefix.`,
        keys: [{ keys: [PREFIX], does: `arm the prefix, then ${tool} reads one key` }],
      }
    case "prefix":
      return {
        text: `${tool} is listening. The next key is a command, not shell input.`,
        keys: bindings[keymap].flatMap((group) => group.items),
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
        keys:
          keymap === "tmux"
            ? [
                { keys: ["↑", "↓", "page up", "page down"], does: "move" },
                { keys: ["space"], does: "start selection" },
                { keys: ["enter"], does: "copy and leave" },
                { keys: ["q"], does: "leave copy mode" },
              ]
            : [
                { keys: ["h", "j", "k", "l", "page up"], does: "move" },
                { keys: ["/", "?"], does: "search forward / backward" },
                { keys: ["n", "N"], does: "repeat the search, same / opposite direction" },
                { keys: ["v"], does: "start selection" },
                { keys: ["y"], does: "copy and leave" },
                { keys: ["q"], does: "leave copy mode" },
              ],
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
export function taskKeys(task: string): string[] {
  const found = [...task.matchAll(/\[([^\]]+)\]/g)].map((match) => match[1])
  return [...new Set(found.filter((key) => key !== PREFIX))]
}
