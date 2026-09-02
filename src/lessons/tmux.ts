import { navigationDrill } from "../drills/navigationDrill"
import { tmuxMixedDrill, tmuxPaneDrill, tmuxWindowDrill } from "../drills/tmuxDrills"
import { did, initialState, leaf } from "../engine/multiplexer"
import {
  G,
  Y,
  R,
  C,
  DIM,
  X,
  shellPane,
  splitRow,
  splitColumn,
  hasSplit,
  oneShell,
  outsideShell,
  drillLesson,
} from "./helpers"
import type { Lesson } from "./types"

export const tmuxLessons: Lesson[] = [
  {
    slug: "tmux-start",
    track: "tmux",
    module: "Getting started",
    title: "Start a named session",
    body: "Install tmux with your system package manager, then start it from a normal shell. Naming the session makes it easier to find and reattach later.",
    task: "Type [tmux new -s work] and press [enter].",
    takeaway:
      "tmux starts a server, creates the work session, and attaches your terminal as a client. Run [tmux ls] to list sessions and [tmux attach -t work] to return.",
    keymap: "tmux",
    input: "shell",
    setup: () => outsideShell(`${DIM}# normal shell outside tmux${X}`),
    goal: (state) => did(state, "started-tmux"),
  },
  {
    slug: "tmux-prefix",
    track: "tmux",
    module: "The model",
    title: "Give a key to tmux",
    body: "tmux sits between your terminal and the shell inside it. Most keys still belong to the shell. The prefix tells tmux that one command key is coming next.",
    task: "Press [ctrl+b], release it, then press [?] to open tmux key help.",
    takeaway:
      "You press the two keys in sequence, not together. A tmux client displays a persistent session. The session contains windows, and each window contains panes.",
    keymap: "tmux",
    input: "keyboard",
    par: 2,
    setup: () => oneShell(`${DIM}# normal typing goes to this shell${X}`),
    goal: (state) => did(state, "opened-help"),
  },
  {
    slug: "tmux-split-v",
    track: "tmux",
    module: "Panes",
    title: "Split side by side",
    body: "A pane is one terminal inside the current window. Splitting keeps both processes visible at the same time.",
    task: "Press [ctrl+b] then [%] to create a pane on the right.",
    takeaway:
      "The new pane gets focus. Both panes belong to the same window and keep independent shells and working directories.",
    keymap: "tmux",
    input: "keyboard",
    par: 2,
    setup: () => oneShell(`${DIM}# make room for a second process${X}`),
    goal: (state) => hasSplit(state, "row"),
  },
  {
    slug: "tmux-split-h",
    track: "tmux",
    module: "Panes",
    title: "Split top and bottom",
    body: "tmux can divide the focused pane along either axis. The quote binding creates a pane below the current one.",
    task: 'Press [ctrl+b] then ["] to create a pane below.',
    takeaway:
      "Splits can nest. You can build a layout by splitting whichever pane currently has focus.",
    keymap: "tmux",
    input: "keyboard",
    par: 2,
    setup: () => oneShell(`${DIM}# stack a second process below${X}`),
    goal: (state) => hasSplit(state, "column"),
  },
  {
    slug: "tmux-navigate",
    track: "tmux",
    module: "Panes",
    title: "Move between panes",
    body: "Focus decides which terminal receives your typing and which pane a tmux command changes. The default arrow bindings move focus by direction.",
    task: "Reach the pane marked with a star. Use [ctrl+b] then an arrow ([←] [↑] [↓] [→]) for each move.",
    takeaway:
      "You can also press [ctrl+b] then [o] to cycle through panes. The active pane is the one with the highlighted border.",
    keymap: "tmux",
    input: "keyboard",
    par: 4,
    setup: () =>
      initialState({
        root: splitRow(
          shellPane(0, [`${DIM}# start here${X}`]),
          splitColumn(shellPane(1), shellPane(2, [`${Y}★ focus this pane${X}`])),
        ),
        activePaneId: 0,
      }),
    goal: (state) => state.activePaneId === 2,
  },
  {
    slug: "tmux-zoom",
    track: "tmux",
    module: "Panes",
    title: "Zoom one pane",
    body: "A dense layout is useful for monitoring. When you need to work, zoom the focused pane without destroying the layout.",
    task: "Press [ctrl+b] then [z] to zoom the editor pane.",
    takeaway:
      "Press the same binding again to restore the layout. Zoom changes the view, not the processes or pane arrangement.",
    keymap: "tmux",
    input: "keyboard",
    par: 2,
    setup: () =>
      initialState({
        root: splitRow(
          leaf(0, [`${C}vim${X}  src/main.ts`, `${DIM}~ editing${X}`]),
          leaf(1, [`${G}tests: 18 passed${X}`]),
        ),
        activePaneId: 0,
      }),
    goal: (state) => did(state, "zoomed-pane"),
  },
  drillLesson({
    slug: "tmux-drill-navigate",
    track: "tmux",
    module: "Panes",
    drill: navigationDrill,
  }),
  drillLesson({ slug: "tmux-drill-panes", track: "tmux", module: "Panes", drill: tmuxPaneDrill }),
  {
    slug: "tmux-windows",
    track: "tmux",
    module: "Windows",
    title: "Create and switch windows",
    body: "A window fills the client and owns its own pane layout. Use windows for separate activities such as editing, tests, and logs.",
    task: "Create a window with [ctrl+b] [c], then return with [ctrl+b] [p].",
    takeaway:
      "Use [ctrl+b] [n] for the next window or [ctrl+b] plus its number for a direct jump. tmux counts windows from 0. Herdr calls this level a tab and counts from 1.",
    keymap: "tmux",
    input: "keyboard",
    par: 4,
    setup: () => oneShell(`${DIM}# window 1: editor${X}`),
    goal: (state) =>
      did(state, "opened-tab") && did(state, "switched-tab") && state.activeTab === 0,
  },
  drillLesson({
    slug: "tmux-drill-windows",
    track: "tmux",
    module: "Windows",
    drill: tmuxWindowDrill,
  }),
  {
    slug: "tmux-copy",
    track: "tmux",
    module: "History",
    title: "Browse pane history",
    body: "Terminal programs keep using the keyboard while they run. tmux copy mode temporarily gives you navigation over pane history.",
    task: "Enter copy mode with [ctrl+b] [[]. Press [page up] to move through history, then [q] to leave.",
    takeaway:
      "Use arrows, Page Up, and Page Down to move. tmux uses Emacs-style selection keys by default and can use Vim keys with [set -g mode-keys vi]. Open key help to check the active copy bindings.",
    keymap: "tmux",
    input: "keyboard",
    par: 4,
    setup: () =>
      initialState({
        root: leaf(0, [
          `${DIM}build output${X}`,
          "src/parser.ts:18: expected Token",
          `${R}error: test failed${X}`,
        ]),
        activePaneId: 0,
      }),
    goal: (state) => did(state, "entered-copy-mode") && state.mode.kind === "terminal",
  },
  {
    slug: "tmux-close-pane",
    track: "tmux",
    module: "Cleanup",
    title: "Close a pane",
    body: "Closing a pane ends the terminal and its foreground process. tmux normally asks for confirmation before it removes the pane.",
    task: "The right pane is disposable. Focus it with [ctrl+b] [→], then close it with [ctrl+b] [x].",
    takeaway:
      "Use [exit] inside a shell for a normal shutdown. Use the close binding when you intend to end whatever owns the pane.",
    keymap: "tmux",
    input: "keyboard",
    par: 4,
    setup: () =>
      initialState({
        root: splitRow(
          shellPane(0, [`${G}editor: unsaved work stays here${X}`]),
          leaf(1, [`${R}watcher crashed${X}`, `${DIM}safe to close${X}`]),
        ),
        activePaneId: 0,
      }),
    goal: (state) => state.root.kind === "leaf" && state.root.id === 0,
  },
  {
    slug: "tmux-detach",
    track: "tmux",
    module: "Sessions",
    title: "Detach without stopping work",
    body: "The tmux server owns the session. Your terminal is only an attached client, so disconnecting the client does not stop the panes.",
    task: "Press [ctrl+b] then [d] to detach from the session.",
    takeaway:
      "Run [tmux attach] to return. Use named sessions with [tmux new -s work], [tmux ls], and [tmux attach -t work]. A session ends when you kill it or its last window exits.",
    keymap: "tmux",
    input: "keyboard",
    par: 2,
    setup: () =>
      initialState({
        root: leaf(0, [`${Y}tests are still running${X}`, `${DIM}client may disconnect${X}`]),
        activePaneId: 0,
      }),
    goal: (state) => state.detached,
  },
  drillLesson({
    slug: "tmux-drill-mixed",
    track: "tmux",
    module: "Final drill",
    drill: tmuxMixedDrill,
  }),
]
