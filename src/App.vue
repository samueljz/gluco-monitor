<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import {
  NConfigProvider,
  NCard,
  NButton,
  NInputNumber,
  NTimePicker,
  NModal,
  NTabs,
  NTabPane,
  NDropdown,
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
import { defaultSchedule, SCHEDULE_RULES } from './constants/schedule'
import type { ScheduleSlot } from './constants/schedule'
import BloodSugarCard from './components/BloodSugarCard.vue'
import SnackCard from './components/SnackCard.vue'
import { syncData, isSignedIn, isSyncing, syncError, handleAuthClick, handleSignoutClick, initGoogleApi } from './services/driveSync'

interface Reading {
  value: number;
  timestamp: number;
}

// State

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
  const [h = 0, m = 0] = timeStr.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

function msToTimeString(ms: number | null): string {
  if (ms === null) return '00:00';
  const d = new Date(ms);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

const colorPalette = [
  'bg-gradient-to-br from-yellow-400 to-lime-500',
  'bg-gradient-to-br from-lime-400 to-emerald-500',
  'bg-gradient-to-br from-emerald-400 to-teal-500',
  'bg-gradient-to-br from-teal-400 to-cyan-500',
  'bg-gradient-to-br from-cyan-400 to-sky-500',
  'bg-gradient-to-br from-sky-400 to-blue-500',
  'bg-gradient-to-br from-blue-400 to-indigo-500',
  'bg-gradient-to-br from-indigo-400 to-violet-500',
  'bg-gradient-to-br from-violet-400 to-purple-500',
  'bg-gradient-to-br from-purple-400 to-fuchsia-500',
  'bg-gradient-to-br from-fuchsia-400 to-pink-500',
  'bg-gradient-to-br from-pink-400 to-rose-500',
  'bg-gradient-to-br from-rose-400 to-red-500',
  'bg-gradient-to-br from-red-400 to-orange-500',
  'bg-gradient-to-br from-orange-400 to-amber-500',
  'bg-gradient-to-br from-amber-400 to-yellow-500',
]

function getSlotColorClass(index: number) {
  return colorPalette[index % colorPalette.length]
}

onMounted(() => {
  const checkInterval = setInterval(() => {
    if (window.gapi && window.google) {
      clearInterval(checkInterval)
      initGoogleApi()
    }
  }, 100)

  window.addEventListener('gdm_sync_complete', () => {
    const savedSchedule = localStorage.getItem('gdm_schedule_v8')
    if (savedSchedule) {
      try {
        const parsed = JSON.parse(savedSchedule)
        schedule.value = parsed.map((p: any) => {
          const def = defaultSchedule.find(d => d.id === p.id)
          return { ...def, ...p }
        })
      } catch (e) {
        console.error('Failed to parse schedule', e)
      }
    }
    loadTodayReadings()
  })

  const savedTheme = localStorage.getItem('gdm_theme')
  if (savedTheme === 'dark') isDarkMode.value = true

  const savedSchedule = localStorage.getItem('gdm_schedule_v8')
  if (savedSchedule) {
    try {
      const parsed = JSON.parse(savedSchedule)
      schedule.value = parsed.map((p: any) => {
        const def = defaultSchedule.find(d => d.id === p.id)
        return { ...def, ...p }
      })
    } catch (e) {
      console.error('Failed to parse schedule', e)
    }
  } else {
    localStorage.setItem('gdm_schedule_v8', JSON.stringify(schedule.value))
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

const notificationPermission = ref('Notification' in window ? Notification.permission : 'denied')

function requestNotification() {
  if ('Notification' in window) {
    Notification.requestPermission().then(perm => {
      notificationPermission.value = perm
    })
  }
}

const notifiedSlots = ref<Set<string>>(new Set())

watch(now, () => {
  for (const slot of schedule.value) {
    if (isSlotDue(slot)) {
      if (!notifiedSlots.value.has(slot.id)) {
        notifiedSlots.value.add(slot.id)
        if ('Notification' in window && notificationPermission.value === 'granted') {
          new Notification('Gluco Monitor', {
            body: `It's time to log your upcoming item: ${slot.name} (${slot.time})`
          })
        }
      }
    } else {
      notifiedSlots.value.delete(slot.id)
    }
  }
})

const dropdownOptions = computed(() => [
  {
    label: isDarkMode.value ? 'Light Mode' : 'Dark Mode',
    key: 'theme'
  },
  {
    label: notificationPermission.value === 'granted' ? 'Notifications Enabled' : 'Enable Notifications',
    key: 'notify',
    disabled: notificationPermission.value === 'granted' || notificationPermission.value === 'denied'
  },
  {
    label: isSignedIn.value 
      ? (isSyncing.value ? 'Syncing to Drive...' : 'Sync Now')
      : 'Connect Google Drive',
    key: 'sync',
    disabled: isSyncing.value
  },
  ...(isSignedIn.value ? [{
    label: 'Disconnect Drive',
    key: 'signout'
  }] : [])
])

function handleDropdownSelect(key: string) {
  if (key === 'theme') {
    toggleTheme()
  } else if (key === 'sync') {
    if (isSignedIn.value) syncData()
    else handleAuthClick()
  } else if (key === 'signout') {
    handleSignoutClick()
  } else if (key === 'notify') {
    requestNotification()
  }
}

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
  syncData()
}

function saveSchedule() {
  localStorage.setItem('gdm_schedule_v8', JSON.stringify(schedule.value))
  syncData()
}

const getActualMins = (id: string) => {
  const logged = todayReadings.value[id]
  if (logged && logged.timestamp) {
    const d = new Date(logged.timestamp)
    return d.getHours() * 60 + d.getMinutes()
  }
  const s = schedule.value.find(x => x.id === id)
  if (!s) return 0
  const [h = 0, m = 0] = s.time.split(':').map(Number)
  return h * 60 + m
}



function updateTimeBasedOnConstraints() {
  const getMins = getActualMins;
  
  const setMins = (id: string, mins: number) => {
    // If the event has already been logged, its time is fixed in history!
    if (todayReadings.value[id]) return;
    
    const s = schedule.value.find(x => x.id === id)
    if (s) {
      const h = Math.floor(mins / 60) % 24
      const m = mins % 60
      s.time = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
    }
  }
  
  for (const rule of SCHEDULE_RULES) {
    if (rule.requiresSourceLogged && !todayReadings.value[rule.start]) continue;
    
    const startMins = getMins(rule.start);
    const endMins = getMins(rule.end);

    setMins(rule.end, startMins + rule.gap);
  }
}

function openEditModal(slotId: string) {
  const slot = schedule.value.find(s => s.id === slotId)
  if (!slot) return
  
  activeEditSlotId.value = slotId
  const hasReading = !!todayReadings.value[slotId]
  
  if (hasReading) {
    // If we have a logged timestamp, use it exactly!
    editFormTimeMs.value = todayReadings.value[slotId]?.timestamp || Date.now()
  } else {
    // Otherwise parse the currently displaying time string
    editFormTimeMs.value = Date.now();
  }
  
  if (slot.requiresReading) {
    editFormReading.value = hasReading ? (todayReadings.value[slotId]?.value ?? null) : null
  } else {
    editFormSnackTaken.value = hasReading
  }
  
  editFormError.value = ''
  showEditModal.value = true
}

const editFormError = ref('')

function saveEditModal() {
  if (!activeEditSlotId.value) return
  
  const slot = schedule.value.find(s => s.id === activeEditSlotId.value)
  let recordedNew = false
  editFormError.value = ''

  // Save Time
  if (slot && editFormTimeMs.value !== null) {
    const proposedTime = msToTimeString(editFormTimeMs.value)
    
    // Validation
    const getMins = (t: string) => {
      const [h=0, m=0] = t.split(':').map(Number)
      return h * 60 + m
    }
    const proposedMins = getMins(proposedTime)

    // 1. Validation using SCHEDULE_RULES
    for (const rule of SCHEDULE_RULES) {
      if (rule.end === slot.id) {
        if (rule.requiresSourceLogged && !todayReadings.value[rule.start]) continue; // ignore if condition not met

        // We only enforce validation walls against events that have ACTUALLY happened (logged)!
        // If the start event hasn't happened yet, it's just a planned time and will dynamically snap.
        if (!todayReadings.value[rule.start]) continue;

        // We use the actual logged time of start
        const startMins = getActualMins(rule.start)
        
        // Validation expects it to be exactly gap, or >= gap. 
        // For our modal validation, we just want to block < gap (earlier than allowed).
        if (proposedMins < startMins + rule.gap) {
          if (rule.strict) {
            const startSlot = schedule.value.find(s => s.id === rule.start)
            const name = startSlot ? startSlot.name : rule.start;
            const minH = Math.floor((startMins + rule.gap) / 60) % 24
            const minM = (startMins + rule.gap) % 60
            const minTimeStr = `${minH.toString().padStart(2, '0')}:${minM.toString().padStart(2, '0')}`
            const hrs = rule.gap >= 60 ? `${rule.gap / 60} hours` : `${rule.gap} minutes`
            editFormError.value = `Must be at least ${hrs} after ${name} (earliest: ${minTimeStr})`
            return
          }
        }
      }
    }

    slot.time = proposedTime
  }

  const logTimestamp = editFormTimeMs.value !== null ? editFormTimeMs.value : Date.now()

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
        timestamp: logTimestamp
      }
    }
  } else if (slot && !slot.requiresReading) {
    if (!todayReadings.value[slot.id]) recordedNew = true
    todayReadings.value[slot.id] = { value: 0, timestamp: logTimestamp }
  }

  if (slot && editFormTimeMs.value !== null) {
    updateTimeBasedOnConstraints()
    saveSchedule()
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

function isSlotDue(slot: ScheduleSlot) {
  if (todayReadings.value[slot.id]) return false;
  
  const [hours = 0, mins = 0] = slot.time.split(':').map(Number)
  const slotMinutes = hours * 60 + mins

  // Due if it's 10 mins before, or anytime after
  // We add a check for midnight wrap if someone scheduled something at 00:00, but typically times are > 00:00.
  // Using simple minute comparison works for a single day.
  if (currentMinutes.value >= slotMinutes - 10) {
    return true;
  }
  
  // Handle case where slot is just after midnight (e.g. 00:05) and current time is 23:55
  return slotMinutes < 10 && currentMinutes.value >= 1440 - (10 - slotMinutes);
  

}

const targetSlotIndex = computed(() => {
  const currentMins = currentMinutes.value
  for (let i = 0; i < schedule.value.length; i++) {
    const slot = schedule.value[i]
    if (slot && isSlotDue(slot)) return i;
  }
  for (let i = 0; i < schedule.value.length; i++) {
    const slot = schedule.value[i]
    if (!slot) continue;
    if (slot.requiresReading && todayReadings.value[slot.id]) continue;
    if (!slot.requiresReading && todayReadings.value[slot.id]) continue;
    
    if (!slot.requiresReading) {
      const [hours = 0, mins = 0] = slot.time.split(':').map(Number)
      const slotMins = hours * 60 + mins
      if (currentMins > slotMins + 45) continue;
    }
    return i;
  }
  return schedule.value.length - 1;
})

function scrollToActive() {
  const el = document.getElementById('card-' + targetSlotIndex.value)
  const container = document.getElementById('today-scroll-container')
  if (el && container) {
    const elTop = el.offsetTop
    const containerHeight = container.clientHeight
    const elHeight = el.clientHeight
    container.scrollTo({
      top: elTop - (containerHeight / 2) + (elHeight / 2),
      behavior: 'smooth'
    })
  } else if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
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
          <div class="flex items-center gap-2 mb-0.5">
            <h1 class="font-bold tracking-widest uppercase text-[10px]" :class="isDarkMode ? 'text-slate-500' : 'text-slate-400'">Gluco Monitor (GDM)</h1>
            <span v-if="isSignedIn" class="text-[9px] font-medium tracking-wide flex items-center gap-1">
              <template v-if="isSyncing">
                <svg class="animate-spin h-2.5 w-2.5" :class="isDarkMode ? 'text-slate-400' : 'text-slate-500'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span :class="isDarkMode ? 'text-slate-400' : 'text-slate-500'">SYNCING</span>
              </template>
              <template v-else-if="syncError">
                <button @click="syncData()" class="flex items-center gap-1 text-rose-500 dark:text-rose-400 hover:underline cursor-pointer" :title="syncError">
                  <svg class="h-2.5 w-2.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                  </svg>
                  <span>SYNC ERROR</span>
                </button>
              </template>
              <template v-else>
                <svg class="h-2.5 w-2.5 text-emerald-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <span :class="isDarkMode ? 'text-slate-500' : 'text-slate-400'">SYNCED</span>
              </template>
            </span>
          </div>
          <p class="text-sm font-semibold" :class="isDarkMode ? 'text-slate-300' : 'text-slate-600'">{{ dateString }}</p>
        </div>
        <n-dropdown :options="dropdownOptions" @select="handleDropdownSelect" placement="bottom-end" trigger="click">
          <button 
            class="w-10 h-10 rounded-full flex items-center justify-center transition-colors shadow-sm shrink-0"
            :class="isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-white text-slate-600 hover:bg-slate-100'"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="1"></circle>
              <circle cx="12" cy="5" r="1"></circle>
              <circle cx="12" cy="19" r="1"></circle>
            </svg>
          </button>
        </n-dropdown>
      </div>

      <!-- Clock (Consistent Flow) -->
      <div class="px-6 pb-6 pt-2 shrink-0 flex flex-col items-center justify-center relative z-20">
        <div class="flex items-baseline">
          <span class="text-[72px] font-black tabular-nums tracking-tighter drop-shadow-sm leading-none" :class="isDarkMode ? 'text-white' : 'text-slate-800'">{{ timeParts.time }}</span>
          <span class="text-xl font-bold ml-2" :class="isDarkMode ? 'text-slate-500' : 'text-slate-400'">{{ timeParts.ampm }}</span>
        </div>
      </div>

      <!-- Tabs Area -->
      <div class="flex-1 min-h-0 w-full flex flex-col relative z-10 overflow-hidden">
        <n-tabs type="segment" justify-content="space-evenly" class="mb-2 flex flex-col h-full" pane-wrapper-style="flex: 1; min-height: 0;" pane-style="height: 100%;">
          <n-tab-pane name="today" tab="Today" display-directive="show">
            <div id="today-scroll-container" class="w-full h-full relative overflow-y-auto no-scrollbar px-4 pb-32 pt-2 flex flex-col gap-4 transition-colors duration-500">
        <div 
          v-for="(slot, index) in schedule" 
          :key="slot.id" 
          :id="'card-' + index"
          @click="openEditModal(slot.id)"
          class="cursor-pointer"
        >
          <BloodSugarCard
            v-if="slot.requiresReading"
            :name="slot.name"
            :time="slot.time"
            :color-class="getSlotColorClass(index)!"
            :is-active="isSlotDue(slot)"
            :reading-value="todayReadings[slot.id]?.value"
          />
          <SnackCard
            v-else
            :name="slot.name"
            :time="slot.time"
            :color-class="getSlotColorClass(index)!"
            :is-active="isSlotDue(slot)"
            :is-taken="!!todayReadings[slot.id]"
          />
        </div>
            </div>
          </n-tab-pane>
          <n-tab-pane name="history" tab="History">
            <div class="w-full h-full overflow-y-auto no-scrollbar pb-32 transition-colors duration-500">
              <HistoryTab />
            </div>
          </n-tab-pane>
        </n-tabs>
      </div>
      
      <!-- Edit Modal -->
      <n-modal v-model:show="showEditModal">
        <n-card 
          style="width: 340px; border-radius: 28px;" 
          :title="activeSlotData?.requiresReading ? 'Log ' + activeSlotData?.name : 'Confirm ' + activeSlotData?.name" 
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
              <div>
                <label class="text-xs font-extrabold text-slate-400 uppercase tracking-widest mb-2 block">{{ activeSlotData?.name }} Taken At</label>
                <n-time-picker v-model:value="editFormTimeMs" format="HH:mm" size="large" class="w-full font-bold" />
              </div>
            </template>
            
            <div v-if="editFormError" class="mt-4 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm font-semibold flex items-start gap-2 leading-tight">
              <svg class="shrink-0 mt-0.5" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
              <span>{{ editFormError }}</span>
            </div>
            
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
.n-tabs-nav { padding: 0 16px !important; }
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
</style>
