import { Text } from 'react-native'
import renderer, { act } from 'react-test-renderer'

import type { WaveXBackend } from '../../src/backend/contract'
import { BackendError, rejection } from '../../src/backend/errors'
import { BackendProvider, useBackendQuery } from '../../src/backend/provider'
import { useSession } from '../../src/data/store'
import type { DetailedAccount, Profile } from '../../src/data/types'
import { useAccountData } from '../../src/features/accounts/use-account-data'
import {
  SessionProvider,
  useAppSession,
  type AppSessionContextValue,
} from '../../src/backend/session-provider'

const mounted: renderer.ReactTestRenderer[] = []

beforeEach(() => {
  useSession.setState(useSession.getInitialState())
})

afterEach(() => {
  act(() => {
    while (mounted.length) mounted.pop()!.unmount()
  })
})

function sessionBackend(overrides: Partial<WaveXBackend['session']> = {}): WaveXBackend {
  return {
    session: {
      restore: jest.fn(async () => false),
      signIn: jest.fn(async () => ({ kind: 'authenticated' as const })),
      refresh: jest.fn(async () => {}),
      signOut: jest.fn(async () => {}),
      ...overrides,
    },
  } as WaveXBackend
}

function renderSession(backend: WaveXBackend) {
  let current!: AppSessionContextValue

  function Probe() {
    current = useAppSession()
    return <Text>{`${current.state}:${current.error ?? ''}`}</Text>
  }

  let tree!: renderer.ReactTestRenderer
  act(() => {
    tree = renderer.create(
      <BackendProvider backend={backend}>
        <SessionProvider>
          <Probe />
        </SessionProvider>
      </BackendProvider>,
    )
  })
  mounted.push(tree)
  return { tree, session: () => current }
}

const flush = () => act(async () => void (await Promise.resolve()))

describe('SessionProvider', () => {
  it.each(['separate', 'batched'] as const)('does not reuse retained private data across %s logout/login updates', async (updates) => {
    const account = (id: string): DetailedAccount => ({
      id, mode: 'LIVE', number: id, currency: 'USD', leverage: 100,
      equity: 1000, balance: 1000, freeMargin: 1000, changePercent: 0,
      asOf: 'Current account snapshot', floatingPnl: 0, current: true,
    })
    const profile = (holder: string): Profile => ({
      holder, avatarUrl: '', email: `${holder}@example.invalid`, phone: '',
      country: '', verified: true, kycStatus: 'Verified',
    })
    let user = 'Alice'
    const backend = {
      ...sessionBackend({
        restore: async () => true,
        signIn: async (identifier) => {
          user = identifier
          return { kind: 'authenticated' }
        },
      }),
      accounts: {
        list: async () => [account(`${user}-account`)],
        profile: async () => profile(user),
      },
    } as unknown as WaveXBackend
    let session!: AppSessionContextValue

    function SignedInData() {
      const result = useAccountData()
      const extra = useBackendQuery('unscoped-private-query', (api) => api.accounts.profile())
      return <Text>{JSON.stringify({
        account: result.data?.account?.id,
        profile: result.data?.profile.holder,
        extra: extra.data?.holder,
      })}</Text>
    }

    function Gate() {
      session = useAppSession()
      return session.state === 'signed-in' ? <SignedInData /> : null
    }

    let tree!: renderer.ReactTestRenderer
    act(() => {
      tree = renderer.create(<BackendProvider backend={backend}><SessionProvider><Gate /></SessionProvider></BackendProvider>)
    })
    mounted.push(tree)
    await flush()
    expect(JSON.parse(tree.root.findByType(Text).props.children)).toEqual({
      account: 'Alice-account', profile: 'Alice', extra: 'Alice',
    })
    act(() => {
      useSession.getState().replaceFavorites(['Alice-favorite'])
      useSession.getState().markNotificationRead('Alice-notification')
    })

    const signOut = async () => {
      await session.signOut()
      expect(useSession.getState().accountId).toBeNull()
      expect([...useSession.getState().favorites]).toEqual([])
      expect([...useSession.getState().readNotifications]).toEqual([])
    }
    // No timer advance: Bob signs in inside the 30-second cache window.
    if (updates === 'batched') {
      await act(async () => {
        await signOut()
        await session.signIn('Bob', 'password')
      })
    } else {
      await act(signOut)
      await act(async () => session.signIn('Bob', 'password'))
    }
    await flush()

    expect(JSON.parse(tree.root.findByType(Text).props.children)).toEqual({
      account: 'Bob-account', profile: 'Bob', extra: 'Bob',
    })
    expect(useSession.getState().accountId).toBe('Bob-account')
  })

  it('starts restoring and becomes signed in when restoration succeeds', async () => {
    const restore = jest.fn(async () => true)
    const { tree } = renderSession(sessionBackend({ restore }))

    expect(tree.root.findByType(Text).props.children).toBe('restoring:')
    await flush()

    expect(tree.root.findByType(Text).props.children).toBe('signed-in:')
    expect(restore).toHaveBeenCalledTimes(1)
  })

  it('becomes signed out when there is no stored session', async () => {
    const { tree } = renderSession(sessionBackend())
    await flush()
    expect(tree.root.findByType(Text).props.children).toBe('signed-out:')
  })

  it('signs in and never retains the submitted password', async () => {
    const signIn = jest.fn(async () => ({ kind: 'authenticated' as const }))
    const { session } = renderSession(sessionBackend({ signIn }))
    await flush()

    await act(async () => session().signIn('person@example.invalid', 'top-secret'))

    expect(session().state).toBe('signed-in')
    expect(JSON.stringify(session())).not.toContain('top-secret')
  })

  it('enters the verification-required state without retaining the password', async () => {
    const signIn = jest.fn(async () => ({ kind: 'verification-required' as const }))
    const { session } = renderSession(sessionBackend({ signIn }))
    await flush()

    await act(async () => session().signIn('person@example.invalid', 'top-secret'))

    expect(session().state).toBe('verification-required')
    expect(JSON.stringify(session())).not.toContain('top-secret')
  })

  it('shows reviewed error copy and never exposes a server message', async () => {
    const signIn = jest.fn(async () => {
      throw rejection('Check your account number or password.', {
        serverMessage: 'SQL error echoed top-secret',
      })
    })
    const { session } = renderSession(sessionBackend({ signIn }))
    await flush()

    await act(async () => session().signIn('person@example.invalid', 'top-secret'))

    expect(session().state).toBe('signed-out')
    expect(session().error).toBe('Check your account number or password.')
    expect(JSON.stringify(session())).not.toContain('SQL')
    expect(JSON.stringify(session())).not.toContain('top-secret')
  })

  it('enters maintenance when the service is unavailable', async () => {
    const restore = jest.fn(async () => {
      throw new BackendError('server', 'internal')
    })
    const { session } = renderSession(sessionBackend({ restore }))
    await flush()

    expect(session().state).toBe('maintenance')
    expect(session().error).toBe('The service is having trouble. Try again shortly.')
  })

  it('retries restoration on demand', async () => {
    const restore = jest
      .fn<Promise<boolean>, []>()
      .mockRejectedValueOnce(new BackendError('server', 'internal'))
      .mockResolvedValueOnce(true)
    const { session } = renderSession(sessionBackend({ restore }))
    await flush()

    await act(async () => session().retryRestore())

    expect(session().state).toBe('signed-in')
    expect(restore).toHaveBeenCalledTimes(2)
  })

  it('logs out and returns to signed out', async () => {
    const signOut = jest.fn(async () => {})
    const { session } = renderSession(sessionBackend({ restore: async () => true, signOut }))
    await flush()

    await act(async () => session().signOut())

    expect(signOut).toHaveBeenCalledTimes(1)
    expect(session().state).toBe('signed-out')
  })
})
