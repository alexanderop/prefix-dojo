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
  tabPrompt,
} from "./layout"
import { mergePrompts, promptDrill, type PromptList } from "./promptDrill"

const twoAcross = () => state({ root: row(pane(0), quiet(1)), activePaneId: 0 })

export const tmuxPanePrompts: PromptList = [
  actionPrompt("split-right", "split right", 2, "split-right"),
  actionPrompt("split-down", "split below", 2, "split-down"),
  focusPrompt("focus-right", row(pane(0), star(1)), 0, 1),
  focusPrompt("focus-left", row(star(0), pane(1)), 1, 0),
  focusPrompt("focus-down", column(pane(0), star(1)), 0, 1),
  focusPrompt("focus-up", column(star(0), pane(1)), 1, 0),
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

export const tmuxWindowPrompts: PromptList = [
  actionPrompt("new-window", "create a window", 2, "opened-tab", () => tabs(2, 0)),
  tabPrompt("next-window", "next window", 3, 0, 1),
  tabPrompt("previous-window", "previous window", 3, 1, 0),
  tabPrompt("window-0", "jump to window 0", 3, 2, 0),
  tabPrompt("window-2", "jump to window 2", 4, 0, 2),
  tabPrompt("window-3", "jump to window 3", 4, 1, 3),
]

export const tmuxSessionPrompts: PromptList = [
  actionPrompt("copy-mode", "enter copy mode", 2, "entered-copy-mode"),
  {
    id: "copy-selection",
    text: "copy: copy mode, select, copy",
    par: 4,
    start: onePane,
    solved: (next) => did(next, "copied-selection"),
  },
  actionPrompt("detach", "detach from the session", 2, "detached"),
]

export const tmuxPaneDrill = promptDrill({
  id: "tmux-panes",
  title: "Pane drill",
  blurb: "Split, focus, zoom, and close. The pane tells you what to do next.",
  target: 12,
  prompts: tmuxPanePrompts,
})

export const tmuxWindowDrill = promptDrill({
  id: "tmux-windows",
  title: "Window drill",
  blurb: "Create windows and jump between them by number or neighbor.",
  target: 12,
  prompts: tmuxWindowPrompts,
})

export const tmuxMixedDrill = promptDrill({
  id: "tmux-mixed",
  title: "Mixed drill",
  blurb: "Every tmux key from the track, shuffled. Pick the right one under pressure.",
  target: 15,
  prompts: mergePrompts(tmuxPanePrompts, tmuxWindowPrompts, tmuxSessionPrompts),
})
