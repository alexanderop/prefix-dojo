/**
 * The compositor: draws one whole frame of the multiplexer into a character
 * grid, the way tmux or Herdr redraws the terminal it owns. Pane borders are
 * box-drawing glyphs, the status line is the last row, mode prompts live in
 * the status line or a popup, and a detached client shows the outer shell.
 *
 * Pure: state plus shell views in, ANSI rows plus a cursor and hit regions out.
 */
import { stripAnsi } from "./ansi"
import type { Tool } from "./bindings"
import { Grid, PALETTE, style, textWidth, type Rect } from "./grid"
import {
  agentSummaries,
  leaves,
  type AgentState,
  type PaneLeaf,
  type PaneNode,
  type TrainerState,
} from "./state"

export type { Rect } from "./grid"

/** What a shell pane shows: scrollback plus the line being edited. */
export interface ShellView {
  lines: string[]
  prompt: string
  input: string
  /** Caret offset into `input`, in characters. */
  cursor: number
}

export type HitTarget =
  | { kind: "pane"; id: number }
  | { kind: "tab"; index: number }
  | { kind: "workspace"; index: number }

export interface HitRegion extends Rect {
  target: HitTarget
}

export interface Frame {
  rows: string[]
  cursor: { x: number; y: number } | null
  regions: HitRegion[]
}

export interface ScreenInput {
  state: TrainerState
  tool: Tool
  cols: number
  rows: number
  shellView: (paneId: number) => ShellView | undefined
  /** The shell the client returns to after a detach. */
  outerShell: ShellView | null
  /** Right-hand clock for the tmux status line, e.g. "14:05 02-Sep-26". */
  clock: string
}

const AGENT_COLOR: Record<AgentState, string> = {
  working: PALETTE.yellow,
  blocked: PALETTE.red,
  done: PALETTE.blue,
  idle: PALETTE.green,
}
const AGENT_GLYPH: Record<AgentState, string> = {
  working: "●",
  blocked: "◉",
  done: "●",
  idle: "○",
}

const SIDEBAR_MIN_COLS = 70

function agentOf(pane: PaneLeaf): { process: string; state: AgentState } | null {
  const first = stripAnsi(pane.lines[0] ?? "").trim()
  const match = /^(\S+)\s+●\s*(working|blocked|done|idle)/.exec(first)
  if (match === null) return null
  return { process: match[1], state: match[2] as AgentState }
}

/** Border title: process name for an agent, the given name or shell otherwise. */
function paneTitle(state: TrainerState, pane: PaneLeaf): string {
  const named = state.paneNames[pane.id]
  if (named !== undefined) return named
  const agent = agentOf(pane)
  if (agent !== null) return agent.process
  if (pane.variant === "shell") return "zsh"
  const first = stripAnsi(pane.lines[0] ?? "")
    .replace(/^#\s*/, "")
    .trim()
  return first || `pane ${pane.id}`
}

// ---- pane layout ----

/** Split a rectangle the way the tree says, leaving one column or row for each divider. */
function layoutPanes(
  node: PaneNode,
  rect: Rect,
  grid: Grid,
  out: Map<number, Rect> = new Map(),
): Map<number, Rect> {
  if (node.kind === "leaf") {
    out.set(node.id, rect)
    return out
  }
  const [first, second] = node.children
  if (node.dir === "row") {
    const firstW = Math.max(1, Math.floor((rect.w - 1) / 2))
    const dividerX = rect.x + firstW
    grid.vline(dividerX, rect.y, rect.y + rect.h - 1)
    layoutPanes(first, { x: rect.x, y: rect.y, w: firstW, h: rect.h }, grid, out)
    layoutPanes(
      second,
      { x: dividerX + 1, y: rect.y, w: Math.max(1, rect.w - firstW - 1), h: rect.h },
      grid,
      out,
    )
  } else {
    const firstH = Math.max(1, Math.floor((rect.h - 1) / 2))
    const dividerY = rect.y + firstH
    grid.hline(rect.x, rect.x + rect.w - 1, dividerY)
    layoutPanes(first, { x: rect.x, y: rect.y, w: rect.w, h: firstH }, grid, out)
    layoutPanes(
      second,
      { x: rect.x, y: dividerY + 1, w: rect.w, h: Math.max(1, rect.h - firstH - 1) },
      grid,
      out,
    )
  }
  return out
}

function frame(grid: Grid, rect: Rect): void {
  grid.hline(rect.x, rect.x + rect.w - 1, rect.y)
  grid.hline(rect.x, rect.x + rect.w - 1, rect.y + rect.h - 1)
  grid.vline(rect.x, rect.y, rect.y + rect.h - 1)
  grid.vline(rect.x + rect.w - 1, rect.y, rect.y + rect.h - 1)
}

function inset(rect: Rect, dx: number, dy: number): Rect {
  return {
    x: rect.x + dx,
    y: rect.y + dy,
    w: Math.max(1, rect.w - 2 * dx),
    h: Math.max(1, rect.h - 2 * dy),
  }
}

// ---- pane content ----

interface Drawn {
  cursor: { x: number; y: number } | null
}

function drawShell(grid: Grid, rect: Rect, view: ShellView, selecting: boolean): Drawn {
  const all = [...view.lines, view.prompt + view.input]
  const visible = all.slice(-rect.h)
  visible.forEach((line, index) => grid.text(rect.x, rect.y + index, line, rect.w))
  const inputY = rect.y + visible.length - 1
  if (selecting) {
    const row = grid.cells[inputY]
    if (row) for (let x = rect.x; x < rect.x + rect.w; x += 1) row[x].reverse = true
  }
  const before = [...view.input].slice(0, view.cursor).length
  const x = Math.min(rect.x + textWidth(view.prompt) + before, rect.x + rect.w - 1)
  return { cursor: { x, y: inputY } }
}

function drawStatic(grid: Grid, rect: Rect, lines: string[]): Drawn {
  lines.slice(0, rect.h).forEach((line, index) => grid.text(rect.x, rect.y + index, line, rect.w))
  return { cursor: null }
}

/** tmux shows `[position/total]` in the pane's top-right corner in copy mode. */
function drawCopyIndicator(grid: Grid, rect: Rect, total: number): void {
  const label = `[0/${total}]`
  grid.textRight(
    rect.x + rect.w,
    rect.y,
    label,
    style({ fg: PALETTE.black, bg: PALETTE.yellow, bold: true }),
  )
}

// ---- chrome ----

function drawTabs(grid: Grid, rect: Rect, state: TrainerState, regions: HitRegion[]): void {
  grid.fill(rect, style({ bg: PALETTE.surface }))
  let x = rect.x
  for (let index = 0; index < state.tabs; index += 1) {
    const current = index === state.activeTab
    const name = state.tabNames[index] ?? (index === 0 ? "main" : `tab ${index + 1}`)
    const label = ` ${name}${current && state.zoomedPaneId !== null ? " ⤢" : ""} `
    const s = current
      ? style({ fg: PALETTE.ink, bg: PALETTE.spot, bold: true })
      : style({ fg: PALETTE.muted, bg: PALETTE.surface })
    const width = grid.text(x, rect.y, label, rect.x + rect.w - x, s)
    regions.push({ x, y: rect.y, w: width, h: 1, target: { kind: "tab", index } })
    x += width
    grid.put(x, rect.y, "│", style({ fg: PALETTE.border, bg: PALETTE.surface }))
    x += 1
  }
  grid.text(
    x,
    rect.y,
    " + ",
    rect.x + rect.w - x,
    style({ fg: PALETTE.muted, bg: PALETTE.surface }),
  )
}

function drawSidebar(grid: Grid, rect: Rect, state: TrainerState, regions: HitRegion[]): void {
  const side = style({ bg: PALETTE.side })
  grid.fill(rect, side)
  const inner = rect.w - 2
  let y = rect.y
  const title = (text: string): void => {
    grid.text(
      rect.x + 1,
      y,
      text,
      inner,
      style({ fg: PALETTE.muted, bg: PALETTE.side, bold: true }),
    )
    y += 1
  }

  title("spaces")
  state.workspaces.forEach((workspace, index) => {
    const active = index === state.activeWorkspace
    const bg = active ? PALETTE.surface : PALETTE.side
    grid.fill({ x: rect.x, y, w: rect.w, h: 1 }, style({ bg }))
    grid.text(
      rect.x + 1,
      y,
      `${active ? "▸" : " "} ${workspace}`,
      inner,
      style({ fg: active ? PALETTE.fg : PALETTE.dim, bg, bold: active }),
    )
    if (active) {
      const tabs = `${state.tabs} ${state.tabs === 1 ? "tab" : "tabs"}`
      grid.textRight(rect.x + rect.w - 1, y, tabs, style({ fg: PALETTE.spot, bg }))
    }
    regions.push({ x: rect.x, y, w: rect.w, h: 1, target: { kind: "workspace", index } })
    y += 1
  })

  y += 1
  title("agents")
  const agents = agentSummaries(state)
  if (agents.length === 0) {
    grid.text(
      rect.x + 1,
      y,
      "  no agents here",
      inner,
      style({ fg: PALETTE.muted, bg: PALETTE.side }),
    )
  }
  for (const agent of agents) {
    if (y >= rect.y + rect.h) break
    const active = agent.paneId === state.activePaneId
    const bg = active ? PALETTE.surface : PALETTE.side
    grid.fill({ x: rect.x, y, w: rect.w, h: 1 }, style({ bg }))
    grid.text(
      rect.x + 1,
      y,
      AGENT_GLYPH[agent.state],
      1,
      style({ fg: AGENT_COLOR[agent.state], bg }),
    )
    grid.text(
      rect.x + 3,
      y,
      agent.name,
      inner - 2,
      style({ fg: active ? PALETTE.fg : PALETTE.dim, bg, bold: active }),
    )
    grid.textRight(rect.x + rect.w - 1, y, agent.state, style({ fg: AGENT_COLOR[agent.state], bg }))
    regions.push({ x: rect.x, y, w: rect.w, h: 1, target: { kind: "pane", id: agent.paneId } })
    y += 1
  }
}

function tmuxStatus(grid: Grid, y: number, input: ScreenInput): Drawn {
  const { state, tool, cols, clock } = input
  const armed = state.mode.kind === "prefix"
  const bg = armed ? PALETTE.spot : PALETTE.green
  const base = style({ fg: PALETTE.black, bg })
  grid.fill({ x: 0, y, w: cols, h: 1 }, base)

  if (state.mode.kind === "rename") {
    const prompt = `(rename-${tool.tab.word}) `
    grid.text(0, y, prompt + state.mode.value, cols, base)
    return { cursor: { x: Math.min(prompt.length + state.mode.value.length, cols - 1), y } }
  }

  let x = grid.text(0, y, `[${tool.sessionName}] `, cols, base)
  for (let index = 0; index < state.tabs; index += 1) {
    const current = index === state.activeTab
    const name = state.tabNames[index] ?? "zsh"
    const flag = current ? `*${state.zoomedPaneId !== null ? "Z" : ""}` : index === 0 ? "-" : ""
    const label = `${index + tool.tab.firstNumber}:${name}${flag}`
    x += grid.text(x, y, label, cols - x, current ? { ...base, bold: true } : base)
    x += grid.text(x, y, " ", cols - x, base)
  }
  grid.textRight(cols, y, `"dojo" ${clock} `, base)
  return { cursor: null }
}

function herdrStatus(grid: Grid, y: number, input: ScreenInput): Drawn {
  const { state, tool, cols } = input
  const armed = state.mode.kind === "prefix"
  const bg = armed ? PALETTE.spot : PALETTE.surface
  const fg = armed ? PALETTE.ink : PALETTE.dim
  const base = style({ fg, bg })
  grid.fill({ x: 0, y, w: cols, h: 1 }, base)

  let x = grid.text(
    0,
    y,
    ` ${tool.sessionName} `,
    cols,
    style({
      fg: armed ? PALETTE.spot : PALETTE.ink,
      bg: armed ? PALETTE.ink : PALETTE.spot,
      bold: true,
    }),
  )
  x += 1
  const workspace = state.workspaces[state.activeWorkspace] ?? ""
  x += grid.text(x, y, workspace, cols - x, { ...base, fg: armed ? fg : PALETTE.fg, bold: true })
  x += grid.text(x, y, ` · tab ${state.activeTab + 1}/${state.tabs}`, cols - x, base)

  const counts = new Map<AgentState, number>()
  for (const agent of agentSummaries(state))
    counts.set(agent.state, (counts.get(agent.state) ?? 0) + 1)
  for (const agentState of ["blocked", "working", "done", "idle"] as const) {
    const count = counts.get(agentState)
    if (count === undefined) continue
    x += grid.text(x, y, "   ", cols - x, base)
    x += grid.text(x, y, `${AGENT_GLYPH[agentState]} ${count} ${agentState}`, cols - x, {
      ...base,
      fg: armed ? fg : AGENT_COLOR[agentState],
    })
  }

  const hint = armed ? `${tool.prefix} … ` : `${tool.prefix} ? help `
  grid.textRight(cols, y, hint, base)
  return { cursor: null }
}

function popup(
  grid: Grid,
  area: Rect,
  title: string,
  body: string[],
  options: { footer?: string; width?: number; corner?: boolean } = {},
): Rect {
  const content = [...body, ...(options.footer ? ["", options.footer] : [])]
  const width = Math.min(
    area.w,
    Math.max(options.width ?? 0, title.length + 6, ...content.map((line) => textWidth(line) + 4)),
  )
  const height = Math.min(area.h, content.length + 2)
  const x = options.corner ? area.x + area.w - width - 1 : area.x + Math.floor((area.w - width) / 2)
  const y = options.corner
    ? area.y + area.h - height - 1
    : area.y + Math.max(1, Math.floor((area.h - height) / 3))
  const rect = { x, y, w: width, h: height }
  const box = style({ fg: PALETTE.spot, bg: PALETTE.surface })
  grid.fill(rect, style({ bg: PALETTE.surface }))
  grid.put(x, y, "╭", box)
  grid.put(x + width - 1, y, "╮", box)
  grid.put(x, y + height - 1, "╰", box)
  grid.put(x + width - 1, y + height - 1, "╯", box)
  for (let i = 1; i < width - 1; i += 1) {
    grid.put(x + i, y, "─", box)
    grid.put(x + i, y + height - 1, "─", box)
  }
  for (let i = 1; i < height - 1; i += 1) {
    grid.put(x, y + i, "│", box)
    grid.put(x + width - 1, y + i, "│", box)
  }
  grid.text(x + 2, y, ` ${title} `, width - 4, { ...box, bold: true })
  content.forEach((line, index) => {
    if (index + 1 >= height - 1) return
    grid.text(x + 2, y + 1 + index, line, width - 4, style({ fg: PALETTE.fg, bg: PALETTE.surface }))
  })
  return rect
}

function drawMode(grid: Grid, area: Rect, input: ScreenInput): Drawn {
  const { state, tool } = input
  const mode = state.mode
  const dim = `\x1b[90m`
  const x = `\x1b[0m`
  switch (mode.kind) {
    case "workspace-picker": {
      const body = state.workspaces.map(
        (name, index) => `${index === mode.selected ? "\x1b[35;1m▸ " : "  "}${name}${x}`,
      )
      popup(grid, area, "workspaces", body, {
        footer: `${dim}↑↓ select · enter open · esc${x}`,
        width: 32,
      })
      return { cursor: null }
    }
    case "goto":
      popup(
        grid,
        area,
        "go to",
        ["\x1b[35;1m▸ workspace / tab / pane\x1b[0m", "  agent by state"],
        {
          footer: `${dim}type to filter · esc${x}`,
          width: 36,
        },
      )
      return { cursor: null }
    case "resize":
      popup(grid, area, "resize", ["h j k l  grow toward a side"], {
        footer: `${dim}enter or esc leaves${x}`,
        corner: true,
      })
      return { cursor: null }
    case "rename": {
      if (tool.id === "tmux") return { cursor: null }
      const rect = popup(grid, area, `rename ${mode.target}`, [mode.value], {
        footer: `${dim}enter save · esc cancel${x}`,
        width: 34,
      })
      return { cursor: { x: rect.x + 2 + mode.value.length, y: rect.y + 1 } }
    }
    case "copy": {
      if (mode.search === null) return { cursor: null }
      const glyph = mode.search.direction === "forward" ? "/" : "?"
      const line = `${glyph}${mode.search.query}`
      if (mode.search.typing) {
        const rect = popup(grid, area, `search ${mode.search.direction}`, [line], {
          footer: `${dim}enter search · esc cancel${x}`,
          width: 34,
          corner: true,
        })
        return { cursor: { x: rect.x + 2 + line.length, y: rect.y + 1 } }
      }
      const count = mode.search.matches
      popup(
        grid,
        area,
        "search",
        [`${line}  ${dim}${count} ${count === 1 ? "match" : "matches"}${x}`],
        {
          footer: `${dim}n next · N previous · esc${x}`,
          corner: true,
        },
      )
      return { cursor: null }
    }
    default:
      return { cursor: null }
  }
}

function drawNotification(grid: Grid, area: Rect, state: TrainerState, tool: Tool): void {
  if (state.notificationPaneId === null || state.mode.kind !== "terminal") return
  const pane = leaves(state.root).find((leaf) => leaf.id === state.notificationPaneId)
  if (pane === undefined) return
  const agent = agentOf(pane)
  const name =
    Object.entries(state.agentPanes).find(([, id]) => id === pane.id)?.[0] ??
    agent?.process ??
    "agent"
  const text = ` ▲ ${name} needs input · ${tool.prefix} o `
  const width = Math.min(area.w - 2, textWidth(text) + 2)
  const x = area.x + area.w - width - 1
  const y = area.y + 1
  const box = style({ fg: PALETTE.red, bg: PALETTE.surface })
  grid.text(x, y - 1 < area.y ? y : y - 1, "╭" + "─".repeat(width - 2) + "╮", width, box)
  grid.text(x, y, "│", 1, box)
  grid.text(x + 1, y, text, width - 2, style({ fg: PALETTE.fg, bg: PALETTE.surface }))
  grid.text(x + width - 1, y, "│", 1, box)
  grid.text(x, y + 1, "╰" + "─".repeat(width - 2) + "╯", width, box)
}

// ---- entry ----

function fallbackOuter(state: TrainerState, tool: Tool): ShellView {
  const pane = leaves(state.root).find((leaf) => leaf.id === state.activePaneId)
  const lines = state.serverStopped
    ? [`${tool.label.toLowerCase()}: server stopped`]
    : state.detached
      ? [`[detached (from session ${tool.sessionName})]`]
      : (pane?.lines ?? [])
  return { lines, prompt: "$ ", input: "", cursor: 0 }
}

export function renderScreen(input: ScreenInput): Frame {
  const { state, tool, cols, rows } = input
  const grid = new Grid(cols, rows)
  const regions: HitRegion[] = []

  // Outside the multiplexer: the client's own shell.
  if (state.detached || state.serverStopped) {
    const view = input.outerShell ?? fallbackOuter(state, tool)
    const drawn = drawShell(grid, { x: 0, y: 0, w: cols, h: rows }, view, false)
    return { rows: grid.serialize(), cursor: drawn.cursor, regions }
  }

  const herdr = tool.id === "herdr"
  const statusY = rows - 1
  let main: Rect = { x: 0, y: 0, w: cols, h: rows - 1 }

  if (herdr && tool.hasSidebar && state.sidebarVisible && cols >= SIDEBAR_MIN_COLS) {
    const width = Math.min(26, Math.max(18, Math.floor(cols * 0.2)))
    drawSidebar(grid, { x: 0, y: 0, w: width, h: rows - 1 }, state, regions)
    grid.vline(width, 0, rows - 2)
    main = { x: width + 1, y: 0, w: cols - width - 1, h: rows - 1 }
  }

  let area = main
  if (herdr && tool.hasWorkspaces) {
    drawTabs(grid, { x: main.x, y: main.y, w: main.w, h: 1 }, state, regions)
    area = { x: main.x, y: main.y + 1, w: main.w, h: main.h - 1 }
  }

  const panes = leaves(state.root)
  const zoomed =
    state.zoomedPaneId !== null ? panes.find((p) => p.id === state.zoomedPaneId) : undefined
  const framed = herdr && (panes.length > 1 || zoomed !== undefined)
  let rects: Map<number, Rect>
  if (zoomed !== undefined) {
    rects = new Map([[zoomed.id, framed ? inset(area, 1, 1) : area]])
    if (framed) frame(grid, area)
  } else if (framed) {
    frame(grid, area)
    rects = layoutPanes(state.root, inset(area, 1, 1), grid)
  } else {
    rects = layoutPanes(state.root, area, grid)
  }

  const activeRect = rects.get(state.activePaneId)
  if (activeRect !== undefined && rects.size > 0 && (framed || panes.length > 1))
    grid.paintBorder(activeRect, PALETTE.spot)
  if (framed) {
    for (const pane of panes) {
      const rect = rects.get(pane.id)
      if (rect === undefined || pane.id === state.activePaneId) continue
      if (agentOf(pane)?.state === "blocked") grid.paintBorder(rect, PALETTE.red)
    }
  }
  grid.resolveLines({ rounded: herdr, color: PALETTE.border })

  let cursor: { x: number; y: number } | null = null
  const copy = state.mode.kind === "copy" ? state.mode : null
  for (const pane of panes) {
    const rect = rects.get(pane.id)
    if (rect === undefined) continue
    const active = pane.id === state.activePaneId
    const content = herdr ? inset(rect, 1, 0) : rect
    regions.push({ ...rect, target: { kind: "pane", id: pane.id } })

    const view = pane.variant === "shell" ? input.shellView(pane.id) : undefined
    const drawn =
      view !== undefined
        ? drawShell(grid, content, view, active && copy?.selecting === true)
        : pane.variant === "shell"
          ? drawShell(
              grid,
              content,
              { lines: pane.lines, prompt: "$ ", input: "", cursor: 0 },
              false,
            )
          : drawStatic(grid, content, pane.lines)

    if (active && copy !== null) {
      drawCopyIndicator(grid, content, view?.lines.length ?? pane.lines.length)
    } else if (active && state.mode.kind === "terminal" && pane.variant === "shell") {
      cursor = drawn.cursor
    }

    if (framed) {
      const title = ` ${paneTitle(state, pane)} `
      const agent = agentOf(pane)
      const fg = active ? PALETTE.spot : agent?.state === "blocked" ? PALETTE.red : PALETTE.muted
      grid.text(rect.x + 1, rect.y - 1, title, Math.max(0, rect.w - 2), style({ fg, bold: active }))
    }
  }

  drawNotification(grid, area, state, tool)

  const status = herdr ? herdrStatus(grid, statusY, input) : tmuxStatus(grid, statusY, input)
  const mode = drawMode(grid, area, input)
  return { rows: grid.serialize(), cursor: mode.cursor ?? status.cursor ?? cursor, regions }
}

/** Which region, if any, a click at a cell lands on. Later regions win, like z-order. */
export function hitTest(regions: HitRegion[], x: number, y: number): HitTarget | null {
  for (let i = regions.length - 1; i >= 0; i -= 1) {
    const r = regions[i]
    if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return r.target
  }
  return null
}
