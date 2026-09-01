/**
 * Pure state machine for the practice terminal. The model mirrors the parts
 * of tmux and Herdr that the lessons exercise; the browser only renders it.
 */

export type SplitDir = "row" | "column"
export type PaneVariant = "shell" | "static"

export type PaneNode =
  | { kind: "leaf"; id: number; lines: string[]; variant: PaneVariant }
  | { kind: "split"; dir: SplitDir; children: [PaneNode, PaneNode] }

export type RenameTarget = "tab" | "workspace" | "pane"

export interface CopySearch {
  query: string
  direction: "forward" | "backward"
  /** True while the learner is still typing the query. */
  typing: boolean
  /** Lines of the focused pane that matched the last executed search. */
  matches: number
}

export type TrainerMode =
  | { kind: "terminal" }
  | { kind: "prefix" }
  | { kind: "copy"; selecting: boolean; search: CopySearch | null }
  | { kind: "resize" }
  | { kind: "workspace-picker"; selected: number }
  | { kind: "help" }
  | { kind: "goto" }
  | { kind: "rename"; target: RenameTarget; value: string }

export type TrainerAction =
  | "started-tmux"
  | "started-herdr"
  | "opened-help"
  | "split-right"
  | "split-down"
  | "focused-pane"
  | "swapped-pane"
  | "cycled-pane"
  | "closed-pane"
  | "zoomed-pane"
  | "opened-tab"
  | "switched-tab"
  | "closed-tab"
  | "renamed-tab"
  | "renamed-pane"
  | "entered-copy-mode"
  | "copied-selection"
  | "searched-history"
  | "repeated-search"
  | "detached"
  | "created-workspace"
  | "switched-workspace"
  | "renamed-workspace"
  | "closed-workspace"
  | "opened-goto"
  | "opened-notification"
  | "resized-pane"
  | "toggled-sidebar"
  | "created-worktree"
  | "remote-attached"
  | "installed-integration"
  | "automated-pane"
  | "listed-plugins"
  | "stopped-server"
  | "started-agent"
  | "prompted-agent"
  | "waited-agent"
  | "read-agent"
  | "sent-agent-keys"
  | "attached-agent"
  | "explained-agent"
  | "installed-skill"

export interface TrainerState {
  root: PaneNode
  activePaneId: number
  mode: TrainerMode
  keystrokes: number
  tabs: number
  activeTab: number
  /** Names given with rename; unnamed tabs fall back to their number. */
  tabNames: Record<number, string>
  paneNames: Record<number, string>
  workspaces: string[]
  activeWorkspace: number
  nextPaneId: number
  detached: boolean
  /** Set by `herdr server stop`: the session and every pane in it ended. */
  serverStopped: boolean
  zoomedPaneId: number | null
  sidebarVisible: boolean
  /** Pane a visible notification points at, for prefix + o. */
  notificationPaneId: number | null
  /** Stable CLI agent names mapped to the pane that currently owns them. */
  agentPanes: Record<string, number>
  actions: TrainerAction[]
  lastAction: string | null
}

export type Keymap = "tmux" | "herdr"

export interface KeyInput {
  key: string
  ctrl: boolean
  alt: boolean
  shift: boolean
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export type AgentState = "working" | "blocked" | "done" | "idle"

export interface AgentSummary {
  paneId: number
  name: string
  state: AgentState
}

export interface ShellCommandResult {
  state: TrainerState
  output: string[] | null
}

interface InitialStateInput {
  root: PaneNode
  activePaneId: number
  tabs?: number
  activeTab?: number
  workspaces?: string[]
  activeWorkspace?: number
  notificationPaneId?: number
  agentPanes?: Record<string, number>
}

const NEW_PANE_LINES = ["\x1b[90m# fresh pane. run a shell, server, or agent here\x1b[0m"]
const MAX_NAME_LENGTH = 24

export function leaf(
  id: number,
  lines: string[] = [],
  variant: PaneVariant = "static",
): Extract<PaneNode, { kind: "leaf" }> {
  return { kind: "leaf", id, lines, variant }
}

export function initialState(input: InitialStateInput): TrainerState {
  const workspaces = input.workspaces ?? ["project"]
  return {
    root: input.root,
    activePaneId: input.activePaneId,
    mode: { kind: "terminal" },
    keystrokes: 0,
    tabs: input.tabs ?? 1,
    activeTab: input.activeTab ?? 0,
    tabNames: {},
    paneNames: {},
    workspaces,
    activeWorkspace: input.activeWorkspace ?? 0,
    nextPaneId: maxPaneId(input.root) + 1,
    detached: false,
    serverStopped: false,
    zoomedPaneId: null,
    sidebarVisible: true,
    notificationPaneId: input.notificationPaneId ?? null,
    agentPanes: { ...input.agentPanes },
    actions: [],
    lastAction: null,
  }
}

export function leaves(node: PaneNode): Extract<PaneNode, { kind: "leaf" }>[] {
  if (node.kind === "leaf") return [node]
  return [...leaves(node.children[0]), ...leaves(node.children[1])]
}

export function containsPane(node: PaneNode, paneId: number): boolean {
  if (node.kind === "leaf") return node.id === paneId
  return containsPane(node.children[0], paneId) || containsPane(node.children[1], paneId)
}

function agentStateFromLine(line: string): AgentState | null {
  const value = /●\s*(blocked|working|done|idle)/.exec(line)?.[1]
  switch (value) {
    case "working":
    case "blocked":
    case "done":
    case "idle":
      return value
    default:
      return null
  }
}

export function agentSummaries(state: TrainerState): AgentSummary[] {
  const namesByPane = new Map<number, string>()
  for (const [name, paneId] of Object.entries(state.agentPanes)) namesByPane.set(paneId, name)

  return leaves(state.root).flatMap((pane) => {
    const first = (pane.lines[0] ?? "").replace(/\x1b\[[0-9;]*m/g, "").trim()
    const process = /^(\S+)\s+●/.exec(first)?.[1]
    const agentState = agentStateFromLine(first)
    if (process === undefined || agentState === null) return []
    return [{
      paneId: pane.id,
      name: namesByPane.get(pane.id) ?? process,
      state: agentState,
    }]
  })
}

export function did(state: TrainerState, action: TrainerAction): boolean {
  return state.actions.includes(action)
}

/** Herdr addresses panes as `w1:p<n>`; the trainer numbers its panes from 0. */
export function paneTarget(id: number): string {
  return `w1:p${id + 1}`
}

function maxPaneId(node: PaneNode): number {
  return Math.max(...leaves(node).map((pane) => pane.id))
}

function record(state: TrainerState, action: TrainerAction): void {
  if (!state.actions.includes(action)) state.actions.push(action)
}

/** Normalized 0..1 rectangles per pane, used for spatial navigation. */
export function paneRects(
  node: PaneNode,
  rect: Rect = { x: 0, y: 0, w: 1, h: 1 },
  out: Map<number, Rect> = new Map(),
): Map<number, Rect> {
  if (node.kind === "leaf") {
    out.set(node.id, rect)
    return out
  }
  const [first, second] = node.children
  if (node.dir === "row") {
    const half = rect.w / 2
    paneRects(first, { x: rect.x, y: rect.y, w: half, h: rect.h }, out)
    paneRects(second, { x: rect.x + half, y: rect.y, w: half, h: rect.h }, out)
  } else {
    const half = rect.h / 2
    paneRects(first, { x: rect.x, y: rect.y, w: rect.w, h: half }, out)
    paneRects(second, { x: rect.x, y: rect.y + half, w: rect.w, h: half }, out)
  }
  return out
}

type Direction = "left" | "right" | "up" | "down"

const DIRECTION_WORDS: Record<Direction, string> = {
  left: "to the left",
  right: "to the right",
  up: "above",
  down: "below",
}

/** Nearest pane whose centre lies in the given direction from the focused pane. */
function neighbor(state: TrainerState, direction: Direction): number | null {
  const rects = paneRects(state.root)
  const from = rects.get(state.activePaneId)
  if (from === undefined) return null

  const fromX = from.x + from.w / 2
  const fromY = from.y + from.h / 2
  let best: { id: number; distance: number } | null = null

  for (const [id, rect] of rects) {
    if (id === state.activePaneId) continue
    const x = rect.x + rect.w / 2
    const y = rect.y + rect.h / 2
    const isInDirection =
      (direction === "left" && x < fromX) ||
      (direction === "right" && x > fromX) ||
      (direction === "up" && y < fromY) ||
      (direction === "down" && y > fromY)
    if (!isInDirection) continue

    const distance = (x - fromX) ** 2 + (y - fromY) ** 2
    if (best === null || distance < best.distance) best = { id, distance }
  }

  return best?.id ?? null
}

function navigate(state: TrainerState, direction: Direction): void {
  const target = neighbor(state, direction)
  if (target === null) {
    state.lastAction = `no pane ${DIRECTION_WORDS[direction]}`
    return
  }

  state.activePaneId = target
  state.zoomedPaneId = null
  state.lastAction = `focused pane ${target}`
  record(state, "focused-pane")
}

function mapLeaves(node: PaneNode, transform: (pane: Extract<PaneNode, { kind: "leaf" }>) => PaneNode): PaneNode {
  if (node.kind === "leaf") return transform(node)
  return {
    kind: "split",
    dir: node.dir,
    children: [mapLeaves(node.children[0], transform), mapLeaves(node.children[1], transform)],
  }
}

function replaceNode(node: PaneNode, targetId: number, replacement: PaneNode): PaneNode {
  return mapLeaves(node, (pane) => (pane.id === targetId ? replacement : pane))
}

/** Exchange the positions of two panes without changing what runs in them. */
function swapPanes(state: TrainerState, direction: Direction): void {
  const target = neighbor(state, direction)
  if (target === null) {
    state.lastAction = `no neighbor ${DIRECTION_WORDS[direction]} to swap with`
    return
  }
  const panes = leaves(state.root)
  const active = panes.find((pane) => pane.id === state.activePaneId)
  const other = panes.find((pane) => pane.id === target)
  if (active === undefined || other === undefined) return

  state.root = mapLeaves(state.root, (pane) => {
    if (pane.id === active.id) return other
    if (pane.id === other.id) return active
    return pane
  })
  state.zoomedPaneId = null
  state.lastAction = `swapped with the pane ${DIRECTION_WORDS[direction]}`
  record(state, "swapped-pane")
}

function cyclePane(state: TrainerState, step: 1 | -1): void {
  const panes = leaves(state.root)
  const index = panes.findIndex((pane) => pane.id === state.activePaneId)
  state.activePaneId = panes[(index + step + panes.length) % panes.length].id
  state.zoomedPaneId = null
  state.lastAction = step === 1 ? "cycled to the next pane" : "cycled to the previous pane"
  record(state, "focused-pane")
  record(state, "cycled-pane")
}

function splitActive(state: TrainerState, direction: SplitDir): void {
  const active = leaves(state.root).find((pane) => pane.id === state.activePaneId)
  if (active === undefined) return

  const newPane = leaf(state.nextPaneId, [...NEW_PANE_LINES], "shell")
  state.root = replaceNode(state.root, active.id, {
    kind: "split",
    dir: direction,
    children: [active, newPane],
  })
  state.activePaneId = newPane.id
  state.nextPaneId += 1
  state.zoomedPaneId = null

  if (direction === "row") {
    state.lastAction = "split pane to the right"
    record(state, "split-right")
  } else {
    state.lastAction = "split pane below"
    record(state, "split-down")
  }
}

function removeLeaf(node: PaneNode, targetId: number): PaneNode | null {
  if (node.kind === "leaf") return node.id === targetId ? null : node
  const first = removeLeaf(node.children[0], targetId)
  const second = removeLeaf(node.children[1], targetId)
  if (first === null) return second
  if (second === null) return first
  return { kind: "split", dir: node.dir, children: [first, second] }
}

function closeActivePane(state: TrainerState): void {
  if (state.root.kind === "leaf") {
    state.lastAction = "cannot close the last pane"
    return
  }
  const closedPaneId = state.activePaneId
  const remaining = removeLeaf(state.root, closedPaneId)
  if (remaining === null) return
  state.root = remaining
  delete state.paneNames[closedPaneId]
  for (const [name, paneId] of Object.entries(state.agentPanes)) {
    if (paneId === closedPaneId) delete state.agentPanes[name]
  }
  if (state.notificationPaneId === closedPaneId) state.notificationPaneId = null
  state.activePaneId = leaves(remaining)[0].id
  state.zoomedPaneId = null
  state.lastAction = "closed pane"
  record(state, "closed-pane")
}

function toggleZoom(state: TrainerState): void {
  if (state.zoomedPaneId === null) {
    state.zoomedPaneId = state.activePaneId
    state.lastAction = `zoomed pane ${state.activePaneId}`
    record(state, "zoomed-pane")
  } else {
    state.zoomedPaneId = null
    state.lastAction = "restored pane layout"
  }
}

function newTab(state: TrainerState): void {
  state.tabs += 1
  state.activeTab = state.tabs - 1
  state.lastAction = `created tab ${state.activeTab + 1}`
  record(state, "opened-tab")
}

function cycleTab(state: TrainerState, step: 1 | -1): void {
  state.activeTab = (state.activeTab + step + state.tabs) % state.tabs
  state.lastAction = step === 1 ? "selected next tab" : "selected previous tab"
  record(state, "switched-tab")
}

/** tmux numbers windows from 0 by default; Herdr numbers tabs from 1. */
function switchTab(state: TrainerState, key: string, firstNumber: 0 | 1): boolean {
  if (!/^[0-9]$/.test(key)) return false
  const index = Number(key) - firstNumber
  if (index < 0 || index >= state.tabs) {
    state.lastAction = firstNumber === 0 ? `no window ${key}` : `no tab ${key}`
    return true
  }
  state.activeTab = index
  state.lastAction = firstNumber === 0 ? `selected window ${key}` : `selected tab ${key}`
  record(state, "switched-tab")
  return true
}

function closeActiveTab(state: TrainerState): void {
  if (state.tabs === 1) {
    state.lastAction = "cannot close the last tab"
    return
  }
  const closed = state.activeTab
  const names: Record<number, string> = {}
  for (const [key, name] of Object.entries(state.tabNames)) {
    const index = Number(key)
    if (index < closed) names[index] = name
    else if (index > closed) names[index - 1] = name
  }
  state.tabNames = names
  state.tabs -= 1
  state.activeTab = Math.min(closed, state.tabs - 1)
  state.lastAction = `closed tab ${closed + 1}`
  record(state, "closed-tab")
}

function closeActiveWorkspace(state: TrainerState): void {
  if (state.workspaces.length === 1) {
    state.lastAction = "cannot close the last workspace"
    return
  }
  const [closed] = state.workspaces.splice(state.activeWorkspace, 1)
  state.activeWorkspace = Math.min(state.activeWorkspace, state.workspaces.length - 1)
  state.lastAction = `closed workspace ${closed}`
  record(state, "closed-workspace")
}

function startRename(state: TrainerState, target: RenameTarget): void {
  state.mode = { kind: "rename", target, value: "" }
  state.lastAction = `renaming the ${target}; type a name, then enter`
}

function openNotificationTarget(state: TrainerState): void {
  if (state.notificationPaneId === null) {
    state.lastAction = "no visible notification to open"
    return
  }
  state.activePaneId = state.notificationPaneId
  state.notificationPaneId = null
  state.zoomedPaneId = null
  state.lastAction = `jumped to pane ${state.activePaneId}, the notification target`
  record(state, "focused-pane")
  record(state, "opened-notification")
}

function enterCopyMode(state: TrainerState): void {
  state.mode = { kind: "copy", selecting: false, search: null }
  state.lastAction = "entered copy mode"
  record(state, "entered-copy-mode")
}

function detach(state: TrainerState): void {
  state.detached = true
  state.mode = { kind: "terminal" }
  state.lastAction = "detached; processes keep running"
  record(state, "detached")
}

function openHelp(state: TrainerState): void {
  state.mode = { kind: "help" }
  state.lastAction = "opened active keybindings"
  record(state, "opened-help")
}

function runTmuxCommand(state: TrainerState, input: KeyInput): void {
  if (switchTab(state, input.key, 0)) return

  switch (input.key) {
    case "?":
      return openHelp(state)
    case "%":
      return splitActive(state, "row")
    case '"':
      return splitActive(state, "column")
    case "ArrowLeft":
      return navigate(state, "left")
    case "ArrowRight":
      return navigate(state, "right")
    case "ArrowUp":
      return navigate(state, "up")
    case "ArrowDown":
      return navigate(state, "down")
    case "o":
      return cyclePane(state, 1)
    case "x":
      return closeActivePane(state)
    case "z":
      return toggleZoom(state)
    case "c":
      return newTab(state)
    case "n":
      return cycleTab(state, 1)
    case "p":
      return cycleTab(state, -1)
    case "[":
      return enterCopyMode(state)
    case "d":
      return detach(state)
    default:
      state.lastAction = `tmux has no binding for prefix + ${input.key}`
  }
}

/** Herdr's shifted prefix bindings. Browsers report shift+t as "T". */
function runHerdrShiftedCommand(state: TrainerState, key: string): boolean {
  switch (key.toLowerCase()) {
    case "n":
      state.workspaces.push(`workspace-${state.workspaces.length + 1}`)
      state.activeWorkspace = state.workspaces.length - 1
      state.lastAction = `created ${state.workspaces[state.activeWorkspace]}`
      record(state, "created-workspace")
      return true
    case "g":
      state.lastAction = "opened Git worktree creation"
      record(state, "created-worktree")
      return true
    case "t":
      startRename(state, "tab")
      return true
    case "w":
      startRename(state, "workspace")
      return true
    case "p":
      startRename(state, "pane")
      return true
    case "x":
      closeActiveTab(state)
      return true
    case "d":
      closeActiveWorkspace(state)
      return true
    case "h":
      swapPanes(state, "left")
      return true
    case "j":
      swapPanes(state, "down")
      return true
    case "k":
      swapPanes(state, "up")
      return true
    case "l":
      swapPanes(state, "right")
      return true
    case "tab":
      cyclePane(state, -1)
      return true
    default:
      return false
  }
}

function runHerdrCommand(state: TrainerState, input: KeyInput): void {
  if (switchTab(state, input.key, 1)) return
  if (input.shift && runHerdrShiftedCommand(state, input.key)) return

  switch (input.key) {
    case "?":
      return openHelp(state)
    case "v":
      return splitActive(state, "row")
    case "-":
      return splitActive(state, "column")
    case "h":
      return navigate(state, "left")
    case "j":
      return navigate(state, "down")
    case "k":
      return navigate(state, "up")
    case "l":
      return navigate(state, "right")
    case "Tab":
      return cyclePane(state, 1)
    case "x":
      return closeActivePane(state)
    case "z":
      return toggleZoom(state)
    case "c":
      return newTab(state)
    case "n":
      return cycleTab(state, 1)
    case "p":
      return cycleTab(state, -1)
    case "[":
      return enterCopyMode(state)
    case "o":
      return openNotificationTarget(state)
    case "r":
      state.mode = { kind: "resize" }
      state.lastAction = "entered resize mode"
      return
    case "w":
      state.mode = { kind: "workspace-picker", selected: state.activeWorkspace }
      state.lastAction = "opened workspace navigation"
      return
    case "g":
      state.mode = { kind: "goto" }
      state.lastAction = "opened session navigator"
      record(state, "opened-goto")
      return
    case "b":
      state.sidebarVisible = !state.sidebarVisible
      state.lastAction = state.sidebarVisible ? "showed sidebar" : "hid sidebar"
      record(state, "toggled-sidebar")
      return
    case "q":
      return detach(state)
    default:
      state.lastAction = `Herdr has no binding for prefix + ${input.key}`
  }
}

const ANSI = /\x1b\[[0-9;]*m/g

/** Herdr search is case-insensitive unless the query contains an uppercase letter. */
function countMatches(state: TrainerState, query: string): number {
  const pane = leaves(state.root).find((item) => item.id === state.activePaneId)
  if (pane === undefined) return 0
  const sensitive = /[A-Z]/.test(query)
  const needle = sensitive ? query : query.toLowerCase()
  return pane.lines.filter((line) => {
    const text = line.replace(ANSI, "")
    return (sensitive ? text : text.toLowerCase()).includes(needle)
  }).length
}

function runCopySearchInput(state: TrainerState, search: CopySearch, input: KeyInput): void {
  if (input.ctrl || input.alt) {
    state.lastAction = "type the search term, then enter"
    return
  }
  if (input.key === "Escape") {
    state.mode = { kind: "copy", selecting: false, search: null }
    state.lastAction = "cancelled search"
    return
  }
  if (input.key === "Enter") {
    if (search.query === "") {
      state.lastAction = "type a search term first"
      return
    }
    const matches = countMatches(state, search.query)
    state.mode = { kind: "copy", selecting: false, search: { ...search, typing: false, matches } }
    if (matches === 0) {
      state.lastAction = `no match for "${search.query}"`
      return
    }
    const where = search.direction === "forward" ? "next" : "previous"
    state.lastAction = `jumped to the ${where} of ${matches} ${matches === 1 ? "line" : "lines"} matching "${search.query}"`
    record(state, "searched-history")
    return
  }
  if (input.key === "Backspace") {
    state.mode = { kind: "copy", selecting: false, search: { ...search, query: search.query.slice(0, -1) } }
    return
  }
  if (input.key.length === 1) {
    state.mode = { kind: "copy", selecting: false, search: { ...search, query: search.query + input.key } }
    return
  }
  state.lastAction = "type the search term, then enter"
}

function runCopyMode(state: TrainerState, input: KeyInput, keymap: Keymap): void {
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
  if (keymap === "herdr" && (input.key === "/" || input.key === "?")) {
    const direction = input.key === "/" ? "forward" : "backward"
    state.mode = {
      kind: "copy",
      selecting: false,
      search: { query: "", direction, typing: true, matches: 0 },
    }
    state.lastAction = direction === "forward" ? "search forward" : "search backward"
    return
  }
  if (keymap === "herdr" && input.key.toLowerCase() === "n") {
    if (mode.search === null || mode.search.matches === 0) {
      state.lastAction = "no search to repeat"
      return
    }
    const reverse = input.key === "N"
    state.lastAction = reverse ? "jumped to the previous match" : "jumped to the next match"
    record(state, "repeated-search")
    return
  }
  const startsSelection = keymap === "tmux" ? input.key === " " : input.key === "v"
  if (startsSelection) {
    state.mode = { kind: "copy", selecting: true, search: mode.search }
    state.lastAction = "started selection"
    return
  }
  const copiesSelection = keymap === "tmux" ? input.key === "Enter" : input.key === "y"
  if (copiesSelection && mode.selecting) {
    state.mode = { kind: "terminal" }
    state.lastAction = "copied selection"
    record(state, "copied-selection")
    return
  }
  state.lastAction = `moved through history with ${input.key}`
}

function runResizeMode(state: TrainerState, input: KeyInput): void {
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
  state.lastAction = "resize mode expects h, j, k, l, or an arrow key"
}

function runRenameMode(state: TrainerState, input: KeyInput): void {
  if (state.mode.kind !== "rename") return
  const { target, value } = state.mode

  if (input.ctrl || input.alt) {
    state.lastAction = "type a name, then enter"
    return
  }
  if (input.key === "Escape") {
    state.mode = { kind: "terminal" }
    state.lastAction = "cancelled rename"
    return
  }
  if (input.key === "Enter") {
    const name = value.trim()
    if (name === "") {
      state.lastAction = "name cannot be empty"
      return
    }
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
  state.lastAction = "type a name, then enter"
}

function runWorkspacePicker(state: TrainerState, input: KeyInput): void {
  if (input.key === "Escape" || input.key === "q") {
    state.mode = { kind: "terminal" }
    state.lastAction = "closed workspace navigation"
    return
  }

  if (input.key === "ArrowDown" || input.key === "j") {
    const selected = (state.mode.kind === "workspace-picker" ? state.mode.selected : 0) + 1
    state.mode = { kind: "workspace-picker", selected: selected % state.workspaces.length }
    state.lastAction = "selected next workspace"
    return
  }
  if (input.key === "ArrowUp" || input.key === "k") {
    const selected = state.mode.kind === "workspace-picker" ? state.mode.selected : 0
    state.mode = {
      kind: "workspace-picker",
      selected: (selected - 1 + state.workspaces.length) % state.workspaces.length,
    }
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
  state.lastAction = "use up or down, then enter"
}

export function applyKey(state: TrainerState, input: KeyInput, keymap: Keymap): TrainerState {
  const next = structuredClone(state)
  next.keystrokes += 1

  switch (next.mode.kind) {
    case "copy":
      runCopyMode(next, input, keymap)
      return next
    case "resize":
      runResizeMode(next, input)
      return next
    case "rename":
      runRenameMode(next, input)
      return next
    case "workspace-picker":
      runWorkspacePicker(next, input)
      return next
    case "help":
    case "goto":
      if (input.key === "Escape" || input.key === "q") {
        next.mode = { kind: "terminal" }
        next.lastAction = "closed overlay"
      }
      return next
    case "terminal":
      if (input.ctrl && input.key.toLowerCase() === "b") {
        next.mode = { kind: "prefix" }
        next.lastAction = "prefix armed"
      } else {
        next.lastAction = "sent key to the focused terminal"
      }
      return next
    case "prefix":
      if (input.ctrl && input.key.toLowerCase() === "b") {
        next.mode = { kind: "terminal" }
        next.lastAction = "sent a literal ctrl+b to the focused terminal"
        return next
      }
      next.mode = { kind: "terminal" }
      if (keymap === "tmux") runTmuxCommand(next, input)
      else runHerdrCommand(next, input)
      return next
  }
}

const C = "\x1b[36m"
const G = "\x1b[32;1m"
const Y = "\x1b[33;1m"
const B = "\x1b[34;1m"
const R = "\x1b[31m"
const DIM = "\x1b[90m"
const X = "\x1b[0m"

/** Replace what a static pane shows, so CLI-driven agents change the sidebar too. */
function setPaneLines(
  state: TrainerState,
  id: number,
  lines: string[],
  variant?: PaneVariant,
): void {
  state.root = mapLeaves(state.root, (pane) =>
    pane.id === id ? { ...pane, lines, variant: variant ?? pane.variant } : pane,
  )
}

function paneIdFromTarget(state: TrainerState, target: string): number | null {
  const match = /^w(\d+):p(\d+)$/.exec(target)
  if (match === null) return null
  const workspaceIndex = Number(match[1]) - 1
  const paneId = Number(match[2]) - 1
  if (workspaceIndex !== state.activeWorkspace) return null
  return containsPane(state.root, paneId) ? paneId : null
}

function namedAgentPane(state: TrainerState, name: string): number | null {
  const paneId = state.agentPanes[name]
  return paneId !== undefined && containsPane(state.root, paneId) ? paneId : null
}

function commandError(state: TrainerState, message: string): string[] {
  state.lastAction = message
  return [`${R}error${X}  ${message}`]
}

interface ShellCommandRule {
  keymap: Keymap
  pattern: RegExp
  run: (state: TrainerState, match: RegExpExecArray) => string[]
}

const SHELL_COMMANDS: ShellCommandRule[] = [
  {
    keymap: "tmux",
    pattern: /^tmux attach -t work$/,
    run: (state) => {
      state.lastAction = "attached to tmux session work"
      return [`${DIM}attached to session: work${X}`]
    },
  },
  {
    keymap: "tmux",
    pattern: /^tmux new -s work$/,
    run: (state) => {
      state.lastAction = "created and attached to tmux session work"
      record(state, "started-tmux")
      return [`${G}created${X}  session: work`]
    },
  },
  {
    keymap: "herdr",
    pattern: /^herdr$/,
    run: (state) => {
      state.lastAction = "started or attached to the default Herdr session"
      record(state, "started-herdr")
      return [`${G}attached${X}  default session · workspace: project`]
    },
  },
  {
    keymap: "herdr",
    pattern: /^herdr --remote workbox$/,
    run: (state) => {
      state.lastAction = "attached to workbox through SSH"
      record(state, "remote-attached")
      return [`${G}connected${X}  workbox · default session`]
    },
  },
  {
    keymap: "herdr",
    pattern: /^herdr integration install codex$/,
    run: (state) => {
      state.lastAction = "installed the Codex integration"
      record(state, "installed-integration")
      return [`${G}installed${X}  codex integration`]
    },
  },
  {
    keymap: "herdr",
    pattern: /^herdr pane split --current --direction right(?: --no-focus)?$/,
    run: (state, match) => {
      const activePaneId = state.activePaneId
      const createdPaneId = state.nextPaneId
      splitActive(state, "row")
      if (match[0].endsWith(" --no-focus")) state.activePaneId = activePaneId
      state.lastAction = "created a pane through the Herdr CLI"
      record(state, "automated-pane")
      return [
        `${G}created${X}  pane w${state.activeWorkspace + 1}:p${createdPaneId + 1} · direction right`,
      ]
    },
  },
  {
    keymap: "herdr",
    pattern: /^herdr worktree create --cwd (\S+) --branch (\S+) --base (\S+) --label ([a-zA-Z0-9._-]+) --focus$/,
    run: (state, match) => {
      const label = match[4]
      if (!state.workspaces.includes(label)) state.workspaces.push(label)
      state.activeWorkspace = state.workspaces.indexOf(label)
      state.lastAction = `created and focused worktree ${label} from ${match[3]}`
      record(state, "created-worktree")
      return [`${G}created${X}  workspace ${label} · branch ${match[2]} · base ${match[3]}`]
    },
  },
  {
    keymap: "herdr",
    pattern: /^herdr plugin list$/,
    run: (state) => {
      state.lastAction = "listed installed Herdr plugins"
      record(state, "listed-plugins")
      return [`${DIM}no plugins installed${X}`]
    },
  },
  {
    keymap: "herdr",
    pattern: /^herdr server stop$/,
    run: (state) => {
      state.serverStopped = true
      state.detached = true
      state.agentPanes = {}
      state.lastAction = "stopped the server; every pane and agent in it ended"
      record(state, "stopped-server")
      return [`${DIM}stopped${X}  default session · every pane and agent ended`]
    },
  },
  {
    keymap: "herdr",
    pattern: /^herdr agent start ([a-z][a-z0-9_-]{0,31}) --kind ([a-z][a-z0-9_-]*) --pane (w\d+:p\d+)(?: -- .+)?$/,
    run: (state, match) => {
      const [, name, kind, target] = match
      const id = paneIdFromTarget(state, target)
      if (id === null) return commandError(state, `no pane ${target}`)
      if (namedAgentPane(state, name) !== null) return commandError(state, `agent ${name} already exists`)
      state.agentPanes[name] = id
      setPaneLines(state, id, [`${C}${kind}${X}  ${G}● idle${X}`, `${DIM}${name} · ready for a prompt${X}`], "static")
      state.lastAction = `started ${kind} in ${target} as ${name}`
      record(state, "started-agent")
      return [`{"result":{"agent":{"name":"${name}","kind":"${kind}","pane_id":"${target}","state":"idle"}}}`]
    },
  },
  {
    keymap: "herdr",
    pattern: /^herdr agent prompt ([a-z][a-z0-9_-]{0,31}) "([^"]+)" --wait(?: --timeout \d+)?$/,
    run: (state, match) => {
      const [, name, prompt] = match
      const id = namedAgentPane(state, name)
      if (id === null) return commandError(state, `no agent named ${name}`)
      const pane = leaves(state.root).find((candidate) => candidate.id === id)
      const kind = pane?.lines[0]?.replace(ANSI, "").split(/\s+/)[0] ?? "agent"
      setPaneLines(state, id, [`${C}${kind}${X}  ${B}● done${X}`, `${DIM}${name} · finished: ${prompt}${X}`])
      state.lastAction = `${name} worked on the prompt; the wait returned when it settled`
      record(state, "prompted-agent")
      return [`{"result":{"agent":"${name}","state":"done","waited_ms":41830}}`]
    },
  },
  {
    keymap: "herdr",
    pattern: /^herdr agent wait ([a-z][a-z0-9_-]{0,31}) --until blocked(?: --timeout \d+)?$/,
    run: (state, match) => {
      const name = match[1]
      const id = namedAgentPane(state, name)
      if (id === null) return commandError(state, `no agent named ${name}`)
      setPaneLines(state, id, [`${C}codex${X}  ${R}● blocked${X}`, `${Y}allow edits to src/auth.ts? (y/n)${X}`])
      state.lastAction = `${name} is blocked and waits for a decision`
      record(state, "waited-agent")
      return [`{"result":{"agent":"${name}","state":"blocked","waited_ms":12045}}`]
    },
  },
  {
    keymap: "herdr",
    pattern: /^herdr agent read ([a-z][a-z0-9_-]{0,31})(?: --source \S+)?(?: --lines \d+)?$/,
    run: (state, match) => {
      const name = match[1]
      const id = namedAgentPane(state, name)
      if (id === null) return commandError(state, `no agent named ${name}`)
      const pane = leaves(state.root).find((candidate) => candidate.id === id)
      state.lastAction = `read the ${name} pane without focusing it`
      record(state, "read-agent")
      return [`${DIM}── ${name} · recent-unwrapped ──${X}`, ...(pane?.lines ?? [])]
    },
  },
  {
    keymap: "herdr",
    pattern: /^herdr agent send-keys ([a-z][a-z0-9_-]{0,31}) (esc|enter|y|n|ctrl\+c)$/,
    run: (state, match) => {
      const [, name, key] = match
      const id = namedAgentPane(state, name)
      if (id === null) return commandError(state, `no agent named ${name}`)
      setPaneLines(state, id, [`${C}codex${X}  ${G}● idle${X}`, `${DIM}${name} · dismissed the prompt with ${key}${X}`])
      state.lastAction = `sent ${key} to ${name}`
      record(state, "sent-agent-keys")
      return [`${G}sent${X}  ${key} · agent ${name}`]
    },
  },
  {
    keymap: "herdr",
    pattern: /^herdr agent attach ([a-z][a-z0-9_-]{0,31})$/,
    run: (state, match) => {
      const name = match[1]
      if (namedAgentPane(state, name) === null) return commandError(state, `no agent named ${name}`)
      state.lastAction = `attached this terminal directly to ${name}`
      record(state, "attached-agent")
      return [`${G}attached${X}  ${name} · ctrl+b q detaches · ctrl+b ctrl+b sends ctrl+b`]
    },
  },
  {
    keymap: "herdr",
    pattern: /^herdr agent explain (w\d+:p\d+)$/,
    run: (state, match) => {
      const target = match[1]
      if (paneIdFromTarget(state, target) === null) return commandError(state, `no pane ${target}`)
      state.lastAction = `explained how Herdr classified ${target}`
      record(state, "explained-agent")
      return [
        `agent:            codex`,
        `state:            idle`,
        `fallback:         default_known_agent_idle_fallback`,
        `${DIM}no manifest rule matched; Herdr defaulted to idle${X}`,
      ]
    },
  },
  {
    keymap: "herdr",
    pattern: /^npx skills add herdrdev\/herdr --skill herdr -g$/,
    run: (state) => {
      state.lastAction = "installed the Herdr skill for your agents"
      record(state, "installed-skill")
      return [
        `${G}✔${X} herdr  ${DIM}→ ~/.claude/skills/herdr/SKILL.md, ~/.codex/skills/herdr/SKILL.md${X}`,
      ]
    },
  },
]

export function executeShellCommand(
  state: TrainerState,
  command: string,
  keymap: Keymap,
): ShellCommandResult {
  const next = structuredClone(state)
  const normalized = command.trim().replace(/\s+/g, " ")

  for (const rule of SHELL_COMMANDS) {
    if (rule.keymap !== keymap) continue
    const match = rule.pattern.exec(normalized)
    if (match === null) continue
    return { state: next, output: rule.run(next, match) }
  }

  return { state: next, output: null }
}

export function applyShellCommand(
  state: TrainerState,
  command: string,
  keymap: Keymap,
): TrainerState {
  return executeShellCommand(state, command, keymap).state
}
