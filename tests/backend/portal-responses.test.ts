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

  it('accepts zero leverage for an account without configured leverage', () => {
    const withoutLeverage = {
      ...portalBootstrapResponse,
      data: {
        ...portalBootstrapResponse.data,
        accounts: [{ ...portalBootstrapResponse.data.accounts[0], leverage: 0 }],
      },
    }

    expect(parsePortalBootstrap(withoutLeverage).accounts[0].leverage).toBe(0)
  })

  it('reads custom leverage from the live leverage label', () => {
    const customLeverage = {
      ...portalBootstrapResponse,
      data: {
        ...portalBootstrapResponse.data,
        accounts: [
          {
            ...portalBootstrapResponse.data.accounts[0],
            leverage: 'custom',
            leverageLabel: '1:500',
          },
        ],
      },
    }

    expect(parsePortalBootstrap(customLeverage).accounts[0].leverage).toBe(500)
  })

  it('uses the account token for cross-API account identity', () => {
    const withDatabaseId = {
      ...portalBootstrapResponse,
      data: {
        ...portalBootstrapResponse.data,
        accounts: [
          {
            ...portalBootstrapResponse.data.accounts[0],
            id: 7,
            token: 'account-1',
          },
        ],
      },
    }

    const account = parsePortalBootstrap(withDatabaseId).accounts[0]
    expect(account.id).toBe('account-1')
    expect(account.identifiers).toEqual(['account-1', '7', '10001'])
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

  it('parses the observed funding field names from the live API', () => {
    const observed = {
      ...fundingConfigurationResponse,
      data: {
        ...fundingConfigurationResponse.data,
        depositMethods: [
          {
            ...fundingConfigurationResponse.data.depositMethods[0],
            name: undefined,
            displayName: 'Bank transfer',
          },
        ],
        withdrawFields: [{ id: 3, name: 'account' }],
      },
    }

    const funding = parseFundingConfiguration(observed)
    expect(funding.depositMethods[0].name).toBe('Bank transfer')
    expect(funding.withdrawFields[0]).toMatchObject({ label: 'account' })
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

  it.each([
    ['withdraw', 'funds'],
    ['deposit', 'funds'],
    ['wallet', 'funds'],
    ['trade', 'order'],
    ['kyc', 'news'],
    ['referral', 'news'],
  ] as const)('maps live portal notification type %s to %s', (type, kind) => {
    const response = {
      ...notificationsResponse,
      data: {
        ...notificationsResponse.data,
        items: [{ ...notificationsResponse.data.items[0], type }],
      },
    }
    expect(parseNotifications(response).items[0].kind).toBe(kind)
  })
})
