# WaveXOne Live Backend Integration Design

## Intent

Replace fixture-backed behavior in the existing Expo/React Native application with the documented WaveXOne trading and client-portal APIs. A user must be able to sign in on a phone, restore a secure session, view real account and market data, and use every existing screen without silent fixture fallbacks. Screens whose advertised data has no confirmed backend source, such as Trading Signals, render an explicit unavailable state instead of fixture content.

The implementation must preserve the repository's existing `WaveXBackend` seam. Screens consume application domain types and must not learn PHP `collect` names, custom authentication headers, cookie mechanics, or raw response shapes.

## Evidence and constraints

The design is grounded in these sources:

- `API_WITH_BEARER_TOKENS_postman_collection (1).json`: 121 trading requests and no saved responses.
- `Client Portal API.postman_collection (1).json`: 34 portal requests and 15 saved unauthenticated or empty responses.
- `wavexone_api.postman_environment (1) (1).json`: the two base URLs; bearer, secret, portal token, and fingerprint variables are empty.
- The linked OpenAPI contract.
- Safe, read-only calls using the supplied test login. No order, funding, account-switch, favorite, or notification mutation was called.

The live read-only probes confirmed the following response surfaces:

- Sign-in: `userID`, `status`, `token`, `mode`, `session_id`, `password`, `verify`, `secret_key`, and `footprint`. The server echoes the password, so request and response bodies must never be logged.
- Accounts: an array containing `uid`, `account_id`, `balance`, `book`, and `account_type`.
- Order counts: `total_count`, `open_count`, and `pending_count` inside a success envelope.
- Market catalogue: grouped arrays such as `fx`, with instrument rows containing `ticker` and `market`.
- Symbol metadata: a symbol-keyed object containing `spread`, `decimal`, and `lot`.
- Favorites and user-group data: success envelopes whose `data` field is JSON encoded as a string.
- Open orders: a success envelope with rows including `id`, `symbol`, `formated_symbol`, `pair`, `time`, `trigger`, `type`, `lot`, `bs`, `sl`, `tp`, `avg`, `t_swap`, `commission`, `status`, and `partiallot`.
- Closed-order history: `info` metadata plus a paginated `data` array.
- Portal bootstrap: user, accounts, summary, chart, transactions, transfers, wallets, referral, demo, account-creation state, manager-request state, and settings.
- Funding configuration: deposit methods, withdrawal modes and fields, saved payment details, KYC state, available funds, limits, and wallets.
- Notifications: `items` plus `unreadCount`.

There is still no documented WebSocket or SSE contract for live prices. The app must label REST-derived prices as snapshots and must not claim tick-level live pricing or `<50ms` execution.

## Safety boundary

Read-only production integration is enabled in phase 1. Mutations are implemented behind the existing phase gate but remain unreachable unless the build explicitly selects the required phase:

- Phase 1: authentication and reads.
- Phase 2: order fingerprinting and trading mutations, only against an authorized staging/test account.
- Phase 3: account, profile, favorite, notification, and funding mutations, only where the configured methods cannot move real money unexpectedly.
- Phase 4: reserved for separately authorized capabilities.

Production order placement, closing, cancellation, deposits, withdrawals, and transfers are not enabled merely because base URLs exist. Their environment must be explicitly configured, and destructive financial actions require user confirmation.

The Postman artifacts and their embedded login values remain outside the repository. The app must never contain a bundled default username, password, account token, secret key, bearer, portal cookie, or order fingerprint.

## Architecture

### Existing external seam

`WaveXBackend` remains the single interface used by screens and tests. `createMockBackend()` and `createLiveBackend()` remain its two adapters. The live adapter hides transport-specific behavior and returns only domain types from `src/data/types.ts`.

The interface is extended only where an existing screen needs behavior that cannot be represented today. Pagination and refresh metadata stay internal until a screen needs them. This keeps the module deep: callers learn a small domain interface while authentication, envelopes, stringified JSON, cookies, coercion, and legacy parameter names stay in the implementation.

### Authentication and app bootstrap

Add a session module above `WaveXBackend` with these states:

- `restoring`: secure storage is being checked.
- `signed-out`: show the login flow.
- `verification-required`: show verification guidance and resend actions.
- `signed-in`: show the existing application navigator.
- `maintenance`: show a retryable maintenance state.

The login screen accepts an email or account number and password. The password exists only for the duration of `session.signIn()` and is never written to Zustand, React persistence, logs, analytics, or secure storage.

Successful sign-in performs the existing `check` then `bearer` handshake, stores only `SessionMaterial` through `expo-secure-store`, establishes the portal cookie through `setPortalSession`, and loads the portal bootstrap. Launch restoration validates or refreshes the trading bearer before rendering account data. Logout clears trading session material, portal cookies, cached domain data, and selected-account state.

### Transport adapters

Keep the current adapters:

- `TradingApiAdapter`: form/query encoding, the custom `Bearer` and `Secretkey` headers, raw bearer responses, trading-envelope interpretation, and token refresh.
- `ClientPortalAdapter`: `Origin`, `ci_session`, `X-Portal-Token`, JSON/form/multipart encoding, and read-only replay after portal-session expiry.
- `Gate`: HTTPS enforcement, phase rules, denied routes, exact parameter allowlists, timeouts, no automatic retries, and duplicate mutation suppression.

Do not add a generated OpenAPI client. The contract cannot accurately model stringified JSON payloads, raw bearer responses, the cookie bootstrap, business failures returned as HTTP 200, or the still-unconfirmed mutation responses.

### Response schemas and mappers

Add focused schema/mapper modules owned by each transport. Every external response crosses a Zod schema before it reaches the domain model.

Mappers perform:

- numeric-string coercion with finite-number validation;
- JSON parsing for string-valued `data` fields;
- normalization of symbols into stable instrument IDs;
- conversion of order-side/status codes into domain unions;
- account and profile aggregation from trading account data plus portal bootstrap;
- date/time normalization without changing the server's financial amounts;
- safe defaults only for presentation metadata, never balances, prices, lots, or order states.

Malformed financial data produces `BackendError('malformed')`; it never silently becomes zero. Zero defaults are allowed only when the server explicitly omits a documented count.

### Screen migration

Migrate screens by domain slice so every step remains reviewable:

1. Authentication and session gate.
2. Home, account, account switcher, profile, and balance.
3. Markets, instrument picker, instrument detail, and charts.
4. Positions, activity, trade, and order ticket.
5. Funding and notifications.

Each screen uses `useBackendQuery()` for reads and explicit `useBackend()` event handlers for mutations. Loading, empty, error, maintenance, and signed-out states are first-class UI states. No screen imports `src/data/mock.ts` after its slice is migrated.

The current Zustand store may retain UI-only state such as selected tab, selected instrument, and optimistic favorite appearance. Server-owned balances, accounts, positions, KYC state, funding methods, and notifications are not persisted as authoritative Zustand data.

### Market data behavior

Build the catalogue by joining the market-watch response with symbol metadata. REST snapshot endpoints populate last-known bid, ask, price, and daily change when their live response schema is captured during implementation. Chart bars feed the existing `ChartSeries` mapper.

Until a quote-stream contract is supplied:

- snapshot reads may refresh while a relevant screen is active;
- refreshes stop when the app or screen is inactive;
- snapshots are never described as live ticks;
- no made-up interpolation or fixture price is mixed into a live account session.

If a required price field is unavailable, the UI renders an explicit unavailable state rather than a fixture value.

### Mutations

Mutation methods are implemented against the endpoint registry but enabled only at their configured phase. Every mutation accepts or derives one idempotency key for one user intent. The gate memoizes the outcome for the duplicate window.

Trading mutations first obtain the per-account order `fingerprint`, which is distinct from the login `footprint`. Network failures after dispatch return an `unconfirmed` result and are never retried automatically. A 401 may refresh and replay reads only; mutations are never replayed.

Financial confirmation screens show account, instrument or method, amount/lots, price type, and the irreversible action. Disabled phases use the existing action-menu pattern to explain what configuration is missing, satisfying the repository's no-dead-taps rule.

## Configuration

Non-secret public configuration remains in Expo environment variables:

- `EXPO_PUBLIC_WAVEX_TRADING_URL`
- `EXPO_PUBLIC_WAVEX_PORTAL_URL`
- `EXPO_PUBLIC_WAVEX_PORTAL_ORIGIN`
- `EXPO_PUBLIC_WAVEX_CHARTING_URL`
- `EXPO_PUBLIC_WAVEX_PHASE`

Credentials are user-entered or provisioned out of band and stored only as session material in the platform keychain/keystore. `.env*.local`, Postman collections, and Postman environments remain gitignored.

The mock backend remains the default when required live configuration is absent. A live-configured build must never fall back to mock data after an authentication or network failure; it shows the real error state.

## Error handling

- Trading HTTP 200 responses inspect the envelope `status`; `fail` and `error` are failures.
- Trading 401 refreshes the bearer once for reads. A second 401 signs out.
- Portal 401 re-establishes `ci_session` and replays reads once. Mutations return unconfirmed or failed according to dispatch state.
- Portal 503 or maintenance envelopes enter the maintenance state.
- Timeouts and offline failures use stable user copy from `userMessageFor()`.
- Server messages remain diagnostic and are redacted before logging.
- App-background transitions cancel or ignore stale query completions.
- Account switches invalidate all account-scoped queries before new results render.

## Testing and verification

Tests use captured, redacted fixtures containing field names and representative types but no real credentials, names, contact details, balances, or tokens.

Required coverage:

- schema acceptance for every captured response and rejection for malformed money/order fields;
- sign-in, restore, refresh, verification-required, sign-out, and password non-persistence;
- portal cookie establishment and read-only replay behavior;
- account aggregation and account-switch cache invalidation;
- market catalogue/spread joins and unavailable-price behavior;
- position, history, funding, and notification mapping;
- phase rejection, duplicate idempotency keys, mutation non-retry, and unconfirmed outcomes;
- screen loading, empty, error, maintenance, signed-out, and ready states;
- a repository check that migrated screens do not import `src/data/mock.ts`.

Before completion run:

```bash
npx expo lint
npx tsc --noEmit
npm test
npx expo-doctor
```

Also run an iOS and Android Metro export or development build appropriate to the native dependencies, and manually verify sign-in/session restoration on a physical phone.

## Rollout

Ship vertical slices with the live adapter opt-in. First enable phase 1 on the supplied test account and verify read-only behavior. Enable phases 2 and 3 only after staging/test mutation captures exist for success, business failure, authentication failure, timeout-after-dispatch, and duplicate submission.

## Explicit non-goals

- Inventing a WebSocket or polling contract for live ticks.
- Presenting Trading Signals as backend-provided data; no confirmed endpoint exists.
- Adding new MAM/PAMM or referral screens in this integration.
- Persisting passwords or embedding the supplied Postman credentials.
- Enabling real-money production mutations without a separately authorized environment.
