import type { ScheduleSlot } from '../constants/schedule'
import { SCHEDULE_RULES } from '../constants/schedule'
import type { StoredReadingMap } from '../types'
import { timeStringToMinutes } from './dueStatus'

function minutesToTimeString(mins: number): string {
  const h = Math.floor(mins / 60) % 24
  const m = mins % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

// The actual minutes-of-day a slot happened at: its logged timestamp if it's
// been recorded today, otherwise its currently scheduled (planned) time.
export function getActualMins(schedule: ScheduleSlot[], todayReadings: StoredReadingMap, id: string): number {
  const logged = todayReadings[id]
  if (logged && logged.timestamp) {
    const d = new Date(logged.timestamp)
    return d.getHours() * 60 + d.getMinutes()
  }
  const slot = schedule.find(s => s.id === id)
  if (!slot) return 0
  return timeStringToMinutes(slot.time)
}

// Cascades planned (not-yet-logged) slot times forward based on SCHEDULE_RULES,
// e.g. pushing "Morning Snack" to 2h after whenever Breakfast actually happened.
// Returns a new array; slots already logged today are left untouched since
// their time is fixed in history.
export function applyCascade(schedule: ScheduleSlot[], todayReadings: StoredReadingMap): ScheduleSlot[] {
  const next = schedule.map(s => ({ ...s }))

  for (const rule of SCHEDULE_RULES) {
    if (rule.requiresSourceLogged && !todayReadings[rule.start]) continue
    if (todayReadings[rule.end]) continue

    const startMins = getActualMins(next, todayReadings, rule.start)
    const target = next.find(s => s.id === rule.end)
    if (target) target.time = minutesToTimeString(startMins + rule.gap)
  }

  return next
}

export type ValidationResult = { ok: true } | { ok: false; message: string }

// Save-time check mirroring applyCascade's rules: blocks a proposed time
// earlier than `gap` minutes after a rule's start event, but only once that
// start event has actually happened — a purely planned time is free to move,
// it'll just get cascaded again.
export function validateProposedTime(
  schedule: ScheduleSlot[],
  todayReadings: StoredReadingMap,
  slotId: string,
  proposedMins: number
): ValidationResult {
  for (const rule of SCHEDULE_RULES) {
    if (rule.end !== slotId) continue
    if (!todayReadings[rule.start]) continue

    const startMins = getActualMins(schedule, todayReadings, rule.start)
    if (proposedMins < startMins + rule.gap && rule.strict) {
      const startSlot = schedule.find(s => s.id === rule.start)
      const name = startSlot ? startSlot.name : rule.start
      const minTimeStr = minutesToTimeString(startMins + rule.gap)
      const hrs = rule.gap >= 60 ? `${rule.gap / 60} hours` : `${rule.gap} minutes`
      return { ok: false, message: `Must be at least ${hrs} after ${name} (earliest: ${minTimeStr})` }
    }
  }
  return { ok: true }
}
