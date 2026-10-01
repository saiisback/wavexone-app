# Response capture status

**Status:** Phase-1 structural shapes captured and implemented on 2026-09-30.

## Why this file exists

The supplied Postman collections settled the **request** side completely —
method, path, parameter names and headers for all 121 trading requests and 34
portal requests. `src/backend/endpoints.ts` is transcribed from them.

They did not settle the **response** side:

| Collection | Requests | Captured responses |
|---|---|---|
| `API_WITH_BEARER_TOKENS` | 121 | **0** |
| `Client Portal API` | 34 | 15, all unauthenticated `401` / empty `200` |

So no successful payload from either API exists anywhere in the project, and
the field names inside one are unknown. A screen cannot be wired to
`accountList` without knowing whether the balance arrives as `balance`,
`bal`, `equity` or `fund`.

Guessing is the one thing this module refuses to do. Every unwired method in
`src/backend/live-backend.ts` names the capture below that unblocks it.

## How to capture

1. Import both collections and `wavexone_api.postman_environment` into Postman.
2. Run **Secret Key generate** (`collect=check`) with a real login. The
   collection's sample sends `email=10001`, an account number rather than an
   address — either form appears to work.
3. Run **refresh token** (`collect=bearer`) to fill `{{bearer_token}}`.
4. For the portal, run `setPortalSession` with the `Origin` header set, so
   Postman's cookie jar holds `ci_session`. Portal `api*` routes return 401
   without it — `X-Portal-Token` alone is not enough.
5. Run each request below and **Save Response → Save as example**.
6. Re-export both collections.

## Before you send them

The collections already carry live account tokens and device fingerprints as
literals across ~80 URLs — five distinct account tokens, one of them repeated
131 times. Guide §6.1 asks for these to be replaced with variables and
rotated. Captured responses will contain more: real names, emails, phone
numbers, balances.

The values are deliberately not reproduced here. This file is committed; the
collections are not, and copying a token out of one into the other would
defeat that.

**Redact before sharing, or share out of band.** The collections are
gitignored in this repo for the same reason. Field *names* are what's needed
here — the values can be scrubbed to `"x"` and the capture is just as useful.

## Phase 1 — implemented read-only integration

The nine reads below now have redacted synthetic fixtures, Zod parsers, and
domain mappings. Raw responses and credentials were not committed.

| # | Request | Unblocks |
|---|---|---|
| 1 | `collect=accountList&token=…` | `accounts.summary`, `accounts.list` — the balance row on Home |
| 2 | `apiBootstrap` | `accounts.profile`, KYC state. The portal's mega-endpoint; one capture covers user, accounts, summary, transactions, transfers, wallets, referral, settings |
| 3 | `collect=mwatch` | `markets.catalogue` — the Markets list |
| 4 | `collect=symbolSpreadApp` | Per-instrument precision and spread |
| 5 | `collect=getfav&token=…&data=[]` | `markets.favorites` |
| 6 | `collect=orders&token=…` | `orders.list` — **needs an account holding at least one open position and one pending order** (guide §7.2). An empty list teaches nothing |
| 7 | `collect=history_of_closed_orders&page=1&token=…&filter=24hr` | `orders.history` — the Activity tab |
| 8 | `apiRedeemConfig?accountToken=…` | `funds.configuration` — deposit methods, withdrawal fields, limits, KYC |
| 9 | `apiNotifications` | `engagement.notifications` |

Also useful, lower priority: `collect=payout_in_out` (funding history),
`apiTransfers`, `apiWalletHistory`, `collect=userGroup` (leverage and spread
per group), `collect=detail`.

## Remaining read-only limitation

Two gaps need a written answer, not a response body:

- **Live ticks (guide §7.5).** No WebSocket/SSE subscription contract is
  documented. The app uses confirmed `getCurrentDayData` REST snapshots and
  does not describe them as tick-level live prices.
- **Charts.** The collection's `charting_base_url` host failed DNS resolution.
  Configure `EXPO_PUBLIC_WAVEX_CHARTING_URL` when a working host is supplied.
- **Account switching.** Both documented switch routes are called with one
  idempotency key; local selection changes only after both acknowledge.

## Phase 2 / 3 — after authorization

Do **not** capture these against production. Guide §7.3 requires written
authorization and a staging environment before any trading mutation runs, and
§7.4 requires funding methods that cannot move real money.

Needed once that exists: `collect=placeorder` (market and limit, success and
failure), `collect=squareoff`, `collect=mobileapp_modifyorder`,
`collect=create_fingerprint`, `apiSubmitWithdraw`, `apiSubmitDeposit`,
`apiTransfer`.

`create_fingerprint` is worth calling out: every order mutation requires a
`fingerprint` parameter distinct from the `footprint` used at sign-in, and its
format (`<hex>_<accountId>`) is known only from URL samples. The response
shape is a guess — see `issueOrderFingerprint` in
`src/backend/adapters/trading-api.ts`.

## Safe future capture procedure

Capture only on an authorized account, redact every scalar value, retain field
names and types, and add the shape to `tests/backend/fixtures/`. Never commit a
Postman export, raw token, password, portal cookie, fingerprint, name, contact
detail, or real financial amount. Add a failing parser test before changing an
adapter.
