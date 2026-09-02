/**
 * A readline-style line editor fed with the raw bytes a terminal sends:
 * printable text, backspace, arrow and home/end sequences, and the emacs
 * control keys every real shell answers to. Pure state; no terminal access.
 */

export type EditorEvent =
  | { kind: "edit" }
  | { kind: "submit"; line: string }
  | { kind: "interrupt" }
  | { kind: "clear" }
  | { kind: "eof" }
  | { kind: "complete"; word: string; before: string }

const ESC = "\x1b"
const CTRL = (letter: string): string => String.fromCharCode(letter.charCodeAt(0) - 96)

const HOME = new Set([CTRL("a"), `${ESC}[H`, `${ESC}[1~`, `${ESC}OH`])
const END = new Set([CTRL("e"), `${ESC}[F`, `${ESC}[4~`, `${ESC}OF`])
const LEFT = new Set([CTRL("b"), `${ESC}[D`, `${ESC}OD`])
const RIGHT = new Set([CTRL("f"), `${ESC}[C`, `${ESC}OC`])
const UP = new Set([CTRL("p"), `${ESC}[A`, `${ESC}OA`])
const DOWN = new Set([CTRL("n"), `${ESC}[B`, `${ESC}OB`])
const WORD_LEFT = new Set([`${ESC}b`, `${ESC}[1;5D`, `${ESC}[1;3D`])
const WORD_RIGHT = new Set([`${ESC}f`, `${ESC}[1;5C`, `${ESC}[1;3C`])
const BACKSPACE = new Set(["\x7f", "\b"])
const DELETE = `${ESC}[3~`

const MAX_HISTORY = 200

// eslint-disable-next-line no-control-regex -- dropping control bytes is the point
const CONTROL_BYTES = /[\x00-\x1f\x7f]/g

function isWordChar(ch: string | undefined): boolean {
  return ch !== undefined && /\S/.test(ch)
}

export class LineEditor {
  private buffer: string[] = []
  private caret = 0
  private readonly past: string[] = []
  /** Index into history while browsing; equals history.length at the draft. */
  private historyIndex = 0
  private draft: string[] = []

  get value(): string {
    return this.buffer.join("")
  }

  get cursor(): number {
    return this.caret
  }

  get history(): readonly string[] {
    return this.past
  }

  /** Replace the line, e.g. after tab completion. */
  set(text: string): void {
    this.buffer = [...text]
    this.caret = this.buffer.length
  }

  /** Feed one chunk of terminal input. Escape sequences arrive whole. */
  feed(data: string): EditorEvent {
    if (data === "\r" || data === "\n") return this.submit()
    if (data === CTRL("c")) {
      this.set("")
      this.historyIndex = this.past.length
      return { kind: "interrupt" }
    }
    if (data === CTRL("d")) return this.buffer.length === 0 ? { kind: "eof" } : this.deleteForward()
    if (data === CTRL("l")) return { kind: "clear" }
    if (data === "\t") {
      const before = this.buffer.slice(0, this.caret).join("")
      const word = before.slice(before.lastIndexOf(" ") + 1)
      return { kind: "complete", word, before: before.slice(0, before.length - word.length) }
    }
    if (BACKSPACE.has(data)) {
      if (this.caret > 0) {
        this.buffer.splice(this.caret - 1, 1)
        this.caret -= 1
      }
      return { kind: "edit" }
    }
    if (data === DELETE) return this.deleteForward()
    if (HOME.has(data)) return this.moveTo(0)
    if (END.has(data)) return this.moveTo(this.buffer.length)
    if (LEFT.has(data)) return this.moveTo(this.caret - 1)
    if (RIGHT.has(data)) return this.moveTo(this.caret + 1)
    if (WORD_LEFT.has(data)) return this.moveTo(this.wordStart())
    if (WORD_RIGHT.has(data)) return this.moveTo(this.wordEnd())
    if (UP.has(data)) return this.browseHistory(-1)
    if (DOWN.has(data)) return this.browseHistory(1)
    if (data === CTRL("k")) {
      this.buffer.splice(this.caret)
      return { kind: "edit" }
    }
    if (data === CTRL("u")) {
      this.buffer.splice(0, this.caret)
      this.caret = 0
      return { kind: "edit" }
    }
    if (data === CTRL("w")) {
      const start = this.wordStart()
      this.buffer.splice(start, this.caret - start)
      this.caret = start
      return { kind: "edit" }
    }
    // Unknown escape sequences (function keys, mouse reports) are ignored.
    if (data.startsWith(ESC)) return { kind: "edit" }

    // Typed or pasted text; control bytes are dropped.
    const printable = [...data.replace(CONTROL_BYTES, "")]
    if (printable.length === 0) return { kind: "edit" }
    this.buffer.splice(this.caret, 0, ...printable)
    this.caret += printable.length
    return { kind: "edit" }
  }

  private moveTo(index: number): EditorEvent {
    this.caret = Math.max(0, Math.min(this.buffer.length, index))
    return { kind: "edit" }
  }

  private submit(): EditorEvent {
    const line = this.value
    const trimmed = line.trim()
    if (trimmed !== "" && this.past[this.past.length - 1] !== trimmed) {
      this.past.push(trimmed)
      if (this.past.length > MAX_HISTORY) this.past.shift()
    }
    this.historyIndex = this.past.length
    this.draft = []
    this.set("")
    return { kind: "submit", line }
  }

  private browseHistory(step: -1 | 1): EditorEvent {
    const target = this.historyIndex + step
    if (target < 0 || target > this.past.length) return { kind: "edit" }
    if (this.historyIndex === this.past.length) this.draft = [...this.buffer]
    this.historyIndex = target
    this.set(target === this.past.length ? this.draft.join("") : this.past[target])
    return { kind: "edit" }
  }

  private deleteForward(): EditorEvent {
    if (this.caret < this.buffer.length) this.buffer.splice(this.caret, 1)
    return { kind: "edit" }
  }

  private wordStart(): number {
    let i = this.caret
    while (i > 0 && !isWordChar(this.buffer[i - 1])) i -= 1
    while (i > 0 && isWordChar(this.buffer[i - 1])) i -= 1
    return i
  }

  private wordEnd(): number {
    let i = this.caret
    while (i < this.buffer.length && !isWordChar(this.buffer[i])) i += 1
    while (i < this.buffer.length && isWordChar(this.buffer[i])) i += 1
    return i
  }
}
