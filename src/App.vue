<script setup lang="ts">
import { computed, onMounted } from 'vue'
import {
  NConfigProvider,
  NCard,
  NButton,
  NInput,
  NModal,
  NTabs,
  NTabPane,
  NDropdown,
  darkTheme
} from 'naive-ui'
import type { GlobalThemeOverrides } from 'naive-ui'
import HistoryTab from './components/HistoryTab.vue'
import BloodSugarCard from './components/BloodSugarCard.vue'
import SnackCard from './components/SnackCard.vue'
import { syncData, isSignedIn, isSyncing, syncError, needsReauth, handleAuthClick, handleSignoutClick, initGoogleApi } from './services/driveSync'
import { migrateStorage } from './utils/storage'
import { useTheme } from './composables/useTheme'
import { useClock } from './composables/useClock'
import { useSchedule } from './composables/useSchedule'
import { useReadings } from './composables/useReadings'
import { useNotifications } from './composables/useNotifications'
import { useEditModal } from './composables/useEditModal'

const { isDarkMode, toggleTheme } = useTheme()

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
    borderRadiusMedium: '10px',
    textColorPrimary: '#ffffff',
    textColorHoverPrimary: '#ffffff',
    textColorPressedPrimary: '#ffffff',
    textColorFocusPrimary: '#ffffff'
  }
}))

const { now, timeParts, dateString, currentMinutes } = useClock()
const { schedule, loadSchedule, saveSchedule } = useSchedule()
const { todayReadings, loadTodayReadings, persistReadings, isSlotDue } = useReadings(now)
const { notificationPermission, requestNotification } = useNotifications(now, schedule, currentMinutes, isSlotDue)

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

const {
  showEditModal,
  activeEditSlotId,
  activeSlotData,
  editFormTimeString,
  editFormReading,
  editFormSnackNote,
  editFormError,
  setEditTimeToNow,
  adjustReading,
  openEditModal,
  saveEditModal,
  uncheckSnack,
} = useEditModal(schedule, todayReadings, saveSchedule, persistReadings, scrollToActive)

const targetSlotIndex = computed(() => {
  const currentMins = currentMinutes.value
  for (let i = 0; i < schedule.value.length; i++) {
    const slot = schedule.value[i]
    if (slot && isSlotDue(slot, currentMins)) return i;
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
    label: !isSignedIn.value
      ? 'Connect Google Drive'
      : needsReauth.value
        ? 'Reconnect Google Drive'
        : (isSyncing.value ? 'Syncing to Drive...' : 'Sync Now'),
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
    if (!isSignedIn.value || needsReauth.value) handleAuthClick()
    else syncData()
  } else if (key === 'signout') {
    handleSignoutClick()
  } else if (key === 'notify') {
    requestNotification()
  }
}

onMounted(() => {
  migrateStorage()

  window.addEventListener('gdm_sync_complete', () => {
    loadSchedule()
    loadTodayReadings()
  })

  loadSchedule()
  loadTodayReadings()

  initGoogleApi()

  setTimeout(() => scrollToActive(), 300)
})
</script>

<template>
  <n-config-provider
    :theme="isDarkMode ? darkTheme : null"
    :theme-overrides="themeOverrides"
  >
    <div
      class="max-w-md mx-auto h-screen flex flex-col font-sans transition-colors duration-500 relative overflow-hidden"
      :class="isDarkMode ? 'bg-slate-950 text-slate-200' : 'bg-slate-50 text-slate-800'"
    >
      <!-- Minimal Header with Theme Toggle -->
      <div class="px-6 pt-10 pb-4 shrink-0 flex items-start justify-between z-20">
        <div>
          <div class="flex items-center gap-2 mb-0.5">
            <h1
              class="font-bold tracking-widest uppercase text-[10px]"
              :class="isDarkMode ? 'text-slate-500' : 'text-slate-400'"
            >
              Gluco Monitor (GDM)
            </h1>
            <span
              v-if="isSignedIn"
              class="text-[9px] font-medium tracking-wide flex items-center gap-1"
            >
              <template v-if="isSyncing">
                <svg
                  class="animate-spin h-2.5 w-2.5"
                  :class="isDarkMode ? 'text-slate-400' : 'text-slate-500'"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    class="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    stroke-width="4"
                  />
                  <path
                    class="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span :class="isDarkMode ? 'text-slate-400' : 'text-slate-500'">SYNCING</span>
              </template>
              <template v-else-if="syncError">
                <button
                  class="flex items-center gap-1 text-rose-500 dark:text-rose-400 hover:underline cursor-pointer"
                  :title="syncError"
                  @click="needsReauth ? handleAuthClick() : syncData()"
                >
                  <svg
                    class="h-2.5 w-2.5"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="3"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                    />
                    <line
                      x1="12"
                      y1="8"
                      x2="12"
                      y2="12"
                    />
                    <line
                      x1="12"
                      y1="16"
                      x2="12.01"
                      y2="16"
                    />
                  </svg>
                  <span>{{ needsReauth ? 'RECONNECT DRIVE' : 'SYNC ERROR' }}</span>
                </button>
              </template>
              <template v-else>
                <svg
                  class="h-2.5 w-2.5 text-emerald-500"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="3"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span :class="isDarkMode ? 'text-slate-500' : 'text-slate-400'">SYNCED</span>
              </template>
            </span>
          </div>
          <p
            class="text-sm font-semibold"
            :class="isDarkMode ? 'text-slate-300' : 'text-slate-600'"
          >
            {{ dateString }}
          </p>
        </div>
        <n-dropdown
          :options="dropdownOptions"
          placement="bottom-end"
          trigger="click"
          @select="handleDropdownSelect"
        >
          <button
            class="w-10 h-10 rounded-full flex items-center justify-center transition-colors shadow-sm shrink-0"
            :class="isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-white text-slate-600 hover:bg-slate-100'"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <circle
                cx="12"
                cy="12"
                r="1"
              />
              <circle
                cx="12"
                cy="5"
                r="1"
              />
              <circle
                cx="12"
                cy="19"
                r="1"
              />
            </svg>
          </button>
        </n-dropdown>
      </div>

      <!-- Clock (Consistent Flow) -->
      <div class="px-6 pb-6 pt-2 shrink-0 flex flex-col items-center justify-center relative z-20">
        <div class="flex items-baseline">
          <span
            class="text-[72px] font-black tabular-nums tracking-tighter drop-shadow-sm leading-none"
            :class="isDarkMode ? 'text-white' : 'text-slate-800'"
          >{{ timeParts.time }}</span>
          <span
            class="text-xl font-bold ml-2"
            :class="isDarkMode ? 'text-slate-500' : 'text-slate-400'"
          >{{ timeParts.ampm }}</span>
        </div>
      </div>

      <!-- Tabs Area -->
      <div class="flex-1 min-h-0 w-full flex flex-col relative z-10 overflow-hidden">
        <n-tabs
          type="segment"
          justify-content="space-evenly"
          class="mb-2 flex flex-col h-full"
          pane-wrapper-style="flex: 1; min-height: 0;"
          pane-style="height: 100%;"
        >
          <n-tab-pane
            name="today"
            tab="Today"
            display-directive="show"
          >
            <div
              id="today-scroll-container"
              class="w-full h-full relative overflow-y-auto no-scrollbar px-4 pb-32 pt-2 flex flex-col gap-4 transition-colors duration-500"
            >
              <div
                v-for="(slot, index) in schedule"
                :id="'card-' + index"
                :key="slot.id"
                class="cursor-pointer"
                @click="openEditModal(slot.id)"
              >
                <BloodSugarCard
                  v-if="slot.requiresReading"
                  :name="slot.name"
                  :time="slot.time"
                  :color-class="getSlotColorClass(index)!"
                  :is-active="isSlotDue(slot, currentMinutes)"
                  :reading-value="todayReadings[slot.id]?.value"
                />
                <SnackCard
                  v-else
                  :name="slot.name"
                  :time="slot.time"
                  :color-class="getSlotColorClass(index)!"
                  :is-active="isSlotDue(slot, currentMinutes)"
                  :is-taken="!!todayReadings[slot.id]"
                  :note="todayReadings[slot.id]?.note"
                />
              </div>
            </div>
          </n-tab-pane>
          <n-tab-pane
            name="history"
            tab="History"
          >
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
                <div class="flex gap-2">
                  <input
                    v-model="editFormTimeString"
                    type="time"
                    :style="{ colorScheme: isDarkMode ? 'dark' : 'light' }"
                    class="flex-1 min-w-0 rounded-2xl px-4 py-3.5 text-3xl font-black tabular-nums tracking-tight bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-white outline-none focus:ring-4 focus:ring-blue-500/30 transition-shadow"
                  >
                  <button
                    type="button"
                    class="shrink-0 px-4 rounded-2xl bg-blue-500/10 hover:bg-blue-500/20 active:scale-95 text-blue-600 dark:text-blue-400 font-extrabold text-xs uppercase tracking-widest transition-all"
                    @click="setEditTimeToNow"
                  >
                    Now
                  </button>
                </div>
              </div>

              <!-- Edit Reading -->
              <div>
                <label class="text-xs font-extrabold text-slate-400 uppercase tracking-widest mb-2 block">Glucose Reading</label>
                <div class="flex items-center gap-3 bg-slate-100 dark:bg-slate-800 rounded-2xl px-3 py-2.5">
                  <button
                    type="button"
                    class="shrink-0 w-12 h-12 rounded-xl bg-white dark:bg-slate-700 shadow-sm active:scale-95 transition-transform flex items-center justify-center text-2xl font-black text-slate-600 dark:text-slate-200"
                    @click="adjustReading(-0.1)"
                  >
                    −
                  </button>
                  <div class="flex-1 flex flex-col items-center min-w-0">
                    <input
                      v-model.number="editFormReading"
                      type="number"
                      inputmode="decimal"
                      step="0.1"
                      min="0"
                      placeholder="0.0"
                      class="w-full bg-transparent text-center text-4xl font-black tabular-nums text-slate-800 dark:text-white outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    >
                    <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest -mt-1">mmol/L</span>
                  </div>
                  <button
                    type="button"
                    class="shrink-0 w-12 h-12 rounded-xl bg-white dark:bg-slate-700 shadow-sm active:scale-95 transition-transform flex items-center justify-center text-2xl font-black text-slate-600 dark:text-slate-200"
                    @click="adjustReading(0.1)"
                  >
                    +
                  </button>
                </div>
              </div>
            </template>

            <template v-else>
              <!-- Snack Confirmation -->
              <div>
                <label class="text-xs font-extrabold text-slate-400 uppercase tracking-widest mb-2 block">{{ activeSlotData?.name }} Taken At</label>
                <div class="flex gap-2">
                  <input
                    v-model="editFormTimeString"
                    type="time"
                    :style="{ colorScheme: isDarkMode ? 'dark' : 'light' }"
                    class="flex-1 min-w-0 rounded-2xl px-4 py-3.5 text-3xl font-black tabular-nums tracking-tight bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-white outline-none focus:ring-4 focus:ring-blue-500/30 transition-shadow"
                  >
                  <button
                    type="button"
                    class="shrink-0 px-4 rounded-2xl bg-blue-500/10 hover:bg-blue-500/20 active:scale-95 text-blue-600 dark:text-blue-400 font-extrabold text-xs uppercase tracking-widest transition-all"
                    @click="setEditTimeToNow"
                  >
                    Now
                  </button>
                </div>
              </div>

              <!-- What was eaten -->
              <div>
                <label class="text-xs font-extrabold text-slate-400 uppercase tracking-widest mb-2 block">What did you eat?</label>
                <n-input
                  v-model:value="editFormSnackNote"
                  type="textarea"
                  placeholder="e.g. Apple and a handful of almonds"
                  :autosize="{ minRows: 2, maxRows: 4 }"
                  size="large"
                  class="w-full font-semibold"
                />
              </div>
            </template>

            <div
              v-if="editFormError"
              class="mt-4 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm font-semibold flex items-start gap-2 leading-tight"
            >
              <svg
                class="shrink-0 mt-0.5"
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              ><circle
                cx="12"
                cy="12"
                r="10"
              /><line
                x1="12"
                y1="8"
                x2="12"
                y2="12"
              /><line
                x1="12"
                y1="16"
                x2="12.01"
                y2="16"
              /></svg>
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
                class="font-bold mr-auto"
                @click="uncheckSnack"
              >
                Remove
              </n-button>

              <div class="flex gap-3 ml-auto">
                <n-button
                  size="large"
                  class="font-bold"
                  @click="showEditModal = false"
                >
                  Cancel
                </n-button>
                <n-button
                  type="primary"
                  size="large"
                  class="font-bold px-6 shadow-md"
                  @click="saveEditModal"
                >
                  Save
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
