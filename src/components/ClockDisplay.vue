<script setup lang="ts">
import { useClock } from '../composables/useClock'

// Owns the per-second clock so only this small component re-renders every
// second, instead of the whole App (and every schedule card).
const { timeParts } = useClock('second')
</script>

<template>
  <div class="px-6 pb-6 pt-2 shrink-0 flex flex-col items-center justify-center relative z-20">
    <div class="flex items-baseline">
      <span class="text-[72px] font-black tabular-nums tracking-tighter drop-shadow-sm leading-none text-slate-800 dark:text-white">{{ timeParts.time }}</span>
      <span class="text-xl font-bold ml-2 text-slate-400 dark:text-slate-500">{{ timeParts.ampm }}</span>
    </div>
  </div>
</template>
