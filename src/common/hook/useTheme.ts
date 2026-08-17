import { useEffect, useState } from 'react'

import { STORAGE_KEYS } from '../constant/storage'

/** 用户保存的主题偏好；`system` 会随操作系统颜色方案变化。 */
export type ThemePreference = 'system' | 'light' | 'dark'

/** 管理主题偏好、本地持久化与系统主题监听。 */
export function useTheme() {
  const [themePreference, setThemePreference] = useState<ThemePreference>(() => {
    const saved = window.localStorage.getItem(STORAGE_KEYS.theme)
    return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system'
  })
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  )

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const updateTheme = () => setSystemTheme(media.matches ? 'dark' : 'light')
    updateTheme()
    media.addEventListener('change', updateTheme)
    return () => media.removeEventListener('change', updateTheme)
  }, [])

  const setTheme = (next: ThemePreference) => {
    window.localStorage.setItem(STORAGE_KEYS.theme, next)
    setThemePreference(next)
  }

  return { activeTheme: themePreference === 'system' ? systemTheme : themePreference, setTheme, themePreference }
}
