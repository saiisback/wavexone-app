import {
  accounts,
  activity,
  fundingMethods,
  instruments,
  notifications,
  positions,
  profile,
  quickAmounts,
  xauChart,
} from '../data/mock'
import type { WaveXBackend } from './contract'
import { BackendError } from './errors'

/**
 * The contract, served from `src/data/mock.ts`.
 *
 * This is not a testing convenience — guide §9 requires "typed success and
 * failure fixtures" for every endpoint, and this is where they live. It also
 * keeps the app runnable while the items in guide §7 are outstanding, and it
 * is what proves the interface is actually implementable before any screen
 * depends on it.
 *
 * Mutations resolve without changing anything and are marked below, so no
 * screen can mistake a mock write for a real one.
 */

/** Stand-in latency, so screens are built against a loading state that exists. */
const LATENCY_MS = 220

function settle<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), LATENCY_MS))
}

/**
 * Mutations fail loudly rather than pretending to succeed. A silent no-op
 * would let a "Withdraw" button look like it worked, which is exactly the
 * failure guide §6.8 asks the confirmation UI to prevent.
 */
function unavailable(what: string): never {
  throw new BackendError(
    'blocked',
    `${what} needs the live backend. This build is running on fixtures.`,
  )
}

const favorites = instruments.filter((item) => item.favorite).map((item) => item.id)

export function createMockBackend(): WaveXBackend {
  return {
    session: {
      async signIn() {
        await settle(null)
        return { kind: 'authenticated' }
      },
      restore: () => settle(true),
      refresh: () => settle(undefined),
      signOut: () => settle(undefined),
    },

    accounts: {
      async summary(accountId) {
        const account = accounts.find((item) => item.id === accountId)
        if (!account) throw new BackendError('rejected', 'That account no longer exists.')
        return settle(account)
      },
      list: () => settle(accounts),
      switchAccount: () => settle(undefined),
      profile: () => settle(profile),
      saveProfile: async () => unavailable('Saving the profile'),
      openAccount: async () => unavailable('Opening an account'),
    },

    markets: {
      catalogue: () => settle(instruments),
      favorites: () => settle(favorites),
      setFavorite: () => settle(undefined),
      quoteSnapshot: (ids) =>
        settle(instruments.filter((item) => ids.includes(item.id))),
      async candles(instrumentId, timeframe) {
        // Only XAU/USD has a hand-built series; the rest would need the
        // charting endpoints in guide §4.4.
        if (instrumentId !== 'xauusd') unavailable(`Chart data for ${instrumentId}`)
        return settle(xauChart[timeframe])
      },
    },

    orders: {
      counts: () =>
        settle({
          open: positions.filter((item) => item.state === 'Open').length,
          pending: positions.filter((item) => item.state === 'Pending').length,
          total: positions.length,
        }),
      list: () => settle(positions.filter((item) => item.state !== 'Closed')),
      history: () => settle(positions.filter((item) => item.state === 'Closed')),
      place: async () => unavailable('Placing an order'),
      modify: async () => unavailable('Modifying an order'),
      cancel: async () => unavailable('Cancelling an order'),
      close: async () => unavailable('Closing a position'),
    },

    funds: {
      configuration: () =>
        settle({
          depositMethods: fundingMethods.deposit,
          withdrawalMethods: fundingMethods.withdraw,
          withdrawalFields: [],
          quickAmounts,
          kycStatus: profile.kycStatus,
          availableFund: accounts[0].freeMargin,
          minimumDeposit: 100,
          minimumWithdrawal: 100,
        }),
      sendWithdrawalOtp: async () => unavailable('Sending a withdrawal OTP'),
      deposit: async () => unavailable('Submitting a deposit'),
      requestWithdrawal: async () => unavailable('Requesting a withdrawal'),
      transfer: async () => unavailable('Transferring funds'),
      history: () => settle(activity),
    },

    engagement: {
      notifications: () => settle(notifications),
      markNotificationsRead: () => settle(undefined),
    },
  }
}
