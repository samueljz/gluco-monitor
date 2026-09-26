import { ref, watch, type Ref } from 'vue'
import type { ScheduleSlot } from '../constants/schedule'

export function useNotifications(
  now: Ref<Date>,
  schedule: Ref<ScheduleSlot[]>,
  currentMinutes: Ref<number>,
  isSlotDue: (slot: ScheduleSlot, currentMinutes: number) => boolean
) {
  const notificationPermission = ref('Notification' in window ? Notification.permission : 'denied')
  const notifiedSlots = new Set<string>()

  function requestNotification() {
    if ('Notification' in window) {
      Notification.requestPermission().then(perm => {
        notificationPermission.value = perm
      })
    }
  }

  watch(now, () => {
    for (const slot of schedule.value) {
      if (isSlotDue(slot, currentMinutes.value)) {
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
  })

  return { notificationPermission, requestNotification }
}
