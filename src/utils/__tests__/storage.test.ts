import { beforeEach, describe, expect, it } from 'vitest'
import { DATA_VERSION_KEY, getDataVersion, migrateStorage, readJSON, writeJSON } from '../storage'
import { isStoredReadingMap } from '../guards'

beforeEach(() => {
  localStorage.clear()
})

describe('readJSON / writeJSON', () => {
  it('round-trips a value through localStorage', () => {
    writeJSON('gdm_readings_2026-01-01', { before_breakfast: { value: 5.2, timestamp: 1 } })
    expect(readJSON('gdm_readings_2026-01-01', isStoredReadingMap, {})).toEqual({
      before_breakfast: { value: 5.2, timestamp: 1 },
    })
  })

  it('returns the fallback when the key is absent', () => {
    expect(readJSON('gdm_readings_missing', isStoredReadingMap, {})).toEqual({})
  })

  it('returns the fallback and warns when the stored JSON does not match the guard', () => {
    localStorage.setItem('gdm_readings_bad', JSON.stringify({ before_breakfast: { value: 'not-a-number' } }))
    expect(readJSON('gdm_readings_bad', isStoredReadingMap, {})).toEqual({})
  })

  it('returns the fallback when the stored value is not valid JSON', () => {
    localStorage.setItem('gdm_readings_corrupt', '{not json')
    expect(readJSON('gdm_readings_corrupt', isStoredReadingMap, {})).toEqual({})
  })
})

describe('migrateStorage', () => {
  it('stamps a fresh version when none is set, without touching other keys', () => {
    localStorage.setItem('gdm_schedule_v9', '[]')
    migrateStorage()
    expect(getDataVersion()).toBe(1)
    expect(localStorage.getItem('gdm_schedule_v9')).toBe('[]')
  })

  it('is a no-op once already at the latest version', () => {
    localStorage.setItem(DATA_VERSION_KEY, '1')
    migrateStorage()
    expect(getDataVersion()).toBe(1)
  })
})
