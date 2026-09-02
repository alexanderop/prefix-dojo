import type { IDisposable } from "@xterm/xterm"

const G = "\x1b[32m"
const C = "\x1b[36m"
const DIM = "\x1b[90m"
const X = "\x1b[0m"

const PROMPT = `${G}➜${X}  ${C}~${X} `

const FILES = [`${C}src/${X}`, `${C}node_modules/${X}`, "README.md", "package.json", ".tmux.conf"]

type ShellEffect = { kind: "print"; lines: string[] } | { kind: "clear" }

function evaluate(input: string): ShellEffect {
  const [command = "", ...args] = input.split(/\s+/)
  switch (command) {
    case "":
      return { kind: "print", lines: [] }
    case "help":
      return {
        kind: "print",
        lines: [
          `${DIM}practice shell commands:${X}`,
          "  ls  pwd  echo  whoami  date  clear  help",
          `${DIM}lesson commands work exactly as written above the terminal${X}`,
        ],
      }
    case "ls":
      return { kind: "print", lines: [FILES.join("   ")] }
    case "pwd":
      return { kind: "print", lines: ["/home/you/dojo"] }
    case "whoami":
      return { kind: "print", lines: ["you"] }
    case "date":
      return { kind: "print", lines: [new Date().toString()] }
    case "echo":
      return { kind: "print", lines: [args.join(" ")] }
    case "clear":
      return { kind: "clear" }
    case "exit":
      return { kind: "print", lines: [`${DIM}this practice shell stays open${X}`] }
    default:
      return { kind: "print", lines: [`zsh: command not found: ${command}`] }
  }
}

export interface ShellTerminalPort {
  write(data: string): void
  writeln(data: string): void
  clear(): void
  onData(listener: (data: string) => void): IDisposable
}

function eraseInput(term: ShellTerminalPort, input: string): void {
  const width = [...input].length
  if (width > 0) term.write("\b \b".repeat(width))
}

/** Attach the small practice shell and return its exact input subscription. */
export function startShell(
  term: ShellTerminalPort,
  isAlive: () => boolean,
  onCommand: (command: string) => string[] | null,
): IDisposable {
  let input = ""
  term.write(PROMPT)

  return term.onData((data) => {
    if (!isAlive()) return

    if (data === "\r") {
      const command = input.trim()
      term.write("\r\n")
      const commandOutput = onCommand(command)
      const effect: ShellEffect =
        commandOutput === null ? evaluate(command) : { kind: "print", lines: commandOutput }
      if (effect.kind === "clear") term.clear()
      else for (const line of effect.lines) term.writeln(line)
      input = ""
      term.write(PROMPT)
      return
    }

    if (data === "\u007f") {
      const characters = [...input]
      if (characters.length === 0) return
      characters.pop()
      input = characters.join("")
      term.write("\b \b")
      return
    }

    if (data === "\u0003") {
      term.write("^C\r\n")
      input = ""
      term.write(PROMPT)
      return
    }

    if (data === "\u0015") {
      eraseInput(term, input)
      input = ""
      return
    }

    // eslint-disable-next-line no-control-regex -- drops escape sequences and control bytes
    if (data.startsWith("\u001b") || /[\u0000-\u001f]/.test(data)) return
    input += data
    term.write(data)
  })
}
