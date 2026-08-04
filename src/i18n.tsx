import { createContext, useContext, useMemo, useState } from 'react'

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
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>(() => {
    const saved = window.localStorage.getItem('repair-assistant-language')
    return saved === 'ja-JP' ? 'ja-JP' : 'zh-CN'
  })

  const value = useMemo<LanguageContextValue>(() => {
    const setLanguage = (next: AppLanguage) => {
      window.localStorage.setItem('repair-assistant-language', next)
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

export function useLanguage() {
  const value = useContext(LanguageContext)
  if (!value) {
    throw new Error('useLanguage must be used inside LanguageProvider')
  }
  return value
}
