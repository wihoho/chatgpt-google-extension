import { CssBaseline, GeistProvider, Text, useToasts } from '@geist-ui/core'
import { useCallback, useEffect, useMemo, useState } from 'preact/hooks'
import '../base.css'
import { getUserConfig, Language, Theme, TriggerMode, updateUserConfig } from '../config'
import logo from '../logo.png'
import { detectSystemColorScheme, getExtensionVersion } from '../utils'
import ProviderSelect from './ProviderSelect'

function OptionsPage(props: { theme: Theme; onThemeChange: (theme: Theme) => void }) {
  const [triggerMode, setTriggerMode] = useState<TriggerMode>(TriggerMode.Always)
  const [language, setLanguage] = useState<Language>(Language.Auto)
  const { setToast } = useToasts()

  useEffect(() => {
    getUserConfig().then((config) => {
      setTriggerMode(config.triggerMode)
      setLanguage(config.language)
    })
  }, [])

  const onTriggerModeChange = useCallback(
    (mode: TriggerMode) => {
      setTriggerMode(mode)
      updateUserConfig({ triggerMode: mode })
      setToast({ text: 'Changes saved', type: 'success' })
    },
    [setToast],
  )

  const onThemeChange = useCallback(
    (theme: Theme) => {
      updateUserConfig({ theme })
      props.onThemeChange(theme)
      setToast({ text: 'Changes saved', type: 'success' })
    },
    [props, setToast],
  )

  const onLanguageChange = useCallback(
    (language: Language) => {
      updateUserConfig({ language })
      setToast({ text: 'Changes saved', type: 'success' })
    },
    [setToast],
  )

  return (
    <div className="container mx-auto">
      <nav className="flex flex-row justify-between items-center mt-5 px-2">
        <div className="flex flex-row items-center gap-2">
          <img src={logo} className="w-10 h-10 rounded-lg" />
          <span className="font-semibold">ChatGPT for Google (v{getExtensionVersion()})</span>
        </div>
      </nav>
      <main className="w-[500px] mx-auto mt-14">
        <Text h3 className="mt-5 mb-0">
          AI Provider
        </Text>
        <ProviderSelect />
      </main>
    </div>
  )
}

function App() {
  const [theme, setTheme] = useState(Theme.Auto)

  const themeType = useMemo(() => {
    if (theme === Theme.Auto) {
      return detectSystemColorScheme()
    }
    return theme
  }, [theme])

  useEffect(() => {
    getUserConfig().then((config) => setTheme(config.theme))
  }, [])

  return (
    <GeistProvider themeType={themeType}>
      <CssBaseline />
      <OptionsPage theme={theme} onThemeChange={setTheme} />
    </GeistProvider>
  )
}

export default App
