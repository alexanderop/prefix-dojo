import { describe, expect, it } from "vitest"
import { stripAnsi } from "../engine/ansi"
import { ShellSession } from "./shellSession"

type Run = (command: string) => string[] | null

function enter(shell: ShellSession, command: string, run: Run = () => null): void {
  for (const ch of command) shell.feed(ch, run)
  shell.feed("\r", run)
}

const plain = (shell: ShellSession): string[] => shell.lines.map(stripAnsi)

describe("ShellSession", () => {
  it("runs a lesson command through the trainer and prints its output", () => {
    const shell = new ShellSession()
    const commands: string[] = []
    enter(shell, "herdr plugin list", (command) => {
      commands.push(command)
      return ["no plugins installed"]
    })
    expect(commands).toEqual(["herdr plugin list"])
    expect(plain(shell)).toEqual(["➜  ~/projects/webapp herdr plugin list", "no plugins installed"])
  })

  it("falls back to builtins and reports unknown commands like zsh", () => {
    const shell = new ShellSession({ lines: ["# start"] })
    enter(shell, "echo hello")
    enter(shell, "frobnicate")
    expect(plain(shell)).toContain("hello")
    expect(plain(shell)).toContain("zsh: command not found: frobnicate")
    expect(plain(shell)[0]).toBe("# start")
  })

  it("clears the scrollback with clear and ctrl+l", () => {
    const shell = new ShellSession({ lines: ["old"] })
    enter(shell, "clear")
    expect(shell.lines).toEqual([])
    enter(shell, "ls")
    shell.feed("\x0c", () => null)
    expect(shell.lines).toEqual([])
  })

  it("completes a unique command word on tab", () => {
    const shell = new ShellSession({ commands: ["tmux"] })
    for (const ch of "tm") shell.feed(ch, () => null)
    shell.feed("\t", () => null)
    expect(shell.input).toBe("tmux ")
  })

  it("prints ^C on interrupt and keeps the prompt", () => {
    const shell = new ShellSession()
    for (const ch of "abc") shell.feed(ch, () => null)
    shell.feed("\x03", () => null)
    expect(shell.input).toBe("")
    expect(plain(shell).at(-1)).toBe("➜  ~/projects/webapp ^C")
  })
})
