import { ref, watch, type Ref } from 'vue'
import type { ScheduleSlot } from '../constants/schedule'
import { timeStringToMinutes } from '../utils/dueStatus'

export function useNotifications(
  schedule: Ref<ScheduleSlot[]>,
  currentMinutes: Ref<number>,
  isSlotDue: (slot: ScheduleSlot, currentMinutes: number) => boolean
) {
  const notificationPermission = ref('Notification' in window ? Notification.permission : 'denied')
  const notifiedSlots = new Set<string>()
  let initialized = false

  function requestNotification() {
    if ('Notification' in window) {
      Notification.requestPermission().then(perm => {
        notificationPermission.value = perm
      })
    }
  }

  watch([currentMinutes, schedule], () => {
    const mins = currentMinutes.value
    for (const slot of schedule.value) {
      if (isSlotDue(slot, mins)) {
        const slotMins = timeStringToMinutes(slot.time)
        // On initial evaluation, mark slots that are already well past their
        // scheduled time (> 15 mins ago) as seen so opening the app late in
        // the day does not trigger a burst of notifications for past slots.
        if (!initialized && mins > slotMins + 15) {
          notifiedSlots.add(slot.id)
          continue
        }

        if (!notifiedSlots.has(slot.id)) {
          notifiedSlots.add(slot.id)
          if ('Notification' in window && notificationPermission.value === 'granted') {
            new Notification('Gluco Monitor', {
              body: `It's time to log your upcoming item: ${slot.name} (${slot.time})`
            })
          }
        }
      } else {
        notifiedSlots.delete(slot.id)
      }
    }
    initialized = true
  })

  return { notificationPermission, requestNotification }
}
