import { BLUE, CYAN, DIM, GREEN, RED, RESET, YELLOW, stripAnsi } from "../engine/ansi"
import {
  closeActivePane,
  closeActiveTab,
  closeActiveWorkspace,
  createWorkspace,
  createWorktree,
  cyclePane,
  cycleTab,
  detach,
  enterCopyMode,
  enterResizeMode,
  navigate,
  newTab,
  openGoto,
  openHelp,
  openNotificationTarget,
  openWorkspacePicker,
  sendLiteralPrefix,
  splitActive,
  startRename,
  swapPanes,
  switchTab,
  toggleSidebar,
  toggleZoom,
  type Direction,
} from "../engine/actions"
import { PREFIX, type ShellCommandRule, type Tool } from "../engine/bindings"
import { commandError, namedAgentPane, paneIdFromTarget, setPaneLines } from "../engine/shell"
import { leaves, record } from "../engine/state"

const HJKL: Record<string, Direction> = { h: "left", j: "down", k: "up", l: "right" }
const TAB = { word: "tab", firstNumber: 1 } as const

const AGENT_NAME = "([a-z][a-z0-9_-]{0,31})"

const shellCommands: ShellCommandRule[] = [
  {
    pattern: /^herdr$/,
    run: (state) => {
      state.detached = false
      state.lastAction = "started or attached to the default Herdr session"
      record(state, "started-herdr")
      return [`${GREEN}attached${RESET}  default session · workspace: project`]
    },
  },
  {
    pattern: /^herdr --remote workbox$/,
    run: (state) => {
      state.detached = false
      state.lastAction = "attached to workbox through SSH"
      record(state, "remote-attached")
      return [`${GREEN}connected${RESET}  workbox · default session`]
    },
  },
  {
    pattern: /^herdr integration install codex$/,
    run: (state) => {
      state.lastAction = "installed the Codex integration"
      record(state, "installed-integration")
      return [`${GREEN}installed${RESET}  codex integration`]
    },
  },
  {
    pattern: /^herdr pane split --current --direction right(?: --no-focus)?$/,
    run: (state, match) => {
      const activePaneId = state.activePaneId
      const createdPaneId = state.nextPaneId
      splitActive(state, "row")
      if (match[0].endsWith(" --no-focus")) state.activePaneId = activePaneId
      state.lastAction = "created a pane through the Herdr CLI"
      record(state, "automated-pane")
      return [
        `${GREEN}created${RESET}  pane w${state.activeWorkspace + 1}:p${createdPaneId + 1} · direction right`,
      ]
    },
  },
  {
    pattern:
      /^herdr worktree create --cwd (\S+) --branch (\S+) --base (\S+) --label ([a-zA-Z0-9._-]+) --focus$/,
    run: (state, match) => {
      const label = match[4]
      if (!state.workspaces.includes(label)) state.workspaces.push(label)
      state.activeWorkspace = state.workspaces.indexOf(label)
      state.lastAction = `created and focused worktree ${label} from ${match[3]}`
      record(state, "created-worktree")
      return [`${GREEN}created${RESET}  workspace ${label} · branch ${match[2]} · base ${match[3]}`]
    },
  },
  {
    pattern: /^herdr plugin list$/,
    run: (state) => {
      state.lastAction = "listed installed Herdr plugins"
      record(state, "listed-plugins")
      return [`${DIM}no plugins installed${RESET}`]
    },
  },
  {
    pattern: /^herdr server stop$/,
    run: (state) => {
      state.serverStopped = true
      state.detached = true
      state.agentPanes = {}
      state.lastAction = "stopped the server; every pane and agent in it ended"
      record(state, "stopped-server")
      return [`${DIM}stopped${RESET}  default session · every pane and agent ended`]
    },
  },
  {
    pattern: new RegExp(
      `^herdr agent start ${AGENT_NAME} --kind ([a-z][a-z0-9_-]*) --pane (w\\d+:p\\d+)(?: -- .+)?$`,
    ),
    run: (state, match) => {
      const [, name, kind, target] = match
      const id = paneIdFromTarget(state, target)
      if (id === null) return commandError(state, `no pane ${target}`)
      if (namedAgentPane(state, name) !== null)
        return commandError(state, `agent ${name} already exists`)
      state.agentPanes[name] = id
      setPaneLines(
        state,
        id,
        [
          `${CYAN}${kind}${RESET}  ${GREEN}● idle${RESET}`,
          `${DIM}${name} · ready for a prompt${RESET}`,
        ],
        "static",
      )
      state.lastAction = `started ${kind} in ${target} as ${name}`
      record(state, "started-agent")
      return [
        `{"result":{"agent":{"name":"${name}","kind":"${kind}","pane_id":"${target}","state":"idle"}}}`,
      ]
    },
  },
  {
    pattern: new RegExp(`^herdr agent prompt ${AGENT_NAME} "([^"]+)" --wait(?: --timeout \\d+)?$`),
    run: (state, match) => {
      const [, name, prompt] = match
      const id = namedAgentPane(state, name)
      if (id === null) return commandError(state, `no agent named ${name}`)
      const pane = leaves(state.root).find((candidate) => candidate.id === id)
      const kind = stripAnsi(pane?.lines[0] ?? "").split(/\s+/)[0] || "agent"
      setPaneLines(state, id, [
        `${CYAN}${kind}${RESET}  ${BLUE}● done${RESET}`,
        `${DIM}${name} · finished: ${prompt}${RESET}`,
      ])
      state.lastAction = `${name} worked on the prompt; the wait returned when it settled`
      record(state, "prompted-agent")
      return [`{"result":{"agent":"${name}","state":"done","waited_ms":41830}}`]
    },
  },
  {
    pattern: new RegExp(`^herdr agent wait ${AGENT_NAME} --until blocked(?: --timeout \\d+)?$`),
    run: (state, match) => {
      const name = match[1]
      const id = namedAgentPane(state, name)
      if (id === null) return commandError(state, `no agent named ${name}`)
      setPaneLines(state, id, [
        `${CYAN}codex${RESET}  ${RED}● blocked${RESET}`,
        `${YELLOW}allow edits to src/auth.ts? (y/n)${RESET}`,
      ])
      state.lastAction = `${name} is blocked and waits for a decision`
      record(state, "waited-agent")
      return [`{"result":{"agent":"${name}","state":"blocked","waited_ms":12045}}`]
    },
  },
  {
    pattern: new RegExp(`^herdr agent read ${AGENT_NAME}(?: --source \\S+)?(?: --lines \\d+)?$`),
    run: (state, match) => {
      const name = match[1]
      const id = namedAgentPane(state, name)
      if (id === null) return commandError(state, `no agent named ${name}`)
      const pane = leaves(state.root).find((candidate) => candidate.id === id)
      state.lastAction = `read the ${name} pane without focusing it`
      record(state, "read-agent")
      return [`${DIM}── ${name} · recent-unwrapped ──${RESET}`, ...(pane?.lines ?? [])]
    },
  },
  {
    pattern: new RegExp(`^herdr agent send-keys ${AGENT_NAME} (esc|enter|y|n|ctrl\\+c)$`),
    run: (state, match) => {
      const [, name, key] = match
      const id = namedAgentPane(state, name)
      if (id === null) return commandError(state, `no agent named ${name}`)
      setPaneLines(state, id, [
        `${CYAN}codex${RESET}  ${GREEN}● idle${RESET}`,
        `${DIM}${name} · dismissed the prompt with ${key}${RESET}`,
      ])
      state.lastAction = `sent ${key} to ${name}`
      record(state, "sent-agent-keys")
      return [`${GREEN}sent${RESET}  ${key} · agent ${name}`]
    },
  },
  {
    pattern: new RegExp(`^herdr agent attach ${AGENT_NAME}$`),
    run: (state, match) => {
      const name = match[1]
      if (namedAgentPane(state, name) === null) return commandError(state, `no agent named ${name}`)
      state.lastAction = `attached this terminal directly to ${name}`
      record(state, "attached-agent")
      return [`${GREEN}attached${RESET}  ${name} · ctrl+b q detaches · ctrl+b ctrl+b sends ctrl+b`]
    },
  },
  {
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
        `${DIM}no manifest rule matched; Herdr defaulted to idle${RESET}`,
      ]
    },
  },
  {
    pattern: /^npx skills add herdrdev\/herdr --skill herdr -g$/,
    run: (state) => {
      state.lastAction = "installed the Herdr skill for your agents"
      record(state, "installed-skill")
      return [
        `${GREEN}✔${RESET} herdr  ${DIM}→ ~/.claude/skills/herdr/SKILL.md, ~/.codex/skills/herdr/SKILL.md${RESET}`,
      ]
    },
  },
]

export const herdr: Tool = {
  id: "herdr",
  label: "Herdr",
  prefix: PREFIX,
  sessionName: "default",
  attachCommand: "herdr",
  tab: TAB,
  hasWorkspaces: true,
  hasSidebar: true,
  caption: "the herd, from a client that isn't there",
  helpNote: "Real Herdr shows only the bindings from your config here. Press / to filter.",
  bindings: [
    {
      name: "Session",
      items: [
        { keys: ["?"], does: "key help for the active config", run: openHelp },
        { keys: ["q"], does: "detach client, keep the server", run: detach },
        { keys: ["b"], does: "toggle the agent sidebar", run: toggleSidebar },
        { keys: ["g"], does: "open the session navigator", run: openGoto },
        { keys: ["o"], does: "jump to the visible notification", run: openNotificationTarget },
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
        {
          keys: ["v"],
          does: "split right (vertical divider)",
          run: (state) => splitActive(state, "row"),
        },
        {
          keys: ["-"],
          does: "split down (horizontal divider)",
          run: (state) => splitActive(state, "column"),
        },
        {
          keys: ["h", "j", "k", "l"],
          does: "move focus left / down / up / right",
          run: (state, label) => navigate(state, HJKL[label]),
        },
        {
          keys: ["shift+h", "shift+j", "shift+k", "shift+l"],
          does: "swap with the neighbor",
          run: (state, label) => swapPanes(state, HJKL[label.slice("shift+".length)]),
        },
        {
          keys: ["tab", "shift+tab"],
          does: "cycle to the next / previous pane",
          run: (state, label) => cyclePane(state, label === "tab" ? 1 : -1),
        },
        { keys: ["z"], does: "zoom / unzoom the focused pane", run: toggleZoom },
        { keys: ["r"], does: "enter resize mode", run: enterResizeMode },
        {
          keys: ["shift+p"],
          does: "rename the focused pane",
          run: (state) => startRename(state, "pane"),
        },
        { keys: ["x"], does: "close the focused pane", run: closeActivePane },
      ],
    },
    {
      name: "Tabs",
      items: [
        { keys: ["c"], does: "create a tab", run: newTab },
        { keys: ["n"], does: "next tab", run: (state) => cycleTab(state, 1) },
        { keys: ["p"], does: "previous tab", run: (state) => cycleTab(state, -1) },
        {
          keys: ["1"],
          does: "…9 jump to a tab by number (counts from 1)",
          matches: (label) => /^[0-9]$/.test(label),
          run: (state, label) => switchTab(state, label, TAB),
        },
        { keys: ["shift+t"], does: "rename the tab", run: (state) => startRename(state, "tab") },
        { keys: ["shift+x"], does: "close the tab", run: closeActiveTab },
      ],
    },
    {
      name: "Workspaces and Git",
      items: [
        { keys: ["shift+n"], does: "create a workspace", run: createWorkspace },
        { keys: ["w"], does: "workspace navigation", run: openWorkspacePicker },
        {
          keys: ["shift+w"],
          does: "rename the workspace",
          run: (state) => startRename(state, "workspace"),
        },
        { keys: ["shift+d"], does: "close the workspace", run: closeActiveWorkspace },
        { keys: ["shift+g"], does: "create a Git worktree", run: createWorktree },
      ],
    },
    {
      name: "History",
      items: [{ keys: ["["], does: "enter copy mode", run: enterCopyMode }],
    },
  ],
  copy: {
    select: "v",
    copy: "y",
    search: true,
    hints: [
      { keys: ["h", "j", "k", "l", "page up"], does: "move" },
      { keys: ["/", "?"], does: "search forward / backward" },
      { keys: ["n", "N"], does: "repeat the search, same / opposite direction" },
      { keys: ["v"], does: "start selection" },
      { keys: ["y"], does: "copy and leave" },
      { keys: ["q"], does: "leave copy mode" },
    ],
  },
  shellCommands,
}
