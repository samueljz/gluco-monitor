<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import {
  NConfigProvider,
  NCard,
  NButton,
  NInputNumber,
  NTimePicker,
  NModal,
  NSwitch,
  NTabs,
  NTabPane,
  darkTheme
} from 'naive-ui'
import type { GlobalThemeOverrides } from 'naive-ui'
import confetti from 'canvas-confetti'
import HistoryTab from './components/HistoryTab.vue'

const isDarkMode = ref(false)

watch(isDarkMode, (val) => {
  if (val) document.documentElement.classList.add('dark')
  else document.documentElement.classList.remove('dark')
}, { immediate: true })

// Custom Theme
const themeOverrides = computed<GlobalThemeOverrides>(() => ({
  common: {
    primaryColor: '#2563eb',
    primaryColorHover: '#3b82f6',
    primaryColorPressed: '#1d4ed8',
    borderRadius: '12px'
  },
  Card: {
    borderRadius: '24px',
    paddingMedium: '20px'
  },
  Button: {
    borderRadiusMedium: '10px'
  }
}))

// Types
interface ScheduleSlot {
  id: string;
  name: string;
  time: string; // HH:mm
  requiresReading: boolean;
  colorClass: string;
}

interface Reading {
  value: number;
  timestamp: number;
}

// State
const defaultSchedule: ScheduleSlot[] = [
  { id: 'before_breakfast', name: 'Before Breakfast', time: '08:00', requiresReading: true, colorClass: 'bg-gradient-to-br from-orange-400 to-amber-500' },
  { id: 'after_breakfast', name: 'After Breakfast', time: '10:00', requiresReading: true, colorClass: 'bg-gradient-to-br from-amber-400 to-yellow-500' },
  { id: 'morning_snack', name: 'Morning Snack', time: '10:30', requiresReading: false, colorClass: 'bg-gradient-to-br from-emerald-400 to-teal-500' },
  { id: 'before_lunch', name: 'Before Lunch', time: '12:30', requiresReading: true, colorClass: 'bg-gradient-to-br from-teal-400 to-cyan-500' },
  { id: 'after_lunch', name: 'After Lunch', time: '14:30', requiresReading: true, colorClass: 'bg-gradient-to-br from-cyan-500 to-blue-500' },
  { id: 'afternoon_snack', name: 'Afternoon Snack', time: '15:30', requiresReading: false, colorClass: 'bg-gradient-to-br from-blue-400 to-indigo-500' },
  { id: 'before_dinner', name: 'Before Dinner', time: '18:00', requiresReading: true, colorClass: 'bg-gradient-to-br from-indigo-500 to-violet-500' },
  { id: 'after_dinner', name: 'After Dinner', time: '20:00', requiresReading: true, colorClass: 'bg-gradient-to-br from-violet-500 to-purple-500' },
  { id: 'before_bedtime', name: 'Before Bedtime', time: '21:00', requiresReading: true, colorClass: 'bg-gradient-to-br from-purple-500 to-fuchsia-600' },
]

const schedule = ref<ScheduleSlot[]>(JSON.parse(JSON.stringify(defaultSchedule)))
const todayReadings = ref<Record<string, Reading>>({})
const now = ref(new Date())
let timer: number | null = null

// Modal State
const showEditModal = ref(false)
const activeEditSlotId = ref<string | null>(null)
const editFormTimeMs = ref<number | null>(null)
const editFormReading = ref<number | null>(null)
const editFormSnackTaken = ref(false)

const activeSlotData = computed(() => {
  if (!activeEditSlotId.value) return null
  return schedule.value.find(s => s.id === activeEditSlotId.value)
})

function timeStringToMs(timeStr: string): number {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

function msToTimeString(ms: number | null): string {
  if (ms === null) return '00:00';
  const d = new Date(ms);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function formatFriendlyTime(timeStr: string) {
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hours = h % 12 || 12;
  return `${hours}:${m.toString().padStart(2, '0')} ${ampm}`;
}

onMounted(() => {
  const savedTheme = localStorage.getItem('gdm_theme')
  if (savedTheme === 'dark') isDarkMode.value = true

  const savedSchedule = localStorage.getItem('gdm_schedule_v7')
  if (savedSchedule) {
    try {
      const parsed = JSON.parse(savedSchedule)
      schedule.value = parsed.map((p: any) => {
        const def = defaultSchedule.find(d => d.id === p.id)
        return { ...def, ...p, colorClass: def?.colorClass || p.colorClass }
      })
    } catch (e) {
      console.error('Failed to parse schedule', e)
    }
  } else {
    localStorage.setItem('gdm_schedule_v7', JSON.stringify(schedule.value))
  }

  loadTodayReadings()

  timer = window.setInterval(() => {
    now.value = new Date()
    loadTodayReadings()
  }, 1000)

  setTimeout(() => scrollToActive(), 300)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})

function toggleTheme() {
  isDarkMode.value = !isDarkMode.value
  localStorage.setItem('gdm_theme', isDarkMode.value ? 'dark' : 'light')
}

function getTodayDateString() {
  const d = now.value
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function loadTodayReadings() {
  const dateStr = getTodayDateString()
  const saved = localStorage.getItem(`gdm_readings_${dateStr}`)
  if (saved) {
    try {
      todayReadings.value = JSON.parse(saved)
    } catch (e) {
      console.error('Failed to parse readings', e)
    }
  } else {
    todayReadings.value = {}
  }
}

function persistReadings() {
  const dateStr = getTodayDateString()
  localStorage.setItem(`gdm_readings_${dateStr}`, JSON.stringify(todayReadings.value))
}

function saveSchedule() {
  localStorage.setItem('gdm_schedule_v7', JSON.stringify(schedule.value))
}

function enforceScheduleConstraints() {
  const getMins = (id: string) => {
    const s = schedule.value.find(x => x.id === id)
    if (!s) return 0
    const [h, m] = s.time.split(':').map(Number)
    return h * 60 + m
  }
  const setMins = (id: string, mins: number) => {
    const s = schedule.value.find(x => x.id === id)
    if (s) {
      const h = Math.floor(mins / 60) % 24
      const m = mins % 60
      s.time = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
    }
  }
  
  const meals = ['before_breakfast', 'morning_snack', 'before_lunch', 'afternoon_snack', 'before_dinner']
  for (let i = 0; i < meals.length - 1; i++) {
    const current = getMins(meals[i])
    const next = getMins(meals[i+1])
    if (next < current + 120) setMins(meals[i+1], current + 120)
  }

  const pairs = [
    ['before_breakfast', 'after_breakfast', 120],
    ['before_lunch', 'after_lunch', 120],
    ['before_dinner', 'after_dinner', 120],
    ['before_dinner', 'before_bedtime', 180]
  ]
  for (const [start, end, gap] of pairs) {
    const startMins = getMins(start as string)
    setMins(end as string, startMins + (gap as number))
  }
}

function openEditModal(slotId: string) {
  const slot = schedule.value.find(s => s.id === slotId)
  if (!slot) return
  
  activeEditSlotId.value = slotId
  const hasReading = !!todayReadings.value[slotId]
  
  if (hasReading) {
    editFormTimeMs.value = timeStringToMs(slot.time)
  } else {
    // Defaults to NOW if unrecorded
    editFormTimeMs.value = Date.now()
  }
  
  if (slot.requiresReading) {
    editFormReading.value = hasReading ? todayReadings.value[slotId].value : null
  } else {
    editFormSnackTaken.value = hasReading
  }
  
  showEditModal.value = true
}

function saveEditModal() {
  if (!activeEditSlotId.value) return
  
  const slot = schedule.value.find(s => s.id === activeEditSlotId.value)
  let recordedNew = false

  // Save Time
  if (slot && editFormTimeMs.value !== null) {
    slot.time = msToTimeString(editFormTimeMs.value)
    enforceScheduleConstraints()
    saveSchedule()
  }

  // Save Reading / Snack Status
  if (slot?.requiresReading) {
    if (editFormReading.value === null || editFormReading.value === undefined || editFormReading.value <= 0) {
      delete todayReadings.value[slot.id]
    } else {
      const existing = todayReadings.value[slot.id]
      if (!existing || existing.value !== editFormReading.value) {
        recordedNew = true
      }
      todayReadings.value[slot.id] = {
        value: editFormReading.value,
        timestamp: existing?.timestamp || Date.now()
      }
    }
  } else if (slot && !slot.requiresReading) {
    if (!todayReadings.value[slot.id]) recordedNew = true
    todayReadings.value[slot.id] = { value: 0, timestamp: Date.now() }
  }
  
  persistReadings()
  showEditModal.value = false

  if (recordedNew) {
    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.7 },
      colors: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6']
    })
    setTimeout(() => scrollToActive(), 1000)
  } else {
    scrollToActive()
  }
}

function uncheckSnack() {
  if (activeEditSlotId.value && todayReadings.value[activeEditSlotId.value]) {
    delete todayReadings.value[activeEditSlotId.value]
    persistReadings()
    showEditModal.value = false
    scrollToActive()
  }
}

// Computed
const timeParts = computed(() => {
  const timeString = now.value.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })
  const parts = timeString.split(' ')
  return { time: parts[0], ampm: parts[1] } 
})

const dateString = computed(() => {
  return now.value.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
})

const currentMinutes = computed(() => now.value.getHours() * 60 + now.value.getMinutes())

function isSlotActive(slot: ScheduleSlot) {
  if (todayReadings.value[slot.id]) return false;
  
  const [hours, mins] = slot.time.split(':').map(Number)
  const slotMinutes = hours * 60 + mins

  let diff = Math.abs(currentMinutes.value - slotMinutes)
  diff = Math.min(diff, 1440 - diff) 

  return diff <= 10
}

const targetSlotIndex = computed(() => {
  const currentMins = currentMinutes.value
  for (let i = 0; i < schedule.value.length; i++) {
    if (isSlotActive(schedule.value[i])) return i;
  }
  for (let i = 0; i < schedule.value.length; i++) {
    const slot = schedule.value[i]
    if (slot.requiresReading && todayReadings.value[slot.id]) continue;
    if (!slot.requiresReading && todayReadings.value[slot.id]) continue;
    
    if (!slot.requiresReading) {
      const [hours, mins] = slot.time.split(':').map(Number)
      const slotMins = hours * 60 + mins
      if (currentMins > slotMins + 45) continue;
    }
    return i;
  }
  return schedule.value.length - 1;
})

function scrollToActive() {
  const el = document.getElementById('card-' + targetSlotIndex.value)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
}
</script>

<template>
  <n-config-provider :theme="isDarkMode ? darkTheme : null" :theme-overrides="themeOverrides">
    <div 
      class="max-w-md mx-auto h-screen flex flex-col font-sans transition-colors duration-500 relative overflow-hidden"
      :class="isDarkMode ? 'bg-slate-950 text-slate-200' : 'bg-slate-50 text-slate-800'"
    >
      
      <!-- Minimal Header with Theme Toggle -->
      <div class="px-6 pt-10 pb-4 shrink-0 flex items-start justify-between z-20">
        <div>
          <h1 class="font-bold tracking-widest uppercase text-[10px] mb-0.5" :class="isDarkMode ? 'text-slate-500' : 'text-slate-400'">Sugar Buddy</h1>
          <p class="text-sm font-semibold" :class="isDarkMode ? 'text-slate-300' : 'text-slate-600'">{{ dateString }}</p>
        </div>
        <button 
          @click="toggleTheme" 
          class="w-10 h-10 rounded-full flex items-center justify-center transition-colors shadow-sm"
          :class="isDarkMode ? 'bg-slate-800 text-yellow-400 hover:bg-slate-700' : 'bg-white text-slate-400 hover:bg-slate-100'"
        >
          <svg v-if="isDarkMode" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
          <svg v-else xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
        </button>
      </div>

      <!-- Clock (Consistent Flow) -->
      <div class="px-6 pb-6 pt-2 shrink-0 flex flex-col items-center justify-center relative z-20">
        <div class="flex items-baseline">
          <span class="text-[72px] font-black tabular-nums tracking-tighter drop-shadow-sm leading-none" :class="isDarkMode ? 'text-white' : 'text-slate-800'">{{ timeParts.time }}</span>
          <span class="text-xl font-bold ml-2" :class="isDarkMode ? 'text-slate-500' : 'text-slate-400'">{{ timeParts.ampm }}</span>
        </div>
      </div>

      <!-- Tabs Area -->
      <div class="flex-1 w-full flex flex-col relative z-10 overflow-hidden">
        <n-tabs type="segment" justify-content="space-evenly" class="px-4 mb-2 shrink-0">
          <n-tab-pane name="today" tab="Today" display-directive="show">
            <div class="w-full overflow-y-auto no-scrollbar pb-32 flex flex-col gap-4 transition-colors duration-500" style="height: calc(100vh - 210px);">
        <div 
          v-for="(slot, index) in schedule" 
          :key="slot.id" 
          :id="'card-' + index"
          @click="openEditModal(slot.id)"
          class="cursor-pointer"
        >
          <n-card 
            class="w-full border-0 transition-all duration-300 overflow-hidden relative shadow-[0_8px_30px_rgb(0,0,0,0.06)]"
            :class="[slot.colorClass, isSlotActive(slot) ? 'scale-[1.02] ring-4 ring-blue-500/30 z-10' : 'opacity-[0.98] hover:scale-[1.01]']"
            style="background-color: transparent;"
          >
            <!-- Decorative glare -->
            <div class="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>

            <div class="text-white relative z-10 flex justify-between items-center min-h-[64px]">
              
              <!-- Left side: Title and Time -->
              <div class="flex flex-col flex-1 pr-4">
                <h3 class="text-[20px] font-extrabold drop-shadow-sm tracking-tight leading-tight mb-1.5">{{ slot.name }}</h3>
                <span class="text-white/90 font-bold text-xs flex items-center gap-1.5 uppercase tracking-wide">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  {{ formatFriendlyTime(slot.time) }}
                </span>
              </div>

              <!-- Right side: Reading/Snack -->
              <div class="flex flex-col items-end shrink-0 pl-4 border-l border-white/20">
                <template v-if="slot.requiresReading">
                  <div v-if="todayReadings[slot.id]" class="flex items-center animate-in fade-in zoom-in duration-500">
                    <div class="flex flex-col items-end pr-4 border-r border-white/20">
                      <span class="text-[38px] leading-none font-black drop-shadow-md">{{ todayReadings[slot.id].value }}</span>
                      <span class="text-[9px] font-bold text-white/80 uppercase tracking-widest mt-1">mmol/L</span>
                    </div>
                    <div class="w-10 h-10 ml-4 rounded-full bg-white/20 flex items-center justify-center shadow-inner shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    </div>
                  </div>
                  <div v-else class="flex flex-col items-end">
                    <span v-if="isSlotActive(slot)" class="bg-white text-slate-800 font-extrabold text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-full shadow-sm animate-pulse whitespace-nowrap">Log Now</span>
                    <div v-else class="w-10 h-10 rounded-full border-2 border-white/30 border-dashed flex items-center justify-center opacity-70"></div>
                  </div>
                </template>
                <template v-else>
                  <div v-if="todayReadings[slot.id]" class="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center animate-in fade-in zoom-in duration-300 shadow-inner">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  </div>
                  <div v-else class="flex flex-col items-end">
                    <span v-if="isSlotActive(slot)" class="bg-white text-slate-800 font-extrabold text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-full shadow-sm animate-pulse whitespace-nowrap">Log Now</span>
                    <div v-else class="w-10 h-10 rounded-full border-2 border-white/30 border-dashed flex items-center justify-center opacity-70"></div>
                  </div>
                </template>
              </div>

            </div>
          </n-card>
        </div>
            </div>
          </n-tab-pane>
          <n-tab-pane name="history" tab="History">
            <div class="w-full overflow-y-auto no-scrollbar pb-32 transition-colors duration-500" style="height: calc(100vh - 210px);">
              <HistoryTab />
            </div>
          </n-tab-pane>
        </n-tabs>
      </div>
      
      <!-- Edit Modal -->
      <n-modal v-model:show="showEditModal">
        <n-card 
          style="width: 340px; border-radius: 28px;" 
          :title="activeSlotData?.requiresReading ? 'Log ' + activeSlotData?.name : 'Confirm Snack'" 
          :bordered="false" 
          size="huge" 
          role="dialog" 
          aria-modal="true"
          class="shadow-2xl"
        >
          <div class="flex flex-col gap-6 pt-2">
            
            <template v-if="activeSlotData?.requiresReading">
              <!-- Edit Time -->
              <div>
                <label class="text-xs font-extrabold text-slate-400 uppercase tracking-widest mb-2 block">Logged At</label>
                <n-time-picker v-model:value="editFormTimeMs" format="HH:mm" size="large" class="w-full font-bold" />
              </div>

              <!-- Edit Reading -->
              <div>
                <label class="text-xs font-extrabold text-slate-400 uppercase tracking-widest mb-2 block">Glucose Reading</label>
                <n-input-number 
                  v-model:value="editFormReading" 
                  size="large" 
                  :step="0.1" 
                  clearable 
                  placeholder="0.0"
                  class="w-full font-bold text-lg"
                >
                   <template #suffix>
                     <span class="text-slate-400 font-semibold text-xs">mmol/L</span>
                   </template>
                </n-input-number>
              </div>
            </template>
            
            <template v-else>
              <!-- Snack Confirmation -->
              <div class="flex flex-col items-center justify-center text-center py-2">
                 <div class="flex items-center gap-3 w-full">
                   <span class="text-slate-600 dark:text-slate-300 font-bold text-base whitespace-nowrap">Snack taken at</span>
                   <n-time-picker v-model:value="editFormTimeMs" format="HH:mm" size="large" class="font-bold flex-1" />
                 </div>
              </div>
            </template>
            
          </div>

          <template #footer>
            <div class="flex items-center gap-3 mt-2 w-full">
               <n-button 
                 v-if="!activeSlotData?.requiresReading && activeEditSlotId && todayReadings[activeEditSlotId]" 
                 type="error" 
                 ghost 
                 size="large" 
                 @click="uncheckSnack" 
                 class="font-bold mr-auto"
               >
                 Remove
               </n-button>
               
               <div class="flex gap-3 ml-auto">
                 <n-button size="large" @click="showEditModal = false" class="font-bold">Cancel</n-button>
                 <n-button type="primary" size="large" @click="saveEditModal" class="font-bold px-6 shadow-md">
                   {{ activeSlotData?.requiresReading ? 'Save' : 'Yes' }}
                 </n-button>
               </div>
            </div>
          </template>
        </n-card>
      </n-modal>

    </div>
  </n-config-provider>
</template>

<style>
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
</style>
