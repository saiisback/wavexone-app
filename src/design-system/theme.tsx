import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Platform, useColorScheme } from 'react-native'
import * as SecureStore from 'expo-secure-store'
import { colors, darkColors, type Palette } from './colors'

export type AppearancePreference = 'light' | 'dark' | 'system'
export type AppearanceStorage = { read(): Promise<string | null>; write(value: AppearancePreference): Promise<void> }
const KEY = 'wavexone.appearance.v1'
const storage: AppearanceStorage = {
  async read() {
    if (Platform.OS === 'web') return typeof localStorage === 'undefined' ? null : localStorage.getItem(KEY)
    return SecureStore.getItemAsync(KEY)
  },
  async write(value) {
    if (Platform.OS === 'web') {
      if (typeof localStorage === 'undefined') throw new Error('Storage is unavailable')
      localStorage.setItem(KEY, value)
    } else await SecureStore.setItemAsync(KEY, value)
  },
}
type Theme = {
  preference: AppearancePreference; scheme: 'light' | 'dark'; ready: boolean; error: string | null
  setPreference(value: AppearancePreference): Promise<void>
}
const ThemeContext = createContext<Theme>({ preference: 'system', scheme: 'light', ready: true, error: null, setPreference: async () => {} })

/** Public device preference is isolated from credentials and survives sign-out. */
export function ThemeProvider({ children, storage: persistence = storage }: { children: ReactNode; storage?: AppearanceStorage }) {
  const system = useColorScheme()
  const [preference, setPreferenceState] = useState<AppearancePreference>('system')
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const writes = useRef(Promise.resolve())
  const revision = useRef(0)
  useEffect(() => {
    let active = true
    persistence.read().then((value) => {
      if (active && (value === 'light' || value === 'dark' || value === 'system')) setPreferenceState(value)
    }).catch(() => { if (active) setError('Could not restore appearance. Choose your appearance again in Settings.') })
      .finally(() => { if (active) setReady(true) })
    return () => { active = false }
  }, [persistence])
  const scheme = preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference
  const value = useMemo<Theme>(() => ({
    preference, scheme, ready, error,
    async setPreference(next) {
      const current = ++revision.current
      setPreferenceState(next)
      setError(null)
      // Serialise local writes so a slower earlier selection cannot win on restart.
      const write = writes.current.then(() => persistence.write(next))
      writes.current = write.catch(() => {})
      try { await write } catch {
        if (revision.current === current) setError('Appearance changed for now, but could not be saved. Select it again to retry.')
      }
    },
  }), [preference, scheme, ready, error, persistence])
  return <ThemeContext.Provider value={value}>{ready ? children : null}</ThemeContext.Provider>
}

export function useTheme() { return useContext(ThemeContext) }
export function useColors(): Palette { return useTheme().scheme === 'dark' ? darkColors : colors }
const cache = new WeakMap<Function, WeakMap<Palette, unknown>>()
/** Styles are built once per palette, and subscribed consumers update in place. */
export function useThemeStyles<T>(factory: (palette: Palette) => T): T {
  const palette = useColors()
  let palettes = cache.get(factory)
  if (!palettes) { palettes = new WeakMap(); cache.set(factory, palettes) }
  if (!palettes.has(palette)) palettes.set(palette, factory(palette))
  return palettes.get(palette) as T
}
