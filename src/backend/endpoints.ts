/**
 * Every endpoint the client is allowed to reach, and the ones it must refuse.
 *
 * Screens never name an endpoint. This registry is the only place collection
 * names appear, which is what makes guide §6.7 ("explicitly deny legacy
 * routes in the client adapter") and §9 ("legacy and unsafe endpoints are
 * blocked by the client module") checkable rather than aspirational.
 *
 * Every entry below is transcribed from the supplied Postman collections
 * (`API_WITH_BEARER_TOKENS`, `Client Portal API`), so methods and parameter
 * names are read off the collection rather than inferred. The collections are
 * gitignored — they carry literal account tokens in ~80 URLs (guide §6.1) —
 * so this file is the committed record of what they say.
 */

/** Which transport an endpoint belongs to — they authenticate differently. */
export type Transport = 'trading' | 'portal' | 'charting'

/** Guide §8. Nothing above the configured phase may be called. */
export type Phase = 1 | 2 | 3 | 4

/**
 * How the request body is encoded. The two transports disagree, which is
 * exactly the kind of detail guide §5 says must not leak into a screen:
 * trading posts form fields, while the portal's `api*` routes read JSON.
 */
export type BodyEncoding = 'form' | 'json' | 'multipart'

export type EndpointSpec = {
  transport: Transport
  /** `collect=` value for trading, path segment for portal. */
  name: string
  method: 'GET' | 'POST'
  /**
   * Changes server state. Guide §6.4: these are never retried automatically,
   * never prefetched, never cached, never replayed.
   */
  mutation: boolean
  /** Lowest delivery phase that may call this. Guide §8. */
  phase: Phase
  /** Required for POST. Omitted on GET, which carries no body. */
  encoding?: BodyEncoding
  /**
   * Parameter names this endpoint accepts, straight from the collection.
   * Recorded so a caller cannot invent `accountId` where the API wants
   * `token`, and so a rename upstream fails a test instead of a trade.
   */
  params?: readonly string[]
  /**
   * Set when the endpoint needs no `Bearer` header. Only `getuser`, which
   * `v1.php` routes with `auth=false`.
   */
  unauthenticated?: true
}

/**
 * Guide §6.5, §6.6, §6.7. Reaching any of these is a bug, so they are named
 * here with the reason rather than simply left out — a missing entry reads as
 * an oversight, a denial reads as a decision.
 */
export const DENIED_ENDPOINTS: Readonly<Record<string, string>> = {
  swapFunctionality:
    'Blocked: SQL injection via payValue/getValue/paySymbol/getSymbol/markup/markupvalue/getlive/paylive, which are concatenated into ~8 UPDATE/INSERT statements with no escaping and no transaction (guide §6.5). Do not enable until the backend team confirms a fix.',
  sendnotification:
    'Blocked: notifications must not be sent from the client application (guide §6.6).',
  transferBalance: 'Blocked legacy route — internal transfers are not exposed in the mobile app.',
  getPayoutInfo:
    'Blocked legacy route — use `funds.configuration` (apiRedeemConfig) instead (guide §4.7).',
  getPayinInfo:
    'Blocked legacy route — use `funds.configuration` (apiRedeemConfig) instead (guide §4.7).',
  // Present in the collections but unreachable by policy rather than by §6.
  getAccounts:
    'Blocked legacy route — session-only auth, returns 200 {"current":[]} instead of 401. Use `apiBootstrap` (guide §4.2).',
  getInternalTranferHistory:
    'Blocked legacy route — unpaged. Use `apiTransfers` (guide §4.6).',
  addAccount: 'Blocked legacy route — use `apiAddAccount` (guide §4.7 "prefer the newer api* endpoints").',
  gentrateXtreAddress:
    'Blocked: internal wallet-provisioning helper, never a client route.',
  appLogin: 'Blocked: renders a view and decrypts a `uct` param with a hardcoded AES key.',
  mailsession: 'Blocked: sets the session token to a hardcoded literal — session-fixation backdoor.',
  demoCreate: 'Blocked: HTML sibling of apiCreateDemoAccount that mutates on a plain GET with no CSRF token.',
}

const trading = (
  name: string,
  method: 'GET' | 'POST',
  mutation: boolean,
  phase: Phase,
  params: readonly string[],
  encoding?: BodyEncoding,
): EndpointSpec => ({ transport: 'trading', name, method, mutation, phase, params, encoding })

const portal = (
  name: string,
  method: 'GET' | 'POST',
  mutation: boolean,
  phase: Phase,
  params: readonly string[],
  encoding?: BodyEncoding,
): EndpointSpec => ({ transport: 'portal', name, method, mutation, phase, params, encoding })

/**
 * Two different device identifiers travel through this API and they are not
 * interchangeable — the collection uses both, spelled differently:
 *
 *  - `footprint`, sent to `check` and `bearer`. Client-chosen, pre-auth.
 *  - `fingerprint`, required by every order mutation. Issued per account by
 *    `create_fingerprint` and treated as an opaque server value.
 *
 * Sending the footprint where the fingerprint belongs is the kind of mistake
 * that fails only at order time, so they are separate fields everywhere.
 */
export const ENDPOINTS = {
  // §4.1 Authentication
  check: trading('check', 'POST', false, 1, ['email', 'password', 'footprint'], 'form'),
  bearer: trading('bearer', 'POST', false, 1, ['token', 'footprint'], 'form'),
  auth: trading('auth', 'GET', false, 1, ['token', 'type', 'mode']),
  reauthenticate: trading('reauthenticate', 'GET', false, 1, ['token', 'type']),
  register: trading(
    'register',
    'POST',
    true,
    3,
    ['email', 'password', 'name', 'number', 'referral', 'manager_id', 'remember'],
    'form',
  ),
  mail: trading('mail', 'POST', true, 3, ['token'], 'form'),
  sendOtp: trading('sentotp', 'POST', true, 3, ['token', 'type'], 'form'),
  savePassword: trading('savepass', 'POST', true, 3, ['token', 'name', 'data'], 'form'),
  disclaimer: trading('disclaimer', 'GET', false, 1, ['token']),

  /**
   * Issues the per-account `fingerprint` that every order mutation needs.
   *
   * Marked a mutation on the strength of its name: we have no response
   * example, and a route called `create_*` most likely inserts a row. Treating
   * a write as a read is the expensive direction of that guess.
   */
  createFingerprint: trading('create_fingerprint', 'GET', true, 2, ['token', 'account_id', 'sid']),

  // §4.2 Home and accounts
  getUser: {
    ...trading('getuser', 'GET', false, 1, ['token', 'brokerid']),
    // `v1.php` routes this with auth=false — it takes no Bearer header.
    unauthenticated: true,
  },
  accountList: trading('accountList', 'GET', false, 1, ['token']),
  ordersCount: trading('orderscount', 'GET', false, 1, ['token']),
  switchAccountTrading: trading('switchAccount', 'GET', true, 1, ['token', 'switchtoken']),
  bootstrap: portal('apiBootstrap', 'GET', false, 1, []),
  switchAccountPortal: portal('switchAccount', 'POST', true, 1, ['token'], 'form'),
  accountCreationStatus: portal('apiAccountCreationRequestStatus', 'GET', false, 1, []),
  requestAccountCreation: portal('apiRequestAccountCreation', 'POST', true, 3, [], 'json'),
  addAccount: portal('apiAddAccount', 'POST', true, 3, [], 'json'),
  createDemoAccount: portal('apiCreateDemoAccount', 'POST', true, 3, [], 'json'),
  leverageOptions: portal('apiLeverageOptions', 'GET', false, 1, ['accountToken']),
  changeLeverage: portal(
    'apiChangeLeverage',
    'POST',
    true,
    3,
    ['accountToken', 'group_id', 'subgroup_value'],
    'json',
  ),

  // §4.3 Markets and watchlist
  watch: trading('watch', 'GET', false, 1, []),
  marketWatch: trading('mwatch', 'GET', false, 1, []),
  symbolSpread: trading('symbolSpreadApp', 'GET', false, 1, []),
  instrumentDetail: trading('detail', 'GET', false, 1, ['token', 'data']),
  instrumentDetailPost: trading('detailPost', 'POST', false, 1, ['token', 'name', 'data'], 'form'),
  userGroup: trading('userGroup', 'GET', false, 1, ['token']),
  favorites: trading('getfav', 'GET', false, 1, ['token', 'data']),
  /** `data` is a JSON string: {"symbol":"X:AXSUSD","watch":"1","type":"add"}. */
  toggleFavorite: trading('favourite', 'GET', true, 1, ['token', 'data']),
  updateFavorite: trading('updateFavorite', 'POST', true, 1, ['token', 'list', 'section'], 'form'),
  currentDayData: trading(
    'getCurrentDayData',
    'POST',
    false,
    1,
    ['data', 'timeline'],
    'multipart',
  ),
  forexMargin: trading('forexmargin', 'GET', false, 2, ['symbol']),

  // §4.4 Charts
  /** On the trading host, not the charting host — `v1.php?collect=…&s=XAUUSD`. */
  chartConfig: trading('charting_library_cloned_data', 'GET', false, 1, ['s']),
  mamDirectory: trading('mamList', 'GET', false, 1, ['token']),
  pammDirectory: trading('pammList', 'GET', false, 1, ['token']),
  mamFollowing: trading('mamFollowingList', 'GET', false, 1, ['token']),
  pammFollowing: trading('pammFollowingList', 'GET', false, 1, ['token']),
  mamFollowers: trading('userMamFollowersList', 'GET', false, 1, ['token']),
  pammFollowers: trading('userPammFollowers', 'GET', false, 1, ['token']),
  mamReport: trading('mamShareValue', 'GET', false, 1, ['mam_id', 'user_id', 'token']),
  pammReport: trading('pammOrderReport', 'GET', false, 1, ['pamm_id', 'user_id', 'token']),
  // §4.5 Orders and positions
  orders: trading('orders', 'GET', false, 1, ['token']),
  singleOrder: trading('singleorder', 'GET', false, 1, ['token', 'order_id']),
  closedHistory: trading('history_of_closed_orders', 'GET', false, 1, [
    'token',
    'page',
    'type',
    'filter',
    'from',
    'to',
  ]),
  placeOrder: trading('placeorder', 'GET', true, 2, [
    'token',
    'type',
    'bs',
    'symbol',
    'lot',
    'sl',
    'target',
    'trigger',
    // HFT (`type=stop`) splits every leg into a buy-side and sell-side field.
    'lotb',
    'slb',
    'targetb',
    'triggerb',
    'lots',
    'sls',
    'targets',
    'triggers',
    'stop_hft_type',
    'clicked',
    'fingerprint',
  ]),
  /** Single-field SL/TP edit: `name` is `StopLoss` or `Target`. */
  modifyOrderSingle: trading('modify', 'GET', true, 2, [
    'token',
    'id',
    'name',
    'val',
    'fingerprint',
  ]),
  modifyPendingOrderSingle: trading('modifypendingorder', 'GET', true, 2, [
    'token',
    'id',
    'name',
    'val',
    'fingerprint',
  ]),
  /** Mobile variants set stop loss and target in one call. Prefer these. */
  modifyOrder: trading('mobileapp_modifyorder', 'GET', true, 2, [
    'token',
    'orderID',
    'stoploss',
    'target',
    'fingerprint',
  ]),
  modifyPendingOrder: trading('mobileapp_modifypendingorder', 'GET', true, 2, [
    'token',
    'orderID',
    'stoploss',
    'target',
    'trigger',
    'fingerprint',
  ]),
  cancelStopLossTakeProfit: trading('cancelsltpvalue', 'GET', true, 2, [
    'token',
    'orderId',
    'field',
  ]),
  closePosition: trading('squareoff', 'GET', true, 2, ['token', 'id', 'fingerprint']),
  bulkClosePositions: trading('bulkPositionclose', 'GET', true, 2, [
    'token',
    'bulkCloseId',
    'fingerprint',
  ]),
  bulkCancelPending: trading('bulkPendingPositionclose', 'GET', true, 2, [
    'token',
    'bulkCloseId',
    'fingerprint',
  ]),

  // §4.6 Activity and history
  fundingHistory: trading('payout_in_out', 'GET', false, 1, ['token', 'page', 'type']),
  redeemHistory: portal('apiRedeemHistory', 'GET', false, 1, [
    'accountToken',
    'type',
    'page',
    'limit',
  ]),
  transfers: portal('apiTransfers', 'GET', false, 1, ['page', 'limit']),
  walletHistory: portal('apiWalletHistory', 'GET', false, 1, ['page', 'limit']),

  // §4.7 Funds
  redeemConfig: portal('apiRedeemConfig', 'GET', false, 1, ['accountToken']),
  saveWithdrawDetails: portal(
    'apiSaveWithdrawDetails',
    'POST',
    true,
    3,
    ['accountToken', 'payment'],
    'json',
  ),
  sendWithdrawOtp: portal(
    'apiSendWithdrawOtp',
    'POST',
    true,
    3,
    ['sourceId', 'amount', 'withdrawAddress'],
    'json',
  ),
  requestPayment: trading(
    'requestPayment',
    'POST',
    true,
    3,
    ['name', 'data', 'token'],
    'form',
  ),
  submitDemoDeposit: portal('submitDemoDeposit', 'POST', true, 3, ['deposit_amount'], 'form'),

  // §4.8 Account and More
  saveProfile: portal('apiSaveProfile', 'POST', true, 3, ['name', 'mobile'], 'json'),
  notifications: portal('apiNotifications', 'GET', false, 1, []),
  markNotificationsRead: portal('apiNotificationsRead', 'POST', true, 1, ['ids'], 'json'),
  referrals: portal('apiReferrals', 'GET', false, 1, ['page', 'limit']),
  referralHierarchy: portal('apiReferralHierarchy', 'GET', false, 1, []),
  referByData: trading('referbyData', 'GET', false, 1, ['token']),
  referReport: trading('referReport', 'POST', false, 1, ['user_token', 'referid_token'], 'form'),

  // Portal session bootstrap — §3.2
  setPortalSession: portal('setPortalSession', 'POST', false, 1, ['token'], 'form'),
} as const satisfies Record<string, EndpointSpec>

export type EndpointKey = keyof typeof ENDPOINTS
