/** CLI automation, the agent skill, plugins, and the field exercises. */
import { did, initialState, leaf } from "../../engine/multiplexer"
import { G, Y, R, C, DIM, X, shellPane, splitRow, oneShell } from "../helpers"
import type { Lesson } from "../types"

export const lessons: Lesson[] = [
  {
    slug: "herdr-automation",
    track: "herdr",
    module: "Automation",
    title: "Let tools drive the layout",
    body: "Herdr exposes the same layout and terminal operations through its CLI and local socket API. Scripts and agents can create panes, run commands, prompt agents, read output, and wait for state.",
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
    body: "An agent command targets a recognized agent by name. Start one in an existing shell pane, then prompt it. With --wait the command returns when the agent settles into idle, done, or blocked.",
    task: 'Type [herdr agent start reviewer --kind codex --pane w1:p2] and press [enter]. Then type [herdr agent prompt reviewer "Review the current diff" --wait] and press [enter].',
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
    body: "A script should not poll screens. Wait for the state you care about, then read the pane to see what the agent is asking. Reading through the CLI does not mark the agent as seen.",
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
        agentPanes: { reviewer: 1 },
      }),
    goal: (state) => did(state, "waited-agent") && did(state, "read-agent"),
  },
  {
    slug: "herdr-skill",
    track: "herdr",
    module: "Automation",
    title: "Let your agent drive Herdr",
    body: "Herdr ships a skill file that teaches a coding agent the same CLI you just used. Inside a Herdr pane the agent sees HERDR_ENV=1 and can split panes, start helpers, and wait for them.",
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
    body: "Herdr plugins package CLI workflows as actions, event hooks, terminal panes, and link handlers. A plugin runs as your user and can call the full Herdr CLI.",
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
    body: "You changed authentication code and want an independent review without leaving your main shell. Build a sibling pane, run a named reviewer there, and collect its report.",
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
        text: 'Type [herdr agent prompt reviewer "Review the current diff. Report blocking issues only." --wait --timeout 120000] and press [enter].',
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
    body: "A second agent needs to fix a flaky session test while your current branch stays untouched. Give that work its own checkout and keep the branch visible as a Herdr workspace.",
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
        text: 'Type [herdr agent prompt implementer "Fix the flaky session timeout test and run the focused suite." --wait --timeout 120000] and press [enter].',
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
    body: "The reviewer stopped at an approval dialog while you worked elsewhere. Read the live dialog before you send a deliberate key. Do not turn a status signal into automatic approval.",
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
      did(state, "waited-agent") && did(state, "read-agent") && did(state, "sent-agent-keys"),
  },
]
