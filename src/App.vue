<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue"
import {
  applyKey,
  applyShellCommand,
  leaves,
  type PaneNode,
  type TrainerState,
} from "./engine/multiplexer"
import {
  createNavigationRound,
  type NavigationRound,
} from "./drills/navigationDrill"
import {
  advanceDrillClock,
  createReadyDrill,
  recordDrillSuccess,
  remainingDrillMs,
  startDrill,
  type DrillSession,
  type FinishedDrillSession,
} from "./drills/session"
import {
  loadNavigationBestScore,
  saveNavigationBestScore,
} from "./drills/scoreStore"
import { lessons, type Lesson } from "./lessons"
import { taskKeys } from "./engine/bindings"
import PaneTree from "./components/PaneTree.vue"
import KeyHud from "./components/KeyHud.vue"
import KeyHelp from "./components/KeyHelp.vue"
import StructureMap from "./components/StructureMap.vue"

const STORAGE_KEY = "prefix-dojo/completed"

function loadCompleted(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return new Set()
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Set()
    const currentSlugs = new Set(lessons.map((item) => item.slug))
    return new Set(
      parsed.filter(
        (value): value is string => typeof value === "string" && currentSlugs.has(value),
      ),
    )
  } catch {
    return new Set()
  }
}

const completed = ref<Set<string>>(loadCompleted())
const lessonIndex = ref(0)
const lesson = computed<Lesson>(() => lessons[lessonIndex.value])
const isNavigationLesson = computed(() => lesson.value.slug === "tmux-navigate")

function nextNavigationRound(previous: NavigationRound | null): NavigationRound {
  return createNavigationRound({ random: Math.random, previous })
}

const navigationDrill = shallowRef<DrillSession<NavigationRound>>(
  createReadyDrill(loadNavigationBestScore(localStorage)),
)
const drillNowMs = ref(0)

// shallowRef: the engine clones state with structuredClone, which rejects reactive proxies.
const state = shallowRef<TrainerState>(lessons[0].setup())
const done = ref(false)
const startedAt = ref<number | null>(null)
const elapsed = ref(0)
const resetCount = ref(0)
/** Keys pressed in this attempt, display spelling, newest last. */
const keyTrail = ref<string[]>([])
const flash = ref<"bad" | "good" | null>(null)
/** Key help opened with the mouse; keyboard help lives in state.mode. */
const helpOpen = ref(false)
let ticker: number | undefined
let flashTimer: number | undefined

const TRAIL_LENGTH = 8

function pushTrail(label: string): void {
  keyTrail.value = [...keyTrail.value, label].slice(-TRAIL_LENGTH)
}

function flashHud(kind: "bad" | "good"): void {
  flash.value = null
  window.clearTimeout(flashTimer)
  // Next frame so a repeated flash restarts the CSS animation.
  requestAnimationFrame(() => {
    flash.value = kind
    flashTimer = window.setTimeout(() => (flash.value = null), 500)
  })
}

const KEY_LABELS: Record<string, string> = {
  ArrowLeft: "←",
  ArrowRight: "→",
  ArrowUp: "↑",
  ArrowDown: "↓",
  " ": "space",
  Escape: "esc",
  Enter: "enter",
  Tab: "tab",
  PageUp: "page up",
  PageDown: "page down",
  Backspace: "backspace",
}

function displayKey(e: KeyboardEvent): string {
  const base = KEY_LABELS[e.key] ?? e.key
  if (e.ctrlKey) return `ctrl+${base.toLowerCase()}`
  if (e.shiftKey && /^[a-z]$/i.test(base)) return `shift+${base.toLowerCase()}`
  return base.length === 1 ? base : base.toLowerCase()
}

function loadLesson(index: number): void {
  lessonIndex.value = index
  state.value = lessons[index].setup()
  navigationDrill.value = createReadyDrill(loadNavigationBestScore(localStorage))
  done.value = false
  startedAt.value = null
  elapsed.value = 0
  resetCount.value += 1
  keyTrail.value = []
  flash.value = null
  helpOpen.value = false
}

watch(lessonIndex, async () => {
  await nextTick()
  document.querySelector(".lesson-link.current")?.scrollIntoView({ block: "nearest" })
})

function resetLesson(): void {
  loadLesson(lessonIndex.value)
}

function nextLesson(): void {
  if (lessonIndex.value < lessons.length - 1) loadLesson(lessonIndex.value + 1)
}

function recordLessonCompletion(): void {
  if (completed.value.has(lesson.value.slug)) return
  completed.value = new Set([...completed.value, lesson.value.slug])
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...completed.value]))
  } catch {
    /* progress just won't persist */
  }
}

function markDone(): void {
  done.value = true
  recordLessonCompletion()
  flashHud("good")
}

function commitFinishedDrill(session: FinishedDrillSession): void {
  navigationDrill.value = session
  if (session.isNewBest) saveNavigationBestScore(localStorage, session.bestScore)
}

function startNavigationDrill(): void {
  if (!isNavigationLesson.value || navigationDrill.value.kind === "running") return
  const nowMs = performance.now()
  const running = startDrill({
    session: navigationDrill.value,
    nowMs,
    createRound: nextNavigationRound,
  })
  navigationDrill.value = running
  drillNowMs.value = nowMs
  state.value = running.round.initialState
  done.value = false
  startedAt.value = null
  elapsed.value = 0
  resetCount.value += 1
}

function exitNavigationDrill(): void {
  const session = navigationDrill.value
  const bestScore = session.kind === "running" ? session.previousBest : session.bestScore
  navigationDrill.value = createReadyDrill(bestScore)
  state.value = lesson.value.setup()
  done.value = false
  startedAt.value = null
  elapsed.value = 0
  resetCount.value += 1
}

function checkGoal(): void {
  const session = navigationDrill.value
  if (session.kind === "running") {
    if (state.value.activePaneId !== session.round.targetPaneId) return
    recordLessonCompletion()
    const next = recordDrillSuccess({
      session,
      nowMs: performance.now(),
      createRound: nextNavigationRound,
    })
    if (next.kind === "finished") {
      commitFinishedDrill(next)
      return
    }
    navigationDrill.value = next
    state.value = next.round.initialState
    resetCount.value += 1
    return
  }
  if (lesson.value.goal(state.value)) markDone()
}

const MODIFIER_KEYS = new Set(["Control", "Shift", "Alt", "Meta"])

function onKeydown(e: KeyboardEvent): void {
  if (MODIFIER_KEYS.has(e.key)) return
  if (e.metaKey) return // leave cmd+r, cmd+w etc. to the browser

  if (helpOpen.value) {
    if (e.key === "Escape" || e.key === "q") {
      e.preventDefault()
      e.stopPropagation()
      helpOpen.value = false
    }
    return
  }

  if (isNavigationLesson.value && navigationDrill.value.kind === "finished") {
    if (e.key === "Enter") {
      e.preventDefault()
      e.stopPropagation()
      startNavigationDrill()
    } else if (e.key === "Escape") {
      e.preventDefault()
      e.stopPropagation()
      exitNavigationDrill()
    }
    return
  }

  if (done.value) {
    if (e.key === "Enter") {
      e.preventDefault()
      e.stopPropagation()
      nextLesson()
    } else if ((e.key === "Escape" || e.key === "q") && state.value.mode.kind === "help") {
      e.preventDefault()
      e.stopPropagation()
      closeHelp()
    }
    return
  }

  // Terminal mode gives ordinary keys to the pane. Other trainer modes own
  // input until the learner exits them.
  const isPrefixChord = e.ctrlKey && e.key.toLowerCase() === "b"
  if (!isPrefixChord && state.value.mode.kind === "terminal") return

  e.preventDefault()
  e.stopPropagation() // capture phase: keeps the chord out of xterm's input
  if (navigationDrill.value.kind !== "running" && startedAt.value === null) {
    startedAt.value = performance.now()
  }
  pushTrail(displayKey(e))
  state.value = applyKey(
    state.value,
    { key: e.key, ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey },
    lesson.value.keymap,
  )
  if (isRejectedAction(state.value.lastAction)) flashHud("bad")
  checkGoal()
}

const REJECTED = [
  /has no binding/,
  /^no pane to the/,
  /^no (window|tab) /,
  /^cannot close/,
  /expects h, j, k, l/,
  /^use up or down/,
]

function isRejectedAction(action: string | null): boolean {
  return action !== null && REJECTED.some((pattern) => pattern.test(action))
}

function openHelp(): void {
  if (done.value || navigationDrill.value.kind === "running") return
  helpOpen.value = true
}

function closeHelp(): void {
  helpOpen.value = false
  if (state.value.mode.kind === "help") {
    state.value = { ...state.value, mode: { kind: "terminal" }, lastAction: "closed key help" }
  }
}

// Stays visible after the goal is met: the help lesson clears the moment help opens.
const helpVisible = computed(() => helpOpen.value || state.value.mode.kind === "help")
const lessonKeys = computed(() => taskKeys(lesson.value.task))
const sessionName = computed(() => (lesson.value.keymap === "tmux" ? "work" : "default"))
const windowList = computed(() =>
  Array.from({ length: state.value.tabs }, (_, index) => {
    const current = index === state.value.activeTab
    const zoom = current && state.value.zoomedPaneId !== null ? "Z" : ""
    return {
      index,
      current,
      label: `${index}:sh${current ? "*" : ""}${zoom}`,
      name: index === 0 ? "main" : `tab ${index + 1}`,
    }
  }),
)

/** Herdr draws its sidebar for herdr lessons only, and only while it is toggled on. */
const showSidebar = computed(() => lesson.value.keymap === "herdr" && state.value.sidebarVisible)
const showTabs = computed(() => lesson.value.keymap === "herdr")

type AgentState = "working" | "blocked" | "done" | "idle"
const AGENT_GLYPH: Record<AgentState, string> = { working: "●", blocked: "◉", done: "●", idle: "○" }

/** Panes whose first line names an agent and its state, for the sidebar's agents half. */
const agents = computed(() =>
  leaves(state.value.root).flatMap((pane) => {
    const first = (pane.lines[0] ?? "").replace(/\x1b\[[0-9;]*m/g, "").trim()
    const match = /^(\S+)\s+●\s*(working|blocked|done|idle)/.exec(first)
    if (!match) return []
    const agentState = match[2] as AgentState
    return [{ id: pane.id, name: match[1], state: agentState, glyph: AGENT_GLYPH[agentState] }]
  }),
)

function focusPane(id: number): void {
  if (done.value || navigationDrill.value.kind === "running" || state.value.activePaneId === id) {
    return
  }
  state.value = {
    ...state.value,
    activePaneId: id,
    keystrokes: state.value.keystrokes + 1,
    zoomedPaneId: null,
    lastAction: `focused pane ${id} with the mouse`,
  }
  checkGoal()
}

function runShellCommand(command: string): void {
  if (done.value) return
  if (startedAt.value === null) startedAt.value = performance.now()
  if (command.length > 0) pushTrail(command)
  pushTrail("enter")
  state.value = applyShellCommand(state.value, command, lesson.value.keymap)
  checkGoal()
}

onMounted(() => {
  window.addEventListener("keydown", onKeydown, { capture: true })
  ticker = window.setInterval(() => {
    const drill = navigationDrill.value
    if (drill.kind === "running") {
      const nowMs = performance.now()
      drillNowMs.value = nowMs
      const next = advanceDrillClock({ session: drill, nowMs })
      if (next.kind === "finished") commitFinishedDrill(next)
    } else if (startedAt.value !== null && !done.value) {
      elapsed.value = (performance.now() - startedAt.value) / 1000
    }
  }, 100)
})
onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeydown, { capture: true })
  window.clearInterval(ticker)
  window.clearTimeout(flashTimer)
})

function renderKeys(text: string): string {
  return text.replace(/\[([^\]]+)\]/g, "<kbd>$1</kbd>")
}

const bodyHtml = computed(() => renderKeys(lesson.value.body))
const taskHtml = computed(() => renderKeys(lesson.value.task))
const takeawayHtml = computed(() => renderKeys(lesson.value.takeaway))
function groupModules(items: Lesson[]): Array<{ name: string; items: Lesson[] }> {
  const groups: Array<{ name: string; items: Lesson[] }> = []
  for (const item of items) {
    const current = groups.at(-1)
    if (current?.name === item.module) current.items.push(item)
    else groups.push({ name: item.module, items: [item] })
  }
  return groups
}

const tracks = computed(() => [
  {
    name: "tmux",
    label: "tmux",
    items: lessons.filter((item) => item.track === "tmux"),
  },
  {
    name: "herdr",
    label: "Herdr",
    items: lessons.filter((item) => item.track === "herdr"),
  },
].map((track) => ({ ...track, modules: groupModules(track.items) })))
const isLast = computed(() => lessonIndex.value === lessons.length - 1)
const trackPosition = computed(() => {
  const items = lessons.filter((item) => item.track === lesson.value.track)
  return {
    current: items.findIndex((item) => item.slug === lesson.value.slug) + 1,
    total: items.length,
  }
})
const visibleRoot = computed<PaneNode>(() => {
  if (state.value.zoomedPaneId === null) return state.value.root
  return leaves(state.value.root).find((pane) => pane.id === state.value.zoomedPaneId) ?? state.value.root
})
const drillBestScore = computed(() => {
  const session = navigationDrill.value
  if (session.kind === "running") return Math.max(session.previousBest, session.score)
  return session.bestScore
})
const drillSeconds = computed(() => {
  const session = navigationDrill.value
  if (session.kind !== "running") return "60.0"
  return (remainingDrillMs({ session, nowMs: drillNowMs.value }) / 1_000).toFixed(1)
})
const isDrillUrgent = computed(() =>
  navigationDrill.value.kind === "running" && Number(drillSeconds.value) <= 10,
)
</script>

<template>
  <div class="site">
    <header class="fighd">
      <h1>prefix dojo <i>·</i> learn tmux and herdr by doing</h1>
      <div class="r" :title="`${completed.size} of ${lessons.length} lessons cleared`">
        <span>{{ completed.size }} / {{ lessons.length }} cleared</span>
        <span class="progress">
          <span class="progress-bar" :style="{ width: `${(completed.size / lessons.length) * 100}%` }"></span>
        </span>
      </div>
    </header>

    <div class="layout">
      <aside class="sidebar">
        <nav v-for="track in tracks" :key="track.name" class="track">
          <h2>
            {{ track.label }}
            <span>{{ track.items.filter((item) => completed.has(item.slug)).length }} / {{ track.items.length }}</span>
          </h2>
          <div v-for="module in track.modules" :key="module.name" class="lesson-module">
            <h3>{{ module.name }}</h3>
            <button
              v-for="item in module.items"
              :key="item.slug"
              class="lesson-link"
              :class="{ current: item.slug === lesson.slug, cleared: completed.has(item.slug) }"
              @click="loadLesson(lessons.indexOf(item))"
            >
              <span class="check">{{ completed.has(item.slug) ? "●" : "○" }}</span>
              <span class="lesson-link-title">{{ item.title }}</span>
            </button>
          </div>
        </nav>
      </aside>

      <main class="stage">
        <div class="brief">
          <div class="brief-head">
            <h2 class="lesson-title">{{ lesson.title }}</h2>
            <p class="lesson-meta">{{ lesson.keymap }} · {{ trackPosition.current }} / {{ trackPosition.total }}</p>
            <button class="reset" @click="resetLesson">↺ reset</button>
          </div>
          <!-- taskHtml and bodyHtml only interpolate our own lesson text into <kbd> tags -->
          <p class="lesson-task"><span>DO</span> <span v-html="taskHtml"></span></p>
          <p class="lesson-body" v-html="bodyHtml"></p>

          <section
            v-if="isNavigationLesson && navigationDrill.kind !== 'finished'"
            class="drill-panel"
            :class="{ active: navigationDrill.kind === 'running' }"
            aria-label="60 second navigation drill"
          >
            <template v-if="navigationDrill.kind === 'ready'">
              <div class="drill-intro">
                <span class="drill-eyebrow">60 second drill</span>
                <span>Reach as many randomized starred panes as you can.</span>
              </div>
              <div class="drill-launch">
                <span>best {{ drillBestScore }}</span>
                <button class="drill-start" @click="startNavigationDrill">start drill</button>
              </div>
            </template>
            <template v-else-if="navigationDrill.kind === 'running'">
              <div class="drill-metric" :class="{ urgent: isDrillUrgent }">
                <span>time</span>
                <strong>{{ drillSeconds }}</strong>
              </div>
              <div class="drill-metric" aria-live="polite">
                <span>score</span>
                <strong :key="navigationDrill.score" class="drill-score-value">
                  {{ navigationDrill.score }}
                </strong>
              </div>
              <div class="drill-metric">
                <span>best</span>
                <strong>{{ drillBestScore }}</strong>
              </div>
              <button class="drill-exit" @click="exitNavigationDrill">exit</button>
            </template>
          </section>
        </div>

        <KeyHud
          :mode="state.mode"
          :keymap="lesson.keymap"
          :input="lesson.input"
          :trail="keyTrail"
          :flash="flash"
          :keystrokes="state.keystrokes"
          :par="navigationDrill.kind === 'running' ? undefined : lesson.par"
          :elapsed="navigationDrill.kind === 'running' ? Number(drillSeconds) : elapsed"
          :open-help="openHelp"
        >
          <StructureMap :state="state" :keymap="lesson.keymap" :session-name="sessionName" />
        </KeyHud>

        <div class="plate" :class="{ detached: state.detached }">
          <div class="plate-body">
          <div class="mock" :class="{ 'with-sidebar': showSidebar }">
            <aside v-if="showSidebar" class="mock-sidebar" aria-label="herdr sidebar">
              <div class="mock-half">
                <div class="mock-title">spaces</div>
                <div
                  v-for="(workspace, index) in state.workspaces"
                  :key="workspace"
                  class="mock-row"
                  :class="{ active: index === state.activeWorkspace }"
                >
                  <span class="mock-dot" :class="index === state.activeWorkspace ? 'dot-working' : 'dot-idle'"></span>
                  <div>
                    <strong>{{ workspace }}</strong>
                    <small>{{ index === state.activeWorkspace ? `${state.tabs} ${state.tabs === 1 ? "tab" : "tabs"}` : "main" }}</small>
                  </div>
                </div>
              </div>
              <div class="mock-half">
                <div class="mock-title"><span>agents</span><span>grouped</span></div>
                <div
                  v-for="agent in agents"
                  :key="agent.id"
                  class="mock-row clickable"
                  :class="[agent.state, { active: agent.id === state.activePaneId }]"
                  @mousedown="focusPane(agent.id)"
                >
                  <span class="mock-glyph">{{ agent.glyph }}</span>
                  <div>
                    <strong>{{ agent.name }}</strong>
                    <small>{{ agent.state }} · pane {{ agent.id }}</small>
                  </div>
                </div>
                <p v-if="agents.length === 0" class="mock-empty">no agents in this space</p>
              </div>
            </aside>

            <section class="mock-main" :class="{ 'no-tabs': !showTabs }">
              <div v-if="showTabs" class="mock-tabs" aria-label="tabs">
                <span
                  v-for="item in windowList"
                  :key="item.index"
                  :class="{ active: item.current }"
                >{{ item.name }}{{ item.current && state.zoomedPaneId !== null ? " ⤢" : "" }}</span>
                <span>+</span>
              </div>

              <div class="panes" :key="`${lesson.slug}-${resetCount}`">
                <PaneTree
                  :node="visibleRoot"
                  :active-pane-id="state.activePaneId"
                  :single="visibleRoot.kind === 'leaf'"
                  :focus-pane="focusPane"
                  :run-shell-command="runShellCommand"
                />

                <div v-if="state.zoomedPaneId !== null" class="zoom-flag">
                  zoomed · other panes still run underneath
                </div>

                <div v-if="state.detached" class="detached-note" role="status">
                  <strong>client detached</strong>
                  <span>the server still owns session {{ sessionName }} and every pane in it</span>
                  <kbd>{{ lesson.keymap === "tmux" ? "tmux attach -t work" : "herdr" }}</kbd>
                </div>

                <div v-if="state.mode.kind === 'workspace-picker' && !done" class="mode-overlay picker-overlay">
                  <p class="overlay-title">workspace navigation</p>
                  <p
                    v-for="(workspace, index) in state.workspaces"
                    :key="workspace"
                    :class="{ selected: index === state.mode.selected }"
                  >{{ index === state.mode.selected ? "▸" : " " }} {{ workspace }}</p>
                  <small>↑/↓ select · enter open · esc close</small>
                </div>

                <div v-else-if="state.mode.kind === 'resize' && !done" class="mode-overlay compact-overlay">
                  <p class="overlay-title">resize mode</p>
                  <p>h j k l or arrow keys</p>
                  <small>enter or esc exits</small>
                </div>

                <div v-else-if="state.mode.kind === 'copy' && !done" class="mode-overlay compact-overlay">
                  <p class="overlay-title">copy mode</p>
                  <p>{{ state.mode.selecting ? "selection started" : "move through pane history" }}</p>
                  <small>{{ lesson.keymap === "tmux" ? "space select · enter copy · q exit" : "v select · y copy · q exit" }}</small>
                </div>

                <div v-else-if="state.mode.kind === 'goto' && !done" class="mode-overlay picker-overlay">
                  <p class="overlay-title">go to</p>
                  <p class="selected">▸ workspace / tab / pane</p>
                  <p>  agent by state</p>
                  <small>type to filter · esc close</small>
                </div>
              </div>
            </section>
          </div>

          <KeyHelp
            v-if="helpVisible"
            :keymap="lesson.keymap"
            :lesson-keys="lessonKeys"
            :close="closeHelp"
          />

          <div
            v-if="navigationDrill.kind === 'finished'"
            class="victory"
            role="dialog"
            aria-modal="true"
            aria-labelledby="drill-result-title"
          >
            <div class="victory-card drill-result-card">
              <p class="drill-result-kicker">60 second drill</p>
              <p id="drill-result-title" class="victory-head">
                {{ navigationDrill.isNewBest ? "NEW BEST" : "TIME" }}
              </p>
              <p class="drill-result-score">{{ navigationDrill.score }}</p>
              <p class="victory-stats">
                {{ navigationDrill.score === 1 ? "pane reached" : "panes reached" }}
                · best {{ navigationDrill.bestScore }}
              </p>
              <div class="drill-result-actions">
                <button class="victory-next" @click="startNavigationDrill">
                  retry <kbd>enter</kbd>
                </button>
                <button class="drill-back" @click="exitNavigationDrill">
                  back to lesson <kbd>esc</kbd>
                </button>
              </div>
            </div>
          </div>

          <div v-else-if="done" class="victory sheet">
            <div class="victory-card sheet-card">
              <div class="sheet-main">
                <p class="victory-head">LESSON CLEARED</p>
                <p class="victory-takeaway" v-html="takeawayHtml"></p>
              </div>
              <div class="sheet-side">
                <p class="victory-stats" v-if="lesson.input === 'keyboard'">
                  {{ state.keystrokes }} keys<span v-if="lesson.par !== undefined"> · par {{ lesson.par }}</span> · {{ elapsed.toFixed(1) }}s
                </p>
                <button v-if="!isLast" class="victory-next" @click="nextLesson">
                  next lesson <kbd>enter</kbd>
                </button>
                <p v-else class="victory-stats">You can now build, leave, and automate a Herdr workspace.</p>
                <button class="victory-again" @click="resetLesson">try again</button>
              </div>
            </div>
          </div>
          </div>

          <footer class="statusline" :class="{ armed: state.mode.kind === 'prefix' }">
            <span class="statusline-session">[{{ sessionName }}]</span>
            <span v-if="lesson.keymap === 'tmux'" class="statusline-windows">
              <span
                v-for="item in windowList"
                :key="item.index"
                class="statusline-window"
                :class="{ current: item.current }"
              >{{ item.label }}</span>
            </span>
            <span v-else class="statusline-windows">
              <span class="statusline-window current">{{ state.workspaces[state.activeWorkspace] }}</span>
              <span class="statusline-window">tab {{ state.activeTab + 1 }}/{{ state.tabs }}</span>
            </span>
            <span class="statusline-action">{{ state.lastAction ?? "waiting for input…" }}</span>
            <span>{{ navigationDrill.kind === "running" ? "drill" : lesson.keymap }} · {{ lesson.input }}</span>
          </footer>
        </div>
      </main>
    </div>
  </div>
</template>
