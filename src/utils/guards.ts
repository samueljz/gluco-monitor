import type { ScheduleSlot } from '../constants/schedule'
import type { StoredReading, StoredReadingMap, ThemeValue } from '../types'

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isScheduleSlot(value: unknown): value is ScheduleSlot {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.time === 'string' &&
    typeof value.requiresReading === 'boolean'
  )
}

export function isScheduleSlotArray(value: unknown): value is ScheduleSlot[] {
  return Array.isArray(value) && value.every(isScheduleSlot)
}

function isStoredReading(value: unknown): value is StoredReading {
  if (!isRecord(value)) return false
  return (
    typeof value.value === 'number' &&
    typeof value.timestamp === 'number' &&
    (value.note === undefined || typeof value.note === 'string')
  )
}

export function isStoredReadingMap(value: unknown): value is StoredReadingMap {
  return isRecord(value) && Object.values(value).every(isStoredReading)
}

export function isThemeValue(value: unknown): value is ThemeValue {
  return value === 'dark' || value === 'light'
}

export function hasAccessToken(value: unknown): value is { access_token: string } {
  return isRecord(value) && typeof value.access_token === 'string'
}
