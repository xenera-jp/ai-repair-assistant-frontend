import { createContext, useContext, useMemo, useState } from 'react'

import { STORAGE_KEYS } from './common/constant/storage'

/** 当前界面支持的语言。 */
export type AppLanguage = 'zh-CN' | 'ja-JP'

interface LanguageContextValue {
  language: AppLanguage
  setLanguage: (language: AppLanguage) => void
  text: (chinese: string, japanese: string) => string
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

/**
 * The language is persisted at application level so navigation does not reset it.
 * Diagnosis responses keep their own language on the server; this context only
 * controls the current UI and the language sent when a new analysis is created.
 */
/** 向组件树提供当前语言及双语文案选择器。 */
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>(() => {
    const saved = window.localStorage.getItem(STORAGE_KEYS.language)
    return saved === 'ja-JP' ? 'ja-JP' : 'zh-CN'
  })

  const value = useMemo<LanguageContextValue>(() => {
    const setLanguage = (next: AppLanguage) => {
      window.localStorage.setItem(STORAGE_KEYS.language, next)
      setLanguageState(next)
    }
    return {
      language,
      setLanguage,
      text: (chinese, japanese) =>
        language === 'ja-JP' ? japanese : chinese,
    }
  }, [language])

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  )
}

/** 读取全局语言上下文；必须在 LanguageProvider 内使用。 */
export function useLanguage() {
  const value = useContext(LanguageContext)
  if (!value) {
    throw new Error('useLanguage must be used inside LanguageProvider')
  }
  return value
}
