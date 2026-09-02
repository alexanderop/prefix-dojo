# Prefix Dojo

Prefix Dojo is an interactive tmux and Herdr course. It teaches the terminal multiplexer model through a simulated terminal, then builds the Herdr-specific workflow on top.

The course has 42 lessons and 8 timed drills. The tmux track covers installation, named sessions, the prefix, panes, windows, scrollback, and persistence. The Herdr track adds installation, workspaces, agent states, mouse control, tabs, pane layouts, resize and copy modes, configuration, worktrees, notifications, renaming, closing, history search, persistence and server stop, remote and direct attach, integrations and detection explain, CLI agent automation, the agent skill, and plugins.

The last three lessons are field exercises. You run an independent reviewer beside your current shell, isolate an implementation in a Git worktree, and inspect a blocked agent before you send input. These exercises follow the [official agent automation recipes](https://herdr.dev/docs/agent-automation/) and a [community report about using Herdr to fan out agents across worktrees](https://github.com/herdrdev/herdr/discussions/739).

## Run it

```sh
pnpm install
pnpm dev
```

Open the local URL that Vite prints. Most lessons use `ctrl+b` followed by one action key. Shell lessons run inside the fake terminal and do not change your machine.

## Progress and backups

Prefix Dojo needs no account. It saves the current lesson, completed lessons, and drill best scores in the browser. Use the `progress` menu to download a JSON backup, restore that backup in another browser, or reset all saved progress. Clearing the browser's site data removes progress that has not been exported.

## What the screen shows

- **Key HUD** above the terminal: the current mode (terminal, prefix armed, copy, resize, …), the keys you pressed so far, a `next` sentence about who receives the next key, a `press` row with the keys that do something right now, and a `did` / `no` line that says what the last key did or why it was refused. Keys the lesson asks for are highlighted and listed first. Rejected keys shake the HUD.
- **Lesson brief**: `WHY` explains the concept, `DO` is the task. `prev` / `next` move through the course; the lesson you had open comes back after a reload.
- **Structure map**: session › window › pane for tmux, session › workspace › tab › pane for Herdr, with the other tool's name for each level so the vocabulary transfers.
- **Key help**: `ctrl+b` `?` in a lesson, or the `? all keys` button, lists every binding the trainer implements for the current tool. `src/tools/<tool>.ts` is the binding table; the engine runs the same rows the overlay shows.
- **The terminal** is one xterm.js grid, drawn the way tmux and Herdr draw a real terminal: pane borders are box-drawing glyphs, the active border is coloured, Herdr's sidebar and tab bar are cells in the same grid, and the status line is the last row (`[work] 0:zsh*` for tmux; it turns mauve while the prefix is armed). Copy mode shows tmux's `[0/N]` marker, a tmux rename is a status-line prompt, Herdr modes are popups. Detaching shows the shell you came from, with `[detached (from session work)]`, and the attach command brings the session back.
- **Shell panes** run a small zsh-like shell with a real line editor: arrows, home/end, ctrl+a/e/u/w/k, history with ↑/↓, tab completion for command words, ctrl+c, ctrl+l. Clicks reach the trainer through SGR mouse reporting, so clicking a pane, tab, or sidebar row focuses it like the real tools.
- **Lesson cleared** slides up from the bottom so the layout you just built stays visible.
- **Drills** (marked `60s` in the course index) repeat a module's keys under a clock. Press `enter` to start; the pane shows one prompt at a time with its par, the key count a clean answer needs. A round scores only within par, so a fumbled prefix costs the point. Each drill clears once your best run reaches its target. Best scores persist per browser.

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
                executeShellCommand); grid.ts (a cell grid with SGR parsing
                and box-drawing joins) and screen.ts (the compositor that
                renders one frame of the session, plus click regions)
  shell/        the practice shell: lineEditor.ts (readline-style editing,
                history, completion) and shellSession.ts (scrollback,
                prompt, builtins; lesson commands go to the trainer first)
  tools/        one descriptor per tool (tmux.ts, herdr.ts): prefix, session
                name, binding table with the action each key runs, copy-mode
                keys, shell commands
  lessons/      the course; tmux.ts and herdr/*.ts hold the lesson data,
                types.ts the Lesson shape, index.ts the ordered list and
                track grouping
  drills/       timed drills: session.ts (clock, score, misses), definition.ts
                (what a drill needs to provide), promptDrill.ts (a drill built
                from a list of pane prompts), tmuxDrills.ts and herdrDrills.ts
                (the prompt catalogs), navigationDrill.ts
  composables/  useCourse (which lesson), useTrainer (one attempt: state,
                trail, clock, drill), useKeyRouter (who gets a key press),
                useProgress (cleared lessons)
  progress/     versioned local progress parsing, JSON backups, and reset
  components/   one file per screen region; TerminalScreen.vue owns the
                xterm instance, feeds typed bytes to the focused pane's shell,
                and writes each rendered frame with synchronized output
```

### Adding things

- **A binding.** Add one row to the tool's table in `src/tools/<tool>.ts` with the action it runs. The engine, key help, and HUD all read that row; `bindings.test.ts` checks that every listed key does something. New behaviour goes into `src/engine/actions.ts`.
- **A shell command.** Add a rule to `shellCommands` in the tool file. Use `commandError` from `src/engine/shell.ts` for failures so the HUD shakes. Builtins that every practice shell answers (`ls`, `echo`, …) live in `src/shell/shellSession.ts`.
- **How the screen looks.** `src/engine/screen.ts` decides where borders, titles, the sidebar, the status line, and mode popups go; `screen.test.ts` renders frames as text and asserts on rows. Change the look there, not in CSS.
- **A lesson.** Add an object to `src/lessons/tmux.ts` or one of `src/lessons/herdr/*.ts`, then a solution to `src/lessons/index.test.ts`. Lessons are data plus `setup` and `goal`.
- **A drill.** Add prompts to `src/drills/tmuxDrills.ts` or `src/drills/herdrDrills.ts` (an id, the pane text, par, a start layout, and a `solved` check), then a clean answer to `src/drills/promptDrill.test.ts`. Insert the entry into the course with `drillLesson(...)` right after the module it repeats. A drill that needs its own round logic implements `DrillDefinition` directly, like `src/drills/navigationDrill.ts`.
- **A tool.** Add `src/tools/<name>.ts` exporting a `Tool`, register it in `src/tools/index.ts`, and extend the `ToolId` union in `src/engine/bindings.ts`.

## Source of truth

The Herdr lessons follow the current [Herdr documentation](https://herdr.dev/docs/) and the default bindings in [`herdrdev/herdr`](https://github.com/herdrdev/herdr). The tmux lessons use the default bindings documented by `man tmux` and verified against tmux 3.6a.

When Herdr changes a default binding or concept, update the row in `src/tools/herdr.ts`, the affected lesson under `src/lessons/herdr/`, and its solution in `src/lessons/index.test.ts` in the same change.
