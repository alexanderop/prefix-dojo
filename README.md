# Prefix Dojo

Prefix Dojo is an interactive tmux and Herdr course. It teaches the terminal multiplexer model through a simulated terminal, then builds the Herdr-specific workflow on top.

The course has 39 short lessons. The tmux track covers installation, named sessions, the prefix, panes, windows, scrollback, and persistence. The Herdr track adds installation, workspaces, agent states, mouse control, tabs, pane layouts, resize and copy modes, configuration, worktrees, notifications, renaming, closing, history search, persistence and server stop, remote and direct attach, integrations and detection explain, CLI agent automation, the agent skill, and plugins.

## Run it

```sh
pnpm install
pnpm dev
```

Open the local URL that Vite prints. Most lessons use `ctrl+b` followed by one action key. Shell lessons run inside the fake terminal and do not change your machine.

## What the screen shows

- **Key HUD** above the terminal: the current mode (terminal, prefix armed, copy, resize, …), the keys you pressed so far, one sentence about who receives the next key, and the keys that do something right now. Keys the lesson asks for are highlighted. Rejected keys shake the HUD.
- **Structure map**: session › window › pane for tmux, session › workspace › tab › pane for Herdr, with the other tool's name for each level so the vocabulary transfers.
- **Key help**: `ctrl+b` `?` in a lesson, or the `? all keys` button, lists every binding the trainer implements for the current tool. `src/engine/bindings.ts` is the reference table and is tested against the engine.
- **Status line**: mimics tmux (`[work] 0:sh*`) and turns mauve while the prefix is armed.
- **Lesson cleared** slides up from the bottom so the layout you just built stays visible.

## Check it

```sh
pnpm test
pnpm build
```

The state machine is pure and covered by Vitest. The production build runs Vue's type checker before Vite.

## Source of truth

The Herdr lessons follow the current [Herdr documentation](https://herdr.dev/docs/) and the default bindings in [`herdrdev/herdr`](https://github.com/herdrdev/herdr). The tmux lessons use the default bindings documented by `man tmux` and verified against tmux 3.6a.

When Herdr changes a default binding or concept, update `src/engine/multiplexer.ts`, the reference table in `src/engine/bindings.ts`, the affected lesson in `src/lessons/index.ts`, and its test in the same change.
