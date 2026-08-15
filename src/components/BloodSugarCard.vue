<script setup lang="ts">
import { NCard } from 'naive-ui'
import { computed } from 'vue'

const props = defineProps<{
  name: string
  time: string
  colorClass: string
  isActive: boolean
  readingValue?: number
}>()

const friendlyTime = computed(() => {
  if (!props.time) return ''
  const [h = 0, m = 0] = props.time.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hours = h % 12 || 12
  return `${hours}:${m.toString().padStart(2, '0')} ${ampm}`
})
</script>

<template>
  <n-card 
    class="w-full border-0 transition-all duration-300 overflow-hidden relative shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.4)]"
    :class="[colorClass, isActive ? 'scale-[1.02] ring-4 ring-blue-500/30 dark:ring-blue-400/40 z-10 dark:shadow-[0_8px_30px_rgba(0,0,0,0.6)]' : 'opacity-[0.98] hover:scale-[1.01]']"
    style="background-color: transparent;"
  >
    <!-- Decorative glare -->
    <div class="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>

    <div class="text-white relative z-10 flex justify-between items-center min-h-[64px]">
      
      <!-- Left side: Title and Time -->
      <div class="flex flex-col flex-1 pr-4">
        <h3 class="text-[20px] font-extrabold drop-shadow-sm tracking-tight leading-tight mb-1.5">{{ name }}</h3>
        <span class="text-white/90 font-bold text-xs flex items-center gap-1.5 uppercase tracking-wide">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          {{ friendlyTime }}
        </span>
      </div>

      <!-- Right side: Reading/Snack -->
      <div class="flex flex-col items-end shrink-0 pl-4 border-l border-white/20">
        <div v-if="readingValue" class="flex items-center animate-in fade-in zoom-in duration-500">
          <div class="flex flex-col items-end pr-4 border-r border-white/20">
            <span class="text-[38px] leading-none font-black drop-shadow-md">{{ readingValue }}</span>
            <span class="text-[9px] font-bold text-white/80 uppercase tracking-widest mt-1">mmol/L</span>
          </div>
          <div class="w-10 h-10 ml-4 rounded-full bg-white/20 flex items-center justify-center shadow-inner shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </div>
        </div>
        <div v-else class="flex flex-col items-end">
          <span v-if="isActive" class="bg-white text-slate-800 font-extrabold text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-full shadow-sm animate-pulse whitespace-nowrap">Log Now</span>
          <div v-else class="w-10 h-10 rounded-full border-2 border-white/30 border-dashed flex items-center justify-center opacity-70"></div>
        </div>
      </div>

    </div>
  </n-card>
</template>
