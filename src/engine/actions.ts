/**
 * Commands a prefix binding can run. Each mutates the cloned state in place
 * and describes what happened in `lastAction`. Tool tables in `src/tools/`
 * map keys to these.
 */
import {
  activeLeaf,
  leaf,
  leaves,
  paneRects,
  record,
  reject,
  type PaneLeaf,
  type PaneNode,
  type RenameTarget,
  type SplitDir,
  type TrainerState,
} from "./state"

export type Direction = "left" | "right" | "up" | "down"

const NEW_PANE_LINES = ["\x1b[90m# fresh pane. run a shell, server, or agent here\x1b[0m"]

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

function mapLeaves(node: PaneNode, transform: (pane: PaneLeaf) => PaneNode): PaneNode {
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

function removeLeaf(node: PaneNode, targetId: number): PaneNode | null {
  if (node.kind === "leaf") return node.id === targetId ? null : node
  const first = removeLeaf(node.children[0], targetId)
  const second = removeLeaf(node.children[1], targetId)
  if (first === null) return second
  if (second === null) return first
  return { kind: "split", dir: node.dir, children: [first, second] }
}

// ---- panes ----

export function navigate(state: TrainerState, direction: Direction): void {
  const target = neighbor(state, direction)
  if (target === null) return reject(state, `no pane ${DIRECTION_WORDS[direction]}`)

  state.activePaneId = target
  state.zoomedPaneId = null
  state.lastAction = `focused pane ${target}`
  record(state, "focused-pane")
}

/** Exchange the positions of two panes without changing what runs in them. */
export function swapPanes(state: TrainerState, direction: Direction): void {
  const target = neighbor(state, direction)
  if (target === null)
    return reject(state, `no neighbor ${DIRECTION_WORDS[direction]} to swap with`)
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

export function cyclePane(state: TrainerState, step: 1 | -1): void {
  const panes = leaves(state.root)
  const index = panes.findIndex((pane) => pane.id === state.activePaneId)
  state.activePaneId = panes[(index + step + panes.length) % panes.length].id
  state.zoomedPaneId = null
  state.lastAction = step === 1 ? "cycled to the next pane" : "cycled to the previous pane"
  record(state, "focused-pane")
  record(state, "cycled-pane")
}

export function splitActive(state: TrainerState, direction: SplitDir): void {
  const active = activeLeaf(state)
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

export function closeActivePane(state: TrainerState): void {
  if (state.root.kind === "leaf") return reject(state, "cannot close the last pane")
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

export function toggleZoom(state: TrainerState): void {
  if (state.zoomedPaneId === null) {
    state.zoomedPaneId = state.activePaneId
    state.lastAction = `zoomed pane ${state.activePaneId}`
    record(state, "zoomed-pane")
  } else {
    state.zoomedPaneId = null
    state.lastAction = "restored pane layout"
  }
}

export function enterResizeMode(state: TrainerState): void {
  state.mode = { kind: "resize" }
  state.lastAction = "entered resize mode"
}

// ---- tabs (tmux windows) ----

export function newTab(state: TrainerState): void {
  state.tabs += 1
  state.activeTab = state.tabs - 1
  state.lastAction = `created tab ${state.activeTab + 1}`
  record(state, "opened-tab")
}

export function cycleTab(state: TrainerState, step: 1 | -1): void {
  state.activeTab = (state.activeTab + step + state.tabs) % state.tabs
  state.lastAction = step === 1 ? "selected next tab" : "selected previous tab"
  record(state, "switched-tab")
}

/** Jump to a tab by its displayed number. tmux counts windows from 0, Herdr tabs from 1. */
export function switchTab(
  state: TrainerState,
  key: string,
  options: { firstNumber: 0 | 1; word: "window" | "tab" },
): void {
  const index = Number(key) - options.firstNumber
  if (index < 0 || index >= state.tabs) return reject(state, `no ${options.word} ${key}`)
  state.activeTab = index
  state.lastAction = `selected ${options.word} ${key}`
  record(state, "switched-tab")
}

export function closeActiveTab(state: TrainerState): void {
  if (state.tabs === 1) return reject(state, "cannot close the last tab")
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

// ---- workspaces ----

export function createWorkspace(state: TrainerState): void {
  state.workspaces.push(`workspace-${state.workspaces.length + 1}`)
  state.activeWorkspace = state.workspaces.length - 1
  state.lastAction = `created ${state.workspaces[state.activeWorkspace]}`
  record(state, "created-workspace")
}

export function closeActiveWorkspace(state: TrainerState): void {
  if (state.workspaces.length === 1) return reject(state, "cannot close the last workspace")
  const [closed] = state.workspaces.splice(state.activeWorkspace, 1)
  state.activeWorkspace = Math.min(state.activeWorkspace, state.workspaces.length - 1)
  state.lastAction = `closed workspace ${closed}`
  record(state, "closed-workspace")
}

export function openWorkspacePicker(state: TrainerState): void {
  state.mode = { kind: "workspace-picker", selected: state.activeWorkspace }
  state.lastAction = "opened workspace navigation"
}

export function createWorktree(state: TrainerState): void {
  state.lastAction = "opened Git worktree creation"
  record(state, "created-worktree")
}

// ---- overlays and session ----

export function startRename(state: TrainerState, target: RenameTarget): void {
  state.mode = { kind: "rename", target, value: "" }
  state.lastAction = `renaming the ${target}; type a name, then enter`
}

export function openNotificationTarget(state: TrainerState): void {
  if (state.notificationPaneId === null) return reject(state, "no visible notification to open")
  state.activePaneId = state.notificationPaneId
  state.notificationPaneId = null
  state.zoomedPaneId = null
  state.lastAction = `jumped to pane ${state.activePaneId}, the notification target`
  record(state, "focused-pane")
  record(state, "opened-notification")
}

export function enterCopyMode(state: TrainerState): void {
  state.mode = { kind: "copy", selecting: false, search: null }
  state.lastAction = "entered copy mode"
  record(state, "entered-copy-mode")
}

export function detach(state: TrainerState): void {
  state.detached = true
  state.mode = { kind: "terminal" }
  state.lastAction = "detached; processes keep running"
  record(state, "detached")
}

export function openHelp(state: TrainerState): void {
  state.mode = { kind: "help" }
  state.lastAction = "opened active keybindings"
  record(state, "opened-help")
}

export function openGoto(state: TrainerState): void {
  state.mode = { kind: "goto" }
  state.lastAction = "opened session navigator"
  record(state, "opened-goto")
}

export function toggleSidebar(state: TrainerState): void {
  state.sidebarVisible = !state.sidebarVisible
  state.lastAction = state.sidebarVisible ? "showed sidebar" : "hid sidebar"
  record(state, "toggled-sidebar")
}

export function sendLiteralPrefix(state: TrainerState, prefix: string): void {
  state.mode = { kind: "terminal" }
  state.lastAction = `sent a literal ${prefix} to the focused terminal`
}
