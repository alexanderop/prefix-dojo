import { describe, expect, it } from "vitest"
import { bindings, modeHint, PREFIX, taskKeys } from "./bindings"
import { applyKey, initialState, leaf, type KeyInput, type Keymap } from "./multiplexer"
import { lessons } from "../lessons"

const ARROWS: Record<string, string> = {
  "←": "ArrowLeft",
  "→": "ArrowRight",
  "↑": "ArrowUp",
  "↓": "ArrowDown",
}

function toInput(label: string): KeyInput {
  if (label === PREFIX) return { key: "b", ctrl: true, alt: false, shift: false }
  if (label.startsWith("shift+")) {
    return { key: label.slice(6).toUpperCase(), ctrl: false, alt: false, shift: true }
  }
  return { key: ARROWS[label] ?? label, ctrl: false, alt: false, shift: false }
}

function afterPrefix(keymap: Keymap, label: string) {
  const start = initialState({
    root: { kind: "split", dir: "row", children: [leaf(0), leaf(1)] },
    activePaneId: 0,
    tabs: 2,
  })
  const armed = applyKey(start, toInput(PREFIX), keymap)
  return applyKey(armed, toInput(label), keymap)
}

describe("binding reference table", () => {
  for (const keymap of ["tmux", "herdr"] as const) {
    it(`every listed ${keymap} key is handled by the engine`, () => {
      const labels = bindings[keymap].flatMap((group) => group.items.flatMap((item) => item.keys))
      for (const label of labels) {
        const next = afterPrefix(keymap, label)
        expect(next.lastAction, `${keymap} prefix + ${label}`).not.toMatch(/no binding/)
      }
    })
  }

  it("names every key a keyboard lesson asks for", () => {
    for (const lesson of lessons.filter((item) => item.input === "keyboard")) {
      const known = new Set(
        bindings[lesson.keymap].flatMap((group) => group.items.flatMap((item) => item.keys)),
      )
      const prefixed = taskKeys(lesson.task).filter((key) => known.has(key))
      expect(prefixed.length, lesson.slug).toBeGreaterThan(0)
    }
  })
})

describe("taskKeys", () => {
  it("drops the prefix and duplicates", () => {
    expect(taskKeys("Press [ctrl+b] then [%]. Then [ctrl+b] [%] again.")).toEqual(["%"])
  })

  it("reads a bracket key", () => {
    expect(taskKeys("Enter copy mode with [ctrl+b] [[].")).toEqual(["["])
  })
})

describe("modeHint", () => {
  it("offers only the prefix while typing goes to the shell", () => {
    const hint = modeHint({ kind: "terminal" }, "tmux")
    expect(hint.keys.map((item) => item.keys)).toEqual([[PREFIX]])
  })

  it("lists the whole keymap once the prefix is armed", () => {
    const hint = modeHint({ kind: "prefix" }, "herdr")
    expect(hint.keys.some((item) => item.keys.includes("v"))).toBe(true)
  })
})
