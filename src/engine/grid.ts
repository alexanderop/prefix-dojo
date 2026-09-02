/**
 * A character grid the compositor draws into, the way a multiplexer draws
 * into the terminal it owns. Text can carry SGR colour sequences; the grid
 * parses them, clips to a width, and serializes each row back to ANSI with
 * the fewest attribute changes.
 */

export interface Style {
  fg: string | null
  bg: string | null
  bold: boolean
  dim: boolean
  reverse: boolean
}

export interface Cell extends Style {
  ch: string
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** Catppuccin mocha, the palette `style.css` and the xterm theme share. */
export const PALETTE = {
  bg: "#11111b",
  side: "#181825",
  surface: "#1e1e2e",
  border: "#45475a",
  fg: "#cdd6f4",
  dim: "#9399b2",
  muted: "#6c7086",
  spot: "#cba6f7",
  ink: "#17171a",
  green: "#a6e3a1",
  yellow: "#f9e2af",
  red: "#f38ba8",
  teal: "#94e2d5",
  blue: "#89b4fa",
  cyan: "#94e2d5",
  black: "#11111b",
} as const

const BASIC = [
  PALETTE.black,
  PALETTE.red,
  PALETTE.green,
  PALETTE.yellow,
  PALETTE.blue,
  PALETTE.spot,
  PALETTE.cyan,
  PALETTE.fg,
]
const BRIGHT = [
  PALETTE.muted,
  PALETTE.red,
  PALETTE.green,
  PALETTE.yellow,
  PALETTE.blue,
  PALETTE.spot,
  PALETTE.cyan,
  PALETTE.fg,
]

export const PLAIN: Style = { fg: null, bg: null, bold: false, dim: false, reverse: false }

export function style(overrides: Partial<Style>): Style {
  return { ...PLAIN, ...overrides }
}

// eslint-disable-next-line no-control-regex -- escape sequences are the point
const SGR = /\x1b\[([0-9;]*)m/g

function hexToRgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16)
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff]
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`
}

/** Apply one SGR parameter list to a style, the way a terminal would. */
export function applySgr(current: Style, params: string, base: Style): Style {
  const next = { ...current }
  const codes = params === "" ? [0] : params.split(";").map(Number)
  for (let i = 0; i < codes.length; i += 1) {
    const code = codes[i]
    if (code === 0) Object.assign(next, base)
    else if (code === 1) next.bold = true
    else if (code === 2) next.dim = true
    else if (code === 7) next.reverse = true
    else if (code === 22) {
      next.bold = false
      next.dim = false
    } else if (code === 27) next.reverse = false
    else if (code >= 30 && code <= 37) next.fg = BASIC[code - 30]
    else if (code >= 90 && code <= 97) next.fg = BRIGHT[code - 90]
    else if (code === 39) next.fg = base.fg
    else if (code >= 40 && code <= 47) next.bg = BASIC[code - 40]
    else if (code >= 100 && code <= 107) next.bg = BRIGHT[code - 100]
    else if (code === 49) next.bg = base.bg
    else if (code === 38 || code === 48) {
      const target = code === 38 ? "fg" : "bg"
      if (codes[i + 1] === 2 && i + 4 < codes.length) {
        next[target] = rgbToHex(codes[i + 2], codes[i + 3], codes[i + 4])
        i += 4
      } else if (codes[i + 1] === 5 && i + 2 < codes.length) {
        const index = codes[i + 2]
        next[target] = index < 8 ? BASIC[index] : index < 16 ? BRIGHT[index - 8] : next[target]
        i += 2
      }
    }
  }
  return next
}

/** Number of columns a string occupies once its escape sequences are gone. */
export function textWidth(text: string): number {
  return [...text.replace(SGR, "")].length
}

// ---- box-drawing line layer ----

const UP = 1
const DOWN = 2
const LEFT = 4
const RIGHT = 8

const SQUARE: Record<number, string> = {
  [UP]: "│",
  [DOWN]: "│",
  [UP | DOWN]: "│",
  [LEFT]: "─",
  [RIGHT]: "─",
  [LEFT | RIGHT]: "─",
  [DOWN | RIGHT]: "┌",
  [DOWN | LEFT]: "┐",
  [UP | RIGHT]: "└",
  [UP | LEFT]: "┘",
  [UP | DOWN | RIGHT]: "├",
  [UP | DOWN | LEFT]: "┤",
  [LEFT | RIGHT | DOWN]: "┬",
  [LEFT | RIGHT | UP]: "┴",
  [UP | DOWN | LEFT | RIGHT]: "┼",
}
const ROUNDED: Record<number, string> = {
  ...SQUARE,
  [DOWN | RIGHT]: "╭",
  [DOWN | LEFT]: "╮",
  [UP | RIGHT]: "╰",
  [UP | LEFT]: "╯",
}

export class Grid {
  readonly cols: number
  readonly rows: number
  readonly cells: Cell[][]
  private readonly lines: Uint8Array
  private readonly lineColor: Array<string | null>

  constructor(cols: number, rows: number) {
    this.cols = cols
    this.rows = rows
    this.cells = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => ({ ch: " ", ...PLAIN })),
    )
    this.lines = new Uint8Array(cols * rows)
    this.lineColor = Array.from({ length: cols * rows }, () => null)
  }

  inside(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.cols && y < this.rows
  }

  put(x: number, y: number, ch: string, s: Style): void {
    if (!this.inside(x, y)) return
    this.cells[y][x] = { ch, ...s }
  }

  fill(rect: Rect, s: Style, ch = " "): void {
    for (let y = rect.y; y < rect.y + rect.h; y += 1)
      for (let x = rect.x; x < rect.x + rect.w; x += 1) this.put(x, y, ch, s)
  }

  /**
   * Write text that may contain SGR sequences, clipped to `maxWidth` columns.
   * Returns the number of columns written.
   */
  text(x: number, y: number, text: string, maxWidth: number, base: Style = PLAIN): number {
    let current = { ...base }
    let cursor = 0
    let last = 0
    const emit = (chunk: string): void => {
      for (const ch of chunk) {
        if (cursor >= maxWidth) return
        if (ch === "\t") {
          const stop = Math.min(maxWidth, cursor + 8 - (cursor % 8))
          while (cursor < stop) this.put(x + cursor++, y, " ", current)
          continue
        }
        const code = ch.codePointAt(0) ?? 0
        if (code < 0x20 || (code >= 0x7f && code < 0xa0)) continue
        this.put(x + cursor, y, ch, current)
        cursor += 1
      }
    }
    for (const match of text.matchAll(SGR)) {
      emit(text.slice(last, match.index))
      current = applySgr(current, match[1], base)
      last = match.index + match[0].length
    }
    emit(text.slice(last))
    return cursor
  }

  /** Text anchored to the right edge of a span. */
  textRight(xEnd: number, y: number, text: string, base: Style = PLAIN): number {
    const width = textWidth(text)
    return this.text(xEnd - width, y, text, width, base)
  }

  hline(x0: number, x1: number, y: number): void {
    for (let x = x0; x <= x1; x += 1) this.join(x, y, (x > x0 ? LEFT : 0) | (x < x1 ? RIGHT : 0))
    this.joinIfLine(x0 - 1, y, RIGHT)
    this.joinIfLine(x1 + 1, y, LEFT)
  }

  vline(x: number, y0: number, y1: number): void {
    for (let y = y0; y <= y1; y += 1) this.join(x, y, (y > y0 ? UP : 0) | (y < y1 ? DOWN : 0))
    this.joinIfLine(x, y0 - 1, DOWN)
    this.joinIfLine(x, y1 + 1, UP)
  }

  /** Colour the line cells on a rectangle's perimeter, e.g. for the active pane. */
  paintBorder(rect: Rect, color: string): void {
    for (let x = rect.x - 1; x <= rect.x + rect.w; x += 1) {
      this.paint(x, rect.y - 1, color)
      this.paint(x, rect.y + rect.h, color)
    }
    for (let y = rect.y - 1; y <= rect.y + rect.h; y += 1) {
      this.paint(rect.x - 1, y, color)
      this.paint(rect.x + rect.w, y, color)
    }
  }

  private paint(x: number, y: number, color: string): void {
    if (this.inside(x, y) && this.lines[y * this.cols + x] !== 0)
      this.lineColor[y * this.cols + x] = color
  }

  private join(x: number, y: number, bits: number): void {
    if (!this.inside(x, y)) return
    this.lines[y * this.cols + x] |= bits
  }

  /** A line meets a neighbour: add the joining arm only where a line already is. */
  private joinIfLine(x: number, y: number, bits: number): void {
    if (this.inside(x, y) && this.lines[y * this.cols + x] !== 0) this.join(x, y, bits)
  }

  /** Turn the line layer into glyphs. Call once, after every line is drawn. */
  resolveLines(options: { rounded: boolean; color: string }): void {
    const table = options.rounded ? ROUNDED : SQUARE
    for (let y = 0; y < this.rows; y += 1) {
      for (let x = 0; x < this.cols; x += 1) {
        const index = y * this.cols + x
        const bits = this.lines[index]
        if (bits === 0) continue
        const cell = this.cells[y][x]
        this.put(x, y, table[bits] ?? "┼", {
          ...PLAIN,
          bg: cell.bg,
          fg: this.lineColor[index] ?? options.color,
        })
      }
    }
  }

  /** One ANSI string per row, each ending in a reset. */
  serialize(): string[] {
    return this.cells.map((row) => {
      let out = ""
      let current: Style | null = null
      for (const cell of row) {
        if (current === null || !sameStyle(current, cell)) {
          out += sgrFor(cell)
          current = cell
        }
        out += cell.ch
      }
      return out + "\x1b[0m"
    })
  }
}

function sameStyle(a: Style, b: Style): boolean {
  return (
    a.fg === b.fg &&
    a.bg === b.bg &&
    a.bold === b.bold &&
    a.dim === b.dim &&
    a.reverse === b.reverse
  )
}

function sgrFor(s: Style): string {
  const codes: string[] = ["0"]
  if (s.bold) codes.push("1")
  if (s.dim) codes.push("2")
  if (s.reverse) codes.push("7")
  if (s.fg !== null) codes.push(`38;2;${hexToRgb(s.fg).join(";")}`)
  if (s.bg !== null) codes.push(`48;2;${hexToRgb(s.bg).join(";")}`)
  return `\x1b[${codes.join(";")}m`
}
