import { describe, expect, it } from 'vitest'
import { hasAccessToken, isScheduleSlotArray, isStoredReadingMap, isThemeValue } from '../guards'

describe('isScheduleSlotArray', () => {
  it('accepts a well-formed schedule array', () => {
    expect(isScheduleSlotArray([
      { id: 'breakfast', name: 'Breakfast', time: '08:00', requiresReading: false, mealType: 'meal' },
    ])).toBe(true)
  })

  it('accepts an empty array', () => {
    expect(isScheduleSlotArray([])).toBe(true)
  })

  it('rejects a non-array', () => {
    expect(isScheduleSlotArray({ id: 'breakfast' })).toBe(false)
  })

  it('rejects an array with a malformed slot', () => {
    expect(isScheduleSlotArray([{ id: 'breakfast', name: 'Breakfast' }])).toBe(false)
  })
})

describe('isStoredReadingMap', () => {
  it('accepts a valid readings map', () => {
    expect(isStoredReadingMap({ before_breakfast: { value: 5.2, timestamp: 1700000000000 } })).toBe(true)
  })

  it('accepts an empty object', () => {
    expect(isStoredReadingMap({})).toBe(true)
  })

  it('rejects a reading missing required fields', () => {
    expect(isStoredReadingMap({ before_breakfast: { value: 5.2 } })).toBe(false)
  })

  it('rejects a non-object', () => {
    expect(isStoredReadingMap([1, 2, 3])).toBe(false)
    expect(isStoredReadingMap(null)).toBe(false)
  })
})

describe('isThemeValue', () => {
  it('accepts "dark" and "light"', () => {
    expect(isThemeValue('dark')).toBe(true)
    expect(isThemeValue('light')).toBe(true)
  })

  it('rejects anything else', () => {
    expect(isThemeValue('blue')).toBe(false)
    expect(isThemeValue(null)).toBe(false)
  })
})

describe('hasAccessToken', () => {
  it('accepts a token response with a string access_token', () => {
    expect(hasAccessToken({ access_token: 'abc', expires_in: 3600 })).toBe(true)
  })

  it('rejects a response with no access_token (e.g. an error response)', () => {
    expect(hasAccessToken({ error: 'access_denied' })).toBe(false)
  })

  it('rejects a non-object', () => {
    expect(hasAccessToken('abc')).toBe(false)
  })
})
