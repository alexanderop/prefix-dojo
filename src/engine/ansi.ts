/** ANSI colour codes shared by lesson text, drill panes, and shell output. */
// eslint-disable-next-line no-control-regex -- escape sequences are the point
export const ANSI = /\x1b\[[0-9;]*m/g

export const BLUE = "\x1b[34;1m"
export const GREEN = "\x1b[32;1m"
export const YELLOW = "\x1b[33;1m"
export const RED = "\x1b[31m"
export const CYAN = "\x1b[36m"
export const DIM = "\x1b[90m"
export const RESET = "\x1b[0m"

export function stripAnsi(text: string): string {
  return text.replace(ANSI, "")
}
