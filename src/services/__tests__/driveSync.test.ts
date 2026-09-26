import { describe, expect, it, vi } from 'vitest'
import { computeMerge } from '../driveSync'

const validSchedule = [
  { id: 'breakfast', name: 'Breakfast', time: '08:00', requiresReading: false, mealType: 'meal' },
]

const validReadings = {
  before_breakfast: { value: 5.2, timestamp: 1700000000000 },
}

describe('computeMerge', () => {
  it('overwrites local values with valid remote values when prioritizing remote', () => {
    const { merged, changedKeys } = computeMerge(
      { gdm_theme: 'dark' },
      { gdm_theme: 'light' },
      true
    )
    expect(merged.gdm_theme).toBe('dark')
    expect(changedKeys).toEqual(['gdm_theme'])
  })

  it('only fills in keys missing locally when not prioritizing remote', () => {
    const { merged, changedKeys } = computeMerge(
      { gdm_theme: 'dark', gdm_schedule_v9: validSchedule },
      { gdm_theme: 'light' },
      false
    )
    expect(merged.gdm_theme).toBe('light')
    expect(merged.gdm_schedule_v9).toEqual(validSchedule)
    expect(changedKeys).toEqual(['gdm_schedule_v9'])
  })

  it('never touches the auth token keys even if present in the remote payload', () => {
    const { merged, changedKeys } = computeMerge(
      { gdm_google_token: 'stolen', gdm_token_expires_at: '0' },
      {},
      true
    )
    expect(merged.gdm_google_token).toBeUndefined()
    expect(merged.gdm_token_expires_at).toBeUndefined()
    expect(changedKeys).toEqual([])
  })

  it('skips a malformed remote schedule instead of corrupting local state', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { merged, changedKeys } = computeMerge(
      { gdm_schedule_v9: { not: 'an array' } },
      { gdm_schedule_v9: validSchedule },
      true
    )
    expect(merged.gdm_schedule_v9).toEqual(validSchedule)
    expect(changedKeys).toEqual([])
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('skips a malformed remote readings map', () => {
    const { merged, changedKeys } = computeMerge(
      { gdm_readings_2026_01_01: { slot: { value: 'nope' } } },
      {},
      true
    )
    expect(merged.gdm_readings_2026_01_01).toBeUndefined()
    expect(changedKeys).toEqual([])
  })

  it('accepts a valid readings map', () => {
    const { merged, changedKeys } = computeMerge(
      { gdm_readings_2026_01_01: validReadings },
      {},
      true
    )
    expect(merged.gdm_readings_2026_01_01).toEqual(validReadings)
    expect(changedKeys).toEqual(['gdm_readings_2026_01_01'])
  })

  it('passes through an unrecognized gdm_ key it has no shape to validate', () => {
    const { merged, changedKeys } = computeMerge(
      { gdm_future_feature: { anything: true } },
      {},
      true
    )
    expect(merged.gdm_future_feature).toEqual({ anything: true })
    expect(changedKeys).toEqual(['gdm_future_feature'])
  })

  it('ignores keys that are not gdm_-prefixed', () => {
    const { merged, changedKeys } = computeMerge({ unrelated: 'value' }, {}, true)
    expect(merged.unrelated).toBeUndefined()
    expect(changedKeys).toEqual([])
  })
})
