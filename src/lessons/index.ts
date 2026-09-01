import {
  did,
  initialState,
  leaf,
  leaves,
  type Keymap,
  type PaneNode,
  type TrainerState,
} from "../engine/multiplexer"

export interface Lesson {
  slug: string
  track: "tmux" | "herdr"
  module: string
  title: string
  /** Text in square brackets renders as a keycap or command. */
  body: string
  task: string
  steps?: ReadonlyArray<{
    text: string
    done: (state: TrainerState) => boolean
  }>
  takeaway: string
  keymap: Keymap
  input: "keyboard" | "mouse" | "shell"
  par?: number
  setup: () => TrainerState
  goal: (state: TrainerState) => boolean
}

const B = "\x1b[34;1m"
const G = "\x1b[32;1m"
const Y = "\x1b[33;1m"
const R = "\x1b[31m"
const C = "\x1b[36m"
const DIM = "\x1b[90m"
const X = "\x1b[0m"

const shellPane = (id: number, extra: string[] = []): PaneNode =>
  leaf(id, extra, "shell")

function splitRow(first: PaneNode, second: PaneNode): PaneNode {
  return { kind: "split", dir: "row", children: [first, second] }
}

function splitColumn(first: PaneNode, second: PaneNode): PaneNode {
  return { kind: "split", dir: "column", children: [first, second] }
}

function hasSplit(state: TrainerState, direction: "row" | "column"): boolean {
  const walk = (node: PaneNode): boolean =>
    node.kind === "split" &&
    (node.dir === direction || walk(node.children[0]) || walk(node.children[1]))
  return walk(state.root)
}

const oneShell = (line: string): TrainerState =>
  initialState({ root: shellPane(0, [line]), activePaneId: 0 })

export const lessons: Lesson[] = [
  {
    slug: "tmux-start",
    track: "tmux",
    module: "Getting started",
    title: "Start a named session",
    body:
      "Install tmux with your system package manager, then start it from a normal shell. Naming the session makes it easier to find and reattach later.",
    task: "Type [tmux new -s work] and press [enter].",
    takeaway:
      "tmux starts a server, creates the work session, and attaches your terminal as a client. Run [tmux ls] to list sessions and [tmux attach -t work] to return.",
    keymap: "tmux",
    input: "shell",
    setup: () => oneShell(`${DIM}# normal shell outside tmux${X}`),
    goal: (state) => did(state, "started-tmux"),
  },
  {
    slug: "tmux-prefix",
    track: "tmux",
    module: "The model",
    title: "Give a key to tmux",
    body:
      "tmux sits between your terminal and the shell inside it. Most keys still belong to the shell. The prefix tells tmux that one command key is coming next.",
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
    body:
      "A pane is one terminal inside the current window. Splitting keeps both processes visible at the same time.",
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
    body:
      "tmux can divide the focused pane along either axis. The quote binding creates a pane below the current one.",
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
    body:
      "Focus decides which terminal receives your typing and which pane a tmux command changes. The default arrow bindings move focus by direction.",
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
    body:
      "A dense layout is useful for monitoring. When you need to work, zoom the focused pane without destroying the layout.",
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
  {
    slug: "tmux-windows",
    track: "tmux",
    module: "Windows",
    title: "Create and switch windows",
    body:
      "A window fills the client and owns its own pane layout. Use windows for separate activities such as editing, tests, and logs.",
    task: "Create a window with [ctrl+b] [c], then return with [ctrl+b] [p].",
    takeaway:
      "Use [ctrl+b] [n] for the next window or [ctrl+b] plus its number for a direct jump. tmux counts windows from 0. Herdr calls this level a tab and counts from 1.",
    keymap: "tmux",
    input: "keyboard",
    par: 4,
    setup: () => oneShell(`${DIM}# window 1: editor${X}`),
    goal: (state) => did(state, "opened-tab") && did(state, "switched-tab") && state.activeTab === 0,
  },
  {
    slug: "tmux-copy",
    track: "tmux",
    module: "History",
    title: "Browse pane history",
    body:
      "Terminal programs keep using the keyboard while they run. tmux copy mode temporarily gives you navigation over pane history.",
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
    body:
      "Closing a pane ends the terminal and its foreground process. tmux normally asks for confirmation before it removes the pane.",
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
    body:
      "The tmux server owns the session. Your terminal is only an attached client, so disconnecting the client does not stop the panes.",
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
  {
    slug: "herdr-start",
    track: "herdr",
    module: "Getting started",
    title: "Start Herdr in a project",
    body:
      "Install Herdr with [brew install herdr] or the installer from herdr.dev. Start it in the directory that contains your project.",
    task: "Type [herdr] and press [enter].",
    takeaway:
      "The command starts or attaches to the default background session and opens a workspace. Herdr is one Rust binary. It runs in your existing terminal and does not require an account.",
    keymap: "herdr",
    input: "shell",
    setup: () => oneShell(`${DIM}~/projects/webapp  # normal shell${X}`),
    goal: (state) => did(state, "started-herdr"),
  },
  {
    slug: "herdr-model",
    track: "herdr",
    module: "Getting started",
    title: "Map projects to workspaces",
    body:
      "Herdr keeps the prefix model but adds a project level above tabs. A session contains workspaces, each workspace contains tabs, and each tab contains panes and agents.",
    task: "Create a workspace with [ctrl+b] then [shift+n].",
    takeaway:
      "Use one workspace per repo, task, or investigation. Use named sessions only when you need separate servers, sockets, and runtime state.",
    keymap: "herdr",
    input: "keyboard",
    par: 2,
    setup: () => oneShell(`${DIM}# workspace: api${X}`),
    goal: (state) => did(state, "created-workspace"),
  },
  {
    slug: "herdr-help-config",
    track: "herdr",
    module: "Configuration",
    title: "Find every active binding",
    body:
      "Herdr shows the bindings that are active in your current configuration. This is more reliable than memorizing a list that may not match your setup.",
    task: "Open key help with [ctrl+b] [?].",
    takeaway:
      "Press / in key help to filter actions. Open in-app settings with [ctrl+b] [s]. Herdr reads ~/.config/herdr/config.toml, supports custom bindings and commands, and reloads it with [ctrl+b] [shift+r].",
    keymap: "herdr",
    input: "keyboard",
    par: 2,
    setup: () => oneShell(`${DIM}# bindings can differ after configuration${X}`),
    goal: (state) => did(state, "opened-help"),
  },
  {
    slug: "herdr-mouse",
    track: "herdr",
    module: "Agent awareness",
    title: "Click the agent that needs you",
    body:
      "Herdr recognizes agents and rolls their state up through panes, tabs, and workspaces. Red means blocked, yellow working, blue done but unseen, and green idle or seen.",
    task: "Click the red pane to focus the blocked agent.",
    takeaway:
      "Herdr is mouse-native. You can also click tabs and workspaces, drag split borders, right-click for actions, and drag text to copy it.",
    keymap: "herdr",
    input: "mouse",
    setup: () =>
      initialState({
        root: splitColumn(
          splitRow(
            leaf(0, [`${C}claude${X}  ${Y}● working${X}`, `${DIM}writing tests${X}`]),
            leaf(1, [`${C}codex${X}   ${B}● done${X}`, `${DIM}review ready${X}`]),
          ),
          leaf(2, [
            `${C}opencode${X}  ${R}● blocked${X}`,
            `${Y}allow pnpm install? (y/n)${X}`,
          ]),
        ),
        activePaneId: 0,
        workspaces: ["api", "webapp"],
      }),
    goal: (state) => state.activePaneId === 2,
  },
  {
    slug: "herdr-layout",
    track: "herdr",
    module: "Panes",
    title: "Build an agent layout",
    body:
      "Herdr uses letters that describe the split. The vertical divider makes panes side by side. The horizontal divider stacks them.",
    task: "Split right with [ctrl+b] [v]. Then split the new pane down with [ctrl+b] [-].",
    takeaway:
      "Each pane is a real terminal. Run an agent, a dev server, tests, or an ordinary shell in any pane.",
    keymap: "herdr",
    input: "keyboard",
    par: 4,
    setup: () => oneShell(`${C}codex${X}  ${Y}● working${X}`),
    goal: (state) =>
      did(state, "split-right") && did(state, "split-down") && leaves(state.root).length === 3,
  },
  {
    slug: "herdr-navigate",
    track: "herdr",
    module: "Panes",
    title: "Move with h, j, k, and l",
    body:
      "Herdr uses Vim directions for pane focus. The keys are h for left, j for down, k for up, and l for right.",
    task: "Move from the top-left pane to the starred pane. Use [ctrl+b] then [h], [j], [k], or [l] for each move.",
    takeaway:
      "Use [ctrl+b] [tab] to cycle panes. Use shifted h, j, k, or l to swap the focused pane with its neighbor.",
    keymap: "herdr",
    input: "keyboard",
    par: 4,
    setup: () =>
      initialState({
        root: splitColumn(
          splitRow(leaf(0, [`${DIM}start${X}`]), leaf(1, [`${Y}★ target${X}`])),
          leaf(2, [`${C}dev server${X}`]),
        ),
        activePaneId: 0,
      }),
    goal: (state) => state.activePaneId === 1,
  },
  {
    slug: "herdr-swap",
    track: "herdr",
    module: "Panes",
    title: "Swap and cycle panes",
    body:
      "Focus moves you. Swap moves the pane. A shifted direction key exchanges the focused pane with its neighbor and keeps everything running inside both.",
    task: "Swap the agent with the pane to its right using [ctrl+b] [shift+l]. Then cycle to the next pane with [ctrl+b] [tab].",
    takeaway:
      "Use [ctrl+b] [shift+tab] to cycle backwards. Cycling follows layout order, which helps when a direction key has several candidates.",
    keymap: "herdr",
    input: "keyboard",
    par: 4,
    setup: () =>
      initialState({
        root: splitRow(
          leaf(0, [`${C}claude${X}  ${Y}● working${X}`]),
          leaf(1, [`${G}dev server${X}`, `${DIM}listening on :5173${X}`]),
        ),
        activePaneId: 0,
      }),
    goal: (state) => did(state, "swapped-pane") && did(state, "cycled-pane"),
  },
  {
    slug: "herdr-tabs",
    track: "herdr",
    module: "Tabs",
    title: "Separate activities into tabs",
    body:
      "A Herdr tab is the same level as a tmux window. Each tab owns one pane layout inside the current workspace.",
    task: "Create a tab with [ctrl+b] [c], then return with [ctrl+b] [p].",
    takeaway:
      "Use [n] and [p] for next and previous. Use a number from 1 to 9 after the prefix to jump directly. Rename a tab with [ctrl+b] [shift+t].",
    keymap: "herdr",
    input: "keyboard",
    par: 4,
    setup: () => oneShell(`${DIM}# tab 1: agents${X}`),
    goal: (state) => did(state, "opened-tab") && did(state, "switched-tab") && state.activeTab === 0,
  },
  {
    slug: "herdr-rename",
    track: "herdr",
    module: "Tabs",
    title: "Name what you are looking at",
    body:
      "Tabs, workspaces, and panes can carry a name. Names appear in the tab row, the sidebar, and the session navigator, so a named layout is easier to come back to.",
    task: "Rename the tab with [ctrl+b] [shift+t], type [review], and press [enter]. Then rename the workspace with [ctrl+b] [shift+w], type [api], and press [enter].",
    takeaway:
      "Rename the focused pane with [ctrl+b] [shift+p]. Herdr names a pane after its process until you set one. Escape cancels a rename.",
    keymap: "herdr",
    input: "keyboard",
    par: 15,
    setup: () => oneShell(`${DIM}# tab 1 of workspace project${X}`),
    goal: (state) => did(state, "renamed-tab") && did(state, "renamed-workspace"),
  },
  {
    slug: "herdr-workspaces",
    track: "herdr",
    module: "Workspaces",
    title: "Switch projects",
    body:
      "Workspace navigation shows your projects and their rolled-up agent state. It stays open while you choose where to go.",
    task: "Open it with [ctrl+b] [w]. Press [↓] once, then [enter] to open webapp.",
    takeaway:
      "Inside workspace navigation, use up and down for workspaces and h, j, k, and l for panes. [ctrl+b] [g] opens the broader session navigator.",
    keymap: "herdr",
    input: "keyboard",
    par: 4,
    setup: () =>
      initialState({
        root: shellPane(0, [`${DIM}# api workspace${X}`]),
        activePaneId: 0,
        workspaces: ["api", "webapp", "docs"],
      }),
    goal: (state) => did(state, "switched-workspace") && state.activeWorkspace === 1,
  },
  {
    slug: "herdr-goto",
    track: "herdr",
    module: "Workspaces",
    title: "Jump anywhere with the session navigator",
    body:
      "Workspace navigation lists projects. The session navigator lists everything: workspaces, tabs, panes, and agents, filtered as you type.",
    task: "Open the session navigator with [ctrl+b] [g], then close it with [esc].",
    takeaway:
      "Use it when you know the name of what you want but not where it lives. Agents can be picked by state, so a blocked agent is one filter away.",
    keymap: "herdr",
    input: "keyboard",
    par: 3,
    setup: () =>
      initialState({
        root: shellPane(0, [`${DIM}# many workspaces, one search${X}`]),
        activePaneId: 0,
        workspaces: ["api", "webapp", "docs"],
      }),
    goal: (state) => did(state, "opened-goto") && state.mode.kind === "terminal",
  },
  {
    slug: "herdr-zoom-resize",
    track: "herdr",
    module: "Layout control",
    title: "Zoom and resize",
    body:
      "Zoom gives one pane the full tab without changing its layout. Resize mode changes the split when one pane needs more room.",
    task: "Zoom with [ctrl+b] [z]. Restore with the same keys. Enter resize mode with [ctrl+b] [r], then press [l].",
    takeaway:
      "Resize mode accepts h, j, k, l, or arrow keys. Press Enter or Escape to leave the mode. You can also drag a split border with the mouse.",
    keymap: "herdr",
    input: "keyboard",
    par: 7,
    setup: () =>
      initialState({
        root: splitRow(leaf(0, [`${C}agent${X}`]), leaf(1, [`${G}server${X}`])),
        activePaneId: 0,
      }),
    goal: (state) => did(state, "zoomed-pane") && did(state, "resized-pane"),
  },
  {
    slug: "herdr-close",
    track: "herdr",
    module: "Layout control",
    title: "Close what you no longer need",
    body:
      "Closing a pane ends the process inside it. Closing a tab closes every pane in it. Neither asks for confirmation, so check the sidebar state first.",
    task: "Close the finished agent with [ctrl+b] [x]. Then close this tab with [ctrl+b] [shift+x].",
    takeaway:
      "Close a whole workspace with [ctrl+b] [shift+d]. Prefer detaching over closing when the work should keep running.",
    keymap: "herdr",
    input: "keyboard",
    par: 4,
    setup: () =>
      initialState({
        root: splitRow(
          shellPane(0, [`${DIM}# main shell${X}`]),
          leaf(1, [`${C}codex${X}  ${B}● done${X}`, `${DIM}merged, nothing left to do${X}`]),
        ),
        activePaneId: 1,
        tabs: 2,
        activeTab: 1,
      }),
    goal: (state) => did(state, "closed-pane") && did(state, "closed-tab"),
  },
  {
    slug: "herdr-copy",
    track: "herdr",
    module: "History",
    title: "Copy agent output",
    body:
      "Herdr copy mode can search and select pane history while the process keeps running. Agent detection still reads the live bottom of the pane.",
    task: "Press [ctrl+b] [[]. Press [v] to select, then [y] to copy.",
    takeaway:
      "Use Vim movement, w, b, Page Up, and Page Down. Search with / or ?. Repeat with n or N. Mouse drag selection copies without copy mode.",
    keymap: "herdr",
    input: "keyboard",
    par: 4,
    setup: () =>
      initialState({
        root: leaf(0, [
          `${C}codex${X}  ${B}● done${X}`,
          "Changed src/auth.ts",
          `${G}12 tests passed${X}`,
        ]),
        activePaneId: 0,
      }),
    goal: (state) => did(state, "copied-selection"),
  },
  {
    slug: "herdr-search",
    track: "herdr",
    module: "History",
    title: "Search pane history",
    body:
      "Copy mode has a search. It is case-insensitive unless the term contains an uppercase letter, and the pane keeps running while you look.",
    task: "Press [ctrl+b] [[]. Press [/], type [failed], and press [enter]. Press [n] to jump to the next match.",
    takeaway:
      "Use [?] to search backwards and [N] to repeat in the opposite direction. Escape clears the search before it leaves copy mode.",
    keymap: "herdr",
    input: "keyboard",
    par: 11,
    setup: () =>
      initialState({
        root: leaf(0, [
          `${C}codex${X}  ${B}● done${X}`,
          `${G}auth.spec.ts passed${X}`,
          `${R}session.spec.ts failed${X}`,
          `${G}router.spec.ts passed${X}`,
          `${R}cache.spec.ts failed${X}`,
        ]),
        activePaneId: 0,
      }),
    goal: (state) => did(state, "searched-history") && did(state, "repeated-search"),
  },
  {
    slug: "herdr-worktrees",
    track: "herdr",
    module: "Git worktrees",
    title: "Give parallel work its own checkout",
    body:
      "A Git worktree gives another agent a separate checkout and branch. This prevents parallel agents from writing into the same files in one working tree.",
    task: "Open worktree creation with [ctrl+b] [shift+g].",
    takeaway:
      "Herdr creates managed worktrees under ~/.herdr/worktrees by default. Review the base branch and path before you confirm creation or deletion.",
    keymap: "herdr",
    input: "keyboard",
    par: 2,
    setup: () => oneShell(`${DIM}# repo: webapp  branch: main${X}`),
    goal: (state) => did(state, "created-worktree"),
  },
  {
    slug: "herdr-sidebar",
    track: "herdr",
    module: "Sidebar and alerts",
    title: "Make room without losing status",
    body:
      "The sidebar lists agents and rolls their state up to each workspace. You can hide it when the focused terminal needs more width.",
    task: "Toggle the sidebar with [ctrl+b] [b].",
    takeaway:
      "The status order is blocked, working, done, idle, then unknown. A done agent becomes idle after you view its tab. Notifications can alert you, and [ctrl+b] [o] opens the visible notification target.",
    keymap: "herdr",
    input: "keyboard",
    par: 2,
    setup: () =>
      initialState({
        root: leaf(0, [`${C}claude${X}  ${Y}● working${X}`]),
        activePaneId: 0,
        workspaces: ["api", "webapp", "docs"],
      }),
    goal: (state) => did(state, "toggled-sidebar"),
  },
  {
    slug: "herdr-notification",
    track: "herdr",
    module: "Sidebar and alerts",
    title: "Answer the agent that pinged you",
    body:
      "When an agent becomes blocked or done in another pane, Herdr shows a notification. One binding takes you to its target without hunting through the layout.",
    task: "An agent in another pane is blocked. Press [ctrl+b] [o] to jump to it.",
    takeaway:
      "Notifications can also reach your desktop through the notification settings in config.toml. The sidebar still shows the full picture.",
    keymap: "herdr",
    input: "keyboard",
    par: 2,
    setup: () =>
      initialState({
        root: splitColumn(
          splitRow(
            shellPane(0, [`${DIM}# you are here${X}`]),
            leaf(1, [`${C}claude${X}  ${Y}● working${X}`]),
          ),
          leaf(2, [`${C}opencode${X}  ${R}● blocked${X}`, `${Y}run the migration now? (y/n)${X}`]),
        ),
        activePaneId: 0,
        notificationPaneId: 2,
      }),
    goal: (state) => did(state, "opened-notification"),
  },
  {
    slug: "herdr-persistence",
    track: "herdr",
    module: "Persistence",
    title: "Detach and return later",
    body:
      "Herdr runs a background server that owns panes and agents. The terminal UI is a client, so closing it does not end the session.",
    task: "Detach the client with [ctrl+b] [q].",
    takeaway:
      "Run [herdr] again to reattach. Use [herdr session list] and [herdr session attach work] for independent servers. A cold restart restores layout and supported agent identities, but not every live process.",
    keymap: "herdr",
    input: "keyboard",
    par: 2,
    setup: () =>
      initialState({
        root: leaf(0, [
          `${C}codex${X}  ${Y}● working${X}`,
          `${DIM}migrating the API while you are away${X}`,
        ]),
        activePaneId: 0,
      }),
    goal: (state) => state.detached,
  },
  {
    slug: "herdr-stop",
    track: "herdr",
    module: "Persistence",
    title: "Know what a stop destroys",
    body:
      "Detach keeps every process. Stopping the server ends them. After a restart Herdr restores workspaces, tabs, panes, and directories, and resumes only agents whose integration reported a session id.",
    task: "End the session on purpose: type [herdr server stop] and press [enter].",
    takeaway:
      "Shells, dev servers, and tests come back as fresh shells in their saved directories. Enable pane_history under experimental in config.toml to replay recent screen contents after a restart.",
    keymap: "herdr",
    input: "shell",
    setup: () =>
      initialState({
        root: splitRow(
          shellPane(0, [`${DIM}# nothing here needs to survive${X}`]),
          leaf(1, [`${C}claude${X}  ${G}● idle${X}`, `${DIM}resumes with claude --resume on the next start${X}`]),
        ),
        activePaneId: 0,
      }),
    goal: (state) => did(state, "stopped-server"),
  },
  {
    slug: "herdr-remote",
    track: "herdr",
    module: "Remote work",
    title: "Attach to a remote machine",
    body:
      "Herdr can run entirely inside an SSH shell, like tmux. It can also use your local terminal as a thin client for a Herdr server on another machine.",
    task: "At the practice prompt, type [herdr --remote workbox] and press [enter].",
    takeaway:
      "Put workbox in ~/.ssh/config. Remote attach uses normal OpenSSH authentication and can bridge local image clipboard paste. Plain ssh followed by herdr is the better fit for phone clients.",
    keymap: "herdr",
    input: "shell",
    setup: () => oneShell(`${DIM}# normal local shell; workbox is in ~/.ssh/config${X}`),
    goal: (state) => did(state, "remote-attached"),
  },
  {
    slug: "herdr-attach-agent",
    track: "herdr",
    module: "Remote work",
    title: "Attach to one agent",
    body:
      "Sometimes one agent should fill your terminal, without the sidebar or the layout. Direct attach connects the current terminal to a single agent pane.",
    task: "At the practice prompt, type [herdr agent attach reviewer] and press [enter].",
    takeaway:
      "Detach with [ctrl+b] [q]. Send a literal ctrl+b to the agent with [ctrl+b] [ctrl+b]. Add --takeover when another client owns the input, and use herdr terminal attach for a plain terminal.",
    keymap: "herdr",
    input: "shell",
    setup: () => oneShell(`${DIM}# reviewer is a codex agent in the default session${X}`),
    goal: (state) => did(state, "attached-agent"),
  },
  {
    slug: "herdr-integration",
    track: "herdr",
    module: "Integrations",
    title: "Install an agent integration",
    body:
      "Herdr can detect many agents from their process and terminal screen. Integrations add lifecycle signals or session identity when an agent supports them.",
    task: "Type [herdr integration install codex] and press [enter].",
    takeaway:
      "Run [herdr integration status] to inspect installed integrations. Unsupported agents still work as terminal processes, but their status may stay unknown without an integration.",
    keymap: "herdr",
    input: "shell",
    setup: () => oneShell(`${DIM}# install only the integrations for agents you use${X}`),
    goal: (state) => did(state, "installed-integration"),
  },
  {
    slug: "herdr-explain",
    track: "herdr",
    module: "Integrations",
    title: "Ask why a status is wrong",
    body:
      "Screen-manifest agents are classified from the bottom of their pane. When a new prompt shape appears, Herdr falls back to idle rather than guessing blocked. Explain shows which rule matched and why.",
    task: "The agent in pane w1:p2 is waiting for you, but the sidebar says idle. Type [herdr agent explain w1:p2] and press [enter].",
    takeaway:
      "A fallback named default_known_agent_idle_fallback means no rule matched. Fetch newer rules with herdr server update-agent-manifests, or add a local override under ~/.config/herdr/agent-detection.",
    keymap: "herdr",
    input: "shell",
    setup: () =>
      initialState({
        root: splitRow(
          shellPane(0, [`${DIM}# w1:p1 · your shell${X}`]),
          leaf(1, [`${C}codex${X}  ${G}● idle${X}`, `${Y}▸ Continue with the rewrite? (Y/n)${X}`]),
        ),
        activePaneId: 0,
      }),
    goal: (state) => did(state, "explained-agent"),
  },
  {
    slug: "herdr-automation",
    track: "herdr",
    module: "Automation",
    title: "Let tools drive the layout",
    body:
      "Herdr exposes the same layout and terminal operations through its CLI and local socket API. Scripts and agents can create panes, run commands, prompt agents, read output, and wait for state.",
    task: "Type [herdr pane split --current --direction right] and press [enter].",
    takeaway:
      "Use pane commands for raw terminals and agent commands for recognized agents. Capture IDs from JSON responses instead of predicting them. Plugins package these APIs into reusable workflows.",
    keymap: "herdr",
    input: "shell",
    setup: () => oneShell(`${DIM}# the CLI targets the current Herdr session${X}`),
    goal: (state) => did(state, "automated-pane"),
  },
  {
    slug: "herdr-agent-run",
    track: "herdr",
    module: "Automation",
    title: "Start an agent and give it work",
    body:
      "An agent command targets a recognized agent by name. Start one in an existing shell pane, then prompt it. With --wait the command returns when the agent settles into idle, done, or blocked.",
    task: "Type [herdr agent start reviewer --kind codex --pane w1:p2] and press [enter]. Then type [herdr agent prompt reviewer \"Review the current diff\" --wait] and press [enter].",
    takeaway:
      "Pass agent arguments after a double dash, for example -- -m gpt-5.4. Names must be unique among live agents and clear when the agent exits. Use pane run for ordinary processes.",
    keymap: "herdr",
    input: "shell",
    setup: () =>
      initialState({
        root: splitRow(
          shellPane(0, [`${DIM}# w1:p1 · your shell${X}`]),
          leaf(1, [`${DIM}w1:p2 · a shell waiting at its prompt${X}`]),
        ),
        activePaneId: 0,
      }),
    goal: (state) => did(state, "started-agent") && did(state, "prompted-agent"),
  },
  {
    slug: "herdr-agent-wait",
    track: "herdr",
    module: "Automation",
    title: "Wait for a decision, then read it",
    body:
      "A script should not poll screens. Wait for the state you care about, then read the pane to see what the agent is asking. Reading through the CLI does not mark the agent as seen.",
    task: "Type [herdr agent wait reviewer --until blocked] and press [enter]. Then type [herdr agent read reviewer] and press [enter].",
    takeaway:
      "Answer with herdr agent send-keys reviewer followed by a key such as y, enter, or esc. Prompting a blocked agent is refused, so waits and reads come first.",
    keymap: "herdr",
    input: "shell",
    setup: () =>
      initialState({
        root: splitRow(
          shellPane(0, [`${DIM}# w1:p1 · your shell${X}`]),
          leaf(1, [`${C}codex${X}  ${Y}● working${X}`, `${DIM}reviewer · editing src/auth.ts${X}`]),
        ),
        activePaneId: 0,
      }),
    goal: (state) => did(state, "waited-agent") && did(state, "read-agent"),
  },
  {
    slug: "herdr-skill",
    track: "herdr",
    module: "Automation",
    title: "Let your agent drive Herdr",
    body:
      "Herdr ships a skill file that teaches a coding agent the same CLI you just used. Inside a Herdr pane the agent sees HERDR_ENV=1 and can split panes, start helpers, and wait for them.",
    task: "Type [npx skills add herdrdev/herdr --skill herdr -g] and press [enter].",
    takeaway:
      "The skill refuses to act when HERDR_ENV is not set, so an agent outside Herdr cannot control a session it does not own. Run herdr --skill to print the copy bundled with your binary.",
    keymap: "herdr",
    input: "shell",
    setup: () => oneShell(`${DIM}# installs for every agent with a skill directory${X}`),
    goal: (state) => did(state, "installed-skill"),
  },
  {
    slug: "herdr-plugins",
    track: "herdr",
    module: "Extensions",
    title: "Inspect plugins before installing",
    body:
      "Herdr plugins package CLI workflows as actions, event hooks, terminal panes, and link handlers. A plugin runs as your user and can call the full Herdr CLI.",
    task: "Type [herdr plugin list] and press [enter].",
    takeaway:
      "Browse the marketplace when you need a reusable workflow. Before [herdr plugin install owner/repo], review the manifest and commands. Herdr validates plugin structure but does not sandbox plugin code.",
    keymap: "herdr",
    input: "shell",
    setup: () => oneShell(`${DIM}# plugins are executable code, not themes${X}`),
    goal: (state) => did(state, "listed-plugins"),
  },
  {
    slug: "herdr-field-review",
    track: "herdr",
    module: "Field exercises",
    title: "Review a risky diff beside your work",
    body:
      "You changed authentication code and want an independent review without leaving your main shell. Build a sibling pane, run a named reviewer there, and collect its report.",
    task: "Create a review lane and bring the result back to your shell.",
    steps: [
      {
        text: "Type [herdr pane split --current --direction right --no-focus] and press [enter].",
        done: (state) => did(state, "automated-pane"),
      },
      {
        text: "Type [herdr agent start reviewer --kind codex --pane w1:p2] and press [enter].",
        done: (state) => did(state, "started-agent"),
      },
      {
        text: "Type [herdr agent prompt reviewer \"Review the current diff. Report blocking issues only.\" --wait --timeout 120000] and press [enter].",
        done: (state) => did(state, "prompted-agent"),
      },
      {
        text: "Type [herdr agent read reviewer --source recent-unwrapped --lines 120] and press [enter].",
        done: (state) => did(state, "read-agent"),
      },
    ],
    takeaway:
      "This is the core automation loop: create a place, start a named agent, prompt it with a bounded wait, then read the result. The main shell stays focused throughout.",
    keymap: "herdr",
    input: "shell",
    setup: () =>
      initialState({
        root: shellPane(0, [
          `${DIM}~/projects/webapp  branch: feat/session-hardening${X}`,
          `${Y}git diff: 4 files changed in auth and session code${X}`,
        ]),
        activePaneId: 0,
      }),
    goal: (state) =>
      did(state, "automated-pane") &&
      did(state, "started-agent") &&
      did(state, "prompted-agent") &&
      did(state, "read-agent"),
  },
  {
    slug: "herdr-field-worktree",
    track: "herdr",
    module: "Field exercises",
    title: "Isolate a flaky test fix",
    body:
      "A second agent needs to fix a flaky session test while your current branch stays untouched. Give that work its own checkout and keep the branch visible as a Herdr workspace.",
    task: "Create a worktree, run an implementer inside it, and inspect the result.",
    steps: [
      {
        text: "Type [herdr worktree create --cwd ~/projects/webapp --branch fix/session-timeout --base main --label session-timeout --focus] and press [enter].",
        done: (state) => did(state, "created-worktree"),
      },
      {
        text: "Type [herdr pane split --current --direction right --no-focus] and press [enter].",
        done: (state) => did(state, "automated-pane"),
      },
      {
        text: "Type [herdr agent start implementer --kind codex --pane w2:p2] and press [enter].",
        done: (state) => did(state, "started-agent"),
      },
      {
        text: "Type [herdr agent prompt implementer \"Fix the flaky session timeout test and run the focused suite.\" --wait --timeout 120000] and press [enter].",
        done: (state) => did(state, "prompted-agent"),
      },
      {
        text: "Type [herdr agent read implementer --source recent-unwrapped --lines 120] and press [enter].",
        done: (state) => did(state, "read-agent"),
      },
    ],
    takeaway:
      "A worktree gives the agent a separate checkout and branch. Review its changes before removal. Herdr removes the checkout, not the Git branch.",
    keymap: "herdr",
    input: "shell",
    setup: () =>
      initialState({
        root: shellPane(0, [
          `${DIM}~/projects/webapp  branch: feat/billing${X}`,
          `${G}working tree clean${X}`,
        ]),
        activePaneId: 0,
        workspaces: ["webapp"],
      }),
    goal: (state) =>
      did(state, "created-worktree") &&
      did(state, "automated-pane") &&
      did(state, "started-agent") &&
      did(state, "prompted-agent") &&
      did(state, "read-agent"),
  },
  {
    slug: "herdr-field-blocked",
    track: "herdr",
    module: "Field exercises",
    title: "Handle a blocked agent without guessing",
    body:
      "The reviewer stopped at an approval dialog while you worked elsewhere. Read the live dialog before you send a deliberate key. Do not turn a status signal into automatic approval.",
    task: "Wait for the block, inspect the dialog, and dismiss it safely.",
    steps: [
      {
        text: "Type [herdr agent wait reviewer --until blocked --timeout 120000] and press [enter].",
        done: (state) => did(state, "waited-agent"),
      },
      {
        text: "Type [herdr agent read reviewer --source visible] and press [enter].",
        done: (state) => did(state, "read-agent"),
      },
      {
        text: "Type [herdr agent send-keys reviewer esc] and press [enter].",
        done: (state) => did(state, "sent-agent-keys"),
      },
    ],
    takeaway:
      "Herdr refuses to prompt an agent that is already blocked. Read the dialog first, then use send-keys only for the response you intend.",
    keymap: "herdr",
    input: "shell",
    setup: () =>
      initialState({
        root: splitRow(
          shellPane(0, [`${DIM}# orchestration shell${X}`]),
          leaf(1, [
            `${C}codex${X}  ${R}● blocked${X}`,
            `${Y}Allow edits to src/auth.ts? (y/n)${X}`,
          ]),
        ),
        activePaneId: 0,
        agentPanes: { reviewer: 1 },
      }),
    goal: (state) =>
      did(state, "waited-agent") &&
      did(state, "read-agent") &&
      did(state, "sent-agent-keys"),
  },
]

export function lessonLeafCount(state: TrainerState): number {
  return leaves(state.root).length
}
