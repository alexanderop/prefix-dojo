<script setup lang="ts">
import { computed } from "vue"
import { agentSummaries, type AgentState, type TrainerState } from "../engine/multiplexer"

const props = defineProps<{
  state: TrainerState
  focusPane: (id: number) => void
  focusWorkspace: (index: number) => void
}>()

const AGENT_GLYPH: Record<AgentState, string> = { working: "●", blocked: "◉", done: "●", idle: "○" }

/** Recognized agents, including stable CLI names when one has been assigned. */
const agents = computed(() =>
  agentSummaries(props.state).map((agent) => ({
    id: agent.paneId,
    name: agent.name,
    state: agent.state,
    glyph: AGENT_GLYPH[agent.state],
  })),
)
</script>

<template>
  <aside class="mock-sidebar" aria-label="herdr sidebar">
    <div class="mock-half">
      <div class="mock-title">spaces</div>
      <button
        v-for="(workspace, index) in state.workspaces"
        :key="workspace"
        type="button"
        class="mock-row"
        :class="{ active: index === state.activeWorkspace }"
        @click="focusWorkspace(index)"
      >
        <span
          class="mock-dot"
          :class="index === state.activeWorkspace ? 'dot-working' : 'dot-idle'"
        ></span>
        <div>
          <strong>{{ workspace }}</strong>
          <small>{{
            index === state.activeWorkspace
              ? `${state.tabs} ${state.tabs === 1 ? "tab" : "tabs"}`
              : "main"
          }}</small>
        </div>
      </button>
    </div>
    <div class="mock-half">
      <div class="mock-title"><span>agents</span><span>grouped</span></div>
      <button
        v-for="agent in agents"
        :key="agent.id"
        type="button"
        class="mock-row clickable"
        :class="[agent.state, { active: agent.id === state.activePaneId }]"
        @click="focusPane(agent.id)"
      >
        <span class="mock-glyph">{{ agent.glyph }}</span>
        <div>
          <strong>{{ agent.name }}</strong>
          <small>{{ agent.state }} · pane {{ agent.id }}</small>
        </div>
      </button>
      <p v-if="agents.length === 0" class="mock-empty">no agents in this space</p>
    </div>
  </aside>
</template>

<style scoped>
.mock-sidebar {
  display: flex;
  flex-direction: column;
  min-width: 0;
  border-right: 1px solid var(--term-border);
  background: var(--term-side);
  user-select: none;
}
/* Two equal halves, like herdr's default sidebar_section_split of 0.5. */
.mock-half {
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
}
.mock-half + .mock-half {
  border-top: 1px solid var(--term-border);
}
.mock-title {
  display: flex;
  justify-content: space-between;
  padding: 9px 12px;
  color: var(--muted);
  font-weight: 700;
}
.mock-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 8px;
  align-items: start;
  padding: 8px 12px;
  color: var(--dim);
  width: 100%;
  border: 0;
  background: transparent;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.mock-row:hover,
.mock-row:focus-visible {
  background: color-mix(in srgb, var(--term-active) 72%, transparent);
  outline: none;
}
.mock-row.active {
  background: var(--term-active);
}
.mock-row strong {
  display: block;
  overflow: hidden;
  color: var(--fg);
  font-weight: 700;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.mock-row small {
  display: block;
  overflow: hidden;
  margin-top: 2px;
  color: var(--muted);
  font-size: 11px;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.mock-row.active small {
  color: var(--spot);
}
.mock-dot {
  width: 6px;
  height: 6px;
  margin-top: 5px;
  border-radius: 50%;
  background: var(--muted);
}
.mock-dot.dot-working {
  background: var(--yellow);
}
.mock-dot.dot-idle {
  background: var(--green);
}
.mock-glyph {
  color: var(--green);
  line-height: 1.2;
}
.mock-row.working .mock-glyph,
.mock-row.working small {
  color: var(--yellow);
}
.mock-row.blocked .mock-glyph,
.mock-row.blocked small {
  color: var(--red);
}
.mock-row.done .mock-glyph,
.mock-row.done small {
  color: var(--teal);
}
.mock-row.active.working small,
.mock-row.active.blocked small,
.mock-row.active.done small,
.mock-row.active.idle small {
  color: inherit;
}
.mock-empty {
  padding: 4px 12px;
  color: var(--muted);
  font-size: 11px;
}
@media (max-width: 900px) {
  .mock-sidebar {
    display: none;
  }
}
</style>
