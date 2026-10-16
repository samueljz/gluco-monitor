import { defaultSchedule } from '../constants/schedule'

export function formatDateYYYYMMDD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function formatTime24To12(time: string): string {
  if (!time) return ''
  const [h = 0, m = 0] = time.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hours = h % 12 || 12
  return `${hours}:${m.toString().padStart(2, '0')} ${ampm}`
}

export function formatTimestampTo12(ts: number): string {
  const d = new Date(ts)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return formatTime24To12(`${hh}:${mm}`)
}

export function formatSlotName(slotId: string): string {
  const match = defaultSchedule.find(s => s.id === slotId)
  if (match) return match.name
  return slotId
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}
