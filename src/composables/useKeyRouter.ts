import { onBeforeUnmount, onMounted, type Ref } from "vue"
import { keyLabel, type KeyInput } from "../engine/multiplexer"
import type { Trainer } from "./useTrainer"

const MODIFIER_KEYS = new Set(["Control", "Shift", "Alt", "Meta"])

function toInput(e: KeyboardEvent): KeyInput {
  return { key: e.key, ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey }
}

/**
 * Decides who gets a key press: the lesson drawer, a result dialog, the
 * browser, xterm, or the trainer. Listens in the capture phase so a prefix
 * chord never reaches the terminal widget.
 */
export function useKeyRouter({
  trainer,
  drawerOpen,
  nextLesson,
}: {
  trainer: Trainer
  drawerOpen: Ref<boolean>
  nextLesson: () => void
}) {
  function swallow(e: KeyboardEvent): void {
    e.preventDefault()
    e.stopPropagation()
  }

  function onKeydown(e: KeyboardEvent): void {
    if (drawerOpen.value) {
      if (e.key === "Escape") {
        swallow(e)
        drawerOpen.value = false
      }
      return
    }

    if (MODIFIER_KEYS.has(e.key)) return
    if (e.metaKey) return // leave cmd+r, cmd+w etc. to the browser

    if (trainer.drill.session.value.kind === "finished") {
      if (e.key === "Enter") {
        swallow(e)
        trainer.drill.start()
      } else if (e.key === "Escape") {
        swallow(e)
        trainer.drill.exit()
      }
      return
    }

    const state = trainer.state.value
    if (trainer.lesson.value.input === "drill" && state.mode.kind === "terminal") {
      const session = trainer.drill.session.value
      if (session.kind === "ready" && e.key === "Enter") {
        swallow(e)
        trainer.drill.start()
        return
      }
      if (session.kind === "running" && e.key === "Escape") {
        swallow(e)
        trainer.drill.exit()
        return
      }
    }

    if (trainer.done.value) {
      if (e.key === "Enter") {
        swallow(e)
        nextLesson()
      } else if ((e.key === "Escape" || e.key === "q") && state.mode.kind === "help") {
        swallow(e)
        trainer.closeHelp()
      }
      return
    }

    // Terminal mode gives ordinary keys to the pane. Other trainer modes own
    // input until the learner exits them.
    const input = toInput(e)
    const isPrefixChord = keyLabel(input) === trainer.tool.value.prefix
    if (!isPrefixChord && state.mode.kind === "terminal") return

    swallow(e)
    trainer.pressKey(input)
  }

  onMounted(() => window.addEventListener("keydown", onKeydown, { capture: true }))
  onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown, { capture: true }))
}
