import renderer, { act } from 'react-test-renderer'
import { Text } from 'react-native'

import type { WaveXBackend } from '../../src/backend/contract'
import { BackendProvider } from '../../src/backend/provider'
import { useSession } from '../../src/data/store'
import type { Account, Profile } from '../../src/data/types'
import { useAccountData } from '../../src/features/accounts/use-account-data'

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
