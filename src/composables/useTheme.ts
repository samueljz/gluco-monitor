import { ref, watch } from 'vue'
import { isThemeValue } from '../utils/guards'
import type { ThemeValue } from '../types'

const THEME_KEY = 'gdm_theme'

export function useTheme() {
  const isDarkMode = ref(false)

  const saved = localStorage.getItem(THEME_KEY)
  if (isThemeValue(saved) && saved === 'dark') isDarkMode.value = true

  watch(isDarkMode, (val) => {
    if (val) document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
  }, { immediate: true })

  function toggleTheme() {
    isDarkMode.value = !isDarkMode.value
    const value: ThemeValue = isDarkMode.value ? 'dark' : 'light'
    localStorage.setItem(THEME_KEY, value)
  }

  return { isDarkMode, toggleTheme }
}
