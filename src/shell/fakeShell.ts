import type { IDisposable } from "@xterm/xterm"

const G = "\x1b[32m"
const C = "\x1b[36m"
const DIM = "\x1b[90m"
const X = "\x1b[0m"

const PROMPT = `${G}➜${X}  ${C}~${X} `

const FILES = [
  `${C}src/${X}`,
  `${C}node_modules/${X}`,
  "README.md",
  "package.json",
  ".tmux.conf",
]

type ShellEffect =
  | { kind: "print"; lines: string[] }
  | { kind: "clear" }

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
    case "tmux":
      if (input === "tmux new -s work") {
        return { kind: "print", lines: [`${G}created${X}  session: work`] }
      }
      if (input === "tmux attach -t work") {
        return { kind: "print", lines: [`${DIM}attached to session: work${X}`] }
      }
      return {
        kind: "print",
        lines: [`${DIM}the trainer is already showing a tmux-style client${X}`],
      }
    case "herdr":
      if (input === "herdr") {
        return {
          kind: "print",
          lines: [`${G}attached${X}  default session · workspace: project`],
        }
      }
      if (input === "herdr --remote workbox") {
        return { kind: "print", lines: [`${G}connected${X}  workbox · default session`] }
      }
      if (input === "herdr integration install codex") {
        return { kind: "print", lines: [`${G}installed${X}  codex integration`] }
      }
      if (input === "herdr pane split --current --direction right") {
        return { kind: "print", lines: [`${G}created${X}  pane w1:p2 · direction right`] }
      }
      if (input === "herdr plugin list") {
        return { kind: "print", lines: [`${DIM}no plugins installed${X}`] }
      }
      if (input === "herdr server stop") {
        return { kind: "print", lines: [`${DIM}stopped${X}  default session · 3 panes ended`] }
      }
      if (/^herdr agent start reviewer --kind codex --pane w1:p\d+/.test(input)) {
        return {
          kind: "print",
          lines: [
            `{"result":{"agent":{"name":"reviewer","kind":"codex","pane_id":"${input.match(/w1:p\d+/)?.[0]}","state":"idle"}}}`,
          ],
        }
      }
      if (/^herdr agent prompt reviewer ".+" --wait/.test(input)) {
        return {
          kind: "print",
          lines: [`{"result":{"agent":"reviewer","state":"done","waited_ms":41830}}`],
        }
      }
      if (/^herdr agent wait reviewer --until blocked/.test(input)) {
        return {
          kind: "print",
          lines: [`{"result":{"agent":"reviewer","state":"blocked","waited_ms":12045}}`],
        }
      }
      if (/^herdr agent read reviewer/.test(input)) {
        return {
          kind: "print",
          lines: [
            `${DIM}── reviewer · recent-unwrapped ──${X}`,
            "I want to edit src/auth.ts to remove the duplicated token check.",
            "allow edits to src/auth.ts? (y/n)",
          ],
        }
      }
      if (input === "herdr agent attach reviewer") {
        return {
          kind: "print",
          lines: [
            `${G}attached${X}  reviewer (codex, w1:p2) · ctrl+b q detaches · ctrl+b ctrl+b sends ctrl+b`,
          ],
        }
      }
      if (/^herdr agent explain w1:p\d+$/.test(input)) {
        return {
          kind: "print",
          lines: [
            `agent:            codex`,
            `state:            idle`,
            `authority:        screen manifest (bundled v14, remote v14)`,
            `matched rule:     none`,
            `fallback:         default_known_agent_idle_fallback`,
            `${DIM}no manifest rule matched the bottom of the screen; Herdr defaulted to idle${X}`,
          ],
        }
      }
      return {
        kind: "print",
        lines: [`${DIM}the trainer is already showing a Herdr-style client${X}`],
      }
    case "npx":
      if (input === "npx skills add herdrdev/herdr --skill herdr -g") {
        return {
          kind: "print",
          lines: [
            `${G}✔${X} herdr  ${DIM}→ ~/.claude/skills/herdr/SKILL.md, ~/.codex/skills/herdr/SKILL.md${X}`,
            `${DIM}agents started inside Herdr (HERDR_ENV=1) can now drive it through the CLI${X}`,
          ],
        }
      }
      return { kind: "print", lines: [`${DIM}npx: only the skill install is simulated here${X}`] }
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
  onCommand: (command: string) => void,
): IDisposable {
  let input = ""
  term.write(PROMPT)

  return term.onData((data) => {
    if (!isAlive()) return

    if (data === "\r") {
      const command = input.trim()
      term.write("\r\n")
      onCommand(command)
      const effect = evaluate(command)
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

    if (data.startsWith("\u001b") || /[\u0000-\u001f]/.test(data)) return
    input += data
    term.write(data)
  })
}
