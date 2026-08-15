export type MealType = 'meal' | 'snack';

export interface ScheduleSlot {
  id: string;
  name: string;
  time: string; // HH:mm
  requiresReading: boolean;
  mealType?: MealType;
}

export const defaultSchedule: ScheduleSlot[] = [
  { id: 'before_breakfast', name: 'Before Breakfast', time: '07:55', requiresReading: true },
  { id: 'breakfast', name: 'Breakfast', time: '08:00', requiresReading: false, mealType: 'meal' },
  { id: 'after_breakfast', name: 'After Breakfast', time: '10:00', requiresReading: true },
  { id: 'morning_snack', name: 'Morning Snack', time: '10:00', requiresReading: false, mealType: 'snack' },
  { id: 'before_lunch', name: 'Before Lunch', time: '12:25', requiresReading: true },
  { id: 'lunch', name: 'Lunch', time: '12:30', requiresReading: false, mealType: 'meal' },
  { id: 'after_lunch', name: 'After Lunch', time: '14:30', requiresReading: true },
  { id: 'afternoon_snack', name: 'Afternoon Snack', time: '14:30', requiresReading: false, mealType: 'snack' },
  { id: 'before_dinner', name: 'Before Dinner', time: '17:55', requiresReading: true },
  { id: 'dinner', name: 'Dinner', time: '18:00', requiresReading: false, mealType: 'meal' },
  { id: 'after_dinner', name: 'After Dinner', time: '20:00', requiresReading: true },
  { id: 'before_bedtime', name: 'Before Bedtime', time: '21:00', requiresReading: true },
]

export interface ScheduleRule {
  start: string;
  end: string;
  gap: number;
  strict: boolean;
  requiresSourceLogged?: boolean;
}

export const SCHEDULE_RULES: ScheduleRule[] = [
  // Unified cascade sequence (strict snapping)
  { start: 'before_breakfast', end: 'breakfast', gap: 5, strict: false },
  { start: 'breakfast', end: 'morning_snack', gap: 120, strict: true },
  { start: 'morning_snack', end: 'before_lunch', gap: 120, strict: true, requiresSourceLogged: true },
  { start: 'before_lunch', end: 'lunch', gap: 5, strict: false },
  { start: 'lunch', end: 'afternoon_snack', gap: 120, strict: true },
  { start: 'afternoon_snack', end: 'before_dinner', gap: 120, strict: true, requiresSourceLogged: true },
  { start: 'before_dinner', end: 'dinner', gap: 5, strict: false },

  // After meal / bedtime rules (minimum gap pushing)
  { start: 'breakfast', end: 'after_breakfast', gap: 120, strict: false },
  { start: 'lunch', end: 'after_lunch', gap: 120, strict: false },
  { start: 'dinner', end: 'after_dinner', gap: 120, strict: false },
  { start: 'dinner', end: 'before_bedtime', gap: 180, strict: false }
];
