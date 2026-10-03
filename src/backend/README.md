# `WaveXBackend`

The network seam described in `WAVEXONE_BACKEND_INTEGRATION_GUIDE.md` §5.
Screens call a typed interface in the app's own domain types and never see
collection names, portal cookies, raw token bodies or the four different
shapes a failure arrives in.

## What is here

| File | Role |
|---|---|
| `contract.ts` | The interface. The only file a screen should need to read. |
| `mock-backend.ts` | The contract served from `src/data/mock.ts`. The default. |
| `live-backend.ts` | The real implementation: session, accounts, markets, orders, funding, and notifications. |
| `gate.ts` | Denylist, phase gating, parameter checking, duplicate-submission guard. |
| `http.ts` | The one `fetch`. TLS, timeouts, body encoding, envelope normalisation. |
| `market-feed.ts` | The only sockets: live prices, chart candles, sparklines and the trading event stream. |
| `endpoints.ts` | Every allowed endpoint and its parameters, plus the twelve that are refused. |
| `errors.ts` | One typed error model, plus the user-facing copy map. |
| `decimal.ts` | Exact money. Guide §5 forbids floats in order calculations. |
| `secure-session-store.ts` | Keychain / Keystore. Memory-only on web. |
| `adapters/` | The two transports: trading API and Client Portal. |
| `provider.tsx` | `BackendProvider`, `useBackend`, `useBackendQuery`. |

## Which implementation runs

`createBackend()` returns the **live** backend against
`https://trade.wavexone.com` — no environment file is needed. Signing in
shows the signed-in user's own data.

The fixture backend runs only when asked for: `EXPO_PUBLIC_WAVEX_BACKEND=mock`.
It used to be the silent default, which made a build without a `.env.local`
accept any password and show fixture data as if it were the user's.

Optional overrides: `EXPO_PUBLIC_WAVEX_TRADING_URL`, `EXPO_PUBLIC_WAVEX_PORTAL_URL`,
`EXPO_PUBLIC_WAVEX_PORTAL_ORIGIN`, `EXPO_PUBLIC_WAVEX_CHARTING_URL`, and:

- `EXPO_PUBLIC_WAVEX_PHASE` (default `3`) — guide §8. Phase 1 is read-only,
  phase 2 adds trading, phase 3 adds funding mutations. Anything above the
  configured phase is refused before a request is made.

## Where the endpoint contract comes from

`endpoints.ts` is transcribed from the supplied Postman collections, so every
method, path and parameter name is read off the collection rather than
inferred. The collections themselves are **gitignored**: they carry literal
account tokens and device fingerprints across ~80 URLs (guide §6.1), so this
file is the committed record of what they say.

Two things that transcription settled, both of which were previously wrong:

- **`footprint` and `fingerprint` are different identifiers.** The first is
  client-chosen and sent to `check`/`bearer` before authentication. The second
  is server-issued per account by `create_fingerprint`, formatted
  `<hex>_<accountId>`, and required by every order mutation. They are separate
  fields on `SessionMaterial` so one cannot be sent where the other belongs.
- **The two transports encode bodies differently.** Trading reads form fields;
  the portal's `api*` routes parse a JSON document; `apiSubmitDeposit` is
  multipart. The encoding comes off the endpoint spec, because sending JSON to
  a route calling `$this->input->post()` yields an empty body and a confusing
  400.

## Live coverage and remaining gap

Redacted structural probes now back strict Zod parsers for authentication,
accounts, order counts, market catalogue and metadata, daily REST snapshots,
favorites, open/closed orders, portal bootstrap, funding configuration, and
notifications. Screens never fall back to fixture values after live mode is
selected.

Streaming follows the 2026-10-02 API reference
(`trade.wavexone.com/platform-api-details/documentation/api`), and was
checked against the live feeds:

- **Prices** — `wss://cloud.wavexone.com/ws/ticks`. One shared socket; each
  row subscribes to its own symbol (`c:xauusd` → `XAUUSD`) and re-renders
  alone. Instrument detail, Trade, the order ticket, the SL/TP sheet and the
  Positions P&L all read it. Reconnects with 1 s → 30 s back-off.
- **Charts** — `wss://cloud.wavexone.com/ws/ohlcV2`, one request per
  timeframe (`CHART_REQUESTS` in `src/data/chart-series.ts`), trimmed to the
  window ending at the newest bar. The newest point follows the live price.
  The old `watchlist_charting` route is not used.
- **Sparklines and the Market Watch period** — the same candle feed, over the
  chosen period.
- **Order events** — `wss://cloud.wavexone.com/server/`, authenticated with
  the account token. Fills, closes, rejections and balance changes re-read
  the affected queries (`useTradingEvents`); events are never applied as
  data. A market order shows "Executing…" until it fills, and a `transit`
  order shows "Closing…".

Phase 1 enables authentication and reads. Phase 2 enables trading mutations;
Phase 3 enables portal/funding mutations. Raising the phase requires an
explicitly authorized staging/test environment.

Every existing trading and funding control is wired to its mutation:

- Order ticket: market and limit (`placeorder` `type=market|limit`,
  `clicked=yes`). The Trade
  tab's Stop option explains itself instead — the API's `type=stop` is a
  two-legged HFT order, not a stop entry.
- Positions: close (`squareoff`), cancel pending (`bulkPendingPositionclose`),
  and the SL/TP sheet (`mobileapp_modifyorder` for open positions,
  `mobileapp_modifypendingorder` with the unchanged trigger for pending ones).
  Emptying a level sends `0`, which those routes read as "remove".
- Funding: deposit, transfer, and withdrawal with the configured destination
  fields. The OTP request and the submission encode that destination
  identically. A deposit to a demo account goes to `submitDemoDeposit`
  (virtual funds), and only for the account the session is on, because that
  route takes no account id.
- Profile: the phone number, through `apiSaveProfile`, resending the
  server-held name unchanged. Email and country have no update route.
- Account switcher: "Open a new account" calls `apiCreateDemoAccount` or
  `apiRequestAccountCreation`, both with the empty body the collection sends.

An acknowledged mutation drops the cached bootstrap and re-reads the affected
screens through `useInvalidateQueries`; a failed or unconfirmed one re-reads
nothing. None of these response shapes has been captured yet (see
`docs/RESPONSE-CAPTURES.md`, Phase 2 / 3), so success is still recognised only
by the `status` envelope.

Not wired, because no response shape exists to parse: `forexmargin`. The
ticket's required margin remains a client-side estimate.

## Rules this module enforces

These are guide §6 requirements, in code rather than in a checklist:

- **Denied routes** (§6.5–6.7). `swapFunctionality`, `sendnotification`,
  `transferBalance`, `getPayoutInfo`, `getPayinInfo` throw with the reason,
  along with seven more the collections turned up: `getAccounts`,
  `getInternalTranferHistory` and legacy `addAccount` (superseded by `api*`
  routes), plus `appLogin`, `mailsession`, `demoCreate` and
  `gentrateXtreAddress`, which render views, fixate sessions or mutate on a
  bare `GET`.
- **Unknown parameters are refused** before the request is sent. This API
  ignores what it does not recognise rather than rejecting it, so `orderId`
  where the route wants `orderID` would return a cheerful success having
  modified nothing. The registry records the real names; the gate checks
  against them. This caught a live bug on its first run — `orders.counts` was
  sending an `account` parameter that `orderscount` does not accept.
- **No automatic retries** (§6.4). There is no retry anywhere. A mutation that
  fails *in transit* is reported as unconfirmed, not retried — the server may
  have acted.
- **No duplicate execution** (§9). Every mutation needs an idempotency key.
  The same key inside 30 seconds returns the first outcome instead of firing
  again. This matters more than usual here: guide §4.5 notes several trading
  mutations are `GET` requests.
- **Phase gating** (§8). Nothing above the configured phase is reachable.
- **HTTPS only** (§6.9). A plaintext base URL fails at construction.
- **No credentials in logs** (§3.3, §6.3). Request and response bodies are
  never logged. URLs are never logged — this API puts the account token in
  the query string.
- **No password persistence** (§3.3). `password` is a parameter to `signIn`
  and appears nowhere else in the module.

## Things intentionally unavailable

Worth resolving before Phase 1 ships:

- **Trading Signals** has no confirmed endpoint (§4.8), so the screen renders
  an unavailable state instead of fixture content.
- **Market Sentiment** and **`<50ms` execution** were unsupported design copy
  and are not shown as live account facts.
- **Referrals and MAM/PAMM** appear in the guide's suggested interface groups
  but have no screen. They are left out rather than added as dead surface.

## Tests

```bash
npm test
```

Tests live in `tests/backend/`, mirroring this directory.

| Spec | Covers |
|---|---|
| `decimal.test.ts` | The arithmetic. |
| `gate.test.ts` | Denylist, phase gating and every duplicate-submission path — including the mutation that fails mid-flight, the one that can place an order twice. |
| `http.test.ts` | TLS refusal, the status→kind mapping, timeouts, form encoding and envelope unwrapping. |
| `errors`/`redact.test.ts` | That no credential reaches a log, and that server wording never reaches a user. |
| `endpoints.test.ts` | Invariants over the whole registry, so a *new* entry that breaks a §6 rule fails without anyone writing a test for it. |
| `trading-api.test.ts` | The §3.1 handshake, the raw-token body, and that the password is sent once and stored nowhere. |
| `client-portal.test.ts` | §3.2, including that a read is replayed after a 401 and a mutation is not. |
| `live-backend.test.ts` | Session lifecycle, `orders.counts`, and that every unwired method refuses by name. |
| `provider.test.tsx` | The four states of `useBackendQuery`, including a read that throws synchronously. |

The synchronous-throw case is a regression guard, not a hypothetical: the
unwired methods used to throw rather than reject, which escaped the hook's
rejection handler and crashed the screen instead of showing the refusal.
