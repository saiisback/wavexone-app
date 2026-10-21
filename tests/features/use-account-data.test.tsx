import renderer, { act } from 'react-test-renderer'
import { Text } from 'react-native'

import type { WaveXBackend } from '../../src/backend/contract'
import { BackendProvider, useInvalidateQueries, type QueryState } from '../../src/backend/provider'
import { useSession } from '../../src/data/store'
import type { Account, Profile } from '../../src/data/types'
import { useAccountData } from '../../src/features/accounts/use-account-data'
import type { AccountData } from '../../src/features/accounts/use-account-data'

const profile: Profile = {
  holder: 'Example User',
  avatarUrl: '',
  email: 'person@example.invalid',
  phone: '',
  country: '',
  verified: true,
  kycStatus: 'Verified',
}

const liveAccount: Account = {
  id: 'live-account',
  mode: 'LIVE',
  number: '10001',
  currency: 'USD',
  leverage: 500,
  equity: 1000,
  balance: 1000,
  freeMargin: 1000,
  changePercent: 0,
  asOf: 'Current account snapshot',
  floatingPnl: 0,
}

const demoAccount = {
  ...liveAccount,
  id: 'demo-account',
  mode: 'DEMO',
  number: '20001',
  current: true,
} as Account

const linkedDemoAccount: Account = {
  id: 'linked-demo-account',
  mode: 'DEMO',
  number: '20002',
  balance: 100000,
  summaryAvailable: false,
}

function Probe() {
  const result = useAccountData()
  return <Text>{result.status === 'ready' ? JSON.stringify({
    account: result.data.account,
    selectedAccount: result.data.selectedAccount,
  }) : result.status}</Text>
}

const flush = () => act(async () => void (await Promise.resolve()))

it('preserves account data and propagates refresh progress and retry after a failed profile update', async () => {
  useSession.setState({ accountId: liveAccount.id })
  let latest!: QueryState<AccountData>
  let invalidate!: (...prefixes: string[]) => void
  let fail!: (error: unknown) => void
  let calls = 0
  const backend = {
    accounts: {
      list: async () => [liveAccount],
      profile: () => {
        calls += 1
        if (calls === 2) return new Promise<Profile>((_, reject) => { fail = reject })
        return Promise.resolve(profile)
      },
    },
    orders: { list: async () => [] },
  } as unknown as WaveXBackend
  function RefreshProbe() { latest = useAccountData(); invalidate = useInvalidateQueries(); return null }
  let tree!: renderer.ReactTestRenderer
  act(() => { tree = renderer.create(<BackendProvider backend={backend}><RefreshProbe /></BackendProvider>) })
  await flush()
  act(() => invalidate('profile:'))
  expect(latest).toMatchObject({ status: 'ready', refreshing: true, data: { account: { id: 'live-account' } } })
  await flush()
  await act(async () => fail(new Error('private server details')))
  expect(latest).toMatchObject({ status: 'ready', refreshing: false, refreshError: 'Something went wrong. Try again.' })
  act(() => { if (latest.status === 'ready') latest.retry?.() })
  await flush()
  expect(latest).toMatchObject({ status: 'ready', data: { account: { id: 'live-account' } } })
  expect(latest.status === 'ready' && latest.refreshError).toBeUndefined()
  expect(calls).toBe(3)
  act(() => tree.unmount())
})

it.each([demoAccount, { ...linkedDemoAccount, current: true }])('selects server-current $id instead of the first account', async (current) => {
  useSession.setState({ accountId: null })
  const backend = {
    accounts: {
      list: async () => [liveAccount, current],
      profile: async () => profile,
    },
  } as unknown as WaveXBackend

  let tree!: renderer.ReactTestRenderer
  act(() => {
    tree = renderer.create(
      <BackendProvider backend={backend}>
        <Probe />
      </BackendProvider>,
    )
  })

  await flush()
  await flush()

  expect(useSession.getState().accountId).toBe(current.id)
  expect(JSON.stringify(tree.toJSON())).toContain(current.id)

  act(() => tree.unmount())
})

it('does not snap an explicitly selected linked-only account back to the live account', async () => {
  useSession.setState({ accountId: linkedDemoAccount.id })
  const backend = {
    accounts: {
      list: async () => [liveAccount, linkedDemoAccount],
      profile: async () => profile,
    },
  } as unknown as WaveXBackend

  let tree!: renderer.ReactTestRenderer
  act(() => {
    tree = renderer.create(
      <BackendProvider backend={backend}>
        <Probe />
      </BackendProvider>,
    )
  })

  await flush()
  await flush()

  expect(useSession.getState().accountId).toBe(linkedDemoAccount.id)
  expect(JSON.stringify(tree.toJSON())).not.toContain(liveAccount.id)
  expect(tree.root.findByType(Text).props.children).toBe(JSON.stringify({
    account: null,
    selectedAccount: linkedDemoAccount,
  }))

  act(() => tree.unmount())
})

it('reconciles selected equity with the current open position P&L', async () => {
  useSession.setState({ accountId: liveAccount.id })
  const backend = {
    accounts: {
      list: async () => [liveAccount],
      profile: async () => profile,
    },
    orders: {
      list: async () => [
        { id: 'open-1', instrumentId: 'c:xauusd', side: 'Buy', lots: 1, entry: 100, current: 125, pnl: 25, state: 'Open' },
        { id: 'pending-1', instrumentId: 'c:xauusd', side: 'Buy', lots: 1, entry: 100, current: 100, pnl: 40, state: 'Pending' },
      ],
    },
    prices: { subscribe: () => () => {}, latest: () => undefined },
  } as unknown as WaveXBackend

  let tree!: renderer.ReactTestRenderer
  act(() => {
    tree = renderer.create(
      <BackendProvider backend={backend}>
        <Probe />
      </BackendProvider>,
    )
  })
  await flush()
  await flush()

  const output = JSON.parse(tree.root.findByType(Text).props.children)
  expect(output.account).toMatchObject({
    balance: 1000,
    equity: 1025,
    floatingPnl: 25,
    freeMargin: 1025,
    changePercent: 2.5,
  })

  act(() => tree.unmount())
})

it('drops stale portal equity when a flat account has no positions or margin in use', async () => {
  useSession.setState({ accountId: liveAccount.id })
  const stale = { ...liveAccount, equity: 1322.68, freeMargin: liveAccount.balance, floatingPnl: 322.68 }
  const backend = {
    accounts: { list: async () => [stale], profile: async () => profile },
    orders: { list: async () => [] },
  } as unknown as WaveXBackend

  let tree!: renderer.ReactTestRenderer
  act(() => {
    tree = renderer.create(<BackendProvider backend={backend}><Probe /></BackendProvider>)
  })
  await flush()
  await flush()

  const output = JSON.parse(tree.root.findByType(Text).props.children)
  expect(output.account).toMatchObject({
    balance: 1000,
    equity: 1000,
    floatingPnl: 0,
    freeMargin: 1000,
    changePercent: 0,
  })

  act(() => tree.unmount())
})

it('moves account equity and open P&L with the live quote stream', async () => {
  useSession.setState({ accountId: liveAccount.id })
  let currentQuote: { bid: number; ask: number; price: number } | undefined
  let notify = () => {}
  const backend = {
    accounts: { list: async () => [liveAccount], profile: async () => profile },
    orders: {
      list: async () => [{
        id: 'open-1',
        instrumentId: 'c:xauusd',
        side: 'Buy',
        lots: 1,
        entry: 100,
        current: 100,
        pnl: 0,
        contractSize: 100,
        swap: -2,
        commission: -1,
        state: 'Open',
      }],
    },
    prices: {
      subscribe: (_id: string, listener: () => void) => {
        notify = listener
        return () => {}
      },
      latest: () => currentQuote,
    },
  } as unknown as WaveXBackend

  let tree!: renderer.ReactTestRenderer
  act(() => {
    tree = renderer.create(<BackendProvider backend={backend}><Probe /></BackendProvider>)
  })
  await flush()
  await flush()

  currentQuote = { bid: 102, ask: 103, price: 102.5 }
  act(() => notify())

  const output = JSON.parse(tree.root.findByType(Text).props.children)
  expect(output.account).toMatchObject({ equity: 1197, floatingPnl: 197 })

  act(() => tree.unmount())
})
