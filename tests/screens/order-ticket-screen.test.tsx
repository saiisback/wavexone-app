import renderer, { act } from 'react-test-renderer'

import { Button } from '../../src/design-system'
import { OrderTicketScreen } from '../../src/screens/order-ticket-screen'
import type { Account, Instrument, Profile } from '../../src/data/types'

const mockShowMenu = jest.fn()

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn(), canGoBack: () => true }),
  useRoute: () => ({
    params: { instrumentId: 'xauusd', side: 'Buy', orderType: 'Market', lots: 0.01 },
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
  useBackend: () => ({ orders: { place: jest.fn() } }),
  useInvalidateQueries: () => jest.fn(),
}))

describe('order margin availability', () => {
  it('uses the LP specification when the account has no configured leverage', () => {
    let tree!: renderer.ReactTestRenderer
    act(() => {
      tree = renderer.create(<OrderTicketScreen />)
    })

    const orderButton = tree.root.findByType(Button)
    expect(orderButton.props.disabled).toBe(false)
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
