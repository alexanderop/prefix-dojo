<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from "vue"
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
import PaneTree from "./components/PaneTree.vue"

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
let ticker: number | undefined

function loadLesson(index: number): void {
  lessonIndex.value = index
  state.value = lessons[index].setup()
  navigationDrill.value = createReadyDrill(loadNavigationBestScore(localStorage))
  done.value = false
  startedAt.value = null
  elapsed.value = 0
  resetCount.value += 1
}

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
  state.value = applyKey(
    state.value,
    { key: e.key, ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey },
    lesson.value.keymap,
  )
  checkGoal()
}

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
const modeLabel = computed(() => {
  switch (state.value.mode.kind) {
    case "terminal": return "terminal"
    case "prefix": return "PREFIX ARMED"
    case "copy": return state.value.mode.selecting ? "copy: selecting" : "copy mode"
    case "resize": return "resize mode"
    case "workspace-picker": return "workspace navigation"
    case "help": return "key help"
    case "goto": return "session navigator"
  }
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
  <div class="crt">
    <header class="masthead">
      <h1>PREFIX<span class="blink">▮</span>DOJO</h1>
      <p class="tagline">build tmux fundamentals, then run agent work in Herdr</p>
    </header>

    <div class="layout">
      <aside class="sidebar">
        <nav v-for="track in tracks" :key="track.name" class="track">
          <h2>// {{ track.label }} <span>{{ track.items.length }}</span></h2>
          <div v-for="module in track.modules" :key="module.name" class="lesson-module">
            <h3>{{ module.name }}</h3>
            <button
              v-for="item in module.items"
              :key="item.slug"
              class="lesson-link"
              :class="{ current: item.slug === lesson.slug }"
              @click="loadLesson(lessons.indexOf(item))"
            >
              <span class="check">{{ completed.has(item.slug) ? "■" : "□" }}</span>
              {{ item.title }}
            </button>
          </div>
        </nav>

        <div class="stats">
          <div class="stat">
            <span class="stat-label">progress</span>
            <span class="stat-value">{{ completed.size }} / {{ lessons.length }}</span>
          </div>
          <div class="stat">
            <span class="stat-label">
              {{ navigationDrill.kind === "running" ? "round keys" : lesson.input === "keyboard" ? "keystrokes" : "input" }}
            </span>
            <span v-if="lesson.input === 'keyboard'" class="stat-value">
              {{ state.keystrokes }}<span v-if="lesson.par !== undefined && navigationDrill.kind !== 'running'" class="stat-par"> / par {{ lesson.par }}</span>
            </span>
            <span v-else class="stat-value input-kind">{{ lesson.input }}</span>
          </div>
          <div class="stat">
            <span class="stat-label">time</span>
            <span class="stat-value">
              {{ navigationDrill.kind === "running" ? drillSeconds : elapsed.toFixed(1) }}s
            </span>
          </div>
          <div class="stat prefix-stat" :class="{ armed: state.mode.kind === 'prefix' }">
            <span class="stat-label">mode</span>
            <span class="stat-value mode-value">{{ modeLabel }}</span>
          </div>
          <button class="reset" @click="resetLesson">↺ reset</button>
        </div>
      </aside>

      <main class="stage">
        <div class="brief">
          <p class="lesson-meta">{{ lesson.track }} · {{ lesson.module }} · {{ trackPosition.current }}/{{ trackPosition.total }}</p>
          <h2 class="lesson-title">{{ lesson.title }}</h2>
          <!-- bodyHtml only interpolates our own lesson text into <kbd> tags -->
          <p class="lesson-body" v-html="bodyHtml"></p>
          <p class="lesson-task"><span>DO</span> <span v-html="taskHtml"></span></p>

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

        <div v-if="lesson.keymap === 'herdr' && state.sidebarVisible" class="workspacebar">
          <span class="workspacebar-label">workspaces</span>
          <span
            v-for="(workspace, index) in state.workspaces"
            :key="workspace"
            class="workspace-chip"
            :class="{ current: index === state.activeWorkspace }"
          >{{ index === state.activeWorkspace ? "●" : "○" }} {{ workspace }}</span>
        </div>

        <div class="tabbar" v-if="state.tabs > 1">
          <span
            v-for="t in state.tabs"
            :key="t"
            class="tab"
            :class="{ current: t - 1 === state.activeTab }"
          >{{ t - 1 }}:{{ t - 1 === state.activeTab ? "sh*" : "sh" }}</span>
        </div>

        <div class="panes" :key="`${lesson.slug}-${resetCount}`">
          <PaneTree
            :node="visibleRoot"
            :active-pane-id="state.activePaneId"
            :focus-pane="focusPane"
            :run-shell-command="runShellCommand"
          />

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
            <small>space/v select · enter/y copy · q exit</small>
          </div>

          <div v-else-if="state.mode.kind === 'goto' && !done" class="mode-overlay picker-overlay">
            <p class="overlay-title">go to</p>
            <p class="selected">▸ workspace / tab / pane</p>
            <p>  agent by state</p>
            <small>type to filter · esc close</small>
          </div>

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

          <div v-else-if="done" class="victory">
            <div class="victory-card">
              <p class="victory-head">LESSON CLEARED</p>
              <p class="victory-takeaway" v-html="takeawayHtml"></p>
              <p class="victory-stats" v-if="lesson.input === 'keyboard'">
                {{ state.keystrokes }} keystrokes · {{ elapsed.toFixed(1) }}s
              </p>
              <button v-if="!isLast" class="victory-next" @click="nextLesson">
                next lesson <kbd>enter</kbd>
              </button>
              <p v-else class="victory-stats">You can now build, leave, and automate a Herdr workspace.</p>
            </div>
          </div>
        </div>

        <footer class="statusline">
          <span>[prefix-dojo]</span>
          <span class="statusline-action">{{ state.lastAction ?? "waiting for input…" }}</span>
          <span>{{ navigationDrill.kind === "running" ? "drill" : lesson.keymap }} · {{ lesson.input }}</span>
        </footer>
      </main>
    </div>
  </div>
</template>
