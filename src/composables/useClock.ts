import { computed, onScopeDispose, ref } from 'vue'

export type ClockResolution = 'second' | 'minute'

// `resolution: 'minute'` still polls every second (so minute changes are
// picked up promptly) but only updates the reactive `now` when the minute
// actually changes, so consumers don't re-render once per second.
export function useClock(resolution: ClockResolution = 'second') {
  const now = ref(new Date())

  const timer = window.setInterval(() => {
    const next = new Date()
    if (
      resolution === 'minute' &&
      next.getMinutes() === now.value.getMinutes() &&
      next.getHours() === now.value.getHours() &&
      next.getDate() === now.value.getDate()
    ) {
      return
    }
    now.value = next
  }, 1000)

  onScopeDispose(() => window.clearInterval(timer))

  const timeParts = computed(() => {
    const timeString = now.value.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })
    const parts = timeString.split(' ')
    return { time: parts[0], ampm: parts[1] }
  })

  const dateString = computed(() => {
    return now.value.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  })

  const currentMinutes = computed(() => now.value.getHours() * 60 + now.value.getMinutes())

  return { now, timeParts, dateString, currentMinutes }
}
