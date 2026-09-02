import { describe, expect, it } from "vitest"
import type { IDisposable } from "@xterm/xterm"
import { startShell, type ShellTerminalPort } from "./fakeShell"

class TerminalStub implements ShellTerminalPort {
  readonly writes: string[] = []
  readonly lines: string[] = []
  clearCount = 0
  private listener: ((data: string) => void) | null = null

  write(data: string): void {
    this.writes.push(data)
  }

  writeln(data: string): void {
    this.lines.push(data)
  }

  clear(): void {
    this.clearCount += 1
  }

  onData(listener: (data: string) => void): IDisposable {
    this.listener = listener
    return {
      dispose: () => {
        this.listener = null
      },
    }
  }

  enter(command: string): void {
    this.listener?.(command)
    this.listener?.("\r")
  }

  send(data: string): void {
    this.listener?.(data)
  }
}

describe("practice shell", () => {
  it("runs a lesson command and reports it to the trainer", () => {
    const terminal = new TerminalStub()
    const commands: string[] = []
    startShell(
      terminal,
      () => true,
      (command) => {
        commands.push(command)
        return command === "herdr plugin list" ? ["no plugins installed"] : null
      },
    )

    terminal.enter("herdr plugin list")

    expect(commands).toEqual(["herdr plugin list"])
    expect(terminal.lines.join("\n")).toContain("no plugins installed")
  })

  it("prints the command result supplied by the trainer", () => {
    const terminal = new TerminalStub()
    startShell(
      terminal,
      () => true,
      (command) =>
        command.endsWith("--no-focus") ? ["created pane w1:p2 without moving focus"] : null,
    )

    terminal.enter("herdr pane split --current --direction right --no-focus")

    expect(terminal.lines).toContain("created pane w1:p2 without moving focus")
    expect(terminal.lines.join("\n")).not.toContain("already showing")
  })

  it("supports editing and clearing the input", () => {
    const terminal = new TerminalStub()
    const commands: string[] = []
    startShell(
      terminal,
      () => true,
      (command) => {
        commands.push(command)
        return null
      },
    )

    terminal.send("tmux new -s wrok")
    terminal.send("\u007f")
    terminal.send("\u007f")
    terminal.send("\u007f")
    terminal.send("ork")
    terminal.send("\r")
    terminal.enter("clear")

    expect(commands).toEqual(["tmux new -s work", "clear"])
    expect(terminal.clearCount).toBe(1)
  })

  it("removes the input listener on dispose", () => {
    const terminal = new TerminalStub()
    const commands: string[] = []
    const input = startShell(
      terminal,
      () => true,
      (command) => {
        commands.push(command)
        return null
      },
    )

    input.dispose()
    terminal.enter("herdr")

    expect(commands).toEqual([])
  })
})
