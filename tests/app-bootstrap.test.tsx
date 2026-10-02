import renderer, { act } from 'react-test-renderer'

import App from '../App'
import { createBackend } from '../src/backend'
import type { WaveXBackend } from '../src/backend/contract'
import { useSession } from '../src/data/store'

jest.mock('../src/design-system/fonts.css', () => ({}))
jest.mock('../src/backend', () => ({ createBackend: jest.fn() }))
jest.mock('../src/navigation/root-navigator', () => ({ RootNavigator: () => null }))
jest.mock('../src/screens/sign-in-screen', () => ({ SignInScreen: () => null }))
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }))
jest.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: ({ children }: { children: React.ReactNode }) => children,
}))
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}))

const flush = () => act(async () => void (await Promise.resolve()))

describe('signed-in data bootstrap', () => {
  it('loads account-scoped markets and favorites after session restoration', async () => {
    useSession.setState({ accountId: null, favorites: new Set<string>() })
    const catalogue = jest.fn(async () => [])
    const favorites = jest.fn(async () => ['xauusd'])
    const backend = {
      session: {
        restore: jest.fn(async () => true),
      },
      accounts: {
        list: jest.fn(async () => [{ id: 'account-1' }]),
        profile: jest.fn(async () => ({ holder: 'Example User' })),
      },
      markets: { catalogue, favorites },
    } as unknown as WaveXBackend
    jest.mocked(createBackend).mockReturnValue(backend)

    let tree!: renderer.ReactTestRenderer
    act(() => {
      tree = renderer.create(<App />)
    })
    await flush()
    await flush()
    await flush()

    expect(catalogue).toHaveBeenCalledTimes(1)
    expect(favorites).toHaveBeenCalledTimes(1)
    expect(useSession.getState().favorites).toEqual(new Set(['xauusd']))

    act(() => tree.unmount())
  })
})
