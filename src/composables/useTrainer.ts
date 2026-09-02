import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch, type Ref } from "vue"
import { bestScoreKey, loadBestScore, saveBestScore } from "../drills/scoreStore"
import {
  advanceDrillClock,
  createReadyDrill,
  finishDrill,
  recordDrillSuccess,
  remainingDrillMs,
  startDrill,
  type DrillSession,
  type FinishedDrillSession,
} from "../drills/session"
import {
  applyKey,
  executeShellCommand,
  keyLabel,
  type KeyInput,
  type Tool,
  type TrainerState,
} from "../engine/multiplexer"
import type { Lesson } from "../lessons"
import { toolFor } from "../tools"

const TRAIL_LENGTH = 8
const TICK_MS = 100
const FLASH_MS = 500

export type Flash = "bad" | "good" | null

/**
 * One attempt at the open lesson: the simulated session, the key trail and
 * HUD flash, the clock, and the optional timed drill. Resets whenever the
 * lesson changes.
 */
export function useTrainer(lesson: Ref<Lesson>, options: { onCleared: (lesson: Lesson) => void }) {
  const tool = computed<Tool>(() => toolFor(lesson.value.keymap))

  // shallowRef: the engine clones state with structuredClone, which rejects reactive proxies.
  const state = shallowRef<TrainerState>(lesson.value.setup())
  const done = ref(false)
  const startedAt = ref<number | null>(null)
  const elapsed = ref(0)
  /** Bumps whenever the layout is rebuilt, so pane terminals remount. */
  const resetCount = ref(0)
  /** Keys pressed in this attempt, display spelling, newest last. */
  const keyTrail = ref<string[]>([])
  const flash = ref<Flash>(null)
  let flashTimer: number | undefined
  let ticker: number | undefined

  // ---- drill ----

  const drillDefinition = computed(() => lesson.value.drill ?? null)
  const drillKey = computed(() =>
    drillDefinition.value === null ? null : bestScoreKey(drillDefinition.value.id),
  )
  const drillSession = shallowRef<DrillSession<unknown>>(createReadyDrill(0))
  const drillNowMs = ref(0)
  const drillRunning = computed(() => drillSession.value.kind === "running")

  function storedBest(): number {
    return drillKey.value === null ? 0 : loadBestScore(localStorage, drillKey.value)
  }

  function createRound(previous: unknown): unknown {
    return drillDefinition.value?.createRound(Math.random, previous)
  }

  const drillBestScore = computed(() => {
    const session = drillSession.value
    if (session.kind === "running") return Math.max(session.previousBest, session.score)
    return session.bestScore
  })
  const drillSeconds = computed(() => {
    const session = drillSession.value
    if (session.kind !== "running") return "60.0"
    return (remainingDrillMs({ session, nowMs: drillNowMs.value }) / 1_000).toFixed(1)
  })
  const drillUrgent = computed(() => drillRunning.value && Number(drillSeconds.value) <= 10)
  /** Par of the round in play, so the HUD can show keys against it. */
  const drillPar = computed(() => {
    const session = drillSession.value
    const definition = drillDefinition.value
    if (session.kind !== "running" || definition === null) return undefined
    return definition.par(session.round)
  })

  function clearIfTargetReached(bestScore: number): void {
    const definition = drillDefinition.value
    if (definition !== null && bestScore >= definition.target) options.onCleared(lesson.value)
  }

  function replaceLayout(next: TrainerState): void {
    state.value = next
    done.value = false
    startedAt.value = null
    elapsed.value = 0
    resetCount.value += 1
  }

  function persistBest(session: FinishedDrillSession): void {
    if (session.isNewBest && drillKey.value !== null) {
      saveBestScore(localStorage, drillKey.value, session.bestScore)
    }
    clearIfTargetReached(session.bestScore)
  }

  function commitFinishedDrill(session: FinishedDrillSession): void {
    drillSession.value = session
    persistBest(session)
  }

  function startDrillRun(): void {
    const definition = drillDefinition.value
    const session = drillSession.value
    if (definition === null || session.kind === "running") return
    const nowMs = performance.now()
    const running = startDrill({ session, nowMs, createRound })
    drillSession.value = running
    drillNowMs.value = nowMs
    replaceLayout(definition.roundState(running.round))
  }

  /** Leaves the drill. A run cut short still keeps whatever it scored. */
  function exitDrill(): void {
    const session = drillSession.value
    if (session.kind === "running") {
      const finished = finishDrill(session)
      persistBest(finished)
      drillSession.value = createReadyDrill(finished.bestScore)
    } else {
      drillSession.value = createReadyDrill(session.bestScore)
    }
    replaceLayout(lesson.value.setup())
  }

  // ---- lesson lifecycle ----

  function reset(): void {
    const bestScore = storedBest()
    drillSession.value = createReadyDrill(bestScore)
    clearIfTargetReached(bestScore)
    replaceLayout(lesson.value.setup())
    keyTrail.value = []
    flash.value = null
  }

  watch(lesson, reset)

  function pushTrail(label: string): void {
    keyTrail.value = [...keyTrail.value, label].slice(-TRAIL_LENGTH)
  }

  function flashHud(kind: Exclude<Flash, null>): void {
    flash.value = null
    window.clearTimeout(flashTimer)
    // Next frame so a repeated flash restarts the CSS animation.
    requestAnimationFrame(() => {
      flash.value = kind
      flashTimer = window.setTimeout(() => (flash.value = null), FLASH_MS)
    })
  }

  function markDone(): void {
    done.value = true
    options.onCleared(lesson.value)
    flashHud("good")
  }

  function checkGoal(): void {
    const session = drillSession.value
    const definition = drillDefinition.value
    if (session.kind === "running" && definition !== null) {
      if (!definition.solved(state.value, session.round)) return
      const withinPar = state.value.keystrokes <= definition.par(session.round)
      const next = recordDrillSuccess({
        session,
        nowMs: performance.now(),
        createRound,
        withinPar,
      })
      flashHud(withinPar ? "good" : "bad")
      if (next.kind === "finished") return commitFinishedDrill(next)
      drillSession.value = next
      state.value = definition.roundState(next.round)
      resetCount.value += 1
      return
    }
    if (lesson.value.goal(state.value)) markDone()
  }

  function startClock(): void {
    if (!drillRunning.value && startedAt.value === null) startedAt.value = performance.now()
  }

  // ---- input ----

  function pressKey(input: KeyInput): void {
    startClock()
    pushTrail(keyLabel(input))
    state.value = applyKey(state.value, input, tool.value)
    if (state.value.rejected) flashHud("bad")
    checkGoal()
  }

  function runShellCommand(command: string): string[] | null {
    if (done.value) return null
    startClock()
    if (command.length > 0) pushTrail(command)
    pushTrail("enter")
    const result = executeShellCommand(state.value, command, tool.value)
    state.value = result.state
    checkGoal()
    return result.output
  }

  /** Mouse actions are locked while a result is showing or a drill is timing keys. */
  function mouseLocked(): boolean {
    return done.value || drillRunning.value
  }

  function focusPane(id: number): void {
    if (mouseLocked() || state.value.activePaneId === id) return
    state.value = {
      ...state.value,
      activePaneId: id,
      keystrokes: state.value.keystrokes + 1,
      zoomedPaneId: null,
      lastAction: `focused pane ${id} with the mouse`,
    }
    checkGoal()
  }

  function focusWorkspace(index: number): void {
    if (mouseLocked() || state.value.activeWorkspace === index) return
    state.value = {
      ...state.value,
      activeWorkspace: index,
      mode: { kind: "terminal" },
      zoomedPaneId: null,
      lastAction: `opened ${state.value.workspaces[index]} with the mouse`,
    }
    checkGoal()
  }

  function focusTab(index: number): void {
    if (mouseLocked() || state.value.activeTab === index) return
    state.value = {
      ...state.value,
      activeTab: index,
      mode: { kind: "terminal" },
      zoomedPaneId: null,
      lastAction: `opened tab ${index + 1} with the mouse`,
    }
    checkGoal()
  }

  function openHelp(): void {
    if (mouseLocked()) return
    state.value = { ...state.value, mode: { kind: "help" }, lastAction: "opened key help" }
  }

  function closeHelp(): void {
    if (state.value.mode.kind !== "help") return
    state.value = { ...state.value, mode: { kind: "terminal" }, lastAction: "closed key help" }
  }

  // Stays visible after the goal is met: the help lesson clears the moment help opens.
  const helpVisible = computed(() => state.value.mode.kind === "help")

  // ---- clock ----

  onMounted(() => {
    const bestScore = storedBest()
    drillSession.value = createReadyDrill(bestScore)
    clearIfTargetReached(bestScore)
    ticker = window.setInterval(() => {
      const session = drillSession.value
      if (session.kind === "running") {
        const nowMs = performance.now()
        drillNowMs.value = nowMs
        const next = advanceDrillClock({ session, nowMs })
        if (next.kind === "finished") commitFinishedDrill(next)
      } else if (startedAt.value !== null && !done.value) {
        elapsed.value = (performance.now() - startedAt.value) / 1000
      }
    }, TICK_MS)
  })
  onBeforeUnmount(() => {
    window.clearInterval(ticker)
    window.clearTimeout(flashTimer)
  })

  return {
    lesson,
    tool,
    state,
    done,
    elapsed,
    resetCount,
    keyTrail,
    flash,
    helpVisible,
    drill: {
      definition: drillDefinition,
      session: drillSession,
      running: drillRunning,
      bestScore: drillBestScore,
      seconds: drillSeconds,
      urgent: drillUrgent,
      par: drillPar,
      start: startDrillRun,
      exit: exitDrill,
    },
    reset,
    pressKey,
    runShellCommand,
    focusPane,
    focusWorkspace,
    focusTab,
    openHelp,
    closeHelp,
  }
}

export type Trainer = ReturnType<typeof useTrainer>
