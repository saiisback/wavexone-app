import renderer, { act } from 'react-test-renderer'

import { Button, Field } from '../../src/design-system'
import { OrderTicketScreen } from '../../src/screens/order-ticket-screen'
import { ModifyOrderScreen } from '../../src/screens/modify-order-screen'
import type { Account, Instrument, Profile } from '../../src/data/types'
import { useSession } from '../../src/data/store'

const mockShowMenu = jest.fn()
const mockPlace = jest.fn()
const mockModify = jest.fn()
const mockGoBack = jest.fn()
const mockInvalidate = jest.fn()
let mockOrderType = 'Market'

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: mockGoBack, canGoBack: () => true }),
  useRoute: () => ({
    params: { instrumentId: 'xauusd', positionId: 'order-1', side: 'Buy', orderType: mockOrderType, lots: 0.01 },
  }),
}))

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}))

jest.mock('../../src/design-system/action-menu', () => ({
  ...jest.requireActual('../../src/design-system/action-menu'),
  useActionMenu: () => mockShowMenu,
}))

const mockAccount: Account = {
  id: 'account-1',
  mode: 'LIVE',
  number: '10001',
  currency: 'USD',
  leverage: 0,
  equity: 1_000,
  balance: 1_000,
  freeMargin: 1_000,
  changePercent: 0,
  asOf: 'Current account snapshot',
  floatingPnl: 0,
}

const mockProfile: Profile = {
  holder: 'Example User',
  avatarUrl: '',
  email: 'person@example.invalid',
  phone: '',
  country: '',
  verified: true,
  kycStatus: 'Verified',
}

const mockInstrument: Instrument = {
  id: 'xauusd',
  symbol: 'XAU/USD',
  name: 'Gold',
  description: 'Gold',
  icon: 'gold',
  price: 2_400,
  precision: 2,
  changePercent: 0,
  bid: 2_399.5,
  ask: 2_400.5,
  spark: [2_399, 2_400],
  category: 'Metals',
  favorite: false,
  contractSize: 100,
  dayOpen: 2_399,
}

jest.mock('../../src/features/accounts/use-account-data', () => ({
  useAccountData: () => ({
    status: 'ready',
    data: {
      accounts: [mockAccount],
      selectedAccount: mockAccount,
      account: mockAccount,
      profile: mockProfile,
    },
  }),
}))

jest.mock('../../src/features/markets/use-market-data', () => ({
  useMarketData: () => ({ catalogue: { status: 'ready', data: [mockInstrument] } }),
}))

jest.mock('../../src/features/markets/use-live-quote', () => ({
  useLiveQuote: () => undefined,
}))

jest.mock('../../src/backend/provider', () => ({
  useBackend: () => ({ orders: { place: mockPlace, modify: mockModify } }),
  useBackendQuery: () => ({ status: 'ready', data: [{ id: 'order-1', instrumentId: 'xauusd', state: 'Open', side: 'Buy', lots: 0.01, entry: 2400, current: 2400, pnl: 0 }] }),
  useInvalidateQueries: () => mockInvalidate,
}))

it('shows modify progress and consumes a confirmation only once even after a rejection', async () => {
  jest.clearAllMocks()
  let reject!: (error: unknown) => void
  mockModify.mockReturnValue(new Promise<void>((_, fail) => { reject = fail }))
  let tree!: renderer.ReactTestRenderer
  act(() => { tree = renderer.create(<ModifyOrderScreen />) })
  act(() => tree.root.findAllByType(Field).find((field) => field.props.label === 'Stop loss')!.props.onChangeText('2300'))
  act(() => tree.root.findByType(Button).props.onPress())
  const confirm = mockShowMenu.mock.lastCall[0].options[0].onSelect
  act(() => { confirm(); confirm() })
  expect(mockModify).toHaveBeenCalledTimes(1)
  expect(tree.root.findByType(Button).props.loading).toBe(true)
  await act(async () => { reject(new Error('offline')); await Promise.resolve() })
  act(() => confirm())
  expect(mockModify).toHaveBeenCalledTimes(1)
  expect(tree.root.findByType(Button).props.loading).toBe(false)
  act(() => tree.unmount())
})

describe('order acknowledgement', () => {
  afterEach(() => { mockOrderType = 'Market' })
  beforeEach(() => {
    jest.clearAllMocks()
    useSession.setState(useSession.getInitialState(), true)
    mockOrderType = 'Market'
    mockPlace.mockResolvedValue(undefined)
  })

  it('announces a confirmed buy and records an unread notification only after acknowledgement', async () => {
    let resolve!: () => void
    mockPlace.mockReturnValue(new Promise<void>((done) => { resolve = done }))
    let tree!: renderer.ReactTestRenderer
    act(() => { tree = renderer.create(<OrderTicketScreen />) })
    act(() => tree.root.findByType(Button).props.onPress())
    act(() => mockShowMenu.mock.calls[0][0].options[0].onSelect())
    expect(useSession.getState().localNotifications).toEqual([])
    expect(mockGoBack).not.toHaveBeenCalled()
    await act(async () => { resolve(); await Promise.resolve() })
    expect(mockShowMenu.mock.lastCall[0].title).toBe('Buy confirmed')
    act(() => mockShowMenu.mock.lastCall[0].options[0].onSelect())
    expect(mockGoBack).toHaveBeenCalledTimes(1)
    const [notice] = useSession.getState().localNotifications
    expect(notice).toMatchObject({ kind: 'order', title: 'Buy confirmed' })
    expect(notice.body).toContain('XAU/USD')
    expect(notice.body).toContain('0.01 lots')
    expect(useSession.getState().readNotifications.has(notice.id)).toBe(false)
    expect(mockInvalidate).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.anything(), expect.anything(), 'notifications')
    act(() => tree.unmount())
  })

  it('does not announce or record a successful buy when the server rejects it', async () => {
    mockPlace.mockRejectedValue(new Error('Rejected'))
    let tree!: renderer.ReactTestRenderer
    act(() => { tree = renderer.create(<OrderTicketScreen />) })
    act(() => tree.root.findByType(Button).props.onPress())
    await act(async () => { mockShowMenu.mock.calls[0][0].options[0].onSelect(); await Promise.resolve() })
    expect(mockShowMenu.mock.lastCall[0].title).toBe('Order not confirmed')
    expect(useSession.getState().localNotifications).toEqual([])
    expect(mockGoBack).not.toHaveBeenCalled()
    act(() => tree.unmount())
  })

  it('submits a confirmation only once while the order is pending', async () => {
    mockPlace.mockReturnValue(new Promise(() => {}))
    let tree!: renderer.ReactTestRenderer
    act(() => { tree = renderer.create(<OrderTicketScreen />) })
    act(() => tree.root.findByType(Button).props.onPress())
    const confirm = mockShowMenu.mock.calls[0][0].options[0].onSelect
    act(() => { confirm(); confirm() })
    expect(mockPlace).toHaveBeenCalledTimes(1)
    expect(tree.root.findByType(Button).props.disabled).toBe(true)
    act(() => tree.unmount())
  })

  it('does not let a retained confirmation create a new order intent after rejection', async () => {
    mockPlace.mockRejectedValue(new Error('offline'))
    let tree!: renderer.ReactTestRenderer
    act(() => { tree = renderer.create(<OrderTicketScreen />) })
    act(() => tree.root.findByType(Button).props.onPress())
    const confirm = mockShowMenu.mock.calls[0][0].options[0].onSelect
    await act(async () => { confirm(); await Promise.resolve() })
    await act(async () => { confirm(); await Promise.resolve() })
    expect(mockPlace).toHaveBeenCalledTimes(1)
    act(() => tree.unmount())
  })

  it('describes an accepted limit order as placed, not bought', async () => {
    mockOrderType = 'Limit'
    let tree!: renderer.ReactTestRenderer
    act(() => { tree = renderer.create(<OrderTicketScreen />) })
    act(() => tree.root.findAllByType(Field).find((field) => field.props.label === 'Limit price')!.props.onChangeText('2300'))
    act(() => tree.root.findByType(Button).props.onPress())
    await act(async () => { mockShowMenu.mock.calls[0][0].options[0].onSelect(); await Promise.resolve() })
    expect(mockShowMenu.mock.lastCall[0].title).toBe('Limit order placed')
    expect(useSession.getState().localNotifications[0].body).toContain('pending')
    act(() => tree.unmount())
    mockOrderType = 'Market'
  })
})

describe('order margin availability', () => {
  it('uses the LP specification when the account has no configured leverage', () => {
    let tree!: renderer.ReactTestRenderer
    act(() => {
      tree = renderer.create(<OrderTicketScreen />)
    })

    const orderButton = tree.root.findByType(Button)
    expect(orderButton.props.disabled).toBe(false)
    expect(orderButton.props.tone).toBe('gold')
    expect(JSON.stringify(tree.toJSON())).toContain('$48.01')
    expect(JSON.stringify(tree.toJSON())).not.toContain('Margin estimate unavailable')
    expect(JSON.stringify(tree.toJSON())).not.toContain('∞')

    act(() => tree.unmount())
  })

  it('uses the instrument margin requirement instead of account-wide leverage', () => {
    mockAccount.leverage = 100
    let tree!: renderer.ReactTestRenderer
    act(() => {
      tree = renderer.create(<OrderTicketScreen />)
    })

    // Gold is 2% in the supplied LP specification: 2400.5 × 100 × 0.01 × 2%.
    expect(JSON.stringify(tree.toJSON())).toContain('$48.01')

    act(() => tree.unmount())
    mockAccount.leverage = 0
  })

  it('raises an equity order to the one-share minimum from the LP specification', () => {
    mockInstrument.symbol = 'AAPL.OQ'
    mockInstrument.category = 'Stocks'
    mockInstrument.contractSize = 1
    mockInstrument.price = 200
    mockInstrument.bid = 199.9
    mockInstrument.ask = 200.1

    let tree!: renderer.ReactTestRenderer
    act(() => {
      tree = renderer.create(<OrderTicketScreen />)
    })

    expect(JSON.stringify(tree.toJSON())).toContain('1.00')

    act(() => tree.unmount())
    Object.assign(mockInstrument, {
      symbol: 'XAU/USD',
      category: 'Metals',
      contractSize: 100,
      price: 2_400,
      bid: 2_399.5,
      ask: 2_400.5,
    })
  })

  it('uses the stricter 1:5 leverage requirement for BTC', () => {
    mockInstrument.symbol = 'BTC/USD'
    mockInstrument.category = 'Crypto'
    mockInstrument.contractSize = 1
    mockInstrument.price = 68_000
    mockInstrument.bid = 67_990
    mockInstrument.ask = 68_000

    let tree!: renderer.ReactTestRenderer
    act(() => {
      tree = renderer.create(<OrderTicketScreen />)
    })

    const rendered = JSON.stringify(tree.toJSON())
    expect(rendered).toContain('1:5')
    expect(rendered).toContain('$136.00')

    act(() => tree.unmount())
    Object.assign(mockInstrument, {
      symbol: 'XAU/USD',
      category: 'Metals',
      contractSize: 100,
      price: 2_400,
      bid: 2_399.5,
      ask: 2_400.5,
    })
  })
})
