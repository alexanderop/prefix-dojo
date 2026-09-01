import { describe, expect, it } from "vitest"
import {
  applyKey,
  applyShellCommand,
  type KeyInput,
  type TrainerState,
} from "../engine/multiplexer"
import { lessons } from "."

function key(value: string, modifiers: Partial<KeyInput> = {}): KeyInput {
  return { key: value, ctrl: false, alt: false, shift: false, ...modifiers }
}

const prefix = key("b", { ctrl: true })

function keys(
  keymap: "tmux" | "herdr",
  ...inputs: KeyInput[]
): (state: TrainerState) => TrainerState {
  return (state) => inputs.reduce(
    (next, input) => applyKey(next, input, keymap),
    state,
  )
}

type Solve = (state: TrainerState) => TrainerState

const typed = (text: string): KeyInput[] => [...text].map((char) => key(char))

const shell = (state: TrainerState, ...commands: string[]): TrainerState =>
  commands.reduce((next, command) => applyShellCommand(next, command, "herdr"), state)

const solutions: ReadonlyArray<readonly [string, Solve]> = [
  ["tmux-start", (state) => applyShellCommand(state, "tmux new -s work", "tmux")],
  ["tmux-prefix", keys("tmux", prefix, key("?"))],
  ["tmux-split-v", keys("tmux", prefix, key("%"))],
  ["tmux-split-h", keys("tmux", prefix, key('"'))],
  ["tmux-navigate", keys("tmux", prefix, key("ArrowRight"), prefix, key("ArrowDown"))],
  ["tmux-zoom", keys("tmux", prefix, key("z"))],
  ["tmux-windows", keys("tmux", prefix, key("c"), prefix, key("p"))],
  ["tmux-copy", keys("tmux", prefix, key("["), key("PageUp"), key("q"))],
  ["tmux-close-pane", keys("tmux", prefix, key("ArrowRight"), prefix, key("x"))],
  ["tmux-detach", keys("tmux", prefix, key("d"))],
  ["herdr-start", (state) => applyShellCommand(state, "herdr", "herdr")],
  ["herdr-model", (state) => applyKey(applyKey(state, prefix, "herdr"), key("N", { shift: true }), "herdr")],
  ["herdr-help-config", keys("herdr", prefix, key("?"))],
  ["herdr-mouse", (state) => ({ ...state, activePaneId: 2 })],
  ["herdr-layout", (state) => [prefix, key("v"), prefix, key("-")].reduce((next, input) => applyKey(next, input, "herdr"), state)],
  ["herdr-navigate", (state) => [prefix, key("l")].reduce((next, input) => applyKey(next, input, "herdr"), state)],
  ["herdr-tabs", (state) => [prefix, key("c"), prefix, key("p")].reduce((next, input) => applyKey(next, input, "herdr"), state)],
  ["herdr-workspaces", (state) => [prefix, key("w"), key("ArrowDown"), key("Enter")].reduce((next, input) => applyKey(next, input, "herdr"), state)],
  ["herdr-zoom-resize", (state) => [prefix, key("z"), prefix, key("z"), prefix, key("r"), key("l")].reduce((next, input) => applyKey(next, input, "herdr"), state)],
  ["herdr-copy", (state) => [prefix, key("["), key("v"), key("y")].reduce((next, input) => applyKey(next, input, "herdr"), state)],
  ["herdr-worktrees", (state) => [prefix, key("G", { shift: true })].reduce((next, input) => applyKey(next, input, "herdr"), state)],
  ["herdr-sidebar", (state) => [prefix, key("b")].reduce((next, input) => applyKey(next, input, "herdr"), state)],
  ["herdr-persistence", (state) => [prefix, key("q")].reduce((next, input) => applyKey(next, input, "herdr"), state)],
  ["herdr-remote", (state) => applyShellCommand(state, "herdr --remote workbox", "herdr")],
  ["herdr-integration", (state) => applyShellCommand(state, "herdr integration install codex", "herdr")],
  ["herdr-automation", (state) => applyShellCommand(state, "herdr pane split --current --direction right", "herdr")],
  ["herdr-plugins", (state) => applyShellCommand(state, "herdr plugin list", "herdr")],
  ["herdr-swap", keys("herdr", prefix, key("L", { shift: true }), prefix, key("Tab"))],
  ["herdr-rename", keys("herdr", prefix, key("T", { shift: true }), ...typed("review"), key("Enter"), prefix, key("W", { shift: true }), ...typed("api"), key("Enter"))],
  ["herdr-goto", keys("herdr", prefix, key("g"), key("Escape"))],
  ["herdr-close", keys("herdr", prefix, key("x"), prefix, key("X", { shift: true }))],
  ["herdr-search", keys("herdr", prefix, key("["), key("/"), ...typed("failed"), key("Enter"), key("n"))],
  ["herdr-notification", keys("herdr", prefix, key("o"))],
  ["herdr-stop", (state) => applyShellCommand(state, "herdr server stop", "herdr")],
  ["herdr-attach-agent", (state) => applyShellCommand(state, "herdr agent attach reviewer", "herdr")],
  ["herdr-explain", (state) => applyShellCommand(state, "herdr agent explain w1:p2", "herdr")],
  ["herdr-agent-run", (state) => shell(state, "herdr agent start reviewer --kind codex --pane w1:p2", 'herdr agent prompt reviewer "Review the current diff" --wait')],
  ["herdr-agent-wait", (state) => shell(state, "herdr agent wait reviewer --until blocked", "herdr agent read reviewer")],
  ["herdr-skill", (state) => applyShellCommand(state, "npx skills add herdrdev/herdr --skill herdr -g", "herdr")],
]

describe("curriculum", () => {
  it("has stable unique lesson slugs", () => {
    const slugs = lessons.map((lesson) => lesson.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it("keeps the tmux foundation before the Herdr track", () => {
    const firstHerdr = lessons.findIndex((lesson) => lesson.track === "herdr")
    expect(firstHerdr).toBeGreaterThan(0)
    expect(lessons.slice(0, firstHerdr).every((lesson) => lesson.track === "tmux")).toBe(true)
    expect(lessons.slice(firstHerdr).every((lesson) => lesson.track === "herdr")).toBe(true)
  })

  it("defines a keyboard target only for keyboard lessons", () => {
    for (const lesson of lessons) {
      if (lesson.input === "keyboard") expect(lesson.par).toBeGreaterThan(0)
      else expect(lesson.par).toBeUndefined()
    }
  })

  it("covers every core multiplexer concept", () => {
    const modules = new Set(lessons.map((lesson) => `${lesson.track}:${lesson.module}`))
    expect([...modules]).toEqual(expect.arrayContaining([
      "tmux:The model",
      "tmux:Getting started",
      "tmux:Panes",
      "tmux:Windows",
      "tmux:History",
      "tmux:Sessions",
      "herdr:Getting started",
      "herdr:Workspaces",
      "herdr:Tabs",
      "herdr:Panes",
      "herdr:Agent awareness",
      "herdr:Integrations",
      "herdr:Persistence",
      "herdr:Remote work",
      "herdr:Automation",
      "herdr:Extensions",
    ]))
  })

  it("has an executable solution for every lesson", () => {
    expect(solutions).toHaveLength(lessons.length)
    for (const [slug, solve] of solutions) {
      const lesson = lessons.find((candidate) => candidate.slug === slug)
      expect(lesson, `missing lesson ${slug}`).toBeDefined()
      if (lesson === undefined) continue
      expect(lesson.goal(solve(lesson.setup())), `unsolved lesson ${slug}`).toBe(true)
    }
  })
})
