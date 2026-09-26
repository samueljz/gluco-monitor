export interface StoredReading {
  value: number;
  timestamp: number;
  note?: string;
}

export type StoredReadingMap = Record<string, StoredReading>;

export type ThemeValue = 'dark' | 'light';
