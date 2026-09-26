import { describe, expect, it } from 'vitest'
import { isSlotDue, timeStringToMinutes } from '../dueStatus'
import type { ScheduleSlot } from '../../constants/schedule'

function slot(overrides: Partial<ScheduleSlot> = {}): ScheduleSlot {
  return { id: 'before_breakfast', name: 'Before Breakfast', time: '08:00', requiresReading: true, ...overrides }
}

describe('timeStringToMinutes', () => {
  it('converts HH:mm to minutes since midnight', () => {
    expect(timeStringToMinutes('08:00')).toBe(480)
    expect(timeStringToMinutes('00:00')).toBe(0)
    expect(timeStringToMinutes('23:59')).toBe(1439)
  })

  it('treats an empty string as 0', () => {
    expect(timeStringToMinutes('')).toBe(0)
  })
})

describe('isSlotDue', () => {
  it('is not due more than 10 minutes before the scheduled time', () => {
    expect(isSlotDue(slot({ time: '08:00' }), {}, 449)).toBe(false)
  })

  it('becomes due exactly 10 minutes before the scheduled time', () => {
    expect(isSlotDue(slot({ time: '08:00' }), {}, 470)).toBe(true)
  })

  it('stays due any time after the scheduled time (no logged reading yet)', () => {
    expect(isSlotDue(slot({ time: '08:00' }), {}, 600)).toBe(true)
  })

  it('is never due once a reading has been logged for it today', () => {
    const todayReadings = { before_breakfast: { value: 5.2, timestamp: Date.now() } }
    expect(isSlotDue(slot({ time: '08:00' }), todayReadings, 600)).toBe(false)
  })

  it('is due for the whole day for a slot scheduled within 10 minutes of midnight', () => {
    // slotMinutes - 10 goes negative here, which simply widens the due
    // window to start at midnight — there's no "previous day" to wrap
    // into, since isSlotDue only ever reasons about today's currentMinutes.
    expect(isSlotDue(slot({ time: '00:05' }), {}, 0)).toBe(true)
    expect(isSlotDue(slot({ time: '00:05' }), {}, 1439)).toBe(true)
  })
})
