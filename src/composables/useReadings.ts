import { computed, ref, watch, type Ref } from 'vue'
import type { ScheduleSlot } from '../constants/schedule'
import type { StoredReadingMap } from '../types'
import { readJSON, writeJSON } from '../utils/storage'
import { isStoredReadingMap } from '../utils/guards'
import { isSlotDue as isSlotDuePure } from '../utils/dueStatus'
import { formatDateYYYYMMDD } from '../utils/format'
import { syncData } from '../services/driveSync'

function readingsKey(dateStr: string): string {
  return `gdm_readings_${dateStr}`
}

export function useReadings(now: Ref<Date>) {
  const todayReadings = ref<StoredReadingMap>({})
  const currentDateString = computed(() => formatDateYYYYMMDD(now.value))

  function loadTodayReadings() {
    todayReadings.value = readJSON(readingsKey(currentDateString.value), isStoredReadingMap, {})
  }

  function persistReadings() {
    writeJSON(readingsKey(currentDateString.value), todayReadings.value)
    syncData()
  }

  watch(currentDateString, () => {
    loadTodayReadings()
  })

  function isSlotDue(slot: ScheduleSlot, currentMinutes: number): boolean {
    return isSlotDuePure(slot, todayReadings.value, currentMinutes)
  }

  return { todayReadings, currentDateString, loadTodayReadings, persistReadings, isSlotDue }
}
