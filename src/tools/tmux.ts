import { DIM, GREEN, RESET } from "../engine/ansi"
import {
  closeActivePane,
  cyclePane,
  cycleTab,
  detach,
  enterCopyMode,
  navigate,
  newTab,
  openHelp,
  sendLiteralPrefix,
  splitActive,
  switchTab,
  toggleZoom,
  type Direction,
} from "../engine/actions"
import { PREFIX, type Tool } from "../engine/bindings"
import { record } from "../engine/state"

const ARROWS: Record<string, Direction> = { "←": "left", "→": "right", "↑": "up", "↓": "down" }
const TAB = { word: "window", firstNumber: 0 } as const

export const tmux: Tool = {
  id: "tmux",
  label: "tmux",
  prefix: PREFIX,
  sessionName: "work",
  attachCommand: "tmux attach -t work",
  tab: TAB,
  hasWorkspaces: false,
  hasSidebar: false,
  caption: "the session, from a client that can leave",
  helpNote: `In real tmux this list is ${PREFIX} ?. Scroll it with arrows.`,
  bindings: [
    {
      name: "Session",
      items: [
        { keys: ["?"], does: "list key bindings", run: openHelp },
        { keys: ["d"], does: "detach client, keep the session", run: detach },
        {
          keys: [PREFIX],
          does: "send a literal ctrl+b to the shell",
          run: (state) => sendLiteralPrefix(state, PREFIX),
        },
      ],
    },
    {
      name: "Panes",
      items: [
        { keys: ["%"], does: "split pane left / right", run: (state) => splitActive(state, "row") },
        {
          keys: ['"'],
          does: "split pane top / bottom",
          run: (state) => splitActive(state, "column"),
        },
        {
          keys: ["←", "→", "↑", "↓"],
          does: "move focus by direction",
          run: (state, label) => navigate(state, ARROWS[label]),
        },
        { keys: ["o"], does: "cycle to the next pane", run: (state) => cyclePane(state, 1) },
        { keys: ["z"], does: "zoom / unzoom the focused pane", run: toggleZoom },
        { keys: ["x"], does: "close the focused pane", run: closeActivePane },
      ],
    },
    {
      name: "Windows",
      items: [
        { keys: ["c"], does: "create a window", run: newTab },
        { keys: ["n"], does: "next window", run: (state) => cycleTab(state, 1) },
        { keys: ["p"], does: "previous window", run: (state) => cycleTab(state, -1) },
        {
          keys: ["0"],
          does: "…9 jump to a window by number (counts from 0)",
          matches: (label) => /^[0-9]$/.test(label),
          run: (state, label) => switchTab(state, label, TAB),
        },
      ],
    },
    {
      name: "History",
      items: [{ keys: ["["], does: "enter copy mode", run: enterCopyMode }],
    },
  ],
  copy: {
    select: "space",
    copy: "enter",
    search: false,
    hints: [
      { keys: ["↑", "↓", "page up", "page down"], does: "move" },
      { keys: ["space"], does: "start selection" },
      { keys: ["enter"], does: "copy and leave" },
      { keys: ["q"], does: "leave copy mode" },
    ],
  },
  shellCommands: [
    {
      pattern: /^tmux attach -t work$/,
      run: (state) => {
        state.detached = false
        state.lastAction = "attached to tmux session work"
        return [`${DIM}attached to session: work${RESET}`]
      },
    },
    {
      pattern: /^tmux new -s work$/,
      run: (state) => {
        state.detached = false
        state.lastAction = "created and attached to tmux session work"
        record(state, "started-tmux")
        return [`${GREEN}created${RESET}  session: work`]
      },
    },
  ],
}
