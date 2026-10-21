import { createLiveBackend } from '../../src/backend/live-backend'
import { createMockBackend } from '../../src/backend/mock-backend'
import { ENDPOINTS } from '../../src/backend/endpoints'
import { portalBootstrapResponse } from './fixtures/portal-responses'

const mockStored = new Map<string, string>()
jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'whenUnlocked',
  getItemAsync: jest.fn(async (key: string) => mockStored.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => void mockStored.set(key, value)),
  deleteItemAsync: jest.fn(async (key: string) => void mockStored.delete(key)),
}))
jest.mock('expo-crypto', () => ({ randomUUID: () => 'fp-managed-test' }))

async function backendFor(response: unknown) {
  mockStored.clear()
  const fetcher = jest.fn()
    .mockResolvedValueOnce({ status: 200, text: async () => JSON.stringify({ status: 'success', token: 'acct-managed', secret_key: 'secret', verify: '1', userID: '7', footprint: 'fp-managed-test' }) })
    .mockResolvedValueOnce({ status: 200, text: async () => 'managed.bearer' })
    .mockImplementation(async () => ({ status: 200, text: async () => JSON.stringify(portalBootstrapResponse) }))
  globalThis.fetch = fetcher
  const backend = createLiveBackend({ tradingBaseUrl: 'https://trading.example', portalBaseUrl: 'https://portal.example', chartingBaseUrl: 'https://charts.example', portalOrigin: 'https://app.example', phase: 1, timeoutMs: 1000 })
  await backend.session.signIn('managed@example.com', 'password')
  fetcher.mockReset().mockResolvedValue({ status: 200, text: async () => JSON.stringify(response) })
  return { backend, fetcher }
}

describe('managed account read routes', () => {
  it.each([
    ['MAM', 'mamFollowingList', 'mamList', 'mam'],
    ['PAMM', 'pammFollowingList', 'pamList', 'pamm'],
  ] as const)('uses the dedicated %s following route with session authentication', async (kind, collection, list, flag) => {
    const { backend, fetcher } = await backendFor({ status: 'success', data: { user: JSON.stringify([{ [flag]: '0' }]), [list]: '[{"user":"26","name":"Manager","follow":"1"},{"user":"27","name":"Other","follow":"0"}]' } })
    await expect(backend.managedAccounts.following(kind)).resolves.toMatchObject({ managerEnabled: false, managers: [{ id: '26' }] })
    const [url, init] = fetcher.mock.calls[0]
    expect(new URL(url).searchParams.get('collect')).toBe(collection)
    expect(new URL(url).searchParams.get('token')).toBe('acct-managed')
    expect(init.headers.Authorization).toBe('Bearer managed.bearer')
    expect(init.method).toBe('GET')
  })

  it.each([
    ['MAM', 'userMamFollowersList', { user: '[{"mam":"0"}]', mamList: '[{"name":"Alice","mam_share":"20","user_id":"7","mam_id":"26"}]' }],
    ['PAMM', 'userPammFollowers', { user: '[{"pamm":"0"}]', pamList: '[{"name":"Alice","investment":"100","shared_pnl":"2","pamm_share":"20","user_id":"7","pamm_id":"26"}]' }],
  ] as const)('loads %s followers regardless of directory capability', async (kind, collection, data) => {
    const { backend, fetcher } = await backendFor({ status: 'success', data })
    await expect(backend.managedAccounts.followers(kind)).resolves.toMatchObject([{ managerId: '26', userId: '7', name: 'Alice' }])
    expect(new URL(fetcher.mock.calls[0][0]).searchParams.get('collect')).toBe(collection)
  })

  it.each([
    ['MAM', 'mamShareValue', 'mam_id', { mamShareValueList: '[]', totalMamShare: 123 }],
    ['PAMM', 'pammOrderReport', 'pamm_id', { pammOrderReport: '[]', pammSharePnl: 123, userSharePnl: 77, totalSharePnl: 200, pamm_share: '20' }],
  ] as const)('loads %s reports with both relationship identifiers and server totals', async (kind, collection, managerParam, data) => {
    const { backend, fetcher } = await backendFor({ status: 'success', data })
    await expect(backend.managedAccounts.report(kind, { managerId: '26', userId: '7' })).resolves.toMatchObject({ kind, rows: [], totals: { managerPnl: 123 } })
    const params = new URL(fetcher.mock.calls[0][0]).searchParams
    expect(params.get('collect')).toBe(collection)
    expect(params.get(managerParam)).toBe('26')
    expect(params.get('user_id')).toBe('7')
    expect(params.get('token')).toBe('acct-managed')
    const spec = Object.values(ENDPOINTS).find((entry) => entry.name === collection)
    expect(spec).toMatchObject({ method: 'GET', mutation: false, phase: 1 })
    expect(spec?.params).toEqual([managerParam, 'user_id', 'token'])
  })

  it('keeps fixture relationship reads explicitly unavailable', async () => {
    const managed = createMockBackend().managedAccounts
    await expect(managed.following('MAM')).rejects.toMatchObject({ kind: 'blocked' })
    await expect(managed.followers('PAMM')).rejects.toMatchObject({ kind: 'blocked' })
    await expect(managed.report('MAM', { managerId: '26', userId: '7' })).rejects.toMatchObject({ kind: 'blocked' })
  })
})
