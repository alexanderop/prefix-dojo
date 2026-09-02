/** Worktrees, sidebar, persistence, remote attach, and integrations. */
import { did, initialState, leaf } from "../../engine/multiplexer"
import { G, Y, R, C, DIM, X, shellPane, splitRow, splitColumn, oneShell } from "../helpers"
import type { Lesson } from "../types"

export const lessons: Lesson[] = [
  {
    slug: "herdr-worktrees",
    track: "herdr",
    module: "Git worktrees",
    title: "Give parallel work its own checkout",
    body: "A Git worktree gives another agent a separate checkout and branch. This prevents parallel agents from writing into the same files in one working tree.",
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
    body: "The sidebar lists agents and rolls their state up to each workspace. You can hide it when the focused terminal needs more width.",
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
    body: "When an agent becomes blocked or done in another pane, Herdr shows a notification. One binding takes you to its target without hunting through the layout.",
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
    body: "Herdr runs a background server that owns panes and agents. The terminal UI is a client, so closing it does not end the session.",
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
    body: "Detach keeps every process. Stopping the server ends them. After a restart Herdr restores workspaces, tabs, panes, and directories, and resumes only agents whose integration reported a session id.",
    task: "End the session on purpose: type [herdr server stop] and press [enter].",
    takeaway:
      "Shells, dev servers, and tests come back as fresh shells in their saved directories. Enable pane_history under experimental in config.toml to replay recent screen contents after a restart.",
    keymap: "herdr",
    input: "shell",
    setup: () =>
      initialState({
        root: splitRow(
          shellPane(0, [`${DIM}# nothing here needs to survive${X}`]),
          leaf(1, [
            `${C}claude${X}  ${G}● idle${X}`,
            `${DIM}resumes with claude --resume on the next start${X}`,
          ]),
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
    body: "Herdr can run entirely inside an SSH shell, like tmux. It can also use your local terminal as a thin client for a Herdr server on another machine.",
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
    body: "Sometimes one agent should fill your terminal, without the sidebar or the layout. Direct attach connects the current terminal to a single agent pane.",
    task: "At the practice prompt, type [herdr agent attach reviewer] and press [enter].",
    takeaway:
      "Detach with [ctrl+b] [q]. Send a literal ctrl+b to the agent with [ctrl+b] [ctrl+b]. Add --takeover when another client owns the input, and use herdr terminal attach for a plain terminal.",
    keymap: "herdr",
    input: "shell",
    setup: () =>
      initialState({
        root: splitRow(
          shellPane(0, [`${DIM}# reviewer is a codex agent in the default session${X}`]),
          leaf(1, [`${C}codex${X}  ${G}● idle${X}`, `${DIM}reviewer · ready${X}`]),
        ),
        activePaneId: 0,
        agentPanes: { reviewer: 1 },
      }),
    goal: (state) => did(state, "attached-agent"),
  },
  {
    slug: "herdr-integration",
    track: "herdr",
    module: "Integrations",
    title: "Install an agent integration",
    body: "Herdr can detect many agents from their process and terminal screen. Integrations add lifecycle signals or session identity when an agent supports them.",
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
    body: "Screen-manifest agents are classified from the bottom of their pane. When a new prompt shape appears, Herdr falls back to idle rather than guessing blocked. Explain shows which rule matched and why.",
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
        agentPanes: { reviewer: 1 },
      }),
    goal: (state) => did(state, "explained-agent"),
  },
]
