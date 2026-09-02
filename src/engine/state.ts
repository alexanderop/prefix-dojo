import { stripAnsi } from "./ansi"

/**
 * Trainer state: the parts of a multiplexer session the lessons exercise.
 * Everything here is plain data plus pure helpers; `multiplexer.ts` applies
 * input to it and `tools/` describes what each key does per tool.
 */

export type SplitDir = "row" | "column"
export type PaneVariant = "shell" | "static"

export type PaneNode =
  | { kind: "leaf"; id: number; lines: string[]; variant: PaneVariant }
  | { kind: "split"; dir: SplitDir; children: [PaneNode, PaneNode] }

export type PaneLeaf = Extract<PaneNode, { kind: "leaf" }>

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
  /** True when the last input was refused: unknown binding, nothing to act on, bad argument. */
  rejected: boolean
}

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

export interface InitialStateInput {
  root: PaneNode
  activePaneId: number
  tabs?: number
  activeTab?: number
  workspaces?: string[]
  activeWorkspace?: number
  notificationPaneId?: number
  agentPanes?: Record<string, number>
}

export function leaf(id: number, lines: string[] = [], variant: PaneVariant = "static"): PaneLeaf {
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
    rejected: false,
  }
}

export function leaves(node: PaneNode): PaneLeaf[] {
  if (node.kind === "leaf") return [node]
  return [...leaves(node.children[0]), ...leaves(node.children[1])]
}

export function containsPane(node: PaneNode, paneId: number): boolean {
  if (node.kind === "leaf") return node.id === paneId
  return containsPane(node.children[0], paneId) || containsPane(node.children[1], paneId)
}

export function activeLeaf(state: TrainerState): PaneLeaf | undefined {
  return leaves(state.root).find((pane) => pane.id === state.activePaneId)
}

function maxPaneId(node: PaneNode): number {
  return Math.max(...leaves(node).map((pane) => pane.id))
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
    const first = stripAnsi(pane.lines[0] ?? "").trim()
    const process = /^(\S+)\s+●/.exec(first)?.[1]
    const agentState = agentStateFromLine(first)
    if (process === undefined || agentState === null) return []
    return [
      {
        paneId: pane.id,
        name: namesByPane.get(pane.id) ?? process,
        state: agentState,
      },
    ]
  })
}

export function did(state: TrainerState, action: TrainerAction): boolean {
  return state.actions.includes(action)
}

/** Herdr addresses panes as `w1:p<n>`; the trainer numbers its panes from 0. */
export function paneTarget(id: number): string {
  return `w1:p${id + 1}`
}

export function record(state: TrainerState, action: TrainerAction): void {
  if (!state.actions.includes(action)) state.actions.push(action)
}

/** Refuse the input: the message explains why, and the UI can react to the flag. */
export function reject(state: TrainerState, message: string): void {
  state.lastAction = message
  state.rejected = true
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

const KEY_LABELS: Record<string, string> = {
  ArrowLeft: "←",
  ArrowRight: "→",
  ArrowUp: "↑",
  ArrowDown: "↓",
  " ": "space",
  Escape: "esc",
  Enter: "enter",
  Tab: "tab",
  PageUp: "page up",
  PageDown: "page down",
  Backspace: "backspace",
}

/**
 * Display spelling of a key press, the same spelling lesson text and the
 * binding tables use: `ctrl+b`, `shift+h`, `←`, `%`. Shift is only spelled
 * out for letters and tab; symbols like `%` already imply it.
 */
export function keyLabel(input: KeyInput): string {
  const base = KEY_LABELS[input.key] ?? input.key
  if (input.ctrl) return `ctrl+${base.toLowerCase()}`
  if (input.shift && (/^[a-z]$/i.test(base) || base === "tab")) return `shift+${base.toLowerCase()}`
  return base.length === 1 ? base : base.toLowerCase()
}
