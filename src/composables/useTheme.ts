import { ref, watch } from 'vue'
import { isThemeValue } from '../utils/guards'
import { syncData } from '../services/driveSync'
import type { ThemeValue } from '../types'

const THEME_KEY = 'gdm_theme'

export function useTheme() {
  const isDarkMode = ref(false)

  function loadTheme() {
    const saved = localStorage.getItem(THEME_KEY)
    if (isThemeValue(saved)) {
      isDarkMode.value = saved === 'dark'
    }
  }

  loadTheme()

  watch(isDarkMode, (val) => {
    if (val) document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
  }, { immediate: true })

  function toggleTheme() {
    isDarkMode.value = !isDarkMode.value
    const value: ThemeValue = isDarkMode.value ? 'dark' : 'light'
    localStorage.setItem(THEME_KEY, value)
    syncData()
  }

  return { isDarkMode, loadTheme, toggleTheme }
}
