import { describe, expect, it } from 'vitest'
import { applyCascade, getActualMins, validateProposedTime } from '../scheduleCascade'
import { defaultSchedule } from '../../constants/schedule'
import type { StoredReadingMap } from '../../types'

function timestampAt(hh: number, mm: number): number {
  const d = new Date()
  d.setHours(hh, mm, 0, 0)
  return d.getTime()
}

describe('getActualMins', () => {
  it('uses a slot\'s logged timestamp when it has one', () => {
    const readings: StoredReadingMap = { breakfast: { value: 0, timestamp: timestampAt(8, 30) } }
    expect(getActualMins(defaultSchedule, readings, 'breakfast')).toBe(8 * 60 + 30)
  })

  it('falls back to the scheduled (planned) time when not logged', () => {
    expect(getActualMins(defaultSchedule, {}, 'breakfast')).toBe(8 * 60) // 08:00
  })

  it('returns 0 for an unknown slot id', () => {
    expect(getActualMins(defaultSchedule, {}, 'does_not_exist')).toBe(0)
  })
})

describe('applyCascade', () => {
  it('pushes a slot to gap minutes after its logged source event', () => {
    const readings: StoredReadingMap = { breakfast: { value: 0, timestamp: timestampAt(8, 30) } }
    const next = applyCascade(defaultSchedule, readings)
    // breakfast -> morning_snack, gap 120
    expect(next.find(s => s.id === 'morning_snack')?.time).toBe('10:30')
    // breakfast -> after_breakfast, gap 120
    expect(next.find(s => s.id === 'after_breakfast')?.time).toBe('10:30')
  })

  it('does not cascade a requiresSourceLogged rule until its source is logged', () => {
    const next = applyCascade(defaultSchedule, {})
    expect(next.find(s => s.id === 'before_lunch')?.time).toBe(
      defaultSchedule.find(s => s.id === 'before_lunch')?.time
    )
  })

  it('cascades a requiresSourceLogged rule once its source is logged', () => {
    const readings: StoredReadingMap = { morning_snack: { value: 0, timestamp: timestampAt(10, 35) } }
    const next = applyCascade(defaultSchedule, readings)
    expect(next.find(s => s.id === 'before_lunch')?.time).toBe('12:35')
  })

  it('never overwrites a slot that has already been logged today', () => {
    const readings: StoredReadingMap = {
      breakfast: { value: 0, timestamp: timestampAt(8, 30) },
      morning_snack: { value: 0, timestamp: timestampAt(9, 0) },
    }
    const next = applyCascade(defaultSchedule, readings)
    // Would otherwise cascade to 10:30, but morning_snack is already logged at 09:00.
    expect(next.find(s => s.id === 'morning_snack')?.time).toBe(
      defaultSchedule.find(s => s.id === 'morning_snack')?.time
    )
  })
})

describe('validateProposedTime', () => {
  it('allows any proposed time when the rule\'s source event has not been logged yet', () => {
    // before_lunch not logged, so lunch (before_lunch -> lunch, gap 5, non-strict
    // anyway) and before_lunch's own incoming rule are both unconstrained.
    const result = validateProposedTime(defaultSchedule, {}, 'before_lunch', 0)
    expect(result.ok).toBe(true)
  })

  it('rejects a strict rule violation once the source event is logged', () => {
    const readings: StoredReadingMap = { breakfast: { value: 0, timestamp: timestampAt(8, 30) } }
    // breakfast -> morning_snack requires >= 120 min gap and is strict.
    const proposedMins = 9 * 60 // 09:00, only 30 min after breakfast
    const result = validateProposedTime(defaultSchedule, readings, 'morning_snack', proposedMins)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toContain('Breakfast')
      expect(result.message).toContain('10:30')
    }
  })

  it('allows a proposed time that satisfies the gap', () => {
    const readings: StoredReadingMap = { breakfast: { value: 0, timestamp: timestampAt(8, 30) } }
    const result = validateProposedTime(defaultSchedule, readings, 'morning_snack', 11 * 60)
    expect(result.ok).toBe(true)
  })

  it('does not reject a non-strict rule even if the gap is violated', () => {
    const readings: StoredReadingMap = { before_breakfast: { value: 5.0, timestamp: timestampAt(7, 55) } }
    // before_breakfast -> breakfast, gap 5, strict: false
    const result = validateProposedTime(defaultSchedule, readings, 'breakfast', 7 * 60 + 56)
    expect(result.ok).toBe(true)
  })
})
