import { describe, expect, it } from "vitest"
import {
  applyKey,
  applyShellCommand,
  did,
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
    const state = press(
      start(),
      "tmux",
      prefix,
      key("["),
      key("PageUp"),
      key("q"),
    )
    expect(state.mode.kind).toBe("terminal")
    expect(did(state, "entered-copy-mode")).toBe(true)
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
  const twoTabs = () =>
    initialState({ root: leaf(0), activePaneId: 0, tabs: 2, activeTab: 1 })
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
