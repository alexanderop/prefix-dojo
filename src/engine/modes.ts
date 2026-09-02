/**
 * Input handling for the modes that own the keyboard until the learner
 * leaves them: copy, resize, rename, and the workspace picker.
 */
import type { Tool } from "./bindings"
import { stripAnsi } from "./ansi"
import {
  activeLeaf,
  keyLabel,
  record,
  reject,
  type CopySearch,
  type KeyInput,
  type TrainerState,
} from "./state"

const MAX_NAME_LENGTH = 24

/** Herdr search is case-insensitive unless the query contains an uppercase letter. */
function countMatches(state: TrainerState, query: string): number {
  const pane = activeLeaf(state)
  if (pane === undefined) return 0
  const sensitive = /[A-Z]/.test(query)
  const needle = sensitive ? query : query.toLowerCase()
  return pane.lines.filter((line) => {
    const text = stripAnsi(line)
    return (sensitive ? text : text.toLowerCase()).includes(needle)
  }).length
}

function runCopySearchInput(state: TrainerState, search: CopySearch, input: KeyInput): void {
  if (input.ctrl || input.alt) return reject(state, "type the search term, then enter")
  if (input.key === "Escape") {
    state.mode = { kind: "copy", selecting: false, search: null }
    state.lastAction = "cancelled search"
    return
  }
  if (input.key === "Enter") {
    if (search.query === "") return reject(state, "type a search term first")
    const matches = countMatches(state, search.query)
    state.mode = { kind: "copy", selecting: false, search: { ...search, typing: false, matches } }
    if (matches === 0) return reject(state, `no match for "${search.query}"`)
    const where = search.direction === "forward" ? "next" : "previous"
    state.lastAction = `jumped to the ${where} of ${matches} ${matches === 1 ? "line" : "lines"} matching "${search.query}"`
    record(state, "searched-history")
    return
  }
  if (input.key === "Backspace") {
    state.mode = {
      kind: "copy",
      selecting: false,
      search: { ...search, query: search.query.slice(0, -1) },
    }
    return
  }
  if (input.key.length === 1) {
    state.mode = {
      kind: "copy",
      selecting: false,
      search: { ...search, query: search.query + input.key },
    }
    return
  }
  reject(state, "type the search term, then enter")
}

export function runCopyMode(state: TrainerState, input: KeyInput, tool: Tool): void {
  const mode = state.mode.kind === "copy" ? state.mode : { selecting: false, search: null }
  if (mode.search?.typing) return runCopySearchInput(state, mode.search, input)

  if (input.key === "Escape") {
    if (mode.selecting || mode.search !== null) {
      state.mode = { kind: "copy", selecting: false, search: null }
      state.lastAction = mode.selecting ? "cleared selection" : "cleared search"
      return
    }
    state.mode = { kind: "terminal" }
    state.lastAction = "left copy mode"
    return
  }
  if (input.key === "q") {
    state.mode = { kind: "terminal" }
    state.lastAction = "left copy mode"
    return
  }
  if (tool.copy.search && (input.key === "/" || input.key === "?")) {
    const direction = input.key === "/" ? "forward" : "backward"
    state.mode = {
      kind: "copy",
      selecting: false,
      search: { query: "", direction, typing: true, matches: 0 },
    }
    state.lastAction = direction === "forward" ? "search forward" : "search backward"
    return
  }
  if (tool.copy.search && input.key.toLowerCase() === "n") {
    if (mode.search === null || mode.search.matches === 0)
      return reject(state, "no search to repeat")
    const reverse = input.key === "N"
    state.lastAction = reverse ? "jumped to the previous match" : "jumped to the next match"
    record(state, "repeated-search")
    return
  }
  const label = keyLabel(input)
  if (label === tool.copy.select) {
    state.mode = { kind: "copy", selecting: true, search: mode.search }
    state.lastAction = "started selection"
    return
  }
  if (label === tool.copy.copy && mode.selecting) {
    state.mode = { kind: "terminal" }
    state.lastAction = "copied selection"
    record(state, "copied-selection")
    return
  }
  state.lastAction = `moved through history with ${input.key}`
}

export function runResizeMode(state: TrainerState, input: KeyInput): void {
  if (input.key === "Escape" || input.key === "Enter" || input.key === "q") {
    state.mode = { kind: "terminal" }
    state.lastAction = "left resize mode"
    return
  }
  if (["h", "j", "k", "l", "ArrowLeft", "ArrowDown", "ArrowUp", "ArrowRight"].includes(input.key)) {
    state.lastAction = `resized pane with ${input.key}`
    record(state, "resized-pane")
    return
  }
  reject(state, "resize mode expects h, j, k, l, or an arrow key")
}

export function runRenameMode(state: TrainerState, input: KeyInput): void {
  if (state.mode.kind !== "rename") return
  const { target, value } = state.mode

  if (input.ctrl || input.alt) return reject(state, "type a name, then enter")
  if (input.key === "Escape") {
    state.mode = { kind: "terminal" }
    state.lastAction = "cancelled rename"
    return
  }
  if (input.key === "Enter") {
    const name = value.trim()
    if (name === "") return reject(state, "name cannot be empty")
    if (target === "tab") {
      state.tabNames[state.activeTab] = name
      record(state, "renamed-tab")
    } else if (target === "workspace") {
      state.workspaces[state.activeWorkspace] = name
      record(state, "renamed-workspace")
    } else {
      state.paneNames[state.activePaneId] = name
      record(state, "renamed-pane")
    }
    state.mode = { kind: "terminal" }
    state.lastAction = `renamed the ${target} to ${name}`
    return
  }
  if (input.key === "Backspace") {
    state.mode = { kind: "rename", target, value: value.slice(0, -1) }
    return
  }
  if (input.key.length === 1 && value.length < MAX_NAME_LENGTH) {
    state.mode = { kind: "rename", target, value: value + input.key }
    return
  }
  reject(state, "type a name, then enter")
}

export function runWorkspacePicker(state: TrainerState, input: KeyInput): void {
  const selected = state.mode.kind === "workspace-picker" ? state.mode.selected : 0
  const count = state.workspaces.length

  if (input.key === "Escape" || input.key === "q") {
    state.mode = { kind: "terminal" }
    state.lastAction = "closed workspace navigation"
    return
  }
  if (input.key === "ArrowDown" || input.key === "j") {
    state.mode = { kind: "workspace-picker", selected: (selected + 1) % count }
    state.lastAction = "selected next workspace"
    return
  }
  if (input.key === "ArrowUp" || input.key === "k") {
    state.mode = { kind: "workspace-picker", selected: (selected - 1 + count) % count }
    state.lastAction = "selected previous workspace"
    return
  }
  if (input.key === "Enter" && state.mode.kind === "workspace-picker") {
    state.activeWorkspace = state.mode.selected
    state.mode = { kind: "terminal" }
    state.lastAction = `opened ${state.workspaces[state.activeWorkspace]}`
    record(state, "switched-workspace")
    return
  }
  reject(state, "use up or down, then enter")
}
