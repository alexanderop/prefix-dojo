# Prefix Dojo

Prefix Dojo is an interactive tmux and Herdr course. It teaches the terminal multiplexer model through a simulated terminal, then builds the Herdr-specific workflow on top.

The course has 27 short lessons. The tmux track covers installation, named sessions, the prefix, panes, windows, scrollback, and persistence. The Herdr track adds installation, workspaces, agent states, mouse control, tabs, pane layouts, resize and copy modes, configuration, worktrees, persistence, remote attach, integrations, CLI automation, and plugins.

## Run it

```sh
pnpm install
pnpm dev
```

Open the local URL that Vite prints. Most lessons use `ctrl+b` followed by one action key. Shell lessons run inside the fake terminal and do not change your machine.

## Check it

```sh
pnpm test
pnpm build
```

The state machine is pure and covered by Vitest. The production build runs Vue's type checker before Vite.

## Source of truth

The Herdr lessons follow the current [Herdr documentation](https://herdr.dev/docs/) and the default bindings in [`herdrdev/herdr`](https://github.com/herdrdev/herdr). The tmux lessons use the default bindings documented by `man tmux` and verified against tmux 3.6a.

When Herdr changes a default binding or concept, update `src/engine/multiplexer.ts`, the affected lesson in `src/lessons/index.ts`, and its test in the same change.
