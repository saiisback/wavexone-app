import renderer, { act } from 'react-test-renderer'
import { ActivityIndicator, StyleSheet } from 'react-native'

import type { FundingConfiguration, WaveXBackend } from '../../src/backend/contract'
import { BackendError } from '../../src/backend/errors'
import { BackendProvider, useInvalidateQueries } from '../../src/backend/provider'
import { useSession } from '../../src/data/store'
import {
  Amount,
  Button,
  CircleButton,
  Field,
  HomeAtmosphere,
  ListRow,
  Logo,
  PageBar,
  PageScreen,
  PageTitle,
  QuickPicks,
  SearchField,
  SegmentedControl,
  Sparkline,
  colors,
} from '../../src/design-system'
import type { ActionMenuRequest } from '../../src/design-system/action-menu'
import type { Account, FundingMode, Instrument, Position, Profile } from '../../src/data/types'
import { MoverCard } from '../../src/features/markets/mover-card'
import { AccountPill } from '../../src/features/accounts/account-pill'
import { PositionRow } from '../../src/features/positions/position-row'
import { PositionCard } from '../../src/features/positions/position-card'
import { HomeScreen } from '../../src/screens/home-screen'
import { FundingScreen } from '../../src/screens/funding-screen'
import { AccountSwitcherScreen } from '../../src/screens/account-switcher-screen'
import { MarketsScreen } from '../../src/screens/markets-screen'
import { PositionsScreen } from '../../src/screens/positions-screen'
import { ManagedAccountsScreen } from '../../src/screens/managed-accounts-screen'
import { TradeScreen } from '../../src/screens/trade-screen'
import { AccountScreen } from '../../src/screens/account-screen'
import { ActivityScreen } from '../../src/screens/activity-screen'
import { BalanceScreen } from '../../src/screens/balance-screen'
import { InstrumentScreen } from '../../src/screens/instrument-screen'
import { TradingViewChart } from '../../src/features/chart/tradingview-chart'
import { NotificationsScreen } from '../../src/screens/notifications-screen'
import { ProfileScreen } from '../../src/screens/profile-screen'
import { SettingsScreen } from '../../src/screens/settings-screen'
import { SignalsScreen } from '../../src/screens/signals-screen'
import { EditPhoneScreen } from '../../src/screens/edit-phone-screen'

const mockOpenAccountSwitcher = jest.fn()
const mockOpenInstrument = jest.fn()
const mockOpenMoreScreen = jest.fn()
const mockOpenOrderTicket = jest.fn()
const mockGoBack = jest.fn()
const mockShowMenu = jest.fn<void, [ActionMenuRequest]>()
let mockFundingMode: FundingMode = 'deposit'
let mockUuid = 0

jest.mock('expo-crypto', () => ({ randomUUID: () => `intent-${++mockUuid}` }))
jest.mock('../../src/design-system/action-menu', () => ({
  ...jest.requireActual('../../src/design-system/action-menu'),
  useActionMenu: () => mockShowMenu,
}))

jest.mock('../../src/backend/session-provider', () => ({
  useAppSession: () => ({ signOut: jest.fn() }),
}))

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => true,
  useNavigation: () => ({ navigate: jest.fn(), goBack: mockGoBack, canGoBack: () => true }),
  useRoute: () => ({ params: { mode: mockFundingMode, instrumentId: 'xauusd' } }),
}))

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}))

jest.mock('../../src/navigation/use-app-navigation', () => ({
  useAppNavigation: () => ({
    openTab: jest.fn(),
    openHomeScreen: jest.fn(),
    openMoreScreen: mockOpenMoreScreen,
    openAccountSwitcher: mockOpenAccountSwitcher,
    openInstrument: mockOpenInstrument,
    openOrderTicket: mockOpenOrderTicket,
    openFunding: jest.fn(),
    openEditPhone: jest.fn(),
    openInstrumentPicker: jest.fn(),
  }),
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

const instrument = (
  id: string,
  symbol: string,
  name: string,
  category: Instrument['category'],
): Instrument => ({
  id,
  symbol,
  name,
  description: name,
  icon: category === 'Crypto' ? 'bitcoin' : category === 'Metals' ? 'gold' : 'generic',
  price: 100,
  precision: 2,
  changePercent: 1,
  bid: 99,
  ask: 101,
  spark: [98, 99, 100],
  category,
  favorite: false,
  contractSize: 1,
  dayOpen: 99,
})

const markets = [
  instrument('xauusd', 'XAU/USD', 'Gold', 'Metals'),
  instrument('audcad', 'AUD/CAD', 'Australian Dollar / Canadian Dollar', 'Forex'),
  instrument('btcusd', 'BTC/USD', 'Bitcoin', 'Crypto'),
  instrument('eurusd', 'EUR/USD', 'Euro / US Dollar', 'Forex'),
]

const mounted: renderer.ReactTestRenderer[] = []

beforeEach(() => {
  useSession.setState({ accountId: null })
  mockOpenAccountSwitcher.mockClear()
  mockOpenInstrument.mockClear()
  mockOpenMoreScreen.mockClear()
  mockOpenOrderTicket.mockClear()
  mockGoBack.mockClear()
  mockShowMenu.mockClear()
  mockFundingMode = 'deposit'
  mockUuid = 0
  globalThis.fetch = jest.fn(() => { throw new Error('Unexpected network request in screen test') })
})

afterEach(() => {
  act(() => {
    while (mounted.length) mounted.pop()!.unmount()
  })
})

function backendWith(
  list: () => Promise<readonly Account[]>,
  readProfile: () => Promise<Profile> = async () => profile,
  positions: readonly Position[] = [],
): WaveXBackend {
  const backend = {
    accounts: {
      list,
      profile: readProfile,
    },
    orders: {
      list: async () => positions,
      history: async () => [],
    },
    markets: {
      catalogue: async () => markets,
      quoteSnapshot: async (ids: readonly string[]) => markets.filter((item) => ids.includes(item.id)),
      favorites: async () => [],
      candles: async () => ({
        points: [98, 99, 100], labels: ['1', '2', '3'], cursorIndex: 2,
        times: [1790812800000, 1790816400000, 1790820000000],
        cursorOpen: 99, cursorClose: 100, min: 98, max: 100, step: 1,
      }),
      sparklines: async () => new Map([
        ['btcusd', [95, 97, 100]],
        ['audcad', [101, 100, 100]],
        ['xauusd', [97, 99, 100]],
      ]),
    },
    prices: {
      subscribe: () => () => {},
      latest: () => undefined,
    },
    funds: {
      history: async () => [],
    },
    engagement: {
      notifications: async () => [],
      markNotificationsRead: async () => undefined,
    },
  } as unknown as WaveXBackend
  backend.orders.historyPage = async (_id, { page }) => ({ positions: page === 1 ? await backend.orders.history(_id) : [], page, hasMore: false })
  return backend
}

function renderLiveScreen(screen: React.ReactElement, backend = backendWith(async () => [account])) {
  let tree!: renderer.ReactTestRenderer
  act(() => {
    tree = renderer.create(<BackendProvider backend={backend}>{screen}</BackendProvider>)
  })
  mounted.push(tree)
  return tree
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

it.each([['Home', HomeScreen], ['Account', AccountScreen]] as const)('keeps loaded %s content visible during account refresh and failure', async (_name, ScreenComponent) => {
  useSession.setState({ accountId: account.id })
  let invalidate!: (...prefixes: string[]) => void
  let reject!: (error: unknown) => void
  let reads = 0
  const backend = backendWith(() => {
    reads += 1
    return reads === 1 ? Promise.resolve([account]) : new Promise<readonly Account[]>((_, fail) => { reject = fail })
  })
  function RefreshHandle() { invalidate = useInvalidateQueries(); return null }
  const tree = renderLiveScreen(<><RefreshHandle /><ScreenComponent /></>, backend)
  await flush()
  await flush()
  const original = renderedText(tree)
  expect(original).toContain('10001')
  act(() => invalidate('accounts:'))
  expect(renderedText(tree)).toContain('Updating…')
  expect(renderedText(tree)).toContain('10001')
  await flush()
  await act(async () => reject(new Error('offline')))
  expect(renderedText(tree)).toContain('Try again')
  expect(renderedText(tree)).toContain('10001')
})

const flush = () => act(async () => void (await Promise.resolve()))
const renderedText = (tree: renderer.ReactTestRenderer) => JSON.stringify(tree.toJSON())

describe('account-facing live screen states', () => {
  it('shows the selected linked demo identity with unavailable summary instead of live equity', async () => {
    const linked: Account = {
      id: 'linked-demo', number: '20003', mode: 'DEMO', balance: 7654.32, summaryAvailable: false,
    }
    useSession.setState({ accountId: linked.id })
    const tree = renderHome(backendWith(async () => [account, linked]))
    await flush()
    await flush()
    const text = renderedText(tree)
    expect(text).toContain('DEMO · 20003')
    expect(text).toContain('7,654.32')
    expect(text).toContain('Account summary unavailable')
    expect(text).not.toContain('1,275.25')
    expect(text).not.toContain('No trading account')
    act(() => tree.root.findByType(Button).props.onPress())
    expect(mockOpenAccountSwitcher).toHaveBeenCalledTimes(1)
  })

  it.each<[number, string]>([[1.98, '+1.98%'], [-2.5, '-2.50%']])('announces portfolio equity and its %s percent change on the balance button', async (changePercent, changeLabel) => {
    useSession.setState({ accountId: account.id })
    const tree = renderHome(backendWith(async () => [{ ...account, changePercent }]))
    await flush()
    await flush()
    const button = tree.root.find((node) =>
      node.props.delayLongPress !== undefined && node.props.accessibilityLabel?.includes('Open balance'),
    )
    expect(button.props.accessibilityRole).toBe('button')
    expect(button.props.accessibilityLabel).toContain('Total equity $1,275.25')
    expect(button.props.accessibilityLabel).toContain(changeLabel)
  })

  it.each([
    ['10001', ['Equity $1,275.25', 'Leverage 1:500', 'Month +1.98%', 'Select LIVE account 10001', 'selected']],
    ['10002', ['Balance 345.67', 'Select to load full account details', 'Select DEMO account 10002']],
  ] as const)('announces the displayed summary and guidance for account %s', async (number, announcedDetails) => {
    useSession.setState({ accountId: account.id })
    const linked: Account = {
      id: 'linked-2', number: '10002', mode: 'DEMO', balance: 345.67, summaryAvailable: false,
    }
    let tree!: renderer.ReactTestRenderer
    act(() => {
      tree = renderer.create(
        <BackendProvider backend={backendWith(async () => [account, linked])}>
          <AccountSwitcherScreen />
        </BackendProvider>,
      )
    })
    mounted.push(tree)
    await flush()
    await flush()
    const accountButton = tree.root.find((node) =>
      node.props.delayLongPress !== undefined && node.props.accessibilityLabel?.includes(number),
    )
    expect(accountButton.props.accessibilityRole).toBe('button')
    for (const detail of announcedDetails) expect(accountButton.props.accessibilityLabel).toContain(detail)
    if (number === '10002') expect(accountButton.props.accessibilityLabel).not.toContain('Equity')
  })

  it('renders a stable loading state', () => {
    const pending = () => new Promise<never>(() => {})
    const tree = renderHome(backendWith(pending, pending))
    const loadingStates = tree.root.findAllByProps({ accessibilityLabel: 'Loading' })
    expect(loadingStates.length).toBeGreaterThan(0)
    const blocks = loadingStates.flatMap((state) => state.findAllByProps({ testID: 'loading-skeleton-block' }))
    expect(blocks.length).toBeGreaterThanOrEqual(4)
    expect(blocks.every((block) => StyleSheet.flatten(block.props.style).backgroundColor === colors.track)).toBe(true)
    expect(tree.root.findAllByType(ActivityIndicator)).toHaveLength(0)
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
    expect(renderedText(tree)).toContain('Watchlist')
    expect(renderedText(tree)).toContain('BTC/USD')
    expect(renderedText(tree)).toContain('AUD/CAD')
    expect(renderedText(tree)).toContain('XAU/USD')
    expect(renderedText(tree)).not.toContain('Trading signals')
    // No favourites yet: the leading markets stand in.
    expect(tree.root.findAllByType(MoverCard).map((card) => card.props.id)).toEqual([
      'xauusd',
      'audcad',
      'btcusd',
      'eurusd',
    ])
    expect(renderedText(tree)).toContain('Star a market on the Markets tab to pin it here.')

    const switchAccount = tree.root.findByProps({ accessibilityLabel: 'Switch account, LIVE 10001' })
    for (let parent = switchAccount.parent; parent; parent = parent.parent) {
      expect(parent.props.accessibilityRole).not.toBe('button')
    }

    act(() => {
      switchAccount.props.onPress()
    })
    expect(mockOpenAccountSwitcher).toHaveBeenCalledTimes(1)
  })
})

describe('home dashboard', () => {
  const position = (id: string, instrumentId: string, side: 'Buy' | 'Sell', pnl: number): Position => ({
    id, instrumentId, side, lots: 0.5, entry: 99, current: 100, pnl, state: 'Open',
  })

  it('labels the portfolio change as open P&L in money and percent', async () => {
    useSession.setState({ accountId: account.id })
    const tree = renderHome(backendWith(async () => [account]))
    await flush()
    await flush()
    const text = renderedText(tree)
    expect(text).toContain('Open P&L')
    expect(text).toContain('+$24.75 (+1.98%)')
  })

  it('uses navy foregrounds and light controls on the warm atmosphere', async () => {
    useSession.setState({ accountId: account.id })
    const tree = renderHome(backendWith(async () => [account]))
    await flush()
    await flush()

    expect(tree.root.find((node) => node.props.children === 'Welcome back').props.color).toBe(colors.referenceMuted)
    expect(tree.root.find((node) => node.props.children === 'Example').props.color).toBe(colors.brand)
    expect(tree.root.findAllByType(Logo).map((logo) => logo.props.tone)).toContain('light')
    expect(tree.root.findAllByType(AccountPill).map((pill) => pill.props.tone)).toContain('light')
    expect(tree.root.findAllByType(CircleButton).find((button) =>
      button.props.accessibilityLabel?.startsWith('Notifications'),
    )?.props.tone).toBe('outline')
    expect(tree.root.findAllByType(Amount).find((amount) =>
      amount.props.accessibilityLabel === '$1,275.25',
    )?.props.color).toBe(colors.brand)
  })

  it('offers a complete trading quick-action grid without dead controls', async () => {
    useSession.setState({ accountId: account.id })
    const tree = renderHome(backendWith(async () => [account]))
    await flush()
    await flush()
    expect(renderedText(tree)).toContain('Quick actions')
    for (const label of ['Deposit', 'Withdraw', 'Trade', 'Markets', 'Positions', 'Activity', 'Balance', 'More']) {
      const action = tree.root.find((node) =>
        node.props.delayLongPress !== undefined && node.props.accessibilityLabel === label,
      )
      expect(action.props.accessibilityRole).toBe('button')
    }
    act(() => {
      tree.root.find((node) =>
        node.props.delayLongPress !== undefined && node.props.accessibilityLabel === 'Activity',
      ).props.onPress()
    })
    expect(mockOpenMoreScreen).toHaveBeenCalledWith('Activity')
    expect(tree.root.findAll((node) => node.props.accessibilityLabel === 'Transfer')).toHaveLength(0)
  })

  it('turns the loaded catalogue into an actionable market pulse', async () => {
    useSession.setState({ accountId: account.id })
    const backend = backendWith(async () => [account])
    backend.markets.catalogue = async () => [
      { ...markets[0], changePercent: 1.8 },
      { ...markets[1], changePercent: -0.4 },
      { ...markets[2], changePercent: 2.6 },
      { ...markets[3], changePercent: 0 },
    ]
    const tree = renderHome(backend)
    await flush()
    await flush()

    const text = renderedText(tree)
    expect(text).toContain('Market pulse')
    expect(text).toContain('2 of 4 markets are moving higher')
    expect(text).toContain('BTC/USD leads at +5.26%')
    expect(tree.root.findByProps({ accessibilityLabel: 'View all markets from market pulse' })).toBeTruthy()
  })

  it('pins favourites to the watchlist ahead of the other markets', async () => {
    const backend = backendWith(async () => [account])
    backend.markets.favorites = async () => ['eurusd', 'btcusd']
    useSession.setState({ accountId: account.id })
    const tree = renderHome(backend)
    await flush()
    await flush()
    await flush()
    expect(tree.root.findAllByType(MoverCard).map((card) => card.props.id)).toEqual(['btcusd', 'eurusd'])
    expect(renderedText(tree)).not.toContain('Star a market')
  })

  it('summarises at most three open positions and counts the rest', async () => {
    useSession.setState({ accountId: account.id })
    const positions = [
      position('p1', 'xauusd', 'Buy', 320),
      position('p2', 'audcad', 'Sell', -137.3),
      position('p3', 'btcusd', 'Buy', 12),
      position('p4', 'eurusd', 'Buy', 4),
      { ...position('p5', 'eurusd', 'Buy', 0), state: 'Pending' as const },
    ]
    const tree = renderHome(backendWith(async () => [account], undefined, positions))
    await flush()
    await flush()
    expect(tree.root.findAllByType(PositionRow).map((row) => row.props.position.id)).toEqual(['p1', 'p2', 'p3'])
    const text = renderedText(tree)
    expect(text).toContain('+$320.00')
    expect(text).toContain('-$137.30')
    expect(text).toContain('1 more open')
  })

  it('draws realised P&L across closed trades on Home, oldest first', async () => {
    useSession.setState({ accountId: account.id })
    const backend = backendWith(async () => [account])
    const closed = (id: string, pnl: number, time: string) =>
      ({ ...position(id, 'xauusd', 'Buy', pnl), state: 'Closed' as const, time })
    backend.orders.history = async () => [
      closed('c2', -40, '2026-09-02 10:00:00'),
      closed('c1', 100, '2026-09-01 10:00:00'),
      closed('c3', 15.5, '2026-09-03 10:00:00'),
    ]
    const tree = renderHome(backend)
    await flush()
    await flush()
    const line = tree.root.findAllByType(Sparkline).find((node) => node.props.color === colors.green)
    expect(line?.props.points).toEqual([0, 100, 60, 75.5])
    const text = renderedText(tree)
    expect(text).toContain('Realised P&L · last 3 trades')
    expect(text).toContain('+$75.50')
  })

  it('leaves the realised line out until there are two closed trades', async () => {
    useSession.setState({ accountId: account.id })
    const backend = backendWith(async () => [account])
    backend.orders.history = async () => [
      { ...position('c1', 'xauusd', 'Buy', 100), state: 'Closed' as const },
    ]
    const tree = renderHome(backend)
    await flush()
    await flush()
    expect(renderedText(tree)).not.toContain('Realised P&L')
  })

  it('marks the bell when notifications are unread', async () => {
    useSession.setState({ accountId: account.id, readNotifications: new Set(['n1']) })
    const backend = backendWith(async () => [account])
    ;(backend as unknown as { engagement: object }).engagement = {
      notifications: async () => [
        { id: 'n1', kind: 'order', title: 'Filled', body: '', time: '10:00' },
        { id: 'n2', kind: 'funds', title: 'Deposit', body: '', time: '11:00' },
      ],
    }
    const tree = renderHome(backend)
    await flush()
    await flush()
    expect(tree.root.findByProps({ accessibilityLabel: 'Notifications, 1 unread' })).toBeTruthy()
  })

  it('shows a zero open P&L without claiming a direction', async () => {
    useSession.setState({ accountId: account.id })
    const tree = renderHome(backendWith(async () => [{ ...account, floatingPnl: 0, changePercent: 0 }]))
    await flush()
    await flush()
    expect(renderedText(tree)).toContain('+$0.00 (+0.00%)')
    expect(tree.root.findAll((node) => node.props.direction === 'flat').length).toBeGreaterThan(0)
  })

  it('invites the trader to explore markets when nothing is open', async () => {
    useSession.setState({ accountId: account.id })
    const tree = renderHome(backendWith(async () => [account]))
    await flush()
    await flush()
    expect(renderedText(tree)).toContain('No open positions')
    expect(renderedText(tree)).toContain('Explore markets')
  })
})

describe('reference-led primary tabs', () => {
  it('shows a pending close and consumes a position confirmation only once', async () => {
    const backend = backendWith(async () => [account], async () => profile, [{ id: 'closing-1', instrumentId: 'xauusd', side: 'Buy', lots: 1, entry: 100, current: 105, pnl: 5, state: 'Open' }])
    let finish!: () => void
    const close = jest.fn(() => new Promise<void>((resolve) => { finish = resolve }))
    backend.orders.close = close
    const tree = renderLiveScreen(<PositionsScreen />, backend)
    await flush(); await flush(); await flush()
    const card = () => tree.root.findAllByType(PositionCard).find((node) => node.props.id === 'closing-1')!
    act(() => card().props.onAction('closing-1'))
    const confirm = mockShowMenu.mock.calls.at(-1)![0].options[0].onSelect!
    await act(async () => { confirm(); confirm(); await Promise.resolve() })
    expect(close).toHaveBeenCalledTimes(1)
    expect(card().props.actionLoading).toBe(true)
    await act(async () => finish())
    act(() => confirm())
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('does not close from a confirmation belonging to a previous account', async () => {
    const backend = backendWith(async () => [account], async () => profile, [{ id: 'stale-1', instrumentId: 'xauusd', side: 'Buy', lots: 1, entry: 100, current: 105, pnl: 5, state: 'Open' }])
    backend.orders.close = jest.fn(async () => undefined)
    const tree = renderLiveScreen(<PositionsScreen />, backend)
    await flush(); await flush(); await flush()
    const card = tree.root.findAllByType(PositionCard).find((node) => node.props.id === 'stale-1')!
    act(() => card.props.onAction('stale-1'))
    const confirm = mockShowMenu.mock.calls.at(-1)![0].options[0].onSelect!
    act(() => useSession.setState({ accountId: 'another-account' }))
    act(() => confirm())
    expect(backend.orders.close).not.toHaveBeenCalled()
  })
  it('shows real managed-account directories and filters followed managers', async () => {
    const backend = backendWith(async () => [account])
    backend.managedAccounts = { directory: async () => ({ managerEnabled: false, managers: [{ id: '1', name: 'Followed Manager', growth: 12.5, following: true }, { id: '2', name: 'Other Manager', following: false }] }), following: async () => ({ managerEnabled: false, managers: [{ id: '3', name: 'Actually Followed', following: true }] }), followers: async () => [], report: async () => { throw new Error('Unexpected report') } }
    const tree = renderLiveScreen(<ManagedAccountsScreen />, backend)
    await flush(); await flush()
    expect(renderedText(tree)).toContain('Followed Manager')
    expect(renderedText(tree)).toContain('Other Manager')
    const filter = tree.root.findAllByType(SegmentedControl).find((control) => control.props.options.includes('Following'))!
    act(() => filter.props.onChange('Following'))
    await flush(); await flush()
    expect(renderedText(tree)).toContain('Actually Followed')
    expect(renderedText(tree)).not.toContain('Other Manager')
  })

  it('loads followers and their report even when the directory capability flag is false', async () => {
    const backend = backendWith(async () => [account])
    const report = jest.fn(async () => ({ kind: 'PAMM' as const, rows: [{ id: '8446', orderId: '8446', managerPnl: -0.00218482, userPnl: -0.00218482, totalPnl: -0.00436964 }], totals: { managerPnl: 0.73271727, userPnl: 0.73271727, totalPnl: 1.46543456 }, share: 50 }))
    backend.managedAccounts = { directory: async () => ({ managerEnabled: false, managers: [] }), following: async () => ({ managerEnabled: false, managers: [] }), followers: async () => [{ id: '26:381', kind: 'PAMM', name: 'Follower One', managerId: '26', userId: '381', share: 50, investment: 5, sharedPnl: 1.27914 }], report }
    const tree = renderLiveScreen(<ManagedAccountsScreen />, backend)
    await flush(); await flush()
    const views = tree.root.findAllByType(SegmentedControl).find((control) => control.props.options.includes('Manager'))!
    act(() => views.props.onChange('Manager'))
    await flush(); await flush()
    expect(renderedText(tree)).toContain('Follower One')
    const reports = tree.root.findAllByType(Button).find((button) => button.props.accessibilityLabel === 'View report for Follower One')!
    act(() => reports.props.onPress())
    await flush(); await flush()
    expect(report).toHaveBeenCalledWith('PAMM', { managerId: '26', userId: '381' })
    expect(renderedText(tree)).toContain('8446')
    expect(renderedText(tree)).toContain('1.46543456')
    act(() => tree.root.findAllByType(Button).find((button) => button.props.accessibilityLabel === 'Back to followers')!.props.onPress())
    const portal = tree.root.findAllByType(Button).find((button) => button.props.accessibilityLabel === 'Open managed-account client portal')!
    act(() => portal.props.onPress())
    expect(mockShowMenu.mock.calls.at(-1)?.[0].options[0].label).toBe('Open client portal')
  })
  it('allows paging through closed trades without waiting for market data', async () => {
    const backend = backendWith(async () => [account])
    backend.markets.catalogue = () => new Promise<never>(() => {})
    backend.orders.historyPage = async (_id, { page }) => ({
      positions: [{ id: `closed-${page}`, instrumentId: page === 1 ? 'xauusd' : 'eurusd', side: 'Buy', lots: 1, entry: 100, current: 105, pnl: 5, state: 'Closed' }], page, hasMore: page === 1,
    })
    const tree = renderLiveScreen(<PositionsScreen />, backend)
    await flush(); await flush(); await flush()
    const tabs = tree.root.findAllByType(SegmentedControl).find((control) => control.props.options.includes('Closed'))!
    act(() => tabs.props.onChange('Closed'))
    await flush(); await flush()
    const next = tree.root.findAllByType(Button).find((button) => button.props.accessibilityLabel === 'Next page of closed trades')
    expect(next).toBeDefined()
    act(() => next!.props.onPress())
    await flush(); await flush()
    expect(renderedText(tree)).toContain('EURUSD')
    expect(renderedText(tree)).toContain('Page 2')
  })
  it('keeps position filters and history visible while the catalogue is unavailable', async () => {
    const backend = backendWith(async () => [account])
    backend.markets.catalogue = () => new Promise<never>(() => {})
    backend.orders.history = async () => [{ id: 'closed-1', instrumentId: 'xauusd', side: 'Buy', lots: 1, entry: 100, current: 105, pnl: 5, state: 'Closed' }]
    const tree = renderLiveScreen(<PositionsScreen />, backend)
    await flush(); await flush(); await flush()
    const tabs = tree.root.findAllByType(SegmentedControl).find((control) => control.props.options.includes('Closed'))
    expect(tabs).toBeDefined()
    act(() => tabs!.props.onChange('Closed'))
    expect(renderedText(tree)).toContain('100.00 → 105.00')
  })

  it('opens managed accounts from the More menu', async () => {
    const tree = renderLiveScreen(<AccountScreen />)
    await flush(); await flush()
    const item = tree.root.findAllByType(ListRow).find((row) => row.props.label === 'Managed accounts')
    expect(item).toBeDefined()
    act(() => item!.props.onPress())
    expect(mockOpenMoreScreen).toHaveBeenCalledWith('ManagedAccounts')
  })
  beforeEach(() => useSession.setState({ accountId: account.id }))

  it('places market discovery inside the warm reference shell while keeping search and filters actionable', async () => {
    const tree = renderLiveScreen(<MarketsScreen />)
    await flush()
    await flush()

    expect(tree.root.findAllByType(HomeAtmosphere)).toHaveLength(1)
    expect(tree.root.findByType(PageTitle).props.tone).toBe('reference')
    expect(tree.root.findByType(PageBar).props.tone).toBe('reference')
    expect(tree.root.findByType(SearchField).props.tone).toBe('light')
    expect(tree.root.findAllByType(CircleButton).find((button) =>
      button.props.accessibilityLabel === 'Show favourites',
    )?.props.tone).toBe('outline')
    const selectedFilter = tree.root.findByProps({ accessibilityLabel: 'All' })
    expect(selectedFilter.props.accessibilityState.selected).toBe(true)
    const animatedFill = selectedFilter.find((node) => node.props.jestAnimatedStyle?.value?.backgroundColor)
    expect(animatedFill.props.jestAnimatedStyle.value.backgroundColor).toBe('rgba(230, 190, 63, 1)')
    expect(renderedText(tree)).toContain('Top movers')
    expect(tree.root.find((node) => node.props.children === 'Biggest moves today').props.color)
      .toBe(colors.textMuted)
    expect(tree.root.find((node) => node.props.children === 'Press and hold a market for quick actions').props.color)
      .toBe(colors.textSubtle)
  })

  it('uses the reference page hierarchy for trade without losing order controls', async () => {
    const tree = renderLiveScreen(<TradeScreen />)
    await flush()
    await flush()

    expect(tree.root.findByType(PageScreen).props.tone).toBe('reference')
    expect(tree.root.findAllByType(AccountPill).map((pill) => pill.props.tone)).toContain('light')
    expect(tree.root.findByType(SegmentedControl).props.value).toBe('Market')
    expect(tree.root.findAll((node) => node.props.accessibilityLabel?.startsWith('Sell at ')).length).toBeGreaterThan(0)
    expect(tree.root.findAll((node) => node.props.accessibilityLabel?.startsWith('Buy at ')).length).toBeGreaterThan(0)
  })

  it('keeps position scope and P&L inside a warm and navy hierarchy', async () => {
    const position: Position = {
      id: 'position-1', instrumentId: 'xauusd', side: 'Buy', lots: 0.1,
      entry: 99, current: 100, pnl: 10, state: 'Open',
    }
    const tree = renderLiveScreen(<PositionsScreen />, backendWith(async () => [account], undefined, [position]))
    await flush()
    await flush()

    expect(tree.root.findAllByType(HomeAtmosphere)).toHaveLength(1)
    expect(tree.root.findByType(PageTitle).props.tone).toBe('reference')
    expect(tree.root.findByType(PageBar).props.tone).toBe('reference')
    expect(tree.root.findByType(AccountPill).props.tone).toBe('light')
    expect(tree.root.findByType(SegmentedControl).props.value).toBe('Open')
    expect(renderedText(tree)).toContain('Floating P&L')
  })
})

describe('reference-led supporting screens', () => {
  beforeEach(() => useSession.setState({ accountId: account.id }))

  it.each([
    ['Account', <AccountScreen />, 'Balance & funding'],
    ['Balance', <BalanceScreen />, 'Deposit'],
    ['Signals', <SignalsScreen />, 'Trading signals are coming soon'],
    ['Profile', <ProfileScreen />, 'CONTACT'],
    ['Settings', <SettingsScreen />, 'Price alerts'],
  ])('moves %s into the shared reference shell without losing its primary content', async (_name, screen, copy) => {
    const tree = renderLiveScreen(screen)
    await flush()
    await flush()

    expect(tree.root.findByType(PageScreen).props.tone).toBe('reference')
    if (_name === 'Account') {
      expect(tree.root.findAllByType(Logo).map((logo) => logo.props.tone)).toContain('dark')
    }
    expect(renderedText(tree)).toContain(copy)
  })

  it('keeps activity filters and account history inside the reference hierarchy', async () => {
    const tree = renderLiveScreen(<ActivityScreen />)
    await flush()
    await flush()

    expect(tree.root.findAllByType(HomeAtmosphere)).toHaveLength(1)
    expect(tree.root.findByType(PageTitle).props.tone).toBe('reference')
    expect(tree.root.findByType(PageBar).props.tone).toBe('reference')
    expect(tree.root.findAllByType(CircleButton).find((button) =>
      button.props.accessibilityLabel === 'Filter activity',
    )?.props.tone).toBe('outline')
    expect(StyleSheet.flatten(tree.root.findByProps({ testID: 'activity-screen' }).props.style).backgroundColor)
      .toBe(colors.surface)
  })

  it('keeps notification actions legible in the reference hierarchy', async () => {
    const tree = renderLiveScreen(<NotificationsScreen />)
    await flush()

    expect(tree.root.findAllByType(HomeAtmosphere)).toHaveLength(1)
    expect(tree.root.findByType(PageTitle).props.tone).toBe('reference')
    expect(tree.root.findByType(PageBar).props.tone).toBe('reference')
    expect(tree.root.find((node) => node.props.children === 'Mark all read').props.color).toBe(colors.referenceMuted)
    expect(renderedText(tree)).toContain('No notifications')
  })

  it('shows a local order notification and unread bell even when the portal feed fails', async () => {
    useSession.setState({ accountId: account.id, localNotifications: [
      { id: 'local:order:1', kind: 'order', title: 'Buy confirmed', body: '0.01 lots XAU/USD', time: 'Just now' },
    ] })
    const backend = backendWith(async () => [account])
    backend.engagement.notifications = async () => { throw new Error('Portal unavailable') }
    const tree = renderLiveScreen(<NotificationsScreen />, backend)
    const home = renderHome(backend)
    await flush()
    await flush()
    expect(renderedText(tree)).toContain('Buy confirmed')
    expect(home.root.findByProps({ accessibilityLabel: 'Notifications, 1 unread' })).toBeTruthy()
  })

  it('marks local order notifications read without sending their IDs to the portal', async () => {
    useSession.setState({ localNotifications: [
      { id: 'local:order:2', kind: 'order', title: 'Buy confirmed', body: '0.01 lots XAU/USD', time: 'Just now' },
    ] })
    const backend = backendWith(async () => [account])
    const read = jest.fn(async () => undefined)
    backend.engagement.markNotificationsRead = read
    const tree = renderLiveScreen(<NotificationsScreen />, backend)
    await flush()
    const row = tree.root.findAll((node) => node.props.accessibilityLabel?.startsWith('Buy confirmed.'))[0]
    act(() => row.props.onPress())
    await flush()
    expect(useSession.getState().readNotifications.has('local:order:2')).toBe(true)
    expect(read).not.toHaveBeenCalled()
    expect(tree.root.findByType(PageTitle).props.subtitle).toBe('All caught up')
  })

  it('reports a failed server read action without marking the notification as read', async () => {
    const backend = backendWith(async () => [account])
    backend.engagement.notifications = async () => [
      { id: 'remote-1', kind: 'order', title: 'Trade update', body: 'Confirmed', time: '10:00' },
    ]
    backend.engagement.markNotificationsRead = async () => { throw new Error('Offline') }
    const tree = renderLiveScreen(<NotificationsScreen />, backend)
    await flush()
    const row = tree.root.findAll((node) => node.props.accessibilityLabel?.startsWith('Trade update.'))[0]
    act(() => row.props.onPress())
    await flush()
    expect(useSession.getState().readNotifications.has('remote-1')).toBe(false)
    expect(mockShowMenu.mock.lastCall?.[0].title).toBe('Could not mark notifications read')
  })

  it('marks a mixed inbox read using only server IDs in the portal request', async () => {
    useSession.setState({ readNotifications: new Set(['older']), localNotifications: [
      { id: 'local:order:3', kind: 'order', title: 'Buy confirmed', body: 'XAU/USD', time: 'Just now' },
    ] })
    const backend = backendWith(async () => [account])
    backend.engagement.notifications = async () => [
      { id: 'remote-2', kind: 'order', title: 'Trade update', body: 'Confirmed', time: '10:00' },
    ]
    const read = jest.fn(async () => undefined)
    backend.engagement.markNotificationsRead = read
    const tree = renderLiveScreen(<NotificationsScreen />, backend)
    await flush()
    act(() => tree.root.findByType(PageTitle).props.trailing.props.onPress())
    await flush()
    expect(read).toHaveBeenCalledWith({ ids: ['remote-2'], idempotencyKey: expect.any(String) })
    expect([...useSession.getState().readNotifications]).toEqual(['older', 'local:order:3', 'remote-2'])
    expect(tree.root.findByType(PageTitle).props.subtitle).toBe('All caught up')
  })

  it('gives instrument detail a warm context header while preserving both trading actions', async () => {
    const tree = renderLiveScreen(<InstrumentScreen />)
    await flush()
    await flush()

    expect(tree.root.findAllByType(HomeAtmosphere)).toHaveLength(1)
    expect(tree.root.findAllByType(CircleButton).find((button) =>
      button.props.accessibilityLabel === 'Go back',
    )?.props.tone).toBe('outline')
    expect(tree.root.findAllByType(CircleButton).find((button) =>
      button.props.accessibilityLabel === 'Add to favourites',
    )?.props.tone).toBe('outline')
    const buy = tree.root.findAllByType(Button).find((node) => node.props.tone === 'gold')
    expect(buy).toBeTruthy()
    act(() => { buy!.props.onPress() })
    expect(mockOpenOrderTicket).toHaveBeenCalledWith('xauusd', 'Buy')
    expect(renderedText(tree)).toContain('Market stats')
  })

  it('keeps the chart runtime mounted while a new window is loading', async () => {
    const backend = backendWith(async () => [account])
    const read = backend.markets.candles
    let release!: (value: Awaited<ReturnType<typeof read>>) => void
    backend.markets.candles = (id, range, interval) => range === '1D'
      ? new Promise((resolve) => { release = resolve })
      : read(id, range, interval)
    const tree = renderLiveScreen(<InstrumentScreen />, backend)
    await flush(); await flush()
    const before = tree.root.findByType(TradingViewChart)
    act(() => tree.root.findAllByType(SegmentedControl).find((control) => control.props.value === '1M')!.props.onChange('1D'))
    await flush()
    expect(Object.is(tree.root.findByType(TradingViewChart), before)).toBe(true)
    expect(renderedText(tree)).toContain('Loading chart')
    await act(async () => release(await read('xauusd', '1D')))
    await flush()
    expect(Object.is(tree.root.findByType(TradingViewChart), before)).toBe(true)
  })

  it('requests candle intervals separately from the date window', async () => {
    const backend = backendWith(async () => [account])
    backend.markets.candles = jest.fn(backend.markets.candles)
    const tree = renderLiveScreen(<InstrumentScreen />, backend)
    await flush(); await flush()
    const intervals = tree.root.findAllByType(SegmentedControl).find((control) => control.props.options.includes('15m'))
    expect(intervals).toBeDefined()
    act(() => intervals!.props.onChange('15m'))
    await flush(); await flush()
    expect(backend.markets.candles).toHaveBeenLastCalledWith('xauusd', '1M', '15m')
    expect(tree.root.findAllByType(SegmentedControl).some((control) => control.props.value === '1M')).toBe(true)
  })

  it('expands and closes the same chart without a second runtime', async () => {
    const tree = renderLiveScreen(<InstrumentScreen />)
    await flush(); await flush()
    const before = tree.root.findByType(TradingViewChart)
    act(() => tree.root.findAll((node) => node.props.accessibilityLabel === 'Expand chart')[0].props.onPress())
    expect(tree.root.findAllByType(TradingViewChart)).toHaveLength(1)
    expect(Object.is(tree.root.findByType(TradingViewChart), before)).toBe(true)
    expect(tree.root.findByType(TradingViewChart).props.expanded).toBe(true)
    act(() => tree.root.findAll((node) => node.props.accessibilityLabel === 'Close fullscreen chart')[0].props.onPress())
    expect(tree.root.findByType(TradingViewChart).props.expanded).toBe(false)
  })

  it('loads one instrument and its chart without waiting for the full market catalogue', async () => {
    const backend = backendWith(async () => [account])
    backend.markets.catalogue = () => new Promise<never>(() => {})
    backend.markets.quoteSnapshot = jest.fn(async () => [markets[0]])
    backend.markets.candles = jest.fn(backend.markets.candles)

    const tree = renderLiveScreen(<InstrumentScreen />, backend)
    await flush()
    await flush()

    expect(backend.markets.quoteSnapshot).toHaveBeenCalledWith(['xauusd'])
    expect(backend.markets.candles).toHaveBeenCalledWith('xauusd', '1M')
    expect(renderedText(tree)).toContain('Market stats')
  })

  it('renders TradingView from broker data without requesting a hosted terminal session', async () => {
    const backend = backendWith(async () => [account])

    const tree = renderLiveScreen(<InstrumentScreen />, backend)
    await flush()
    await flush()

    expect(tree.root.findByProps({ testID: 'tradingview-chart' })).toBeTruthy()
  })

  it('uses gold for the primary completion action in account and phone sheets', async () => {
    const accountTree = renderLiveScreen(<AccountSwitcherScreen />)
    const phoneTree = renderLiveScreen(<EditPhoneScreen />)
    await flush()
    await flush()

    expect(accountTree.root.findByType(Button).props.tone).toBe('gold')
    expect(phoneTree.root.findByType(Button).props.tone).toBe('gold')
  })
})

describe('progressive funding flow', () => {
  const config: FundingConfiguration = {
    depositMethods: ['Bank transfer'], withdrawalMethods: ['Bank transfer'],
    withdrawalFields: [{ id: 'bank', name: 'account', label: 'Bank account' }],
    quickAmounts: [50, 100, 250], kycStatus: 'Verified', availableFund: 500,
    minimumDeposit: 50, minimumWithdrawal: 25,
  }
  const sibling = { ...account, id: 'account-2', number: '10002' }

  it('uses gold for the reviewed funding action', async () => {
    const { tree } = await funding()
    expect(tree.root.findByType(Button).props.tone).toBe('gold')
  })

  async function funding(mode: FundingMode = 'deposit', options: { configuration?: Partial<FundingConfiguration>; accounts?: Account[]; selectedAccountId?: string } = {}) {
    mockFundingMode = mode
    useSession.setState({ accountId: options.selectedAccountId ?? account.id })
    const listAccounts = jest.fn(async () => options.accounts ?? [account, sibling])
    const backend = backendWith(listAccounts)
    const switchAccount = jest.fn<Promise<void>, [{ accountId: string; idempotencyKey: string }]>().mockResolvedValue(undefined)
    backend.accounts.switchAccount = switchAccount
    const funds = {
      configuration: jest.fn(async (_accountId: string) => ({ ...config, ...options.configuration })),
      deposit: jest.fn<Promise<void>, [unknown]>().mockResolvedValue(undefined),
      sendWithdrawalOtp: jest.fn<Promise<void>, [unknown]>().mockResolvedValue(undefined),
      requestWithdrawal: jest.fn<Promise<void>, [unknown]>().mockResolvedValue(undefined),
      history: jest.fn().mockResolvedValue([]),
    }
    backend.funds = funds
    let refresh!: ReturnType<typeof useInvalidateQueries>
    function RefreshControl() {
      refresh = useInvalidateQueries()
      return null
    }
    let tree!: renderer.ReactTestRenderer
    act(() => { tree = renderer.create(<BackendProvider backend={backend}><RefreshControl /><FundingScreen /></BackendProvider>) })
    mounted.push(tree)
    await flush()
    await flush()
    return { tree, funds, refresh, listAccounts, backend, switchAccount }
  }
  const change = (tree: renderer.ReactTestRenderer, label: string, value: string) =>
    act(() => tree.root.findAllByType(Field).find((field) => field.props.label === label)!.props.onChangeText(value))
  const cta = (tree: renderer.ReactTestRenderer) => tree.root.findByType(Button)
  const confirm = (tree: renderer.ReactTestRenderer) => {
    act(() => cta(tree).props.onPress())
    const action = mockShowMenu.mock.calls.at(-1)![0].options[0].onSelect!
    act(() => action())
    return action
  }

  it.each(['', '0', '-50', 'abc50', '1.2.3', '49.99', '1e2', '50.001'])('disables invalid or below-minimum deposit amount %s', async (amount) => {
    const { tree, funds } = await funding()
    change(tree, 'Amount', amount)
    expect(cta(tree).props.disabled).toBe(true)
    act(() => cta(tree).props.onPress())
    expect(mockShowMenu).not.toHaveBeenCalled()
    expect(funds.deposit).not.toHaveBeenCalled()
  })

  it.each(['deposit', 'withdraw'] as const)('shows an unavailable state when %s has no valid methods', async (mode) => {
    const { tree } = await funding(mode, { configuration: { depositMethods: ['', '  '], withdrawalMethods: [] } })
    expect(renderedText(tree)).toContain('No funding methods are available')
    change(tree, 'Amount', '100')
    expect(cta(tree).props.disabled).toBe(true)
  })

  it('withholds linked-only demo funding until reselecting loads that same account summary', async () => {
    const linked: Account = { id: 'linked-demo', number: '20003', mode: 'DEMO', balance: 7654.32, summaryAvailable: false }
    const { tree, backend, funds, switchAccount, listAccounts } = await funding('deposit', { accounts: [account, linked], selectedAccountId: linked.id })
    expect(renderedText(tree)).toContain('DEMO · 20003')
    expect(renderedText(tree)).toContain('Account summary unavailable')
    expect(funds.configuration).not.toHaveBeenCalled()
    expect(tree.root.findAllByType(Field)).toHaveLength(0)
    act(() => tree.update(<BackendProvider backend={backend}><FundingScreen /><AccountSwitcherScreen /></BackendProvider>))
    await flush()
    const choice = tree.root.find((node) => node.props.delayLongPress !== undefined && node.props.accessibilityLabel?.startsWith('Select DEMO account 20003'))
    listAccounts.mockResolvedValue([account, { ...account, id: linked.id, mode: 'DEMO', number: linked.number, current: true }])
    act(() => choice.props.onPress())
    await flush()
    await flush()
    expect(switchAccount).toHaveBeenCalledWith({ accountId: linked.id, idempotencyKey: expect.any(String) })
    expect(useSession.getState().accountId).toBe(linked.id)
    expect(funds.configuration).toHaveBeenCalledWith(linked.id)
    expect(funds.configuration).not.toHaveBeenCalledWith(account.id)
    expect(funds.deposit).not.toHaveBeenCalled()
  })

  it('lets the trader change the account before entering a funding request', async () => {
    const { tree } = await funding()
    const changeAccount = tree.root.findByProps({ accessibilityLabel: 'Change funding account' })
    act(() => changeAccount.props.onPress())
    expect(mockOpenAccountSwitcher).toHaveBeenCalledTimes(1)
  })

  it('keeps a confirmed deposit success visible until the trader dismisses it', async () => {
    const { tree, funds } = await funding()
    change(tree, 'Amount', '100')
    confirm(tree)
    await flush()

    expect(funds.deposit).toHaveBeenCalledTimes(1)
    expect(renderedText(tree)).toContain('Deposit request sent')
    expect(renderedText(tree)).toContain('Track its progress in Activity')
    expect(mockGoBack).not.toHaveBeenCalled()
    act(() => tree.root.findByProps({ accessibilityLabel: 'Done' }).props.onPress())
    expect(mockGoBack).toHaveBeenCalledTimes(1)
  })

  it('locks inputs and suppresses duplicate confirmations during and after submission', async () => {
    const { tree, funds } = await funding()
    let finish!: () => void
    funds.deposit.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve }))
    change(tree, 'Amount', '100')
    const action = confirm(tree)
    act(() => action())
    expect(funds.deposit).toHaveBeenCalledTimes(1)
    expect(cta(tree).props.disabled).toBe(true)
    expect(renderedText(tree)).toContain('Submitting')
    expect(tree.root.findAllByType(Field).every((field) => field.props.editable === false)).toBe(true)
    expect(tree.root.findAllByType(ListRow).every((row) => !row.props.onPress)).toBe(true)
    expect(tree.root.findAllByType(QuickPicks)).toHaveLength(0)
    await act(async () => finish())
    act(() => action())
    expect(funds.deposit).toHaveBeenCalledTimes(1)
    expect(renderedText(tree)).toContain('Deposit request sent')
    expect(mockGoBack).not.toHaveBeenCalled()
    expect(funds.configuration).toHaveBeenCalledTimes(2)
  })

  it('requests an OTP first, freezes the reviewed destination, then submits with a new intent', async () => {
    const { tree, funds, refresh } = await funding('withdraw')
    expect(tree.root.findAllByType(Field).some((field) => field.props.label === 'OTP')).toBe(false)
    change(tree, 'Amount', '100')
    expect(cta(tree).props.disabled).toBe(true)
    change(tree, 'Bank account', '12345678')
    expect(renderedText(tree)).toContain('Send withdrawal code')
    const sendCode = confirm(tree)
    await flush()
    act(() => sendCode())
    expect(funds.sendWithdrawalOtp).toHaveBeenCalledTimes(1)
    expect(funds.requestWithdrawal).not.toHaveBeenCalled()
    funds.configuration.mockResolvedValue({ ...config, withdrawalFields: [{ id: 'replacement', name: 'replacement', label: 'New destination' }] })
    act(() => refresh('funding:'))
    await flush()
    expect(tree.root.findAllByType(Field).some((field) => field.props.label === 'Bank account')).toBe(true)
    expect(renderedText(tree)).toContain('Enter the code sent to you')
    expect(cta(tree).props.disabled).toBe(true)
    expect(tree.root.findAllByType(Field).find((field) => field.props.label === 'Amount')!.props.editable).toBe(false)
    change(tree, 'OTP', '123456')
    confirm(tree)
    await flush()
    expect(funds.requestWithdrawal).toHaveBeenCalledWith({ accountId: 'account-1', amount: '100.00', method: 'Bank transfer', details: { account: '12345678' }, otp: '123456', idempotencyKey: expect.any(String) })
    const first = funds.sendWithdrawalOtp.mock.calls[0][0] as { idempotencyKey: string }
    const second = funds.requestWithdrawal.mock.calls[0][0] as { idempotencyKey: string }
    expect(second.idempotencyKey).not.toBe(first.idempotencyKey)
    expect(renderedText(tree)).toContain('Withdraw request sent')
    expect(mockGoBack).not.toHaveBeenCalled()
  })

  it('does not accept an older confirmation after the OTP step has advanced', async () => {
    const { tree, funds } = await funding('withdraw')
    change(tree, 'Amount', '100')
    change(tree, 'Bank account', '12345678')
    act(() => cta(tree).props.onPress())
    const oldConfirmation = mockShowMenu.mock.calls.at(-1)![0].options[0].onSelect!
    confirm(tree)
    await flush()
    act(() => oldConfirmation())
    await flush()
    expect(funds.sendWithdrawalOtp).toHaveBeenCalledTimes(1)
    expect(funds.requestWithdrawal).not.toHaveBeenCalled()
  })

  it('discards the pending confirmation and OTP when the selected account changes', async () => {
    const { tree, funds } = await funding('withdraw')
    change(tree, 'Amount', '100')
    change(tree, 'Bank account', '12345678')
    confirm(tree)
    await flush()
    change(tree, 'OTP', '123456')
    act(() => cta(tree).props.onPress())
    const oldConfirmation = mockShowMenu.mock.calls.at(-1)![0].options[0].onSelect!
    act(() => useSession.getState().selectAccount('account-2'))
    await flush()
    await flush()
    act(() => oldConfirmation())
    expect(funds.requestWithdrawal).not.toHaveBeenCalled()
    expect(tree.root.findAllByType(Field).some((field) => field.props.label === 'OTP')).toBe(false)
    expect(tree.root.findAllByType(Field).find((field) => field.props.label === 'Amount')!.props.value).toBe('')
  })

  it('does not silently change an OTP-approved method after a configuration refresh', async () => {
    const { tree, funds, refresh } = await funding('withdraw')
    change(tree, 'Amount', '100')
    change(tree, 'Bank account', '12345678')
    confirm(tree)
    await flush()
    funds.configuration.mockResolvedValue({ ...config, withdrawalMethods: ['Different bank'] })
    act(() => refresh('funding:'))
    await flush()
    change(tree, 'OTP', '123456')
    expect(cta(tree).props.disabled).toBe(true)
    expect(renderedText(tree)).toContain('The selected method is no longer available')
    expect(funds.requestWithdrawal).not.toHaveBeenCalled()
  })

  it.each([
    { label: 'approved method is removed', update: { withdrawalMethods: ['Different bank'] } },
    { label: 'available funds drop below the amount', update: { availableFund: 50 } },
    { label: 'withdrawal minimum rises above the amount', update: { minimumWithdrawal: 150 } },
  ])('invalidates an open final withdrawal confirmation when $label', async ({ update }) => {
    const { tree, funds, refresh } = await funding('withdraw')
    change(tree, 'Amount', '100')
    change(tree, 'Bank account', '12345678')
    confirm(tree)
    await flush()
    change(tree, 'OTP', '123456')
    act(() => cta(tree).props.onPress())
    const pending = mockShowMenu.mock.calls.at(-1)![0].options[0].onSelect!
    funds.configuration.mockResolvedValue({ ...config, ...update })
    act(() => refresh('funding:'))
    await flush()
    act(() => pending())
    await flush()
    expect(funds.requestWithdrawal).not.toHaveBeenCalled()
    expect(funds.sendWithdrawalOtp).toHaveBeenCalledTimes(1)
    expect(mockGoBack).not.toHaveBeenCalled()
  })

  it('invalidates an open deposit confirmation when the minimum changes, and accepts a new valid review', async () => {
    const { tree, funds, refresh } = await funding()
    change(tree, 'Amount', '100')
    act(() => cta(tree).props.onPress())
    const pending = mockShowMenu.mock.calls.at(-1)![0].options[0].onSelect!
    funds.configuration.mockResolvedValue({ ...config, minimumDeposit: 150 })
    act(() => refresh('funding:'))
    await flush()
    act(() => pending())
    await flush()
    expect(funds.deposit).not.toHaveBeenCalled()
    change(tree, 'Amount', '200')
    confirm(tree)
    await flush()
    expect(funds.deposit).toHaveBeenCalledTimes(1)
    expect(funds.deposit).toHaveBeenCalledWith(expect.objectContaining({ amount: '200.00' }))
  })

  it('keeps an open confirmation usable when a refresh returns unchanged eligibility', async () => {
    const { tree, funds, refresh } = await funding()
    change(tree, 'Amount', '100')
    act(() => cta(tree).props.onPress())
    const pending = mockShowMenu.mock.calls.at(-1)![0].options[0].onSelect!
    funds.configuration.mockResolvedValue({ ...config, depositMethods: [...config.depositMethods] })
    act(() => refresh('funding:'))
    await flush()
    act(() => pending())
    await flush()
    expect(funds.deposit).toHaveBeenCalledTimes(1)
  })

  it('does not navigate another screen after a pending deposit finishes on a dismissed sheet', async () => {
    const { tree, funds } = await funding()
    let finish!: () => void
    funds.deposit.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve }))
    change(tree, 'Amount', '100')
    confirm(tree)
    act(() => tree.unmount())
    await act(async () => finish())
    expect(mockGoBack).not.toHaveBeenCalled()
  })

  it('enforces the configured withdrawal minimum and accepts its exact boundary', async () => {
    const { tree } = await funding('withdraw')
    change(tree, 'Bank account', '12345678')
    change(tree, 'Amount', '24.99')
    expect(cta(tree).props.disabled).toBe(true)
    change(tree, 'Amount', '25')
    expect(cta(tree).props.disabled).toBe(false)
  })

  it('keeps the OTP step after a declined withdrawal and permits a newly confirmed correction', async () => {
    const { tree, funds } = await funding('withdraw')
    funds.requestWithdrawal.mockRejectedValueOnce(new BackendError('rejected', 'Invalid code'))
    change(tree, 'Amount', '100')
    change(tree, 'Bank account', '12345678')
    confirm(tree)
    await flush()
    change(tree, 'OTP', '111111')
    confirm(tree)
    await flush()
    expect(renderedText(tree)).toContain('Enter the code sent to you')
    change(tree, 'OTP', '222222')
    confirm(tree)
    await flush()
    expect(funds.sendWithdrawalOtp).toHaveBeenCalledTimes(1)
    expect(funds.requestWithdrawal).toHaveBeenCalledTimes(2)
    expect(renderedText(tree)).toContain('Withdraw request sent')
    expect(mockGoBack).not.toHaveBeenCalled()
  })

  it('blocks withdrawals above available funds', async () => {
    const { tree } = await funding('withdraw')
    change(tree, 'Amount', '501')
    change(tree, 'Bank account', '12345678')
    expect(cta(tree).props.disabled).toBe(true)
    expect(renderedText(tree)).toContain('Above the available')
  })

  it.each(['network', 'timeout', 'server', 'malformed', 'blocked'] as const)('uses reviewed, ambiguous %s copy without retrying', async (kind) => {
    const { tree, funds } = await funding()
    funds.deposit.mockRejectedValue(new BackendError(kind, 'internal database message', { serverMessage: 'secret diagnostic' }))
    change(tree, 'Amount', '100')
    const action = confirm(tree)
    await flush()
    const message = mockShowMenu.mock.calls.at(-1)![0].message
    expect(message).toBe('We could not confirm this request. Check your account activity before making another attempt.')
    expect(message).not.toContain('Nothing was changed')
    expect(message).not.toContain('secret diagnostic')
    act(() => action())
    expect(funds.deposit).toHaveBeenCalledTimes(1)
    expect(mockGoBack).not.toHaveBeenCalled()
  })

  it('keeps rejected OTP delivery on the first step and hides server diagnostics', async () => {
    const { tree, funds } = await funding('withdraw')
    funds.sendWithdrawalOtp.mockRejectedValue(new BackendError('rejected', 'raw', { serverMessage: 'database internals' }))
    change(tree, 'Amount', '100')
    change(tree, 'Bank account', '12345678')
    confirm(tree)
    await flush()
    expect(mockShowMenu.mock.calls.at(-1)![0].message).toBe('That request was declined. Review your details before submitting again.')
    expect(tree.root.findAllByType(Field).some((field) => field.props.label === 'OTP')).toBe(false)
    expect(funds.requestWithdrawal).not.toHaveBeenCalled()
  })
})
