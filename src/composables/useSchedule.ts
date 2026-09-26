import { ref } from 'vue'
import { defaultSchedule, type ScheduleSlot } from '../constants/schedule'
import { writeJSON } from '../utils/storage'
import { isScheduleSlotArray } from '../utils/guards'
import { syncData } from '../services/driveSync'

const SCHEDULE_KEY = 'gdm_schedule_v9'

function cloneDefaultSchedule(): ScheduleSlot[] {
  return JSON.parse(JSON.stringify(defaultSchedule))
}

export function useSchedule() {
  const schedule = ref<ScheduleSlot[]>(cloneDefaultSchedule())

  function loadSchedule() {
    const raw = localStorage.getItem(SCHEDULE_KEY)
    if (raw === null) {
      writeJSON(SCHEDULE_KEY, schedule.value)
      return
    }

    try {
      const parsed = JSON.parse(raw)
      if (!isScheduleSlotArray(parsed)) {
        console.warn('Ignoring malformed schedule in localStorage')
        return
      }
      // Merge each saved slot onto its current default so newly added
      // fields (e.g. a future mealType) show up even for slots saved by an
      // older version of the app.
      schedule.value = parsed.map(p => ({ ...(defaultSchedule.find(d => d.id === p.id) ?? {}), ...p }))
    } catch (e) {
      console.error('Failed to parse schedule', e)
    }
  }

  function saveSchedule() {
    writeJSON(SCHEDULE_KEY, schedule.value)
    syncData()
  }

  return { schedule, loadSchedule, saveSchedule }
}
