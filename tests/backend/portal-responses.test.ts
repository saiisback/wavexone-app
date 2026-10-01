import {
  fundingConfigurationResponse,
  notificationsResponse,
  portalBootstrapResponse,
} from './fixtures/portal-responses'
import {
  parseFundingConfiguration,
  parseNotifications,
  parsePortalBootstrap,
} from '../../src/backend/responses/portal'

describe('portal response parsers', () => {
  it('parses bootstrap accounts, user, summary, and transactions', () => {
    const bootstrap = parsePortalBootstrap(portalBootstrapResponse)

    expect(bootstrap.user).toMatchObject({
      id: '1',
      accountId: 'account-1',
      verified: true,
    })
    expect(bootstrap.accounts[0]).toMatchObject({
      id: 'account-1',
      number: '10001',
      equity: 1275.25,
      leverage: 500,
    })
    expect(bootstrap.transactions[0]).toMatchObject({
      id: 'transaction-1',
      amount: 100,
      type: 'deposit',
    })
  })

  it('parses the paginated transaction object returned by apiBootstrap', () => {
    const paginated = {
      ...portalBootstrapResponse,
      data: {
        ...portalBootstrapResponse.data,
        transactions: {
          items: portalBootstrapResponse.data.transactions,
          page: 1,
          limit: 100,
          total: portalBootstrapResponse.data.transactions.length,
        },
      },
    }

    expect(parsePortalBootstrap(paginated).transactions).toHaveLength(1)
  })

  it.each([Number.NaN, Number.POSITIVE_INFINITY])('rejects non-finite portal equity: %s', (equity) => {
    const invalid = {
      ...portalBootstrapResponse,
      data: {
        ...portalBootstrapResponse.data,
        accounts: [{ ...portalBootstrapResponse.data.accounts[0], equity }],
      },
    }
    expect(() => parsePortalBootstrap(invalid)).toThrow()
  })

  it('parses funding methods, limits, and KYC state', () => {
    const funding = parseFundingConfiguration(fundingConfigurationResponse)

    expect(funding).toMatchObject({
      kycVerified: true,
      availableFund: 900.25,
      minimumDeposit: 100,
    })
    expect(funding.depositMethods[0]).toMatchObject({ id: '1', code: 'bank' })
    expect(funding.withdrawFields[0]).toMatchObject({ id: '3', label: 'Account number' })
  })

  it('parses notifications and preserves the unread count', () => {
    expect(parseNotifications(notificationsResponse)).toEqual({
      items: [
        {
          id: 'notification-1',
          kind: 'order',
          title: 'Order filled',
          body: 'Your example order was filled.',
          time: '2026-09-30T10:00:00Z',
        },
      ],
      unreadCount: 1,
    })
  })
})
