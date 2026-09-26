import type { ScheduleSlot } from '../constants/schedule'
import type { StoredReadingMap } from '../types'

export function timeStringToMinutes(time: string): number {
  if (!time) return 0
  const [h = 0, m = 0] = time.split(':').map(Number)
  return h * 60 + m
}

// Readings are bucketed per calendar day (gdm_readings_<dateStr>), so "due"
// only needs to consider today: a slot becomes due 10 minutes before its
// scheduled time and stays due (indefinitely, for today) until it's logged.
// There is deliberately no cross-midnight handling here — a slot scheduled
// just after midnight being "due" while it's still yesterday would file
// under the wrong day's key.
export function isSlotDue(slot: ScheduleSlot, todayReadings: StoredReadingMap, currentMinutes: number): boolean {
  if (todayReadings[slot.id]) return false

  const slotMinutes = timeStringToMinutes(slot.time)
  return currentMinutes >= slotMinutes - 10
}
