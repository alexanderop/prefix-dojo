<script setup lang="ts">
export interface TabItem {
  index: number
  current: boolean
  name: string
}

defineProps<{
  tabs: TabItem[]
  zoomed: boolean
  focusTab: (index: number) => void
}>()
</script>

<template>
  <div class="mock-tabs" aria-label="tabs">
    <button
      v-for="item in tabs"
      :key="item.index"
      type="button"
      :class="{ active: item.current }"
      @click="focusTab(item.index)"
    >
      {{ item.name }}{{ item.current && zoomed ? " ⤢" : "" }}
    </button>
    <span>+</span>
  </div>
</template>

<style scoped>
.mock-tabs {
  display: flex;
  align-items: center;
  height: 27px;
  background: var(--term-active);
  color: var(--muted);
  user-select: none;
}
.mock-tabs button,
.mock-tabs span {
  min-width: 92px;
  height: 100%;
  padding: 4px 14px;
  border-right: 1px solid var(--term-border);
  white-space: nowrap;
}
.mock-tabs button {
  border-top: 0;
  border-bottom: 0;
  border-left: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.mock-tabs button:hover,
.mock-tabs button:focus-visible {
  color: var(--fg);
  outline: none;
}
.mock-tabs button.active {
  background: var(--spot);
  color: var(--spot-ink);
  font-weight: 800;
}
.mock-tabs span:last-child {
  min-width: 40px;
  text-align: center;
}
</style>
