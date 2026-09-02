<script setup lang="ts">
import { computed } from "vue"
import { modeHint, type KeyHint } from "../engine/bindings"
import type { Tool, TrainerMode, TrainerState } from "../engine/multiplexer"
import type { InputKind } from "../lessons"

const props = defineProps<{
  mode: TrainerMode
  tool: Tool
  input: InputKind
  state: TrainerState
  /** Keys and commands the lesson task names, minus the prefix. */
  lessonKeys: string[]
  done: boolean
  openHelp: () => void
}>()

/** How many key chips to show before folding the rest behind the help overlay. */
const CHIP_LIMIT = 9

interface Chip {
  keys: string[]
  does: string
  wanted: boolean
}

const wanted = computed(() => new Set(props.lessonKeys))

const INPUT_TEXT: Record<InputKind, string> = {
  keyboard:
    "Keys go to the shell right now. Press the prefix first, release it, then one command key.",
  mouse: "This lesson uses the mouse. Click inside the terminal where the task says.",
  shell: "Type the command into the terminal and press enter. Nothing runs on your machine.",
  drill: "Read the prompt in the pane, then answer with the fewest keys you can.",
}

const text = computed(() => {
  if (props.done) return "Lesson cleared. Press enter for the next one, or reset to try again."
  if (props.mode.kind === "terminal") return INPUT_TEXT[props.input]
  return modeHint(props.mode, props.tool).text
})

function toChips(hints: KeyHint[]): Chip[] {
  return hints.map((hint) => ({
    keys: hint.keys,
    does: hint.does,
    wanted: hint.keys.some((key) => wanted.value.has(key)),
  }))
}

const chips = computed<Chip[]>(() => {
  if (props.done) return []
  if (props.mode.kind === "terminal") {
    const own = props.lessonKeys.map((key) => ({ keys: [key], does: "", wanted: true }))
    if (props.input === "keyboard" || props.input === "drill") {
      return [{ keys: [props.tool.prefix], does: "arm the prefix", wanted: true }, ...own]
    }
    return own
  }
  const all = toChips(modeHint(props.mode, props.tool).keys)
  // Keys the lesson asks for come first so they are never folded away.
  return [...all.filter((chip) => chip.wanted), ...all.filter((chip) => !chip.wanted)]
})

const visible = computed(() => chips.value.slice(0, CHIP_LIMIT))
const hidden = computed(() => Math.max(0, chips.value.length - CHIP_LIMIT))

const feedback = computed(() => {
  const action = props.state.lastAction
  if (action === null) return null
  return { text: action, bad: props.state.rejected }
})
</script>

<template>
  <div class="guide" :class="{ 'mode-prefix': mode.kind === 'prefix', done }">
    <div class="guide-row">
      <span class="guide-label">next</span>
      <p class="guide-text">{{ text }}</p>
    </div>
    <div
      v-if="visible.length > 0"
      class="guide-row guide-keys"
      aria-label="keys that do something now"
    >
      <span class="guide-label">press</span>
      <span class="guide-chips">
        <template v-for="(chip, index) in visible" :key="chip.keys.join('|')">
          <span v-if="index > 0 && mode.kind === 'terminal'" class="guide-then" aria-hidden="true"
            >then</span
          >
          <span class="guide-chip" :class="{ wanted: chip.wanted }">
            <kbd v-for="key in chip.keys" :key="key">{{ key }}</kbd>
            <span v-if="chip.does" class="guide-does">{{ chip.does }}</span>
          </span>
        </template>
        <button v-if="hidden > 0" class="guide-more" type="button" @click="openHelp">
          +{{ hidden }} more <kbd>?</kbd>
        </button>
      </span>
    </div>
    <div v-if="feedback" class="guide-row guide-feedback" :class="{ bad: feedback.bad }">
      <span class="guide-label">{{ feedback.bad ? "no" : "did" }}</span>
      <p class="guide-text" role="status">
        <span class="guide-mark" aria-hidden="true">{{ feedback.bad ? "✗" : "✓" }}</span>
        {{ feedback.text }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.guide {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.guide-row {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr);
  gap: 10px;
  align-items: baseline;
}
.guide-label {
  color: var(--faint2);
  font-size: 9px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}
.guide-text {
  margin: 0;
  color: var(--ink);
  font-family: var(--body);
  font-size: 13px;
  line-height: 1.5;
}
.mode-prefix .guide-text {
  color: var(--yellow);
}
.done .guide-text {
  color: var(--green);
}
.guide-chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 8px;
  min-width: 0;
}
.guide-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px 2px 2px;
  border: 1px solid transparent;
  opacity: 0.7;
}
.guide-chip kbd {
  font-size: 11px;
  padding: 0 6px;
}
.guide-chip.wanted {
  opacity: 1;
  border-color: color-mix(in srgb, var(--yellow) 45%, transparent);
  background: rgba(249, 226, 175, 0.07);
}
.guide-chip.wanted kbd {
  color: var(--yellow);
  border-color: var(--yellow);
}
.guide-does {
  color: var(--faint);
  font-family: var(--body);
  font-size: 11px;
}
.guide-then {
  color: var(--faint2);
  font-size: 9.5px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
.guide-more {
  border: 1px solid var(--line2);
  background: transparent;
  color: var(--faint);
  font: inherit;
  font-size: 10.5px;
  padding: 2px 7px;
  cursor: pointer;
}
.guide-more kbd {
  margin-left: 4px;
  font-size: 9.5px;
  padding: 0 4px;
}
.guide-more:hover,
.guide-more:focus-visible {
  color: var(--ink);
  border-color: var(--faint);
  outline: none;
}
.guide-feedback .guide-text {
  color: var(--green);
  font-size: 12.5px;
}
.guide-feedback.bad .guide-text {
  color: var(--red);
}
.guide-feedback .guide-label {
  color: var(--green);
}
.guide-feedback.bad .guide-label {
  color: var(--red);
}
.guide-mark {
  margin-right: 4px;
  font-family: var(--mono);
}
@media (max-width: 560px) {
  .guide-row {
    grid-template-columns: minmax(0, 1fr);
    gap: 2px;
  }
}
</style>
