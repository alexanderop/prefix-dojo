import { describe, expect, it } from "vitest"
import { LineEditor } from "./lineEditor"

const LEFT = "\x1b[D"
const UP = "\x1b[A"
const DOWN = "\x1b[B"

function type(editor: LineEditor, text: string): void {
  for (const ch of text) editor.feed(ch)
}

describe("LineEditor", () => {
  it("inserts at the caret and submits the line", () => {
    const editor = new LineEditor()
    type(editor, "tmux new -s wrk")
    editor.feed(LEFT)
    editor.feed(LEFT)
    editor.feed("o")
    expect(editor.value).toBe("tmux new -s work")
    expect(editor.feed("\r")).toEqual({ kind: "submit", line: "tmux new -s work" })
    expect(editor.value).toBe("")
  })

  it("handles backspace, ctrl+w, ctrl+u, and ctrl+a / ctrl+e", () => {
    const editor = new LineEditor()
    type(editor, "herdr plugin listt")
    editor.feed("\x7f")
    expect(editor.value).toBe("herdr plugin list")
    editor.feed("\x17")
    expect(editor.value).toBe("herdr plugin ")
    editor.feed("\x01")
    expect(editor.cursor).toBe(0)
    editor.feed("\x05")
    expect(editor.cursor).toBe(13)
    editor.feed("\x15")
    expect(editor.value).toBe("")
  })

  it("browses history with the arrow keys and keeps the draft", () => {
    const editor = new LineEditor()
    type(editor, "ls")
    editor.feed("\r")
    type(editor, "pwd")
    editor.feed("\r")
    type(editor, "ec")
    editor.feed(UP)
    expect(editor.value).toBe("pwd")
    editor.feed(UP)
    expect(editor.value).toBe("ls")
    editor.feed(DOWN)
    editor.feed(DOWN)
    expect(editor.value).toBe("ec")
  })

  it("reports ctrl+c, ctrl+l, and tab as events", () => {
    const editor = new LineEditor()
    type(editor, "her")
    expect(editor.feed("\t")).toEqual({ kind: "complete", word: "her", before: "" })
    expect(editor.feed("\x0c")).toEqual({ kind: "clear" })
    expect(editor.feed("\x03")).toEqual({ kind: "interrupt" })
    expect(editor.value).toBe("")
  })

  it("drops control bytes from pasted text", () => {
    const editor = new LineEditor()
    editor.feed("echo\x00 hi\x07")
    expect(editor.value).toBe("echo hi")
  })
})
