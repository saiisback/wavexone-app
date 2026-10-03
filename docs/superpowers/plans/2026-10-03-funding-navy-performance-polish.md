# Funding, Navy UI, and Performance Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable the existing funding flows, make repeat navigation materially faster, and finish the app with a coherent navy visual system and recognizable instrument marks.

**Architecture:** Preserve the current backend seam and React Navigation structure. Harden the financial mutations at the adapter/screen boundary, retain completed read promises for a bounded freshness window in the query provider, and express visual changes through shared design-system tokens and components so every screen inherits the same treatment.

**Tech Stack:** Expo SDK 57, React Native, React Navigation, Zustand, react-native-svg, expo-image, Jest, react-test-renderer.

**Spec:** `docs/superpowers/specs/2026-10-03-funding-navy-performance-polish-design.md`

## Global Constraints

- Use `#1E2A5E` as the primary dark/action color while preserving a light canvas and white elevated surfaces.
- Gold remains reserved for important financial actions, verification, and selected emphasis.
- All account, balance, quote, market, and funding values remain server-owned; no fixture data enters live paths.
- Network access remains behind `useBackend()` / `useBackendQuery()` and `src/backend/http.ts` remains the only direct `fetch`.
- Every mutation receives one idempotency key per confirmed user intent and is never automatically retried.
- Automated and agent verification must not submit a real deposit, withdrawal, transfer, or order.
- Preserve existing uncommitted user work. Do not commit unless the user explicitly asks.
- Use `npx` commands because this checkout has no `bun.lock`.

## Review Focus

- A transfer with fewer than two accounts must explain why it is unavailable and never submit source and destination as the same account.
- A withdrawal OTP success must progress to OTP entry without creating a second unconfirmed withdrawal intent.
- A mutation with an ambiguous network failure must stay disabled until its promise settles and must not invite an unsafe retry.
- Cached data must never cross account-specific query keys and explicit invalidation must force a fresh request immediately.
- Unknown or exchange-suffixed symbols must render a stable fallback mark without blank images, list jumps, or third-party requests.

---

### Task 1: Bounded Query Retention and Loading Skeletons

**Files:**
- Modify: `src/backend/provider.tsx:10-150`
- Modify: `src/features/shared/query-state.tsx:1-80`
- Modify: `src/design-system/colors.ts`
- Test: `tests/backend/provider.test.tsx`
- Test: `tests/screens/live-data-screens.test.tsx`

**Interfaces:**
- Consumes: semantic query keys and `useInvalidateQueries(...prefixes)`.
- Produces: completed-query retention for a fixed freshness window, immediate explicit invalidation, and a reusable content-shaped loading state.

- [ ] **Step 1: Replace the existing unmount test with red tests for bounded retention**

  Add tests named `retains a completed query across a short unmount and remount`, `explicit invalidation bypasses retained data`, `does not share retained data across query keys`, and `does not retain a rejected read as fresh data`. Assert exact read call counts.

- [ ] **Step 2: Run the provider tests and verify the retention test fails**

  Run: `npm test -- --runInBand tests/backend/provider.test.tsx`

  Expected: the remount test reports two reads instead of one.

- [ ] **Step 3: Implement bounded completed-query retention in `BackendProvider`**

  Extend each query entry with settlement/freshness metadata, retain successful completed promises for 30 seconds after the last consumer unmounts, evict failed reads, and preserve the current prefix invalidation behavior. Keep account isolation entirely key-based.

- [ ] **Step 4: Read the Impeccable craft floor before the first UI edit**

  Read: `/Users/saikarthik/.agents/skills/impeccable/reference/craft-floor.md`

- [ ] **Step 5: Add the shared navy skeleton loading primitive**

  Replace the primary centered spinner presentation in `QueryStateView` with stable rounded skeleton blocks using shared colors and dimensions. Preserve the `Loading` accessibility label and error/empty behavior.

- [ ] **Step 6: Run provider and screen-state tests**

  Run: `npm test -- --runInBand tests/backend/provider.test.tsx tests/screens/live-data-screens.test.tsx`

  Expected: PASS with no React warnings.

### Task 2: Verified Funding Enablement and Progressive Submission UX

**Files:**
- Modify: `.env.local`
- Modify: `src/screens/funding-screen.tsx:28-280`
- Modify: `src/backend/adapters/client-portal.ts:95-220` only if a red contract test exposes a mismatch
- Modify: `src/backend/live-backend.ts:500-565` only if a red domain test exposes a mismatch
- Test: `tests/backend/client-portal.test.ts`
- Test: `tests/backend/live-backend.test.ts`
- Test: `tests/screens/live-data-screens.test.tsx`

**Interfaces:**
- Consumes: existing `funds.configuration`, `deposit`, `sendWithdrawalOtp`, `requestWithdrawal`, and `transfer` contracts.
- Produces: enabled local Phase 3 funding, `idle | submitting | awaitingOtp | succeeded` screen state, and one guarded submission per confirmation.

- [ ] **Step 1: Add red adapter tests for every supplied funding request contract**

  Assert multipart deposit keys, JSON withdrawal OTP/submission keys, JSON transfer keys, form-encoded demo deposit, `credentials: include`, approved Origin, and one request per idempotency key.

- [ ] **Step 2: Add red funding-screen behavior tests**

  Cover disabled invalid amounts, missing funding methods, one-account transfer, different source/destination enforcement, double-tap suppression while submitting, OTP progression, and reviewed failure copy.

- [ ] **Step 3: Run the focused funding tests and verify failures describe missing UI state or contract mismatches**

  Run: `npm test -- --runInBand tests/backend/client-portal.test.ts tests/backend/live-backend.test.ts tests/screens/live-data-screens.test.tsx`

- [ ] **Step 4: Enable Phase 3 locally and implement the minimal progressive flow**

  Set `EXPO_PUBLIC_WAVEX_PHASE=3` in `.env.local`. Add explicit submitting state, disable all mutation controls during submission, convert successful OTP delivery into an inline OTP step, prevent same-account transfer, and show an unavailable state when configuration supplies no valid methods.

- [ ] **Step 5: Fix only contract mismatches proven by Step 1**

  Keep request methods, encodings, and field names exactly aligned to the supplied collection. Do not broaden phase access or add mutation retries.

- [ ] **Step 6: Run focused funding tests**

  Run: `npm test -- --runInBand tests/backend/client-portal.test.ts tests/backend/live-backend.test.ts tests/screens/live-data-screens.test.tsx`

  Expected: PASS; fetch mocks prove no real network call occurs.

### Task 3: Navy Design System and Instrument Marks

**Files:**
- Modify: `src/design-system/colors.ts`
- Modify: `src/design-system/asset-icon.tsx`
- Modify: `src/design-system/button.tsx`
- Modify: `src/design-system/card.tsx`
- Modify: `src/design-system/field.tsx`
- Modify: `src/design-system/list-row.tsx`
- Modify: `src/navigation/tab-bar.tsx`
- Modify: `src/screens/home-screen.tsx`
- Modify: `src/screens/balance-screen.tsx`
- Modify: `src/screens/funding-screen.tsx`
- Modify: `src/screens/account-switcher-screen.tsx`
- Modify: `src/backend/live-backend.ts:619-626`
- Test: `tests/features/market-row.test.tsx`
- Test: `tests/backend/live-backend.test.ts`
- Test: `tests/screens/live-data-screens.test.tsx`

**Interfaces:**
- Consumes: server `ticker`, `name`, and category plus existing `AssetIconKind` metadata.
- Produces: semantic navy tokens, consistent shared component states, normalized ticker-to-mark resolution, bundled stock marks, and a deterministic monogram fallback.

- [ ] **Step 1: Add red icon-resolution and rendering tests**

  Assert that `AAPL.OQ`, `TSLA`, `NVDA`, `MSFT`, `AMZN`, `META`, `GOOGL`, and `NFLX` resolve to their bundled mark kinds; existing BTC/ETH/XAU/XAG/EUR/OIL mappings remain intact; and an unknown ticker renders a non-empty monogram fallback.

- [ ] **Step 2: Run the icon tests and verify stock cases fail as generic**

  Run: `npm test -- --runInBand tests/features/market-row.test.tsx tests/backend/live-backend.test.ts`

- [ ] **Step 3: Extend `AssetIcon` with local vector stock marks and normalized matching**

  Add only bundled `react-native-svg` artwork—no third-party image requests. Strip exchange prefixes/suffixes before matching while retaining the original server symbol for display and IDs.

- [ ] **Step 4: Apply the semantic navy palette through shared components**

  Remap `ink`, primary text, dark surfaces, navigation selection, and filled controls to navy roles; add only the pale navy tokens required for selected, focused, and skeleton states. Preserve green/red semantic colors and verified contrast.

- [ ] **Step 5: Polish affected screens using the shared vocabulary**

  Normalize card padding/radii, section spacing, account pills, funding hierarchy, action-row alignment, and tab selection. Do not introduce screen-local hex colors or replace native menus/sheets.

- [ ] **Step 6: Run market and screen tests**

  Run: `npm test -- --runInBand tests/features/market-row.test.tsx tests/backend/live-backend.test.ts tests/screens/live-data-screens.test.tsx`

  Expected: PASS with stable accessibility labels.

### Task 4: Native Visual QA and Release Verification

**Files:**
- Modify: only files already touched above when the bounded visual pass finds a concrete defect
- Verify: all changed source and test files

**Interfaces:**
- Consumes: completed Tasks 1–3.
- Produces: a verified phone-size implementation and a concise handoff for the user-operated transaction test.

- [ ] **Step 1: Run the full static and automated verification suite**

  Run: `npx tsc --noEmit`

  Run: `npx expo lint`

  Run: `npm test -- --runInBand`

  Run: `git diff --check`

  Expected: every command exits 0.

- [ ] **Step 2: Run the Impeccable detector once over changed UI targets**

  Run: `/Users/saikarthik/.agents/skills/impeccable/scripts/impeccable detect --json src/design-system src/navigation/tab-bar.tsx src/screens/home-screen.tsx src/screens/balance-screen.tsx src/screens/funding-screen.tsx src/screens/account-switcher-screen.tsx`

  Fix all actionable findings in one batch.

- [ ] **Step 3: Inspect one representative phone-size simulator pass**

  Check Home, Balance, Markets, account switcher, Deposit, Withdraw before/after OTP state, and Transfer. Verify safe areas, keyboard avoidance, long account labels, unknown-symbol fallback, loading skeletons, disabled/submitting controls, and no runtime warnings. Fix concrete defects in one batch and perform at most one confirmation pass.

- [ ] **Step 4: Re-run verification after visual fixes**

  Run: `npx tsc --noEmit && npx expo lint && npm test -- --runInBand && git diff --check`

  Expected: all commands exit 0.

- [ ] **Step 5: Hand off the user-operated funding test**

  Tell the user exactly which account, amount, method, destination, and confirmation screen to review, without requesting credentials or initiating the mutation. Report that no commit was created.
