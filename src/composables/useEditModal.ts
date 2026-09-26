import { computed, ref, type Ref } from 'vue'
import confetti from 'canvas-confetti'
import type { ScheduleSlot } from '../constants/schedule'
import type { StoredReadingMap } from '../types'
import { timeStringToMinutes } from '../utils/dueStatus'
import { applyCascade, validateProposedTime } from '../utils/scheduleCascade'

function timeStringToMs(timeStr: string): number {
  if (!timeStr) return 0
  const [h = 0, m = 0] = timeStr.split(':').map(Number)
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return d.getTime()
}

function msToTimeString(ms: number | null): string {
  if (ms === null) return '00:00'
  const d = new Date(ms)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

export function useEditModal(
  schedule: Ref<ScheduleSlot[]>,
  todayReadings: Ref<StoredReadingMap>,
  saveSchedule: () => void,
  persistReadings: () => void,
  scrollToActive: () => void
) {
  const showEditModal = ref(false)
  const activeEditSlotId = ref<string | null>(null)
  const editFormTimeMs = ref<number | null>(null)
  const editFormReading = ref<number | null>(null)
  const editFormSnackTaken = ref(false)
  const editFormSnackNote = ref('')
  const editFormError = ref('')

  const activeSlotData = computed(() => {
    if (!activeEditSlotId.value) return null
    return schedule.value.find(s => s.id === activeEditSlotId.value) ?? null
  })

  const editFormTimeString = computed<string>({
    get: () => msToTimeString(editFormTimeMs.value),
    set: (val: string) => {
      editFormTimeMs.value = val ? timeStringToMs(val) : null
    }
  })

  function setEditTimeToNow() {
    editFormTimeMs.value = Date.now()
  }

  function adjustReading(delta: number) {
    const current = editFormReading.value ?? 0
    const next = Math.round((current + delta) * 10) / 10
    editFormReading.value = Math.max(0, next)
  }

  function openEditModal(slotId: string) {
    const slot = schedule.value.find(s => s.id === slotId)
    if (!slot) return

    activeEditSlotId.value = slotId
    const hasReading = !!todayReadings.value[slotId]

    if (hasReading) {
      // If we have a logged timestamp, use it exactly!
      editFormTimeMs.value = todayReadings.value[slotId]?.timestamp || Date.now()
    } else {
      // Otherwise default to right now
      editFormTimeMs.value = Date.now()
    }

    if (slot.requiresReading) {
      editFormReading.value = hasReading ? (todayReadings.value[slotId]?.value ?? null) : null
    } else {
      editFormSnackTaken.value = hasReading
      editFormSnackNote.value = todayReadings.value[slotId]?.note ?? ''
    }

    editFormError.value = ''
    showEditModal.value = true
  }

  function saveEditModal() {
    if (!activeEditSlotId.value) return

    const slot = schedule.value.find(s => s.id === activeEditSlotId.value)
    let recordedNew = false
    editFormError.value = ''

    if (slot && editFormTimeMs.value !== null) {
      const proposedTime = msToTimeString(editFormTimeMs.value)
      const proposedMins = timeStringToMinutes(proposedTime)

      const result = validateProposedTime(schedule.value, todayReadings.value, slot.id, proposedMins)
      if (!result.ok) {
        editFormError.value = result.message
        return
      }

      slot.time = proposedTime
    }

    const logTimestamp = editFormTimeMs.value !== null ? editFormTimeMs.value : Date.now()

    // Save Reading / Snack Status
    if (slot?.requiresReading) {
      if (editFormReading.value === null || editFormReading.value === undefined || editFormReading.value <= 0) {
        delete todayReadings.value[slot.id]
      } else {
        const existing = todayReadings.value[slot.id]
        if (!existing || existing.value !== editFormReading.value) {
          recordedNew = true
        }
        todayReadings.value[slot.id] = {
          value: editFormReading.value,
          timestamp: logTimestamp
        }
      }
    } else if (slot && !slot.requiresReading) {
      if (!todayReadings.value[slot.id]) recordedNew = true
      const note = editFormSnackNote.value.trim()
      todayReadings.value[slot.id] = { value: 0, timestamp: logTimestamp, ...(note ? { note } : {}) }
    }

    if (slot && editFormTimeMs.value !== null) {
      schedule.value = applyCascade(schedule.value, todayReadings.value)
      saveSchedule()
    }

    persistReadings()
    showEditModal.value = false

    if (recordedNew) {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.7 },
        colors: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6']
      })
      setTimeout(() => scrollToActive(), 1000)
    } else {
      scrollToActive()
    }
  }

  function uncheckSnack() {
    if (activeEditSlotId.value && todayReadings.value[activeEditSlotId.value]) {
      delete todayReadings.value[activeEditSlotId.value]
      persistReadings()
      showEditModal.value = false
      scrollToActive()
    }
  }

  return {
    showEditModal,
    activeEditSlotId,
    activeSlotData,
    editFormTimeMs,
    editFormTimeString,
    editFormReading,
    editFormSnackTaken,
    editFormSnackNote,
    editFormError,
    setEditTimeToNow,
    adjustReading,
    openEditModal,
    saveEditModal,
    uncheckSnack,
  }
}
