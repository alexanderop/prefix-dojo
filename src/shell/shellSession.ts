/**
 * One practice shell: scrollback, a prompt, and a line editor. Lesson
 * commands go to the trainer first; anything else runs a small set of
 * builtins so the shell answers like zsh would.
 */
import { LineEditor } from "./lineEditor"

const G = "\x1b[32m"
const C = "\x1b[36m"
const B = "\x1b[34;1m"
const DIM = "\x1b[90m"
const X = "\x1b[0m"

const MAX_LINES = 500

const FILES = [`${B}src${X}`, `${B}node_modules${X}`, "README.md", "package.json", ".tmux.conf"]

const BUILTINS = ["ls", "pwd", "echo", "whoami", "date", "clear", "help", "history", "cat", "exit"]

export interface ShellSessionOptions {
  /** Working directory shown in the prompt. */
  cwd?: string
  /** Lines the pane already showed when the shell started. */
  lines?: string[]
  /** Command words tab completion offers besides the builtins, e.g. "tmux". */
  commands?: string[]
}

export type ShellEvent = { kind: "none" } | { kind: "command"; command: string }

export class ShellSession {
  readonly editor = new LineEditor()
  lines: string[]
  private readonly cwd: string
  private readonly commands: string[]

  constructor(options: ShellSessionOptions = {}) {
    this.cwd = options.cwd ?? "~/projects/webapp"
    this.lines = [...(options.lines ?? [])]
    this.commands = [...new Set([...BUILTINS, ...(options.commands ?? [])])].sort()
  }

  get prompt(): string {
    return `${G}➜${X}  ${C}${this.cwd}${X} `
  }

  get input(): string {
    return this.editor.value
  }

  get cursor(): number {
    return this.editor.cursor
  }

  print(...lines: string[]): void {
    this.lines.push(...lines)
    if (this.lines.length > MAX_LINES) this.lines.splice(0, this.lines.length - MAX_LINES)
  }

  /**
   * Feed terminal input. When a line is submitted, `run` gets the chance to
   * answer it (the trainer's lesson commands); `null` falls through to the
   * builtins.
   */
  feed(data: string, run: (command: string) => string[] | null): ShellEvent {
    const event = this.editor.feed(data)
    switch (event.kind) {
      case "submit": {
        this.print(this.prompt + event.line)
        const command = event.line.trim()
        if (command === "") return { kind: "none" }
        const output = run(command)
        if (output !== null) this.print(...output)
        else this.builtin(command)
        return { kind: "command", command }
      }
      case "interrupt":
        this.print(this.prompt + "^C")
        return { kind: "none" }
      case "clear":
        this.lines = []
        return { kind: "none" }
      case "eof":
        this.print(this.prompt, `${DIM}this practice shell stays open${X}`)
        return { kind: "none" }
      case "complete":
        this.complete(event.word, event.before)
        return { kind: "none" }
      default:
        return { kind: "none" }
    }
  }

  private complete(word: string, before: string): void {
    if (before.trim() !== "" || word === "") return
    const matches = this.commands.filter((command) => command.startsWith(word))
    if (matches.length === 1) {
      this.editor.set(`${before}${matches[0]} `)
    } else if (matches.length > 1) {
      let common = matches[0]
      for (const match of matches) while (!match.startsWith(common)) common = common.slice(0, -1)
      if (common.length > word.length) this.editor.set(`${before}${common}`)
      else this.print(this.prompt + word, matches.join("  "))
    }
  }

  private builtin(input: string): void {
    const [command = "", ...args] = input.split(/\s+/)
    switch (command) {
      case "help":
        this.print(
          `${DIM}practice shell builtins:${X}`,
          `  ${BUILTINS.join("  ")}`,
          `${DIM}lesson commands work exactly as written above the terminal${X}`,
        )
        return
      case "ls":
        this.print(FILES.join("  "))
        return
      case "pwd":
        this.print(this.cwd.replace(/^~/, "/home/you"))
        return
      case "whoami":
        this.print("you")
        return
      case "date":
        this.print(new Date().toString())
        return
      case "echo":
        this.print(args.join(" "))
        return
      case "cat":
        this.print(
          args.length === 0
            ? "cat: missing file"
            : args[0] === "README.md"
              ? "# webapp\n\nA practice project."
              : `cat: ${args[0]}: No such file or directory`,
        )
        return
      case "history":
        this.print(...this.editor.history.map((line, index) => `  ${index + 1}  ${line}`))
        return
      case "clear":
        this.lines = []
        return
      case "exit":
        this.print(`${DIM}this practice shell stays open${X}`)
        return
      default:
        this.print(`zsh: command not found: ${command}`)
    }
  }
}
