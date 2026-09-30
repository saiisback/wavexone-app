# WaveXOne Live Backend Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace fixture-backed application behavior with the authenticated WaveXOne trading and client-portal APIs while preserving safe phase gates for financial mutations.

**Architecture:** Keep `WaveXBackend` as the external seam and deepen its live adapter with strict response parsers, transport-specific adapters, an in-memory bootstrap cache, and secure session restoration. Add an app-level session provider that chooses sign-in or the existing navigator, then migrate screens by domain slice from fixtures to `useBackendQuery()` and explicit mutation handlers.

**Tech Stack:** Expo SDK 57, React Native 0.86, React 19, TypeScript, React Navigation, Zustand, Zod, Expo SecureStore, Jest, react-test-renderer.

**Spec:** `docs/superpowers/specs/2026-09-30-live-backend-integration-design.md`

## Global Constraints

- Use Node 22.13.x or newer; Expo SDK 57 does not support the repository's currently active Node 22.12.0.
- Before changing an Expo or React Native API, read the matching SDK 57 documentation and the linked page from `https://docs.expo.dev/llms.txt`.
- Screens import `Text`, `Pressable`, fields, and image primitives only through `src/design-system`.
- Screens call `WaveXBackend`; no screen imports endpoint names, transport adapters, `fetch`, or Postman artifacts.
- `src/backend/http.ts` remains the only application `fetch` call.
- Never log URLs, request/response bodies, passwords, tokens, secret keys, cookies, fingerprints, contact details, or account values.
- The password is never stored after `session.signIn()` returns.
- Reads may refresh/re-establish a session once; mutations are never replayed automatically.
- Every mutation carries one idempotency key per user intent and remains phase-gated.
- No live build silently falls back to fixture values after a network, authentication, or parsing failure.
- REST-derived prices are labeled snapshots; no UI claims streaming or `<50ms` execution.
- The supplied Postman files remain outside Git and their values never appear in tests or committed fixtures.

## Review Focus

- A sign-in response echoes the password: `tests/backend/trading-responses.test.ts` and `tests/backend/session-provider.test.tsx` must prove it is neither returned, stored, nor logged.
- An account switch can race old requests: `tests/backend/live-backend.test.ts` must prove old account-scoped results cannot become the selected account's data.
- Several payloads contain numeric strings or JSON encoded inside strings: parser tests must accept valid coercions and reject non-finite money, lots, prices, and unknown order states.
- A mutation can time out after the server acted: gate/adapter tests must prove no auth refresh or retry replays it and that duplicate idempotency keys share one outcome.
- Live ticks are unavailable: market tests and screen tests must prove missing snapshots render unavailable states and never fixture prices.

## File Structure

### Create

- `.nvmrc` — supported local Node version.
- `src/backend/responses/trading.ts` — Zod schemas and mappers for trading responses.
- `src/backend/responses/portal.ts` — Zod schemas and mappers for portal responses.
- `src/backend/session-provider.tsx` — restore/sign-in/sign-out state machine.
- `src/features/shared/query-state.tsx` — reusable loading, empty, error, and unavailable presentation.
- `src/screens/sign-in-screen.tsx` — credential entry through design-system primitives.
- `tests/backend/fixtures/trading-responses.ts` — synthetic, redacted response fixtures.
- `tests/backend/fixtures/portal-responses.ts` — synthetic, redacted response fixtures.
- `tests/backend/trading-responses.test.ts` — trading parser tests.
- `tests/backend/portal-responses.test.ts` — portal parser tests.
- `tests/backend/session-provider.test.tsx` — application-session state tests.
- `tests/screens/live-data-screens.test.tsx` — critical screen-state regression tests.

### Modify

- `src/backend/contract.ts` — confirmed domain request/result types and mutation intent identifiers.
- `src/backend/adapters/trading-api.ts` — confirmed sign-in aliases plus read/mutation methods.
- `src/backend/adapters/client-portal.ts` — typed portal reads/mutations and session recovery.
- `src/backend/live-backend.ts` — implement the interface, cache bootstrap data, invalidate by account/session.
- `src/backend/mock-backend.ts` — satisfy the evolved interface without pretending mutations succeed.
- `src/backend/provider.tsx` — refreshable query keys and explicit invalidation support where required.
- `src/backend/endpoints.ts` — align phase declarations with the approved safety boundary.
- `src/backend/http.ts` — support confirmed multipart values without weakening redaction.
- `src/data/store.ts` — retain UI-only selections/optimistic sets; remove authoritative fixture imports.
- `App.tsx` and `src/navigation/root-navigator.tsx` — install the session gate.
- All files in `src/screens/` that currently import `src/data/mock.ts` — migrate each domain slice.
- Existing `tests/backend/*.test.ts(x)` — extend adapter, gate, provider, and live-backend coverage.
- `src/backend/README.md` and `docs/RESPONSE-CAPTURES.md` — record implemented shapes and remaining mutation/live-tick gaps.

---

### Task 1: Redacted Response Fixtures and Strict Parsers

**Files:**
- Create: `.nvmrc`
- Create: `tests/backend/fixtures/trading-responses.ts`
- Create: `tests/backend/fixtures/portal-responses.ts`
- Create: `tests/backend/trading-responses.test.ts`
- Create: `tests/backend/portal-responses.test.ts`
- Create: `src/backend/responses/trading.ts`
- Create: `src/backend/responses/portal.ts`

**Interfaces:**
- Produces: `parseCheckedSession(value: unknown): CheckedSession`
- Produces: `parseTradingAccounts(value: unknown): readonly TradingAccountRecord[]`
- Produces: `parseOrderCounts(value: unknown): OrderCounts`
- Produces: `parseMarketCatalogue(value: unknown): readonly MarketRecord[]`
- Produces: `parseSymbolMetadata(value: unknown): ReadonlyMap<string, SymbolMetadata>`
- Produces: `parseFavoriteIds(value: unknown): readonly string[]`
- Produces: `parseOpenPositions(value: unknown): readonly Position[]`
- Produces: `parseClosedHistory(value: unknown): readonly Position[]`
- Produces: `parsePortalBootstrap(value: unknown): PortalBootstrap`
- Produces: `parseFundingConfiguration(value: unknown): FundingConfiguration`
- Produces: `parseNotifications(value: unknown): NotificationsResult`

- [ ] **Step 1: Add synthetic fixtures with the confirmed field names and representative dummy values**

Use fake tokens, contacts, balances, IDs, and symbols. Include numeric strings, stringified JSON, an empty history page, and one open/pending/closed order.

- [ ] **Step 2: Write failing parser tests**

Assert valid mapping and rejection of `NaN`, `Infinity`, absent session fields, malformed stringified JSON, and unknown order-side/status values. Assert `parseCheckedSession()` contains no password field even when the input echoes one.

- [ ] **Step 3: Run the parser tests and verify RED**

Run: `npx --yes node@22.13.1 node_modules/jest/bin/jest.js tests/backend/trading-responses.test.ts tests/backend/portal-responses.test.ts --runInBand`

Expected: FAIL because the response modules do not exist.

- [ ] **Step 4: Implement the parser interfaces with Zod**

Keep transport records internal. Return domain types where the response alone is sufficient; return narrow internal records where `live-backend.ts` must join trading and portal data.

- [ ] **Step 5: Run parser tests and the backend test suite**

Run: `npx --yes node@22.13.1 node_modules/jest/bin/jest.js tests/backend --runInBand`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add .nvmrc src/backend/responses tests/backend/fixtures tests/backend/trading-responses.test.ts tests/backend/portal-responses.test.ts
git commit -m "feat: parse live backend responses"
```

### Task 2: Authenticated Session and Portal Bootstrap

**Files:**
- Modify: `src/backend/adapters/trading-api.ts`
- Modify: `src/backend/adapters/client-portal.ts`
- Modify: `src/backend/live-backend.ts`
- Modify: `src/backend/secure-session-store.ts`
- Modify: `tests/backend/trading-api.test.ts`
- Modify: `tests/backend/client-portal.test.ts`
- Modify: `tests/backend/live-backend.test.ts`

**Interfaces:**
- Consumes: `parseCheckedSession`, `parsePortalBootstrap`
- Produces: existing `WaveXBackend.session` behavior with portal establishment
- Produces internally: `readBootstrap(): Promise<PortalBootstrap>` and `invalidateSessionData(): void`

- [ ] **Step 1: Add failing authentication tests for the confirmed live response**

Cover `verify`, `secret_key`, server-returned footprint, echoed password removal, raw bearer text, portal establishment immediately after sign-in, and portal re-establishment after restore.

- [ ] **Step 2: Add failing cache invalidation tests**

Assert sign-out clears session material, portal state, bootstrap cache, selected account data, and order fingerprints.

- [ ] **Step 3: Run focused tests and verify RED**

Run: `npx --yes node@22.13.1 node_modules/jest/bin/jest.js tests/backend/trading-api.test.ts tests/backend/client-portal.test.ts tests/backend/live-backend.test.ts --runInBand`

- [ ] **Step 4: Implement confirmed authentication parsing and portal bootstrap caching**

Do not persist portal payloads or passwords. Cache bootstrap only in the live backend instance and invalidate it on sign-out or account switch.

- [ ] **Step 5: Run focused and full backend tests**

Expected: PASS with no credential value in snapshots or output.

- [ ] **Step 6: Commit**

```bash
git add src/backend/adapters src/backend/live-backend.ts src/backend/secure-session-store.ts tests/backend
git commit -m "feat: complete live session bootstrap"
```

### Task 3: Application Session Gate and Sign-In Screen

**Files:**
- Create: `src/backend/session-provider.tsx`
- Create: `src/features/shared/query-state.tsx`
- Create: `src/screens/sign-in-screen.tsx`
- Create: `tests/backend/session-provider.test.tsx`
- Modify: `App.tsx`
- Modify: `src/navigation/root-navigator.tsx`
- Modify: `src/screens/account-screen.tsx`

**Interfaces:**
- Produces: `AppSessionState = 'restoring' | 'signed-out' | 'verification-required' | 'signed-in' | 'maintenance'`
- Produces: `useAppSession(): { state; error; signIn(identifier, password); signOut(); retryRestore() }`
- Produces: `QueryStateView` for consistent loading, empty, error, and unavailable UI

- [ ] **Step 1: Write failing state-machine tests**

Cover restore success/failure, sign-in success, verification-required, reviewed error copy, maintenance, logout, and the guarantee that a password is absent from provider state after success and failure.

- [ ] **Step 2: Run the session-provider test and verify RED**

- [ ] **Step 3: Implement `SessionProvider` and `SignInScreen`**

The screen uses `Field`, `Button`, `Text`, and other design-system exports. Disable duplicate submissions, use a secure password field, and provide accessible labels.

- [ ] **Step 4: Gate navigation in `App.tsx`**

Render a stable restoring state before deciding between sign-in and `RootNavigator`. Wire the existing account logout control to `useAppSession().signOut()`.

- [ ] **Step 5: Run session tests, lint, and typecheck**

Run: `npx --yes node@22.13.1 node_modules/jest/bin/jest.js tests/backend/session-provider.test.tsx --runInBand`

Run: `npx --yes node@22.13.1 node_modules/expo/bin/cli lint`

Run: `npx --yes node@22.13.1 node_modules/typescript/bin/tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add App.tsx src/backend/session-provider.tsx src/features/shared/query-state.tsx src/screens/sign-in-screen.tsx src/navigation/root-navigator.tsx src/screens/account-screen.tsx tests/backend/session-provider.test.tsx
git commit -m "feat: add secure sign-in flow"
```

### Task 4: Accounts, Profile, Selection, and Dashboard

**Files:**
- Modify: `src/backend/contract.ts`
- Modify: `src/backend/live-backend.ts`
- Modify: `src/backend/mock-backend.ts`
- Modify: `src/data/store.ts`
- Modify: `src/screens/home-screen.tsx`
- Modify: `src/screens/account-screen.tsx`
- Modify: `src/screens/account-switcher-screen.tsx`
- Modify: `src/screens/profile-screen.tsx`
- Modify: `src/screens/balance-screen.tsx`
- Modify: `tests/backend/live-backend.test.ts`
- Modify: `tests/screens/live-data-screens.test.tsx`

**Interfaces:**
- Consumes: trading account records and `PortalBootstrap`
- Produces: `accounts.list()`, `accounts.summary(accountId)`, `accounts.profile()`
- Changes: `accounts.switchAccount(request: { accountId: string; idempotencyKey: string }): Promise<void>`
- Store produces UI-only `accountId: string | null` and `selectAccount(accountId)`

- [ ] **Step 1: Write failing account aggregation and switch-race tests**

Assert trading balances join portal leverage/equity data by account ID, no missing monetary field silently becomes zero, and a late result from the old account is not rendered after switching.

- [ ] **Step 2: Write failing screen-state tests**

Cover loading, empty, malformed/error, and ready dashboard/account states using an injected backend.

- [ ] **Step 3: Implement account/profile methods and selection invalidation**

Use portal summary values only when their account association is unambiguous. Session-switch endpoints update both transports or fail without changing local selection.

- [ ] **Step 4: Migrate the five account-facing screens**

Remove their `src/data/mock.ts` imports. Query keys include the selected account ID. Keep settings and market-period choices in Zustand because they are UI-owned.

- [ ] **Step 5: Run account/backend/screen tests, lint, and typecheck**

- [ ] **Step 6: Commit**

```bash
git add src/backend src/data/store.ts src/screens/home-screen.tsx src/screens/account-screen.tsx src/screens/account-switcher-screen.tsx src/screens/profile-screen.tsx src/screens/balance-screen.tsx tests
git commit -m "feat: connect live account data"
```

### Task 5: Markets, Favorites, Price Snapshots, and Charts

**Files:**
- Modify: `src/backend/contract.ts`
- Modify: `src/backend/adapters/trading-api.ts`
- Modify: `src/backend/live-backend.ts`
- Modify: `src/data/store.ts`
- Modify: `src/data/trade-draft.ts`
- Modify: `src/screens/markets-screen.tsx`
- Modify: `src/screens/balance-screen.tsx`
- Modify: `src/screens/instrument-picker-screen.tsx`
- Modify: `src/screens/instrument-screen.tsx`
- Modify: `src/screens/trade-screen.tsx`
- Modify: `src/screens/order-ticket-screen.tsx`
- Modify: `tests/backend/live-backend.test.ts`
- Modify: `tests/screens/live-data-screens.test.tsx`

**Interfaces:**
- Produces: existing `markets.catalogue()`, `markets.favorites()`, `markets.quoteSnapshot(ids)`, and `markets.candles(id, timeframe)`
- Changes: `markets.setFavorite(request: { instrumentId: string; favorite: boolean; idempotencyKey: string }): Promise<void>`

- [ ] **Step 1: Capture only the structural shape of `getCurrentDayData` and chart history using the supplied test account**

Do not commit the raw response. Extend synthetic fixtures with the confirmed field names and types.

- [ ] **Step 2: Write failing joins and unavailable-price tests**

Assert catalogue + metadata + snapshot joining, symbol normalization, precision validation, stringified favorites, chart timeframe mapping, and explicit unavailable data when a snapshot field is absent.

- [ ] **Step 3: Implement market methods and active-screen refresh behavior**

Do not create a background retry loop. Refresh snapshots only while the relevant screen is active, and stop on unmount/background.

- [ ] **Step 4: Migrate market/trade screens and trade draft lookups**

Rows keep per-row optimistic favorite selectors, then reconcile with the server outcome. A rejected favorite mutation rolls the row back and shows reviewed copy.

- [ ] **Step 5: Run parser, live-backend, screen, lint, and typecheck checks**

- [ ] **Step 6: Commit**

```bash
git add src/backend src/data src/screens tests
git commit -m "feat: connect live market data"
```

### Task 6: Positions and Activity

**Files:**
- Modify: `src/backend/adapters/trading-api.ts`
- Modify: `src/backend/live-backend.ts`
- Modify: `src/screens/positions-screen.tsx`
- Modify: `src/screens/activity-screen.tsx`
- Modify: `tests/backend/live-backend.test.ts`
- Modify: `tests/screens/live-data-screens.test.tsx`

**Interfaces:**
- Produces: existing `orders.counts(accountId)`, `orders.list(accountId)`, `orders.history(accountId)`, and `funds.history(accountId)`

- [ ] **Step 1: Write failing order/history mapper tests**

Assert open vs pending states, side codes, lot/price/PnL coercion, pagination metadata, empty history, and unknown-state rejection.

- [ ] **Step 2: Implement the read methods**

Join position symbols to instrument IDs without importing fixtures. Combine portal transactions and trading funding history into normalized `ActivityEntry` values without double counting.

- [ ] **Step 3: Migrate positions and activity screens**

Use account-scoped query keys and explicit empty states. Never show positions from the previous account while a new request is loading.

- [ ] **Step 4: Run focused and full tests**

- [ ] **Step 5: Commit**

```bash
git add src/backend src/screens/positions-screen.tsx src/screens/activity-screen.tsx tests
git commit -m "feat: connect positions and activity"
```

### Task 7: Funding Configuration and Notifications

**Files:**
- Modify: `src/backend/contract.ts`
- Modify: `src/backend/adapters/client-portal.ts`
- Modify: `src/backend/live-backend.ts`
- Modify: `src/data/store.ts`
- Modify: `src/screens/funding-screen.tsx`
- Modify: `src/screens/notifications-screen.tsx`
- Modify: `tests/backend/live-backend.test.ts`
- Modify: `tests/screens/live-data-screens.test.tsx`

**Interfaces:**
- Produces: richer `FundingMethod`, `FundingField`, and `FundingConfiguration` domain types
- Produces: `funds.configuration(accountId)`, `engagement.notifications()`
- Changes: `engagement.markNotificationsRead(request: { ids: readonly string[]; idempotencyKey: string }): Promise<void>`

- [ ] **Step 1: Write failing funding/notification tests**

Cover minimum amounts, KYC, available funds, withdrawal limits, empty saved destinations, notification type mapping, unread count, and read-state rollback.

- [ ] **Step 2: Implement portal reads and mappings**

Keep payment-method implementation fields in domain-safe structures; do not expose raw portal objects to screens.

- [ ] **Step 3: Migrate funding and notification screens**

Render server-provided methods and limits. Notification read state is optimistic UI state reconciled with `markNotificationsRead()`.

- [ ] **Step 4: Run focused and full tests**

- [ ] **Step 5: Commit**

```bash
git add src/backend src/data/store.ts src/screens/funding-screen.tsx src/screens/notifications-screen.tsx tests
git commit -m "feat: connect funding and notifications"
```

### Task 8: Phase-Gated Trading Mutations

**Files:**
- Modify: `src/backend/adapters/trading-api.ts`
- Modify: `src/backend/live-backend.ts`
- Modify: `src/screens/order-ticket-screen.tsx`
- Modify: `src/screens/positions-screen.tsx`
- Modify: `tests/backend/trading-api.test.ts`
- Modify: `tests/backend/live-backend.test.ts`
- Modify: `tests/backend/gate.test.ts`

**Interfaces:**
- Consumes: existing `PlaceOrderRequest`, `ModifyOrderRequest`, `CloseOrderRequest`
- Produces: `orders.place`, `orders.modify`, `orders.cancel`, and `orders.close`

- [ ] **Step 1: Write failing request-shape and safety tests**

Assert market/limit parameter names, pending/open modification endpoints, per-account fingerprint acquisition, phase rejection, duplicate-key deduplication, business failure, and timeout-after-dispatch as unconfirmed. Assert no 401 refresh replays a mutation.

- [ ] **Step 2: Implement trading mutation adapter methods**

Use exact decimal strings and endpoint-registry names. Treat success as an acknowledged envelope only; never infer success from HTTP 200.

- [ ] **Step 3: Wire confirmation handlers**

The order ticket submits one generated idempotency key after user confirmation. Position actions select modify/cancel/close based on server state and invalidate reads only after confirmed success.

- [ ] **Step 4: Run trading, gate, live-backend, lint, and typecheck checks**

- [ ] **Step 5: Commit**

```bash
git add src/backend src/screens/order-ticket-screen.tsx src/screens/positions-screen.tsx tests/backend
git commit -m "feat: add guarded trading mutations"
```

### Task 9: Phase-Gated Funding and Preference Mutations

**Files:**
- Modify: `src/backend/contract.ts`
- Modify: `src/backend/adapters/client-portal.ts`
- Modify: `src/backend/http.ts`
- Modify: `src/backend/live-backend.ts`
- Modify: `src/screens/funding-screen.tsx`
- Modify: `src/screens/markets-screen.tsx`
- Modify: `src/screens/instrument-screen.tsx`
- Modify: `src/screens/notifications-screen.tsx`
- Modify: `tests/backend/client-portal.test.ts`
- Modify: `tests/backend/http.test.ts`
- Modify: `tests/backend/live-backend.test.ts`

**Interfaces:**
- Adds: `funds.sendWithdrawalOtp(request: WithdrawalOtpRequest): Promise<void>`
- Extends: `FundingRequest` with method-specific `details`, optional `otp`, and optional upload metadata
- Produces: `funds.deposit`, `funds.requestWithdrawal`, `funds.transfer`, `markets.setFavorite`, and `engagement.markNotificationsRead`

- [ ] **Step 1: Write failing portal mutation tests**

Cover JSON/form/multipart encoding, optional proof metadata, OTP-before-withdrawal ordering, exact phase gates, no mutation replay after portal 401, reviewed business rejection, and duplicate intent suppression.

- [ ] **Step 2: Implement portal mutation methods and multipart encoding**

Do not add automatic retries. Keep proof optional where the backend permits it; validate size/MIME before dispatch when present.

- [ ] **Step 3: Wire funding and preference controls**

Funding renders method-specific fields and OTP state from configuration. If the configured phase blocks an action, open an action menu explaining the missing staging/authorization requirement rather than rendering an inert control.

- [ ] **Step 4: Run portal/http/live-backend/screen tests**

- [ ] **Step 5: Commit**

```bash
git add src/backend src/screens tests
git commit -m "feat: add guarded portal mutations"
```

### Task 10: Remove Fixture Coupling and Verify the App

**Files:**
- Modify: `src/features/shared/query-state.tsx`
- Modify: remaining `src/screens/*.tsx` fixture imports
- Modify: `src/screens/signals-screen.tsx`
- Modify: `src/backend/README.md`
- Modify: `docs/RESPONSE-CAPTURES.md`
- Modify: `tests/screens/live-data-screens.test.tsx`

**Interfaces:**
- Consumes: `QueryStateView` from Task 3

- [ ] **Step 1: Add a failing fixture-boundary test**

Assert no screen, feature, navigation file, or backend live adapter imports `src/data/mock.ts`. Permit only `mock-backend.ts` and tests to import fixtures. Also assert screens do not directly import `Text`, `Pressable`, `TextInput`, or image components from React Native or third-party packages.

- [ ] **Step 2: Implement shared query states and finish screen cleanup**

Trading Signals renders a clear unavailable state because no confirmed endpoint exists. Preserve local-only settings behavior. Remove any live-session fallback to mock values.

- [ ] **Step 3: Update backend documentation**

Record implemented captures, remaining live-tick gap, phase requirements, environment variables, and the safe procedure for future redacted captures.

- [ ] **Step 4: Run complete verification**

Run:

```bash
npx --yes node@22.13.1 node_modules/expo/bin/cli lint
npx --yes node@22.13.1 node_modules/typescript/bin/tsc --noEmit
npx --yes node@22.13.1 node_modules/jest/bin/jest.js --runInBand
npx expo-doctor
```

Expected: lint/typecheck/tests exit 0; Expo Doctor has no new backend-related failures. Resolve or explicitly report unrelated existing config warnings.

- [ ] **Step 5: Verify native bundles**

Run:

```bash
npx --yes node@22.13.1 node_modules/expo/bin/cli export --platform ios --clear
npx --yes node@22.13.1 node_modules/expo/bin/cli export --platform android --clear
```

Expected: both platforms bundle successfully.

- [ ] **Step 6: Physical-phone acceptance check**

Verify sign-in, restore after restart, account switch, dashboard, markets, instrument chart, positions, activity, funding configuration, notifications, logout, offline handling, and session expiry. Exercise financial mutations only in the explicitly authorized phase/environment.

- [ ] **Step 7: Commit**

```bash
git add src tests docs
git commit -m "feat: finish live backend integration"
```
