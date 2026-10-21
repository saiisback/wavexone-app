import { BackendError } from '../../src/backend/errors'
import { parseManagedDirectory, parseManagedFollowing, parseManagedFollowers, parseManagedReport } from '../../src/backend/managed-accounts'

const manager = {
  user: '26', name: 'test', rank: '1', growth: '28487.81', age: '0', followers: '2',
  drawdown: '0', fund: '1064.47', risklevel: '1', follow: '0',
}

const response = (data: Record<string, unknown>) => ({ status: 'success', message: 'success', data })
const mamResponse = (entry: Record<string, unknown> = manager) => response({
  user: '[{"mam":"1"}]', mamList: JSON.stringify([entry]),
})

describe('managed account directory parsing', () => {
  it('normalizes the verified MAM directory without fabricating metrics', () => {
    expect(parseManagedDirectory(mamResponse(), 'MAM')).toEqual({
      managerEnabled: true,
      managers: [{
        id: '26', name: 'test', rank: 1, growth: 28487.81, age: 0, followers: 2,
        drawdown: 0, fund: 1064.47, risk: 1, following: false,
      }],
    })
    expect(parseManagedDirectory(mamResponse({ user: 27, name: 'Other' }), 'MAM').managers)
      .toEqual([{ id: '27', name: 'Other' }])
  })

  it('reads PAMM from pamList and the documented pamm user capability', () => {
    expect(parseManagedDirectory(response({
      user: '[{"pamm":"1"}]', pamList: JSON.stringify([{ ...manager, follow: '1' }]),
    }), 'PAMM')).toMatchObject({ managerEnabled: true, managers: [{ id: '26', following: true }] })
    expect(parseManagedDirectory(response({ user: '[{"pamm":"0"}]', pamList: '[]' }), 'PAMM'))
      .toEqual({ managerEnabled: false, managers: [] })
    expect(() => parseManagedDirectory(response({ user: '[{"pamm":"1"}]', pammList: '[]' }), 'PAMM'))
      .toThrow(BackendError)
  })

  it('accepts explicit empty nested lists', () => {
    expect(parseManagedDirectory(response({ user: '[]', mamList: '[]' }), 'MAM'))
      .toEqual({ managerEnabled: false, managers: [] })
  })

  it.each([
    undefined,
    { status: 'fail', message: 'private-account-value', data: {} },
    response({}),
    response({ user: '[]', mamList: '[' }),
    response({ user: '[', mamList: '[]' }),
    response({ user: '[]', mamList: '{}' }),
    response({ user: [], mamList: [] }),
    response({ user: '[{"mam":"unknown"}]', mamList: '[]' }),
    response({ user: '[{"pammflag":"1"}]', mamList: '[]' }),
    response({ user: '[{"mam":"1"},{"mam":"0"}]', mamList: '[]' }),
    mamResponse({ user: '', name: 'test' }),
    mamResponse({ user: '26', name: ' ' }),
    mamResponse({ ...manager, growth: 'not-a-number' }),
    mamResponse({ ...manager, growth: '' }),
    mamResponse({ ...manager, growth: 'Infinity' }),
    mamResponse({ ...manager, fund: null }),
    mamResponse({ ...manager, followers: '-1' }),
    mamResponse({ ...manager, followers: '1.5' }),
    mamResponse({ ...manager, follow: 'yes' }),
  ])('rejects malformed data instead of displaying an empty directory (%#)', (input) => {
    expect(() => parseManagedDirectory(input, 'MAM')).toThrow(BackendError)
    try {
      parseManagedDirectory(input, 'MAM')
    } catch (error) {
      expect(error).toMatchObject({ kind: 'malformed' })
      expect(JSON.stringify(error)).not.toContain('private-account-value')
      expect((error as Error).cause).toBeUndefined()
    }
  })
})

describe('managed relationships and reports', () => {
  it('filters following results by the actual follow flag', () => {
    expect(parseManagedFollowing(response({ user: '[{"mam":"0"}]', mamList: '[{"user":"1","name":"A","follow":"0"},{"user":"2","name":"B","follow":"1"}]' }), 'MAM'))
      .toEqual({ managerEnabled: false, managers: [{ id: '2', name: 'B', following: true }] })
  })

  it('retains both MAM relationship identifiers even when the manager capability is off', () => {
    expect(parseManagedFollowers(response({ user: '[{"mam":"0"}]', mamList: '[{"name":"Alice","mam_share":"20","user_id":"7","mam_id":"26"}]' }), 'MAM'))
      .toEqual([{ id: '["26","7"]', kind: 'MAM', name: 'Alice', managerId: '26', userId: '7', share: 20 }])
  })

  it('normalizes the distinct PAMM follower financial fields', () => {
    expect(parseManagedFollowers(response({ user: '[{"pamm":"0"}]', pamList: '[{"name":"Bob","investment":"500.5","shared_pnl":"-12.25","pamm_share":"30","user_id":"8","pamm_id":"26"}]' }), 'PAMM'))
      .toEqual([{ id: '["26","8"]', kind: 'PAMM', name: 'Bob', managerId: '26', userId: '8', share: 30, investment: 500.5, sharedPnl: -12.25 }])
  })

  it('preserves server MAM report totals and each reported identity', () => {
    expect(parseManagedReport(response({ mamShareValueList: '[{"order_pnl_log_id":"4","order_id":"9","user_pnl":"10","mam_user_pnl":"2","user_uid":"7","mam_uid":"26","updatedtime":"2026-10-17 12:00:00"}]', totalMamShare: '123.5' }), 'MAM'))
      .toEqual({ kind: 'MAM', rows: [{ id: '4', orderId: '9', userPnl: 10, managerPnl: 2, userId: '7', managerId: '26', updatedAt: '2026-10-17 12:00:00' }], totals: { managerPnl: 123.5 } })
  })

  it('preserves PAMM report totals instead of recomputing them from visible rows', () => {
    expect(parseManagedReport(response({ pammOrderReport: '[{"order_id":"9","pamm_share_amount":"2","user_share_amount":"8","total_shared_pnl":"10"}]', pammSharePnl: 101, userSharePnl: '202', totalSharePnl: '303', pamm_share: '20' }), 'PAMM'))
      .toEqual({ kind: 'PAMM', rows: [{ id: '9', orderId: '9', managerPnl: 2, userPnl: 8, totalPnl: 10 }], totals: { managerPnl: 101, userPnl: 202, totalPnl: 303 }, share: 20 })
  })

  it('accepts explicit empty relationship and report lists with validated totals', () => {
    expect(parseManagedFollowers(response({ user: '[]', pamList: '[]' }), 'PAMM')).toEqual([])
    expect(parseManagedReport(response({ mamShareValueList: '[]', totalMamShare: '0' }), 'MAM'))
      .toEqual({ kind: 'MAM', rows: [], totals: { managerPnl: 0 } })
  })

  it.each([
    () => parseManagedFollowers(response({ user: '[]', mamList: '[{"name":"Secret","mam_share":"20","user_id":"7"}]' }), 'MAM'),
    () => parseManagedFollowers(response({ user: '[]', pamList: '[{"name":"Secret","investment":"bad","shared_pnl":"0","pamm_share":"1","user_id":"7","pamm_id":"8"}]' }), 'PAMM'),
    () => parseManagedReport(response({ mamShareValueList: '[]' }), 'MAM'),
    () => parseManagedReport(response({ pammOrderReport: '[]', pammSharePnl: 0, userSharePnl: 0, totalSharePnl: 'bad', pamm_share: '2' }), 'PAMM'),
    () => parseManagedReport(response({ mamShareValueList: '[{"order_id":"9"}]', totalMamShare: 0 }), 'MAM'),
  ])('rejects invalid financial records without exposing response details (%#)', (parse) => {
    expect(parse).toThrow(BackendError)
    try { parse() } catch (error) {
      expect(error).toMatchObject({ kind: 'malformed' })
      expect((error as Error).cause).toBeUndefined()
      expect(String(error)).not.toContain('Secret')
    }
  })
})
