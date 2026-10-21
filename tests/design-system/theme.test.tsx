import renderer, { act } from 'react-test-renderer'
import { useState } from 'react'
import { Appearance, View } from 'react-native'
import { ThemeProvider, useTheme, useThemeStyles, type AppearanceStorage } from '../../src/design-system/theme'
import type { Palette } from '../../src/design-system/colors'

jest.unmock('react-native/Libraries/Utilities/useColorScheme')

const createStyles = (colors: Palette) => ({ frame: { backgroundColor: colors.text } })

it('restores a saved appearance before mounting the interface, then updates mounted consumers without losing state', async () => {
  let restore!: (value: string | null) => void
  let saved: string | null = null
  const storage: AppearanceStorage = { read: () => new Promise((resolve) => { restore = resolve }), write: async (value) => { saved = value } }
  let theme!: ReturnType<typeof useTheme>
  let mounts = 0
  function Consumer() {
    theme = useTheme()
    const styles = useThemeStyles(createStyles)
    const [identity] = useState(() => ++mounts)
    return <View testID="probe" accessibilityLabel={String(identity)} style={styles.frame} />
  }
  let tree!: renderer.ReactTestRenderer
  await act(async () => { tree = renderer.create(<ThemeProvider storage={storage}><Consumer /></ThemeProvider>) })
  expect(mounts).toBe(0)
  await act(async () => { restore('dark') })
  expect(theme.preference).toBe('dark')
  expect(theme.scheme).toBe('dark')
  expect(tree.root.findByProps({ testID: 'probe' }).props.style.backgroundColor).toBe('#F2F4FA')
  await act(async () => { await theme.setPreference('light') })
  expect(saved).toBe('light')
  expect(tree.root.findByProps({ testID: 'probe' }).props.style.backgroundColor).toBe('#1C1C1E')
  expect(mounts).toBe(1)
  act(() => tree.unmount())
  await act(async () => { tree = renderer.create(<ThemeProvider storage={storage}><Consumer /></ThemeProvider>) })
  await act(async () => { restore(saved) })
  expect(theme.preference).toBe('light')
  expect(tree.root.findByProps({ testID: 'probe' }).props.style.backgroundColor).toBe('#1C1C1E')
  act(() => tree.unmount())
})

it('follows system changes only while System is selected', async () => {
  let change!: (event: { colorScheme: 'dark' | 'light' }) => void
  let system: 'light' | 'dark' = 'light'
  const get = jest.spyOn(Appearance, 'getColorScheme').mockImplementation(() => system)
  const subscribe = jest.spyOn(Appearance, 'addChangeListener').mockImplementation((listener) => { change = listener; return { remove: () => {} } })
  const storage: AppearanceStorage = { read: async () => null, write: async () => {} }
  let theme!: ReturnType<typeof useTheme>
  function Consumer() { theme = useTheme(); return null }
  let tree!: renderer.ReactTestRenderer
  await act(async () => { tree = renderer.create(<ThemeProvider storage={storage}><Consumer /></ThemeProvider>) })
  expect(theme.preference).toBe('system')
  expect(theme.scheme).toBe('light')
  act(() => { system = 'dark'; change({ colorScheme: 'dark' }) })
  expect(theme.scheme).toBe('dark')
  await act(async () => { await theme.setPreference('light') })
  act(() => { system = 'light'; change({ colorScheme: 'light' }); system = 'dark'; change({ colorScheme: 'dark' }) })
  expect(theme.scheme).toBe('light')
  await act(async () => { await theme.setPreference('dark') })
  act(() => { system = 'light'; change({ colorScheme: 'light' }) })
  expect(theme.scheme).toBe('dark')
  await act(async () => { await theme.setPreference('system') })
  expect(theme.scheme).toBe('light')
  act(() => tree.unmount())
  get.mockRestore(); subscribe.mockRestore()
})

it('mounts the interface in System mode and exposes the failure when restoration is unavailable', async () => {
  const storage: AppearanceStorage = { read: async () => { throw new Error('unavailable') }, write: async () => {} }
  let theme!: ReturnType<typeof useTheme>
  function Consumer() { theme = useTheme(); return null }
  let tree!: renderer.ReactTestRenderer
  await act(async () => { tree = renderer.create(<ThemeProvider storage={storage}><Consumer /></ThemeProvider>) })
  expect(theme.preference).toBe('system')
  expect(theme.ready).toBe(true)
  expect(theme.error).toContain('Could not restore appearance')
  act(() => tree.unmount())
})

it('keeps an immediate local choice visible and reports a failed save', async () => {
  const storage: AppearanceStorage = { read: async () => null, write: async () => { throw new Error('unavailable') } }
  let theme!: ReturnType<typeof useTheme>
  function Consumer() { theme = useTheme(); return null }
  let tree!: renderer.ReactTestRenderer
  await act(async () => { tree = renderer.create(<ThemeProvider storage={storage}><Consumer /></ThemeProvider>) })
  await act(async () => { await theme.setPreference('dark') })
  expect(theme.scheme).toBe('dark')
  expect(theme.error).toContain('could not be saved')
  act(() => tree.unmount())
})
