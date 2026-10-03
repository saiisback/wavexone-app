# WaveXOne Mobile Backend Integration Guide

**Status:** Integration discovery completed  
**Verified:** 2026-09-28  
**Purpose:** Connect the WaveXOne mobile interface to the capabilities documented by the supplied Postman collections.

## 1. Source of truth

Backend endpoints define the application functionality. The generated mobile designs define presentation only. A screen, action, metric, or menu item must not be enabled unless a corresponding backend endpoint or approved external destination exists.

Reviewed artifacts:

- `Client Portal API.postman_collection.json`
- `API_WITH_BEARER_TOKENS_postman_collection.json`
- `wavexone_api.postman_environment (1).json`

No credentials, account tokens, bearer tokens, secret keys, fingerprints, cookies, or personal account data are recorded in this document.

## 2. Integration readiness summary

The supplied artifacts are sufficient to begin the read-only application integration and build the client-side backend module. Authentication, account information, market discovery, order counts, closed-trade history, portfolio bootstrap, funding configuration, wallet history, notifications, and referrals were successfully accessed.

Production trading and real-money funding must remain disabled until mutation testing is authorized in a staging or dedicated test environment.

### Verified access

| Capability | Result | Notes |
|---|---|---|
| Secret-key issuance | HTTP 200 | Returns secret key and account/session token. |
| Bearer refresh | HTTP 200 | Returns a raw token body rather than JSON. |
| Authenticated user check | HTTP 200, success | Trading authentication is operational. |
| Account details/list | HTTP 200 | Multiple-account structure is available. |
| Order counts | HTTP 200, success | Open, pending, and total counts are available. |
| Open-order list | Reachable | Supplied account returned no usable open-order payload. |
| Closed-trade history | HTTP 200 | Paginated/history data is available. |
| Markets/watchlist | HTTP 200 | Forex and crypto collections are available. |
| Symbol spread catalogue | HTTP 200 | Broad multi-asset symbol coverage is available. |
| Favorites | HTTP 200, success | Favorite-symbol functionality is available. |
| Chart configuration | HTTP 200 | Instrument metadata is available; OHLC/live behavior still needs confirmation. |
| Portal session | HTTP 200, success | Cookie-backed portal access is operational. |
| Portal bootstrap | HTTP 200, success | Returns user, accounts, summary, chart, transactions, transfers, wallets, referral, demo and settings data. |
| Funding configuration | HTTP 200, success | Deposit methods, withdrawal fields/modes, limits and KYC status are available. |
| Transfer/funding/wallet history | HTTP 200, success | Paged histories are available. |
| Notifications/referrals | HTTP 200, success | Both feeds are available. |

## 3. Authentication and session lifecycle

WaveXOne currently exposes two related authentication mechanisms. Their complexity must be hidden inside one client module rather than repeated in screens.

### 3.1 Trading authentication

1. Send `email`, `password`, and device `footprint` to:

   `POST /api-v1/v1.php?collect=check`

2. Read the returned account token, secret key, session information, verification state, and footprint.
3. Send the account token and footprint to:

   `POST /api-v1/v1.php?collect=bearer`

   Include the secret key in the `Secretkey` header.
4. Treat the entire successful response body as the bearer token. The endpoint currently returns a raw token, not a JSON document.
5. Send subsequent trading requests with:

   - `Secretkey: <secret-key>`
   - `Bearer: <bearer-token>`
   - Account token where required by the endpoint
6. Validate the session with:

   `GET /api-v1/v1.php?collect=auth&token=<account-token>`

### 3.2 Client Portal session

1. Complete trading authentication and obtain the account token.
2. Call:

   `POST /setPortalSession`

   Send the account token in the form body and use the approved WaveXOne `Origin`.
3. Persist the returned portal session cookie in the HTTP client's cookie jar.
4. Send `X-Portal-Token` when selecting a particular sibling trading account.
5. Re-establish the portal session after cookie expiration or an authorized `401` response.

### 3.3 Secure storage requirements

- Use platform secure storage for tokens and secret keys.
- Never persist the password after authentication.
- Never write tokens, secret keys, cookies, OTPs, request bodies, or query strings to application logs.
- Redact authentication values from crash reports and analytics.
- Clear all stored session material on logout or account removal.

## 4. Screen-to-endpoint mapping

### 4.1 Authentication

| User flow | Endpoints |
|---|---|
| Sign in | `check`, `bearer`, `auth` |
| Session validation | `auth`, `reauthenticate` |
| Registration and verification | `register`, `mail`, verified-user `auth` mode |
| Password recovery | `sentotp`, `savepass` |

### 4.2 Home and accounts

| UI area | Endpoints |
|---|---|
| Portfolio/account summary | `getuser`, `accountList`, `apiBootstrap` |
| Open and pending counts | `orderscount` |
| Account selector | `accountList`, trading `switchAccount`, portal `switchAccount` |
| Create/add/demo account | `apiRequestAccountCreation`, `apiAddAccount`, `apiCreateDemoAccount` |
| Leverage management | `apiLeverageOptions`, `apiChangeLeverage` |

Do not show design-only metrics such as Market Sentiment or `<50ms` execution as live account data unless the backend team supplies a dedicated data contract.

### 4.3 Markets and watchlist

| UI area | Endpoints |
|---|---|
| Market catalogue | `watch`, `mwatch`, `symbolSpreadApp` |
| Instrument/account details | `detail`, `detailPost`, `userGroup` |
| Favorites/watchlist | `getfav`, `favourite`, `updateFavorite` |
| Daily market values | `getCurrentDayData` |
| Margin preview | `forexmargin` |

### 4.4 Charts

| UI area | Endpoints |
|---|---|
| Instrument chart configuration | `charting_library_cloned_data` |
| Historical bars | `watchlist_charting` on `charting_base_url` |

The live quote transport is not documented. Confirm whether the app should use a WebSocket feed or REST polling and obtain the required subscription/request contract.

### 4.5 Orders and positions

| UI area | Endpoints |
|---|---|
| Open/pending/closed orders | `orders`, `singleorder`, `orderscount`, `history_of_closed_orders` |
| Place market/limit/stop order | `placeorder` variants |
| Modify SL/TP and pending orders | `modify`, `mobileapp_modifyorder`, `modifypendingorder`, `mobileapp_modifypendingorder` |
| Remove SL/TP | `cancelsltpvalue` |
| Close one position | `squareoff` |
| Bulk close/cancel | `bulkPositionclose`, `bulkPendingPositionclose` |

Several trading mutations are implemented as `GET` requests. The client must treat them as non-idempotent mutations: never prefetch, cache, replay, or automatically retry these calls.

### 4.6 Activity and history

| UI area | Endpoints |
|---|---|
| Closed trading history | `history_of_closed_orders` |
| Deposit/withdraw history | `payout_in_out`, `apiRedeemHistory` |
| Internal transfers | `apiTransfers` |
| Wallet activity | `apiWalletHistory` |
| Consolidated initial activity | `apiBootstrap` |

### 4.7 Funds

| UI area | Endpoints |
|---|---|
| Funding methods and limits | `apiRedeemConfig` |
| Save withdrawal destination | `apiSaveWithdrawDetails` |
| Withdrawal OTP | `apiSendWithdrawOtp` |
| Submit withdrawal | `requestPayment` (`name=request`) |
| Submit deposit | `requestPayment` (`name=deposit`) |
| Internal transfer | Not exposed in the mobile app |

Use the documented `requestPayment` trading endpoint for deposit and withdrawal requests. Do not use `transferBalance`, `getPayoutInfo`, `getPayinInfo`, or other legacy variants unless the backend team explicitly approves them.

### 4.8 Account and More

| UI area | Endpoints |
|---|---|
| Profile | `detail`, `detailPost`, `apiSaveProfile` |
| KYC state | `apiRedeemConfig`, `apiBootstrap` |
| Notifications | `apiNotifications`, `apiNotificationsRead` |
| Referrals | `apiReferrals`, `apiReferralHierarchy`, `referbyData`, `referReport` |
| MAM/PAMM | MAM/PAMM list, follow, follower and request endpoints |
| Demo account | `apiCreateDemoAccount`, `submitDemoDeposit` |

No dedicated Trading Signals or Support endpoint was confirmed. Hide those rows until an endpoint is supplied, or implement them as explicitly approved external web destinations.

## 5. Client module design

Create one deep `WaveXBackend` module at the network seam. Screens call its typed interface and must not know about collection names, custom headers, portal cookies, raw token responses, legacy parameter names, or inconsistent response envelopes.

Suggested interface groups:

```text
session:    signIn, restore, refresh, signOut
accounts:   summary, list, switchAccount, profile
markets:    catalogue, favorites, quoteSnapshot, candles
orders:     list, history, place, modify, cancel, close
funds:      configuration, deposit, requestWithdrawal, transfer, history
engagement: notifications, referrals, managedAccounts
```

Internal adapters:

- `TradingApiAdapter` for `/api-v1/v1.php?collect=...`
- `ClientPortalAdapter` for portal session and `/api*` portal endpoints
- `SecureSessionStore` for tokens, secret key, fingerprint, and cookie metadata
- `BackendErrorMapper` to normalize inconsistent status and error formats

### Normalized result rules

- Convert all money and price values to decimal-safe domain values; do not use binary floating-point for order calculations.
- Normalize `status: success|fail|error`, HTTP errors, non-JSON responses, and legacy HTTP-200 failures into one typed error model.
- Preserve server messages for diagnostics but map user-visible messages separately.
- Parse timestamps with an explicit timezone.
- Validate response shapes before allowing an order or funding action.

## 6. Safety and security constraints

1. The supplied trading collection contains literal account/session-like values in numerous URLs. Replace these with variables and rotate any credentials that may be real.
2. Never ship Postman sample credentials inside the mobile application.
3. Do not place tokens in analytics, logs, screenshots, deep links, or crash metadata.
4. Disable automatic retries for every order, transfer, deposit, withdrawal, follow/unfollow, account creation, or profile mutation.
5. Do not integrate `swapFunctionality` until the backend team confirms that its documented SQL-injection and transaction-safety problems are fixed.
6. Do not use `sendnotification` from the client application.
7. Prefer newer `api*` portal endpoints and explicitly deny legacy routes in the client adapter.
8. Require confirmation UI before order closing, bulk closing, withdrawals, transfers, or leverage changes.
9. Use certificate-valid HTTPS only; never bypass TLS verification.

## 7. Information still required

The backend team must provide:

1. A dedicated staging or development account.
2. An account containing at least one open position and one pending order.
3. Written authorization and environment details for testing trading mutations.
4. Deposit and withdrawal test methods that cannot move real money.
5. The live-price WebSocket or polling specification.
6. Successful and failed response examples for order and funding mutations.
7. Confirmation of the preferred endpoint where legacy and newer variants overlap.
8. Token lifetime, refresh timing, cookie lifetime, rate limits, and throttling rules.
9. KYC upload fields, file constraints, lifecycle states, and rejection reasons.
10. Trading Signals and Support endpoints or approved external URLs.
11. Decimal precision, minimum lot, step size, leverage, margin, and market-hours rules per instrument.
12. Confirmation that credentials embedded in the supplied collection have been rotated.

## 8. Delivery phases

### Phase 1 — Read-only integration

- Authentication and secure session storage
- Home/account summary
- Account switching
- Markets, favorites and chart history
- Position/order counts and closed history
- Activity, notifications and funding configuration

### Phase 2 — Trading in a controlled environment

- Open and pending order states
- Margin preview
- Market and pending order placement
- SL/TP modification
- Single and bulk close/cancel
- Failure, timeout and duplicate-submission testing

### Phase 3 — Funding and account operations

- Deposit submission
- Withdrawal OTP and submission
- Internal transfers
- Profile and KYC
- Demo/additional account flows

### Phase 4 — Production hardening

- Contract tests for every used endpoint
- Redaction and secure-storage audit
- Rate-limit and token-expiration tests
- Trading/funding idempotency review
- Monitoring without sensitive payloads
- Release approval from backend and security owners

## 9. Acceptance criteria

Backend integration is production-ready only when:

- Every enabled screen is backed by an approved endpoint.
- Every endpoint has typed success and failure fixtures.
- Authentication restoration and expiration are tested.
- Trading and funding mutations pass staging tests without duplicate execution.
- No credential or personal data appears in logs.
- Live prices and chart data have a documented freshness policy.
- Legacy and unsafe endpoints are blocked by the client module.
- The backend team has approved the final endpoint list.
