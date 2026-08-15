export interface ScheduleSlot {
  id: string;
  name: string;
  time: string; // HH:mm
  requiresReading: boolean;
  isMeal?: boolean;
}

export const defaultSchedule: ScheduleSlot[] = [
  { id: 'before_breakfast', name: 'Before Breakfast', time: '08:00', requiresReading: true, isMeal: true },
  { id: 'after_breakfast', name: 'After Breakfast', time: '10:00', requiresReading: true },
  { id: 'morning_snack', name: 'Morning Snack', time: '10:30', requiresReading: false, isMeal: true },
  { id: 'before_lunch', name: 'Before Lunch', time: '12:30', requiresReading: true, isMeal: true },
  { id: 'after_lunch', name: 'After Lunch', time: '14:30', requiresReading: true },
  { id: 'afternoon_snack', name: 'Afternoon Snack', time: '15:30', requiresReading: false, isMeal: true },
  { id: 'before_dinner', name: 'Before Dinner', time: '18:00', requiresReading: true, isMeal: true },
  { id: 'after_dinner', name: 'After Dinner', time: '20:00', requiresReading: true },
  { id: 'before_bedtime', name: 'Before Bedtime', time: '21:00', requiresReading: true },
]

export const DEPENDENT_PAIRS = [
  ['before_breakfast', 'after_breakfast', 120],
  ['before_lunch', 'after_lunch', 120],
  ['before_dinner', 'after_dinner', 120],
  ['before_dinner', 'before_bedtime', 180]
] as const;
