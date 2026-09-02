# Prefix Dojo

Prefix Dojo is an interactive tmux and Herdr course. It teaches the terminal multiplexer model through a simulated terminal, then builds the Herdr-specific workflow on top.

The course has 42 lessons. The tmux track covers installation, named sessions, the prefix, panes, windows, scrollback, and persistence. The Herdr track adds installation, workspaces, agent states, mouse control, tabs, pane layouts, resize and copy modes, configuration, worktrees, notifications, renaming, closing, history search, persistence and server stop, remote and direct attach, integrations and detection explain, CLI agent automation, the agent skill, and plugins.

The last three lessons are field exercises. You run an independent reviewer beside your current shell, isolate an implementation in a Git worktree, and inspect a blocked agent before you send input. These exercises follow the [official agent automation recipes](https://herdr.dev/docs/agent-automation/) and a [community report about using Herdr to fan out agents across worktrees](https://github.com/herdrdev/herdr/discussions/739).

## Run it

```sh
pnpm install
pnpm dev
```

Open the local URL that Vite prints. Most lessons use `ctrl+b` followed by one action key. Shell lessons run inside the fake terminal and do not change your machine.

## What the screen shows

- **Key HUD** above the terminal: the current mode (terminal, prefix armed, copy, resize, …), the keys you pressed so far, one sentence about who receives the next key, and the keys that do something right now. Keys the lesson asks for are highlighted. Rejected keys shake the HUD.
- **Structure map**: session › window › pane for tmux, session › workspace › tab › pane for Herdr, with the other tool's name for each level so the vocabulary transfers.
- **Key help**: `ctrl+b` `?` in a lesson, or the `? all keys` button, lists every binding the trainer implements for the current tool. `src/tools/<tool>.ts` is the binding table; the engine runs the same rows the overlay shows.
- **Status line**: mimics tmux (`[work] 0:sh*`) and turns mauve while the prefix is armed.
- **Lesson cleared** slides up from the bottom so the layout you just built stays visible.

## Check it

```sh
pnpm check
```

That runs ESLint, the Prettier check, Vue's type checker, and Vitest. Each is also available on its own: `pnpm lint`, `pnpm format`, `pnpm test`, `pnpm build`.

## How the code is laid out

```
src/
  engine/       pure state machine: state.ts (types), actions.ts (what a
                binding can do), modes.ts (copy, resize, rename, picker),
                bindings.ts (the Tool contract), multiplexer.ts (applyKey,
                executeShellCommand)
  tools/        one descriptor per tool (tmux.ts, herdr.ts): prefix, session
                name, binding table with the action each key runs, copy-mode
                keys, shell commands
  lessons/      the course; tmux.ts and herdr/*.ts hold the lesson data,
                types.ts the Lesson shape, index.ts the ordered list and
                track grouping
  drills/       timed drills: session.ts (clock and score), definition.ts
                (what a drill needs to provide), navigationDrill.ts
  composables/  useCourse (which lesson), useTrainer (one attempt: state,
                trail, clock, drill), useKeyRouter (who gets a key press),
                useProgress (cleared lessons)
  components/   one file per screen region
```

### Adding things

- **A binding.** Add one row to the tool's table in `src/tools/<tool>.ts` with the action it runs. The engine, key help, and HUD all read that row; `bindings.test.ts` checks that every listed key does something. New behaviour goes into `src/engine/actions.ts`.
- **A shell command.** Add a rule to `shellCommands` in the tool file. Use `commandError` from `src/engine/shell.ts` for failures so the HUD shakes.
- **A lesson.** Add an object to `src/lessons/tmux.ts` or one of `src/lessons/herdr/*.ts`, then a solution to `src/lessons/index.test.ts`. Lessons are data plus `setup` and `goal`.
- **A drill.** Implement `DrillDefinition` (see `src/drills/navigationDrill.ts`) and set `drill:` on the lesson that offers it.
- **A tool.** Add `src/tools/<name>.ts` exporting a `Tool`, register it in `src/tools/index.ts`, and extend the `ToolId` union in `src/engine/bindings.ts`.

## Source of truth

The Herdr lessons follow the current [Herdr documentation](https://herdr.dev/docs/) and the default bindings in [`herdrdev/herdr`](https://github.com/herdrdev/herdr). The tmux lessons use the default bindings documented by `man tmux` and verified against tmux 3.6a.

When Herdr changes a default binding or concept, update the row in `src/tools/herdr.ts`, the affected lesson under `src/lessons/herdr/`, and its solution in `src/lessons/index.test.ts` in the same change.
