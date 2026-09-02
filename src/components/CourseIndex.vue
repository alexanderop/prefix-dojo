<script setup lang="ts">
import { nextTick, ref, watch } from "vue"
import type { Lesson, TrackGroup } from "../lessons"

const props = defineProps<{
  open: boolean
  tracks: TrackGroup[]
  current: Lesson
  completed: Set<string>
  close: () => void
  select: (lesson: Lesson) => void
}>()

const closeButton = ref<HTMLButtonElement | null>(null)

watch(
  () => props.open,
  async (isOpen) => {
    await nextTick()
    if (isOpen) closeButton.value?.focus()
  },
)

watch(
  () => props.current,
  async () => {
    await nextTick()
    document.querySelector(".lesson-link.current")?.scrollIntoView({ block: "nearest" })
  },
)
</script>

<template>
  <button
    v-if="open"
    class="nav-scrim"
    type="button"
    aria-label="Close lesson index"
    @click="close"
  ></button>
  <aside id="lesson-drawer" class="sidebar" :class="{ open }" aria-label="Course overview">
    <div class="sidebar-head">
      <span>course index</span>
      <button ref="closeButton" type="button" @click="close">esc · close</button>
    </div>
    <nav v-for="track in tracks" :key="track.name" class="track">
      <h2>
        {{ track.label }}
        <span
          >{{ track.items.filter((item) => completed.has(item.slug)).length }} /
          {{ track.items.length }}</span
        >
      </h2>
      <div v-for="module in track.modules" :key="module.name" class="lesson-module">
        <h3>{{ module.name }}</h3>
        <button
          v-for="item in module.items"
          :key="item.slug"
          type="button"
          class="lesson-link"
          :class="{ current: item.slug === current.slug, cleared: completed.has(item.slug) }"
          :aria-current="item.slug === current.slug ? 'step' : undefined"
          :aria-label="`${item.title}, ${completed.has(item.slug) ? 'completed' : 'not completed'}`"
          @click="select(item)"
        >
          <span class="check" aria-hidden="true">{{ completed.has(item.slug) ? "●" : "○" }}</span>
          <span class="lesson-link-title">{{ item.title }}</span>
        </button>
      </div>
    </nav>
  </aside>
</template>

<style scoped>
.nav-scrim {
  position: absolute;
  inset: 0;
  z-index: 8;
  border: 0;
  background: rgba(17, 17, 27, 0.74);
  cursor: default;
}
.sidebar {
  position: absolute;
  inset: 0 auto 0 0;
  z-index: 9;
  width: min(340px, calc(100% - 32px));
  display: flex;
  flex-direction: column;
  gap: 22px;
  overflow-y: auto;
  padding: 16px 18px;
  border: 1px solid var(--line2);
  background: var(--bg);
  box-shadow: 18px 0 48px rgba(0, 0, 0, 0.45);
  transform: translateX(calc(-100% - 36px));
  visibility: hidden;
  transition:
    transform 180ms ease,
    visibility 180ms;
}
.sidebar.open {
  transform: translateX(0);
  visibility: visible;
}
.sidebar-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--line2);
  color: var(--ink);
  font-size: 10.5px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}
.sidebar-head button {
  border: 0;
  background: transparent;
  color: var(--faint2);
  padding: 3px;
  font: inherit;
  font-size: 9px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  cursor: pointer;
}
.sidebar-head button:hover,
.sidebar-head button:focus-visible {
  color: var(--spot);
  outline: none;
}
.track h2 {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin: 0 0 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--line2);
  color: var(--faint);
  font-size: 10.5px;
  font-weight: 400;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}
.track h2 span {
  color: var(--spot);
  letter-spacing: 0.1em;
}
.lesson-module + .lesson-module {
  margin-top: 10px;
}
.lesson-module h3 {
  margin: 0 0 3px 22px;
  color: var(--faint2);
  font-size: 9.5px;
  font-weight: 400;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}
.lesson-link {
  display: grid;
  grid-template-columns: 12px minmax(0, 1fr);
  gap: 10px;
  align-items: baseline;
  width: 100%;
  padding: 5px 6px 5px 4px;
  background: none;
  border: 0;
  color: var(--faint);
  font: inherit;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}
.lesson-link:hover,
.lesson-link:focus-visible {
  color: var(--ink);
  background: var(--panel);
  outline: 1px solid var(--line2);
  outline-offset: -1px;
}
.lesson-link.current {
  color: var(--ink);
  background: var(--panel);
  font-weight: 700;
}
.check {
  color: var(--faint2);
  font-size: 10px;
}
.lesson-link.current .check {
  color: var(--spot);
}
.lesson-link.cleared .check {
  color: var(--green);
}
.lesson-link-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
@media (max-width: 900px) {
  .sidebar {
    width: min(420px, 100%);
    max-height: none;
  }
}
</style>
