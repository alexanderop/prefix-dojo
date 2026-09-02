/** Model, panes, tabs, workspaces, layout, and history. */
import { did, initialState, leaf, leaves } from "../../engine/multiplexer"
import { B, G, Y, R, C, DIM, X, shellPane, splitRow, splitColumn, oneShell } from "../helpers"
import type { Lesson } from "../types"

export const lessons: Lesson[] = [
  {
    slug: "herdr-start",
    track: "herdr",
    module: "Getting started",
    title: "Start Herdr in a project",
    body: "Install Herdr with [brew install herdr] or the installer from herdr.dev. Start it in the directory that contains your project.",
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
    body: "Herdr keeps the prefix model but adds a project level above tabs. A session contains workspaces, each workspace contains tabs, and each tab contains panes and agents.",
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
    body: "Herdr shows the bindings that are active in your current configuration. This is more reliable than memorizing a list that may not match your setup.",
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
    body: "Herdr recognizes agents and rolls their state up through panes, tabs, and workspaces. Red means blocked, yellow working, blue done but unseen, and green idle or seen.",
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
          leaf(2, [`${C}opencode${X}  ${R}● blocked${X}`, `${Y}allow pnpm install? (y/n)${X}`]),
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
    body: "Herdr uses letters that describe the split. The vertical divider makes panes side by side. The horizontal divider stacks them.",
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
    body: "Herdr uses Vim directions for pane focus. The keys are h for left, j for down, k for up, and l for right.",
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
    body: "Focus moves you. Swap moves the pane. A shifted direction key exchanges the focused pane with its neighbor and keeps everything running inside both.",
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
    body: "A Herdr tab is the same level as a tmux window. Each tab owns one pane layout inside the current workspace.",
    task: "Create a tab with [ctrl+b] [c], then return with [ctrl+b] [p].",
    takeaway:
      "Use [n] and [p] for next and previous. Use a number from 1 to 9 after the prefix to jump directly. Rename a tab with [ctrl+b] [shift+t].",
    keymap: "herdr",
    input: "keyboard",
    par: 4,
    setup: () => oneShell(`${DIM}# tab 1: agents${X}`),
    goal: (state) =>
      did(state, "opened-tab") && did(state, "switched-tab") && state.activeTab === 0,
  },
  {
    slug: "herdr-rename",
    track: "herdr",
    module: "Tabs",
    title: "Name what you are looking at",
    body: "Tabs, workspaces, and panes can carry a name. Names appear in the tab row, the sidebar, and the session navigator, so a named layout is easier to come back to.",
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
    body: "Workspace navigation shows your projects and their rolled-up agent state. It stays open while you choose where to go.",
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
    body: "Workspace navigation lists projects. The session navigator lists everything: workspaces, tabs, panes, and agents, filtered as you type.",
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
    body: "Zoom gives one pane the full tab without changing its layout. Resize mode changes the split when one pane needs more room.",
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
    body: "Closing a pane ends the process inside it. Closing a tab closes every pane in it. Neither asks for confirmation, so check the sidebar state first.",
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
    body: "Herdr copy mode can search and select pane history while the process keeps running. Agent detection still reads the live bottom of the pane.",
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
    body: "Copy mode has a search. It is case-insensitive unless the term contains an uppercase letter, and the pane keeps running while you look.",
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
]
