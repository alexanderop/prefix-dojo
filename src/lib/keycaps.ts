/** Lesson text spells keys and commands in [brackets]; render them as keycaps. */
export function renderKeys(text: string): string {
  return text.replace(/\[([^\]]+)\]/g, "<kbd>$1</kbd>")
}
