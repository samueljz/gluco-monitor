import { computed, onScopeDispose, ref } from 'vue'

export function useClock() {
  const now = ref(new Date())

  const timer = window.setInterval(() => {
    now.value = new Date()
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
