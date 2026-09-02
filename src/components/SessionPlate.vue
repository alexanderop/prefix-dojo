<script setup lang="ts">
import { computed } from "vue"
import type { Tool, TrainerState } from "../engine/multiplexer"
import AgentSidebar from "./AgentSidebar.vue"
import ModeOverlay from "./ModeOverlay.vue"
import PaneTree from "./PaneTree.vue"
import StatusLine from "./StatusLine.vue"
import TabBar from "./TabBar.vue"

const props = defineProps<{
  tool: Tool
  state: TrainerState
  /** Hides mode overlays once a result is showing. */
  done: boolean
  /** Remounts the pane terminals when it changes. */
  layoutKey: string
  statusCaption: string
  focusPane: (id: number) => void
  focusTab: (index: number) => void
  focusWorkspace: (index: number) => void
  runShellCommand: (command: string) => string[] | null
}>()

const tabs = computed(() =>
  Array.from({ length: props.state.tabs }, (_, index) => {
    const current = index === props.state.activeTab
    const zoom = current && props.state.zoomedPaneId !== null ? "Z" : ""
    return {
      index,
      current,
      label: `${index}:sh${current ? "*" : ""}${zoom}`,
      name: props.state.tabNames[index] ?? (index === 0 ? "main" : `tab ${index + 1}`),
    }
  }),
)

/** Herdr draws its sidebar only while it is toggled on. */
const showSidebar = computed(() => props.tool.hasSidebar && props.state.sidebarVisible)
const showTabs = computed(() => props.tool.hasWorkspaces)
</script>

<template>
  <div class="plate" :class="{ detached: state.detached }">
    <div class="plate-body">
      <div class="mock" :class="{ 'with-sidebar': showSidebar }">
        <AgentSidebar
          v-if="showSidebar"
          :state="state"
          :focus-pane="focusPane"
          :focus-workspace="focusWorkspace"
        />

        <section class="mock-main" :class="{ 'no-tabs': !showTabs }">
          <TabBar
            v-if="showTabs"
            :tabs="tabs"
            :zoomed="state.zoomedPaneId !== null"
            :focus-tab="focusTab"
          />

          <div :key="layoutKey" class="panes">
            <PaneTree
              :node="state.root"
              :active-pane-id="state.activePaneId"
              :single="state.root.kind === 'leaf'"
              :zoomed-pane-id="state.zoomedPaneId"
              :focus-pane="focusPane"
              :run-shell-command="runShellCommand"
            />

            <div v-if="state.zoomedPaneId !== null" class="zoom-flag">
              zoomed · other panes still run underneath
            </div>

            <div v-if="state.serverStopped" class="detached-note stopped-note" role="status">
              <strong>server stopped</strong>
              <span
                >session {{ tool.sessionName }} ended; its panes and agents are gone. The next start
                restores the layout, not the processes</span
              >
              <kbd>{{ tool.attachCommand }}</kbd>
            </div>

            <div v-else-if="state.detached" class="detached-note" role="status">
              <strong>client detached</strong>
              <span>the server still owns session {{ tool.sessionName }} and every pane in it</span>
              <kbd>{{ tool.attachCommand }}</kbd>
            </div>

            <ModeOverlay
              v-if="!done"
              :mode="state.mode"
              :tool="tool"
              :workspaces="state.workspaces"
            />
          </div>
        </section>
      </div>

      <slot />
    </div>

    <StatusLine :tool="tool" :state="state" :tabs="tabs" :caption="statusCaption" />
  </div>
</template>

<style scoped>
.plate {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  border: 1px solid var(--line2);
  background: var(--term-bg);
  color: var(--muted);
  font-size: 12.5px;
  line-height: 1.4;
}
.plate.detached .mock {
  filter: grayscale(0.7) brightness(0.55);
}
.plate-body {
  position: relative;
  flex: 1;
  display: flex;
  min-height: 0;
}
.mock {
  flex: 1;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  min-height: 0;
}
.mock.with-sidebar {
  grid-template-columns: minmax(220px, 17%) minmax(0, 1fr);
}
.mock-main {
  position: relative;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  min-width: 0;
  min-height: 0;
}
.mock-main.no-tabs {
  grid-template-rows: minmax(0, 1fr);
}
.panes {
  position: relative;
  display: flex;
  min-height: 0;
  min-width: 0;
  background: var(--term-bg);
}
.zoom-flag {
  position: absolute;
  z-index: 2;
  top: 10px;
  right: 16px;
  padding: 2px 8px;
  border: 1px solid var(--yellow);
  background: var(--term-bg);
  color: var(--yellow);
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.detached-note {
  position: absolute;
  z-index: 2;
  top: 14px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 12px;
  max-width: calc(100% - 32px);
  border: 1px solid var(--yellow);
  background: var(--term-bg);
  padding: 7px 12px;
  color: var(--fg);
  font-size: 12px;
  white-space: nowrap;
  box-shadow: 0 10px 36px rgba(0, 0, 0, 0.55);
}
.detached-note strong {
  color: var(--yellow);
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  font-size: 10px;
}
.detached-note kbd {
  font-size: 11px;
}
.stopped-note {
  border-color: var(--red);
}
.stopped-note strong {
  color: var(--red);
}
@media (max-width: 900px) {
  .mock.with-sidebar {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (max-width: 560px) {
  .panes {
    min-height: 360px;
  }
}
</style>
