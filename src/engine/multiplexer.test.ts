import { describe, expect, it } from "vitest"
import {
  agentSummaries,
  applyKey,
  applyShellCommand,
  containsPane,
  did,
  executeShellCommand,
  initialState,
  leaf,
  leaves,
  paneRects,
  type KeyInput,
  type Keymap,
  type TrainerState,
} from "./multiplexer"

function key(value: string, modifiers: Partial<KeyInput> = {}): KeyInput {
  return { key: value, ctrl: false, alt: false, shift: false, ...modifiers }
}

function press(state: TrainerState, keymap: Keymap, ...inputs: KeyInput[]): TrainerState {
  return inputs.reduce((next, input) => applyKey(next, input, keymap), state)
}

function start(): TrainerState {
  return initialState({ root: leaf(0), activePaneId: 0 })
}

const prefix = key("b", { ctrl: true })

describe("prefix handling", () => {
  it("leaves ordinary terminal input alone", () => {
    const state = press(start(), "tmux", key("%"))
    expect(state.root.kind).toBe("leaf")
    expect(state.mode.kind).toBe("terminal")
  })

  it("arms for one command, then returns to terminal mode", () => {
    let state = press(start(), "tmux", prefix)
    expect(state.mode.kind).toBe("prefix")
    state = press(state, "tmux", key("%"))
    expect(state.mode.kind).toBe("terminal")
    expect(did(state, "split-right")).toBe(true)
  })

  it("sends a literal ctrl+b when the prefix is pressed twice", () => {
    const state = press(start(), "tmux", prefix, prefix)
    expect(state.mode.kind).toBe("terminal")
    expect(state.lastAction).toContain("literal ctrl+b")
  })
})

describe("tmux pane work", () => {
  it("creates both split directions and focuses each new pane", () => {
    let state = press(start(), "tmux", prefix, key("%"))
    expect(state.root.kind === "split" && state.root.dir).toBe("row")
    expect(state.activePaneId).toBe(1)

    state = press(state, "tmux", prefix, key('"'))
    expect(leaves(state.root)).toHaveLength(3)
    expect(did(state, "split-down")).toBe(true)
    expect(state.activePaneId).toBe(2)
  })

  it("moves focus spatially", () => {
    let state = press(start(), "tmux", prefix, key("%"))
    state = press(state, "tmux", prefix, key("ArrowLeft"))
    expect(state.activePaneId).toBe(0)
    state = press(state, "tmux", prefix, key("ArrowRight"))
    expect(state.activePaneId).toBe(1)
  })

  it("zooms without deleting the underlying layout", () => {
    let state = press(start(), "tmux", prefix, key("%"), prefix, key("z"))
    expect(state.zoomedPaneId).toBe(1)
    expect(leaves(state.root)).toHaveLength(2)
    expect(containsPane(state.root, 0)).toBe(true)
    expect(containsPane(state.root, 1)).toBe(true)
    expect(containsPane(state.root, 99)).toBe(false)

    state = press(state, "tmux", prefix, key("z"))
    expect(state.zoomedPaneId).toBeNull()
    expect(leaves(state.root)).toHaveLength(2)
  })

  it("closes the focused pane and preserves the other pane", () => {
    let state = press(start(), "tmux", prefix, key("%"), prefix, key("x"))
    expect(state.root).toMatchObject({ kind: "leaf", id: 0 })
    expect(state.activePaneId).toBe(0)

    state = press(state, "tmux", prefix, key("x"))
    expect(state.root.kind).toBe("leaf")
    expect(state.lastAction).toContain("last pane")
  })
})

describe("tmux windows, copy mode, and sessions", () => {
  it("creates a window and switches back", () => {
    let state = press(start(), "tmux", prefix, key("c"))
    expect(state.tabs).toBe(2)
    expect(state.activeTab).toBe(1)
    state = press(state, "tmux", prefix, key("p"))
    expect(state.activeTab).toBe(0)
  })

  it("browses and exits copy mode", () => {
    const state = press(start(), "tmux", prefix, key("["), key("PageUp"), key("q"))
    expect(state.mode.kind).toBe("terminal")
    expect(did(state, "entered-copy-mode")).toBe(true)
  })

  it("does not accept Herdr's vi selection keys", () => {
    const state = press(start(), "tmux", prefix, key("["), key("v"), key("y"))

    expect(did(state, "copied-selection")).toBe(false)
    expect(state.mode.kind).toBe("copy")
  })

  it("detaches with prefix d", () => {
    const state = press(start(), "tmux", prefix, key("d"))
    expect(state.detached).toBe(true)
    expect(did(state, "detached")).toBe(true)
  })
})

describe("Herdr actions", () => {
  it("uses v and minus for the two split directions", () => {
    const state = press(start(), "herdr", prefix, key("v"), prefix, key("-"))
    expect(leaves(state.root)).toHaveLength(3)
    expect(did(state, "split-right")).toBe(true)
    expect(did(state, "split-down")).toBe(true)
  })

  it("creates and selects workspaces through their real modes", () => {
    let state = press(start(), "herdr", prefix, key("N", { shift: true }))
    expect(state.workspaces).toEqual(["project", "workspace-2"])

    state = initialState({
      root: leaf(0),
      activePaneId: 0,
      workspaces: ["api", "webapp"],
    })
    state = press(state, "herdr", prefix, key("w"), key("ArrowDown"), key("Enter"))
    expect(state.activeWorkspace).toBe(1)
    expect(did(state, "switched-workspace")).toBe(true)
  })

  it("resizes in a persistent resize mode", () => {
    const state = press(start(), "herdr", prefix, key("r"), key("l"))
    expect(state.mode.kind).toBe("resize")
    expect(did(state, "resized-pane")).toBe(true)
  })

  it("detaches with q, not the tmux d binding", () => {
    const herdr = press(start(), "herdr", prefix, key("q"))
    const tmux = press(start(), "tmux", prefix, key("q"))
    expect(herdr.detached).toBe(true)
    expect(tmux.detached).toBe(false)
  })
})

describe("Herdr shell automation", () => {
  it.each([
    ["herdr", "started-herdr"],
    ["herdr --remote workbox", "remote-attached"],
    ["herdr integration install codex", "installed-integration"],
    ["herdr pane split --current --direction right", "automated-pane"],
    ["herdr plugin list", "listed-plugins"],
  ] as const)("recognizes %s", (command, action) => {
    const state = applyShellCommand(start(), command, "herdr")
    expect(did(state, action)).toBe(true)
  })

  it("creates a real simulated pane for the CLI split command", () => {
    const state = applyShellCommand(
      start(),
      "herdr pane split --current --direction right",
      "herdr",
    )
    expect(leaves(state.root)).toHaveLength(2)
  })
})

describe("tmux shell lifecycle", () => {
  it("creates a named session from a normal shell", () => {
    const state = applyShellCommand(start(), "tmux new -s work", "tmux")
    expect(did(state, "started-tmux")).toBe(true)
  })
})

describe("layout rectangles", () => {
  it("partitions nested splits", () => {
    const state = press(start(), "tmux", prefix, key("%"), prefix, key('"'))
    const rects = paneRects(state.root)
    expect(rects.size).toBe(3)
    expect(rects.get(0)).toEqual({ x: 0, y: 0, w: 0.5, h: 1 })
    expect(rects.get(1)).toEqual({ x: 0.5, y: 0, w: 0.5, h: 0.5 })
    expect(rects.get(2)).toEqual({ x: 0.5, y: 0.5, w: 0.5, h: 0.5 })
  })
})

describe("numbered window and tab jumps", () => {
  const twoTabs = () => initialState({ root: leaf(0), activePaneId: 0, tabs: 2, activeTab: 1 })
  const prefix = { key: "b", ctrl: true, alt: false, shift: false }
  const digit = (key: string) => ({ key, ctrl: false, alt: false, shift: false })

  it("tmux counts windows from 0", () => {
    const next = applyKey(applyKey(twoTabs(), prefix, "tmux"), digit("0"), "tmux")
    expect(next.activeTab).toBe(0)
    expect(next.lastAction).toBe("selected window 0")
  })

  it("Herdr counts tabs from 1", () => {
    const next = applyKey(applyKey(twoTabs(), prefix, "herdr"), digit("1"), "herdr")
    expect(next.activeTab).toBe(0)
    expect(next.lastAction).toBe("selected tab 1")
  })

  it("reports a missing window instead of falling through", () => {
    const next = applyKey(applyKey(twoTabs(), prefix, "tmux"), digit("7"), "tmux")
    expect(next.activeTab).toBe(1)
    expect(next.lastAction).toBe("no window 7")
  })
})

describe("Herdr pane swap and cycle", () => {
  const twoPanes = () =>
    initialState({
      root: { kind: "split", dir: "row", children: [leaf(0, ["agent"]), leaf(1, ["server"])] },
      activePaneId: 0,
    })

  it("swaps the focused pane with its neighbor and keeps focus on it", () => {
    const state = press(twoPanes(), "herdr", prefix, key("L", { shift: true }))
    expect(leaves(state.root).map((pane) => pane.id)).toEqual([1, 0])
    expect(state.activePaneId).toBe(0)
    expect(did(state, "swapped-pane")).toBe(true)
  })

  it("rejects a swap with no neighbor in that direction", () => {
    const state = press(twoPanes(), "herdr", prefix, key("H", { shift: true }))
    expect(state.lastAction).toMatch(/^no neighbor/)
    expect(did(state, "swapped-pane")).toBe(false)
  })

  it("cycles forward with tab and backward with shift+tab", () => {
    let state = press(twoPanes(), "herdr", prefix, key("Tab"))
    expect(state.activePaneId).toBe(1)
    expect(did(state, "cycled-pane")).toBe(true)
    state = press(state, "herdr", prefix, key("Tab", { shift: true }))
    expect(state.activePaneId).toBe(0)
  })
})

describe("Herdr closing tabs and workspaces", () => {
  it("closes the active tab and refuses to close the last one", () => {
    let state = initialState({ root: leaf(0), activePaneId: 0, tabs: 2, activeTab: 1 })
    state = press(state, "herdr", prefix, key("X", { shift: true }))
    expect(state.tabs).toBe(1)
    expect(state.activeTab).toBe(0)
    expect(did(state, "closed-tab")).toBe(true)

    state = press(state, "herdr", prefix, key("X", { shift: true }))
    expect(state.tabs).toBe(1)
    expect(state.lastAction).toBe("cannot close the last tab")
  })

  it("keeps the names of the remaining tabs", () => {
    let state = initialState({ root: leaf(0), activePaneId: 0, tabs: 3, activeTab: 1 })
    state = { ...state, tabNames: { 0: "main", 2: "logs" } }
    state = press(state, "herdr", prefix, key("X", { shift: true }))
    expect(state.tabNames).toEqual({ 0: "main", 1: "logs" })
  })

  it("closes the active workspace and refuses to close the last one", () => {
    let state = initialState({
      root: leaf(0),
      activePaneId: 0,
      workspaces: ["api", "webapp"],
      activeWorkspace: 1,
    })
    state = press(state, "herdr", prefix, key("D", { shift: true }))
    expect(state.workspaces).toEqual(["api"])
    expect(state.activeWorkspace).toBe(0)
    expect(did(state, "closed-workspace")).toBe(true)

    state = press(state, "herdr", prefix, key("D", { shift: true }))
    expect(state.lastAction).toBe("cannot close the last workspace")
  })
})

describe("Herdr rename mode", () => {
  const type = (text: string) => [...text].map((char) => key(char))

  it("renames the active tab from typed text", () => {
    const state = press(
      start(),
      "herdr",
      prefix,
      key("T", { shift: true }),
      ...type("review"),
      key("Enter"),
    )
    expect(state.tabNames[0]).toBe("review")
    expect(state.mode.kind).toBe("terminal")
    expect(did(state, "renamed-tab")).toBe(true)
  })

  it("renames the workspace and the pane through their own bindings", () => {
    let state = press(
      start(),
      "herdr",
      prefix,
      key("W", { shift: true }),
      ...type("api"),
      key("Enter"),
    )
    expect(state.workspaces[0]).toBe("api")
    expect(did(state, "renamed-workspace")).toBe(true)

    state = press(state, "herdr", prefix, key("P", { shift: true }), ...type("tests"), key("Enter"))
    expect(state.paneNames[0]).toBe("tests")
    expect(did(state, "renamed-pane")).toBe(true)
  })

  it("ignores modifier chords while a name is being typed", () => {
    const state = press(
      start(),
      "herdr",
      prefix,
      key("T", { shift: true }),
      prefix,
      key("b", { ctrl: true }),
    )
    expect(state.mode).toEqual({ kind: "rename", target: "tab", value: "" })
    expect(state.lastAction).toBe("type a name, then enter")
  })

  it("supports backspace, rejects an empty name, and cancels with escape", () => {
    let state = press(
      start(),
      "herdr",
      prefix,
      key("T", { shift: true }),
      key("a"),
      key("Backspace"),
    )
    expect(state.mode).toEqual({ kind: "rename", target: "tab", value: "" })

    state = press(state, "herdr", key("Enter"))
    expect(state.mode.kind).toBe("rename")
    expect(state.lastAction).toBe("name cannot be empty")

    state = press(state, "herdr", key("Escape"))
    expect(state.mode.kind).toBe("terminal")
    expect(state.tabNames).toEqual({})
  })
})

describe("Herdr notification target", () => {
  it("jumps to the pane a notification points at, once", () => {
    const base = initialState({
      root: { kind: "split", dir: "row", children: [leaf(0), leaf(1, ["claude  ● blocked"])] },
      activePaneId: 0,
      notificationPaneId: 1,
    })
    let state = press(base, "herdr", prefix, key("o"))
    expect(state.activePaneId).toBe(1)
    expect(did(state, "opened-notification")).toBe(true)

    state = press(state, "herdr", prefix, key("o"))
    expect(state.lastAction).toBe("no visible notification to open")
  })

  it("records the session navigator opening", () => {
    const state = press(start(), "herdr", prefix, key("g"), key("Escape"))
    expect(did(state, "opened-goto")).toBe(true)
    expect(state.mode.kind).toBe("terminal")
  })
})

describe("Herdr copy-mode search", () => {
  const history = () =>
    initialState({
      root: leaf(0, ["auth passed", "\x1b[31msession FAILED\x1b[0m", "cache failed"]),
      activePaneId: 0,
    })
  const type = (text: string) => [...text].map((char) => key(char))

  it("collects the query, counts case-insensitive matches, and repeats with n", () => {
    let state = press(history(), "herdr", prefix, key("["), key("/"), ...type("failed"))
    expect(state.mode).toMatchObject({ kind: "copy", search: { query: "failed", typing: true } })

    state = press(state, "herdr", key("Enter"))
    expect(state.mode).toMatchObject({ kind: "copy", search: { matches: 2, typing: false } })
    expect(did(state, "searched-history")).toBe(true)

    state = press(state, "herdr", key("n"))
    expect(did(state, "repeated-search")).toBe(true)
    state = press(state, "herdr", key("N", { shift: true }))
    expect(state.lastAction).toBe("jumped to the previous match")
  })

  it("ignores modifier chords while the query is being typed", () => {
    const state = press(history(), "herdr", prefix, key("["), key("/"), prefix)
    expect(state.mode).toMatchObject({ search: { query: "", typing: true } })
  })

  it("is case-sensitive once the query has an uppercase letter", () => {
    const state = press(
      history(),
      "herdr",
      prefix,
      key("["),
      key("/"),
      ...type("FAILED"),
      key("Enter"),
    )
    expect(state.mode).toMatchObject({ search: { matches: 1 } })
  })

  it("reports a miss and refuses to repeat without a hit", () => {
    let state = press(history(), "herdr", prefix, key("["), key("n"))
    expect(state.lastAction).toBe("no search to repeat")

    state = press(state, "herdr", key("/"), ...type("nope"), key("Enter"))
    expect(state.lastAction).toBe('no match for "nope"')
    expect(did(state, "searched-history")).toBe(false)
  })

  it("clears the search with escape before leaving copy mode", () => {
    let state = press(
      history(),
      "herdr",
      prefix,
      key("["),
      key("/"),
      ...type("failed"),
      key("Enter"),
    )
    state = press(state, "herdr", key("Escape"))
    expect(state.mode).toEqual({ kind: "copy", selecting: false, search: null })
    state = press(state, "herdr", key("Escape"))
    expect(state.mode.kind).toBe("terminal")
  })

  it("does not accept tmux's emacs selection keys", () => {
    const state = press(history(), "herdr", prefix, key("["), key(" "), key("Enter"))

    expect(did(state, "copied-selection")).toBe(false)
    expect(state.mode.kind).toBe("copy")
  })
})

describe("Herdr agent CLI", () => {
  const twoPanes = () =>
    initialState({
      root: {
        kind: "split",
        dir: "row",
        children: [leaf(0, [], "shell"), leaf(1, ["idle shell"])],
      },
      activePaneId: 0,
    })

  it.each([
    ["herdr server stop", "stopped-server"],
    ["herdr agent start reviewer --kind codex --pane w1:p2", "started-agent"],
    ["herdr agent start reviewer --kind codex --pane w1:p2 -- -m gpt-5.4", "started-agent"],
    ['herdr agent prompt reviewer "Review the current diff" --wait', "prompted-agent"],
    [
      'herdr agent prompt reviewer "Review the current diff" --wait --timeout 120000',
      "prompted-agent",
    ],
    ["herdr agent wait reviewer --until blocked", "waited-agent"],
    ["herdr agent read reviewer", "read-agent"],
    ["herdr agent read reviewer --source recent-unwrapped --lines 80", "read-agent"],
    ["herdr agent send-keys reviewer esc", "sent-agent-keys"],
    ["herdr agent attach reviewer", "attached-agent"],
    ["herdr agent explain w1:p2", "explained-agent"],
    ["npx skills add herdrdev/herdr --skill herdr -g", "installed-skill"],
  ] as const)("recognizes %s", (command, action) => {
    const initial = twoPanes()
    if (/agent (prompt|wait|read|send-keys|attach)/.test(command)) {
      initial.agentPanes.reviewer = 1
    }
    const state = applyShellCommand(initial, command, "herdr")
    expect(did(state, action)).toBe(true)
  })

  it("does not recognize Herdr commands on the tmux keymap", () => {
    const state = applyShellCommand(twoPanes(), "herdr server stop", "tmux")
    expect(state.actions).toEqual([])
  })

  it("puts the started agent into the targeted pane and moves it through states", () => {
    let state = applyShellCommand(
      twoPanes(),
      "herdr agent start reviewer --kind codex --pane w1:p2",
      "herdr",
    )
    expect(leaves(state.root)[1].lines[0]).toContain("● idle")
    expect(agentSummaries(state)).toContainEqual({ paneId: 1, name: "reviewer", state: "idle" })

    state = applyShellCommand(
      state,
      'herdr agent prompt reviewer "Review the current diff" --wait',
      "herdr",
    )
    expect(leaves(state.root)[1].lines[0]).toContain("● done")

    state = applyShellCommand(state, "herdr agent wait reviewer --until blocked", "herdr")
    expect(leaves(state.root)[1].lines[0]).toContain("● blocked")
  })

  it("rejects commands that target a pane or agent that does not exist", () => {
    let state = applyShellCommand(
      twoPanes(),
      "herdr agent start reviewer --kind codex --pane w1:p999",
      "herdr",
    )
    state = applyShellCommand(state, 'herdr agent prompt reviewer "Review this" --wait', "herdr")

    expect(did(state, "started-agent")).toBe(false)
    expect(did(state, "prompted-agent")).toBe(false)
    expect(state.agentPanes).toEqual({})
    expect(state.lastAction).toBe("no agent named reviewer")
  })

  it("removes a named agent when its pane closes", () => {
    const base = initialState({
      root: { kind: "split", dir: "row", children: [leaf(0), leaf(1, ["codex  ● idle"])] },
      activePaneId: 1,
      agentPanes: { reviewer: 1 },
    })

    const state = press(base, "herdr", prefix, key("x"))

    expect(state.agentPanes).toEqual({})
  })

  it("keeps focus in the caller pane when a CLI split uses --no-focus", () => {
    const result = executeShellCommand(
      initialState({ root: leaf(0, [], "shell"), activePaneId: 0 }),
      "herdr pane split --current --direction right --no-focus",
      "herdr",
    )
    const state = result.state

    expect(leaves(state.root)).toHaveLength(2)
    expect(state.activePaneId).toBe(0)
    expect(result.output?.join("\n")).toContain("created")
    expect(result.output?.join("\n")).not.toContain("already showing")
  })

  it("creates a focused worktree workspace and runs a named agent there", () => {
    let state = applyShellCommand(
      initialState({ root: leaf(0, [], "shell"), activePaneId: 0, workspaces: ["webapp"] }),
      "herdr worktree create --cwd ~/projects/webapp --branch fix/session-timeout --base main --label session-timeout --focus",
      "herdr",
    )
    expect(state.workspaces).toEqual(["webapp", "session-timeout"])
    expect(state.activeWorkspace).toBe(1)

    state = applyShellCommand(
      state,
      "herdr pane split --current --direction right --no-focus",
      "herdr",
    )
    state = applyShellCommand(
      state,
      "herdr agent start implementer --kind codex --pane w2:p2",
      "herdr",
    )
    expect(state.agentPanes).toEqual({ implementer: 1 })
    expect(leaves(state.root)[0]).toMatchObject({ variant: "shell" })
    expect(leaves(state.root)[1]).toMatchObject({ variant: "static" })

    state = applyShellCommand(
      state,
      'herdr agent prompt implementer "Fix the flaky test." --wait --timeout 120000',
      "herdr",
    )
    expect(leaves(state.root)[1].lines).toEqual(
      expect.arrayContaining([
        expect.stringContaining("implementer · finished: Fix the flaky test."),
      ]),
    )
  })

  it("reads a blocked agent before sending a deliberate key", () => {
    let state = initialState({
      root: {
        kind: "split",
        dir: "row",
        children: [leaf(0, [], "shell"), leaf(1, ["codex  ● blocked"])],
      },
      activePaneId: 0,
      agentPanes: { reviewer: 1 },
    })

    state = applyShellCommand(
      state,
      "herdr agent wait reviewer --until blocked --timeout 120000",
      "herdr",
    )
    state = applyShellCommand(state, "herdr agent read reviewer --source visible", "herdr")
    state = applyShellCommand(state, "herdr agent send-keys reviewer esc", "herdr")

    expect(did(state, "waited-agent")).toBe(true)
    expect(did(state, "read-agent")).toBe(true)
    expect(did(state, "sent-agent-keys")).toBe(true)
    expect(leaves(state.root)[1].lines[0]).toContain("● idle")
  })

  it("marks the server stopped as well as detached", () => {
    const state = applyShellCommand(twoPanes(), "herdr server stop", "herdr")
    expect(state.serverStopped).toBe(true)
    expect(state.detached).toBe(true)
  })
})

describe("rejected flag", () => {
  const start = initialState({ root: leaf(0), activePaneId: 0 })
  const prefix: KeyInput = { key: "b", ctrl: true, alt: false, shift: false }
  const press = (state: TrainerState, key: string, keymap: "tmux" | "herdr" = "tmux") =>
    applyKey(state, { key, ctrl: false, alt: false, shift: false }, keymap)

  it("is set when the prefix key has no binding", () => {
    const state = press(applyKey(start, prefix, "tmux"), "€")
    expect(state.rejected).toBe(true)
    expect(state.lastAction).toContain("no binding")
  })

  it("is set when a bound command has nothing to act on", () => {
    const state = press(applyKey(start, prefix, "tmux"), "x")
    expect(state.rejected).toBe(true)
    expect(state.lastAction).toBe("cannot close the last pane")
  })

  it("clears on the next accepted key", () => {
    const rejected = press(applyKey(start, prefix, "tmux"), "x")
    const next = press(applyKey(rejected, prefix, "tmux"), "%")
    expect(next.rejected).toBe(false)
  })

  it("is set by a shell command error and cleared by a good one", () => {
    const bad = applyShellCommand(start, "herdr agent attach ghost", "herdr")
    expect(bad.rejected).toBe(true)
    expect(applyShellCommand(bad, "herdr", "herdr").rejected).toBe(false)
  })
})
