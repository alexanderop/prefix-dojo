<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue"
import { bindings, PREFIX } from "../engine/bindings"
import type { Keymap } from "../engine/multiplexer"

const props = defineProps<{
  keymap: Keymap
  lessonKeys: string[]
  close: () => void
}>()

const groups = computed(() => bindings[props.keymap])
const wanted = computed(() => new Set(props.lessonKeys))
const tool = computed(() => (props.keymap === "tmux" ? "tmux" : "Herdr"))
const closeButton = ref<HTMLButtonElement | null>(null)
let previousFocus: HTMLElement | null = null

onMounted(async () => {
  previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  await nextTick()
  closeButton.value?.focus()
})

onBeforeUnmount(() => previousFocus?.focus())
</script>

<template>
  <div class="help" role="dialog" aria-modal="true" aria-labelledby="help-title" @click.self="close">
    <div class="help-card">
      <header class="help-head">
        <p id="help-title" class="help-title">{{ tool }} key bindings</p>
        <p class="help-sub">
          Every command starts with <kbd>{{ PREFIX }}</kbd>, released, then one key.
          Highlighted keys are the ones this lesson asks for.
        </p>
      </header>

      <div class="help-groups">
        <section v-for="group in groups" :key="group.name" class="help-group">
          <h3>{{ group.name }}</h3>
          <div
            v-for="binding in group.items"
            :key="binding.does"
            class="help-row"
            :class="{ wanted: binding.keys.some((key) => wanted.has(key)) }"
          >
            <span class="help-keys">
              <kbd v-for="key in binding.keys" :key="key">{{ key }}</kbd>
            </span>
            <span class="help-does">{{ binding.does }}</span>
          </div>
        </section>
      </div>

      <footer class="help-foot">
        <span v-if="keymap === 'tmux'">
          In real tmux this list is <kbd>{{ PREFIX }}</kbd> <kbd>?</kbd>. Scroll it with arrows.
        </span>
        <span v-else>
          Real Herdr shows only the bindings from your config here. Press <kbd>/</kbd> to filter.
        </span>
        <button ref="closeButton" class="help-close" type="button" @click="close">
          close <kbd>esc</kbd>
        </button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.help {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: grid;
  place-items: center;
  background: rgba(17, 17, 27, 0.86);
  animation: fade-in 160ms ease;
}
@keyframes fade-in {
  from {
    opacity: 0;
  }
}
.help-card {
  width: min(880px, calc(100% - 28px));
  max-height: calc(100% - 28px);
  display: flex;
  flex-direction: column;
  border: 1px solid var(--spot);
  background: var(--term-active);
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.6);
}
.help-head {
  padding: 14px 18px 10px;
  border-bottom: 1px solid var(--term-border);
}
.help-title {
  margin: 0 0 4px;
  color: var(--spot);
  font-family: var(--disp);
  font-size: 18px;
  font-weight: 800;
}
.help-sub {
  margin: 0;
  color: var(--dim);
  font-family: var(--body);
  font-size: 12px;
  line-height: 1.5;
}
.help-groups {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 14px 22px;
  padding: 14px 18px;
  overflow-y: auto;
}
.help-group h3 {
  margin: 0 0 6px;
  color: var(--spot);
  font-size: 9px;
  font-weight: 400;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}
.help-row {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 3px 4px;
  font-size: 12px;
  color: var(--fg);
}
.help-row.wanted {
  background: rgba(249, 226, 175, 0.08);
  outline: 1px solid var(--yellow);
}
.help-row.wanted kbd {
  color: var(--yellow);
  border-color: var(--yellow);
}
.help-keys {
  display: inline-flex;
  gap: 3px;
  flex: 0 0 auto;
  min-width: 78px;
}
.help-keys kbd {
  font-size: 11px;
  padding: 0 6px;
}
.help-does {
  color: var(--fg);
}
.help-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 18px;
  border-top: 1px solid var(--term-border);
  color: var(--dim);
  font-size: 11px;
}
.help-foot kbd {
  font-size: 10px;
  padding: 0 5px;
}
.help-close {
  border: 1px solid var(--term-border);
  background: transparent;
  color: var(--fg);
  font: inherit;
  font-size: 12px;
  padding: 5px 10px;
  cursor: pointer;
}
.help-close:hover,
.help-close:focus-visible {
  border-color: var(--spot);
  color: var(--spot);
  outline: none;
}
</style>
