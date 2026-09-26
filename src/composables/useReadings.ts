import { ref, type Ref } from 'vue'
import type { ScheduleSlot } from '../constants/schedule'
import type { StoredReadingMap } from '../types'
import { readJSON, writeJSON } from '../utils/storage'
import { isStoredReadingMap } from '../utils/guards'
import { isSlotDue as isSlotDuePure } from '../utils/dueStatus'
import { getActualMins as getActualMinsPure } from '../utils/scheduleCascade'
import { syncData } from '../services/driveSync'

function getDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function readingsKey(dateStr: string): string {
  return `gdm_readings_${dateStr}`
}

export function useReadings(now: Ref<Date>) {
  const todayReadings = ref<StoredReadingMap>({})

  function loadTodayReadings() {
    todayReadings.value = readJSON(readingsKey(getDateString(now.value)), isStoredReadingMap, {})
  }

  function persistReadings() {
    writeJSON(readingsKey(getDateString(now.value)), todayReadings.value)
    syncData()
  }

  function getActualMins(schedule: ScheduleSlot[], id: string): number {
    return getActualMinsPure(schedule, todayReadings.value, id)
  }

  function isSlotDue(slot: ScheduleSlot, currentMinutes: number): boolean {
    return isSlotDuePure(slot, todayReadings.value, currentMinutes)
  }

  return { todayReadings, loadTodayReadings, persistReadings, getActualMins, isSlotDue }
}
