import { describe, expect, it } from "vitest"
import { stripAnsi } from "./ansi"
import { applyKey, initialState, leaf, type KeyInput, type TrainerState } from "./multiplexer"
import { hitTest, renderScreen, type ScreenInput, type ShellView } from "./screen"
import { toolFor } from "../tools"

const key = (value: string, modifiers: Partial<KeyInput> = {}): KeyInput => ({
  key: value,
  ctrl: false,
  alt: false,
  shift: false,
  ...modifiers,
})
const prefix = key("b", { ctrl: true })

const shell: ShellView = { lines: ["$ echo hi", "hi"], prompt: "$ ", input: "ls", cursor: 2 }

function render(state: TrainerState, tool: "tmux" | "herdr", overrides: Partial<ScreenInput> = {}) {
  const frame = renderScreen({
    state,
    tool: toolFor(tool),
    cols: 60,
    rows: 12,
    shellView: () => shell,
    outerShell: null,
    clock: "14:05 02-Sep-26",
    ...overrides,
  })
  return { ...frame, text: frame.rows.map(stripAnsi) }
}

const twoPanes = (): TrainerState =>
  initialState({
    root: {
      kind: "split",
      dir: "row",
      children: [
        leaf(0, [], "shell"),
        leaf(1, ["\x1b[36mclaude\x1b[0m  \x1b[33m● working\x1b[0m"]),
      ],
    },
    activePaneId: 0,
  })

describe("renderScreen", () => {
  it("fills every row to the terminal width and ends each in a reset", () => {
    const frame = render(twoPanes(), "tmux")
    expect(frame.rows).toHaveLength(12)
    for (const row of frame.text) expect(row).toHaveLength(60)
    for (const row of frame.rows) expect(row.endsWith("\x1b[0m")).toBe(true)
  })

  it("draws the tmux status line last, with the session and window list", () => {
    const frame = render(twoPanes(), "tmux")
    const status = frame.text[11]
    expect(status).toMatch(/^\[work\] 0:zsh\* /)
    expect(status).toContain('"dojo" 14:05 02-Sep-26')
  })

  it("separates tmux panes with a box-drawing divider and no outer frame", () => {
    const frame = render(twoPanes(), "tmux")
    expect(frame.text[0]).toContain("│")
    expect(frame.text[0].startsWith("│")).toBe(false)
    expect(frame.text[0]).not.toContain("─")
  })

  it("puts the cursor after the shell input of the focused pane", () => {
    const frame = render(twoPanes(), "tmux")
    expect(frame.cursor).toEqual({ x: 4, y: 2 })
    expect(frame.text[2].startsWith("$ ls")).toBe(true)
  })

  it("frames Herdr panes with rounded corners and titles", () => {
    const frame = render(twoPanes(), "herdr", { cols: 60 })
    const all = frame.text.join("\n")
    expect(all).toContain("╭")
    expect(all).toContain("╯")
    expect(all).toContain(" zsh ")
    expect(all).toContain(" claude ")
  })

  it("shows the sidebar and tab bar when the terminal is wide enough", () => {
    const frame = render(twoPanes(), "herdr", { cols: 100 })
    expect(frame.text[0]).toContain("spaces")
    expect(frame.text[1]).toContain("▸ project")
    expect(frame.text[0]).toContain(" main ")
    expect(frame.text.join("\n")).toContain("claude")
    expect(frame.text[11]).toContain("● 1 working")
  })

  it("draws the copy-mode position indicator in the focused pane", () => {
    const state = applyKey(applyKey(twoPanes(), prefix, "tmux"), key("["), "tmux")
    const frame = render(state, "tmux")
    expect(frame.text[0]).toContain("[0/2]")
    expect(frame.cursor).toBeNull()
  })

  it("turns the tmux rename into a status-line prompt with the cursor in it", () => {
    let state = twoPanes()
    state = { ...state, mode: { kind: "rename", target: "tab", value: "api" } }
    const frame = render(state, "tmux")
    expect(frame.text[11].startsWith("(rename-window) api")).toBe(true)
    expect(frame.cursor).toEqual({ x: 19, y: 11 })
  })

  it("shows the client's shell instead of the session while detached", () => {
    const state = applyKey(applyKey(twoPanes(), prefix, "tmux"), key("d"), "tmux")
    const frame = render(state, "tmux")
    expect(frame.text[0]).toContain("[detached (from session work)]")
    expect(frame.text.join("\n")).not.toContain("[work]")
    expect(frame.text.join("\n")).not.toContain("│")
  })

  it("marks the prefix as armed in the status line", () => {
    const state = applyKey(twoPanes(), prefix, "tmux")
    const frame = render(state, "tmux")
    expect(frame.rows[11]).toContain("48;2;203;166;247")
  })

  it("reports hit regions for panes, tabs, and workspaces", () => {
    const frame = render(twoPanes(), "herdr", { cols: 100 })
    expect(hitTest(frame.regions, 1, 1)).toEqual({ kind: "workspace", index: 0 })
    expect(hitTest(frame.regions, 25, 0)).toEqual({ kind: "tab", index: 0 })
    expect(hitTest(frame.regions, 90, 5)).toEqual({ kind: "pane", id: 1 })
  })

  it("lets a zoomed pane take the whole area", () => {
    const state = applyKey(applyKey(twoPanes(), prefix, "tmux"), key("z"), "tmux")
    const frame = render(state, "tmux")
    expect(frame.text[0]).not.toContain("│")
    expect(frame.text[11]).toContain("0:zsh*Z")
  })
})
