import { DIM, RED, RESET, YELLOW } from "../engine/ansi"
import { did } from "../engine/state"
import {
  actionPrompt,
  column,
  focusPrompt,
  onePane,
  pane,
  quiet,
  row,
  star,
  state,
  swapPrompt,
  tabPrompt,
} from "./layout"
import { mergePrompts, promptDrill, type PromptList } from "./promptDrill"

const twoAcross = () => state({ root: row(pane(0), quiet(1)), activePaneId: 0 })

export const herdrPanePrompts: PromptList = [
  actionPrompt("split-right", "split right", 2, "split-right"),
  actionPrompt("split-down", "split below", 2, "split-down"),
  focusPrompt("focus-right", row(pane(0), star(1)), 0, 1),
  focusPrompt("focus-left", row(star(0), pane(1)), 1, 0),
  focusPrompt("focus-down", column(pane(0), star(1)), 0, 1),
  focusPrompt("focus-up", column(star(0), pane(1)), 1, 0),
  swapPrompt("swap-right", "swap with the pane on the right", row(pane(0), quiet(1)), 0, 1),
  swapPrompt("swap-left", "swap with the pane on the left", row(quiet(0), pane(1)), 1, 0),
  swapPrompt("swap-down", "swap with the pane below", column(pane(0), quiet(1)), 0, 1),
  actionPrompt("cycle", "cycle to the next pane", 2, "cycled-pane", twoAcross),
  {
    id: "zoom",
    text: "zoom this pane",
    par: 2,
    start: twoAcross,
    solved: (next, start) => next.zoomedPaneId === start.activePaneId,
  },
  actionPrompt("close-pane", "close this pane", 2, "closed-pane", twoAcross),
]

const tabs = (count: number, activeTab: number) =>
  state({ root: pane(0), activePaneId: 0, tabs: count, activeTab })

const workspaces = (names: string[], activeWorkspace: number) =>
  state({ root: pane(0), activePaneId: 0, workspaces: names, activeWorkspace })

export const herdrTabPrompts: PromptList = [
  actionPrompt("new-tab", "create a tab", 2, "opened-tab", () => tabs(2, 0)),
  tabPrompt("next-tab", "next tab", 3, 0, 1),
  tabPrompt("previous-tab", "previous tab", 3, 1, 0),
  tabPrompt("tab-1", "go to tab 1", 3, 2, 0),
  tabPrompt("tab-3", "go to tab 3", 4, 0, 2),
  tabPrompt("tab-4", "go to tab 4", 4, 1, 3),
  actionPrompt("close-tab", "close this tab", 2, "closed-tab", () => tabs(2, 1)),
  actionPrompt("new-workspace", "create a workspace", 2, "created-workspace"),
  {
    id: "switch-workspace",
    text: "switch to workspace api",
    par: 4,
    start: () => workspaces(["project", "api"], 0),
    solved: (next) => next.activeWorkspace === 1,
  },
  actionPrompt("close-workspace", "close this workspace", 2, "closed-workspace", () =>
    workspaces(["project", "api"], 1),
  ),
]

const LOG_LINES = [
  `${DIM}12:01 build started${RESET}`,
  `${YELLOW}12:02 warn: 3 unused exports${RESET}`,
  `${RED}12:03 error: type check failed${RESET}`,
  `${DIM}12:03 build stopped${RESET}`,
]

const logPane = () => state({ root: pane(0, LOG_LINES), activePaneId: 0 })

export const herdrHistoryPrompts: PromptList = [
  actionPrompt("copy-mode", "enter copy mode", 2, "entered-copy-mode", logPane),
  {
    id: "copy-selection",
    text: "copy: copy mode, select, yank",
    par: 4,
    start: logPane,
    solved: (next) => did(next, "copied-selection"),
  },
  {
    id: "search-error",
    text: 'search history for "error"',
    par: 9,
    start: logPane,
    solved: (next) =>
      next.mode.kind === "copy" &&
      next.mode.search?.query === "error" &&
      next.mode.search.matches > 0,
  },
  {
    id: "search-warn",
    text: 'search history for "warn"',
    par: 8,
    start: logPane,
    solved: (next) =>
      next.mode.kind === "copy" &&
      next.mode.search?.query === "warn" &&
      next.mode.search.matches > 0,
  },
]

export const herdrSessionPrompts: PromptList = [
  actionPrompt("goto", "open the session navigator", 2, "opened-goto"),
  actionPrompt("sidebar", "toggle the sidebar", 2, "toggled-sidebar"),
  actionPrompt("notification", "jump to the notification", 2, "opened-notification", () =>
    state({ root: row(pane(0), quiet(1)), activePaneId: 0, notificationPaneId: 1 }),
  ),
  actionPrompt("detach", "detach from the session", 2, "detached", onePane),
]

export const herdrPaneDrill = promptDrill({
  id: "herdr-panes",
  title: "Pane drill",
  blurb: "Split, focus, swap, zoom, and close. The pane tells you what to do next.",
  target: 12,
  prompts: herdrPanePrompts,
})

export const herdrTabDrill = promptDrill({
  id: "herdr-tabs",
  title: "Tab and workspace drill",
  blurb: "Tabs by number and neighbor, workspaces through the picker.",
  target: 12,
  prompts: herdrTabPrompts,
})

export const herdrHistoryDrill = promptDrill({
  id: "herdr-history",
  title: "History drill",
  blurb: "Copy mode, selections, and search against a short build log.",
  target: 8,
  prompts: herdrHistoryPrompts,
})

export const herdrMixedDrill = promptDrill({
  id: "herdr-mixed",
  title: "Mixed drill",
  blurb: "Every Herdr key from the track, shuffled. Pick the right one under pressure.",
  target: 15,
  prompts: mergePrompts(
    herdrPanePrompts,
    herdrTabPrompts,
    herdrHistoryPrompts,
    herdrSessionPrompts,
  ),
})
