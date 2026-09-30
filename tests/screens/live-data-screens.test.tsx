import renderer, { act } from 'react-test-renderer'

import type { WaveXBackend } from '../../src/backend/contract'
import { BackendError } from '../../src/backend/errors'
import { BackendProvider } from '../../src/backend/provider'
import { useSession } from '../../src/data/store'
import type { Account, Profile } from '../../src/data/types'
import { HomeScreen } from '../../src/screens/home-screen'

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
}))

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}))

jest.mock('../../src/navigation/use-app-navigation', () => ({
  useAppNavigation: () => ({ openTab: jest.fn(), openInstrument: jest.fn() }),
}))

const account: Account = {
  id: 'account-1',
  mode: 'LIVE',
  number: '10001',
  currency: 'USD',
  leverage: 500,
  equity: 1275.25,
  balance: 1250.5,
  freeMargin: 1200.5,
  changePercent: 1.98,
  asOf: 'Current account snapshot',
  floatingPnl: 24.75,
}

const profile: Profile = {
  holder: 'Example User',
  avatarUrl: '',
  email: 'person@example.invalid',
  phone: '',
  country: '',
  verified: true,
  kycStatus: 'Verified',
}

const mounted: renderer.ReactTestRenderer[] = []

beforeEach(() => {
  useSession.setState({ accountId: null })
})

afterEach(() => {
  act(() => {
    while (mounted.length) mounted.pop()!.unmount()
  })
})

function backendWith(
  list: () => Promise<readonly Account[]>,
  readProfile: () => Promise<Profile> = async () => profile,
): WaveXBackend {
  return {
    accounts: {
      list,
      profile: readProfile,
    },
  } as WaveXBackend
}

function renderHome(backend: WaveXBackend) {
  let tree!: renderer.ReactTestRenderer
  act(() => {
    tree = renderer.create(
      <BackendProvider backend={backend}>
        <HomeScreen />
      </BackendProvider>,
    )
  })
  mounted.push(tree)
  return tree
}

const flush = () => act(async () => void (await Promise.resolve()))
const renderedText = (tree: renderer.ReactTestRenderer) => JSON.stringify(tree.toJSON())

describe('account-facing live screen states', () => {
  it('renders a stable loading state', () => {
    const pending = () => new Promise<never>(() => {})
    const tree = renderHome(backendWith(pending, pending))
    expect(tree.root.findByProps({ accessibilityLabel: 'Loading' })).toBeTruthy()
  })

  it('renders an empty account state', async () => {
    const tree = renderHome(backendWith(async () => []))
    await flush()
    expect(renderedText(tree)).toContain('No trading account')
  })

  it('renders reviewed error copy rather than backend diagnostics', async () => {
    const tree = renderHome(
      backendWith(async () => {
        throw new BackendError('malformed', 'database column equity missing')
      }),
    )
    await flush()
    expect(renderedText(tree)).toContain('We got an unexpected response. Nothing was changed.')
    expect(renderedText(tree)).not.toContain('database column')
  })

  it('renders joined account and profile data when ready', async () => {
    useSession.setState({ accountId: 'account-1' })
    const tree = renderHome(backendWith(async () => [account]))
    await flush()
    await flush()
    expect(renderedText(tree)).toContain('Example')
    expect(renderedText(tree)).toContain('1,275.25')
    expect(renderedText(tree)).toContain('Trading signals unavailable')
  })
})
