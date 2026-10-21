# Reference-Led App Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Carry the approved blue/navy/white/black/gold Home-screen visual language through the remaining WaveXOne screens while preserving all trading behavior.

**Architecture:** Build the redesign into shared page and sheet shells first, then migrate primary tabs, supporting routes, and native route-based sheets. Keep light content surfaces where existing information density needs dark text, and use blue/navy for atmosphere, hierarchy, and summaries rather than globally inverting every component.

**Tech Stack:** Expo SDK 57, React Native 0.86, React Navigation, Zustand, `react-native-svg`, Jest, react-test-renderer.

**Spec:** `docs/superpowers/specs/2026-10-05-reference-led-app-redesign-design.md`

## Global constraints

- Do not copy banking content from the visual reference.
- Preserve current navigation, backend calls, mutations, and screen ownership.
- Gold is the selected/primary highlight; green and red retain financial meaning.
- Use shared colors and tokens, not screen-local hex values.
- Preserve the user's existing uncommitted work and do not commit unless asked.
- Use `npx` because this checkout has no `bun.lock`.

### Task 1: Build the shared reference shell

**Files:**
- Modify: `src/design-system/page-layout.tsx`
- Modify: `src/design-system/sheet.tsx`
- Modify: `src/design-system/colors.ts`
- Modify: `src/design-system/tokens.ts`
- Modify: `src/design-system/index.ts`
- Test: `tests/design-system/page-layout.test.tsx`
- Test: `tests/design-system/sheet.test.tsx`

- [ ] **Step 1: Add failing tests for the new page and sheet hierarchy**

  Assert that the reference page shell renders an atmospheric header, accessible title/actions, and a distinct content surface. Assert that the shared sheet preserves its native route body while exposing the navy heading and selected gold treatment.

- [ ] **Step 2: Run the focused tests and confirm the new assertions fail**

  Run: `npm test -- --runInBand tests/design-system/page-layout.test.tsx tests/design-system/sheet.test.tsx`

- [ ] **Step 3: Implement the shared visual primitives**

  Reuse `HomeAtmosphere`; add reference-aware variants to `PageScreen`, `PageTitle`, `PageBar`, and `Sheet`. Keep safe-area handling, scroll behavior, keyboard avoidance, and accessibility unchanged.

- [ ] **Step 4: Re-run the focused tests**

  Expected: PASS with no renderer warnings.

### Task 2: Redesign the Markets, Trade, and Positions tabs

**Files:**
- Modify: `src/screens/markets-screen.tsx`
- Modify: `src/screens/trade-screen.tsx`
- Modify: `src/screens/positions-screen.tsx`
- Modify: `src/features/market/market-row.tsx` only where shared presentation needs it
- Modify: `src/features/trading/position-card.tsx` only where shared presentation needs it
- Test: `tests/screens/live-data-screens.test.tsx`

- [ ] **Step 1: Add failing screen-structure tests**

  Assert accessible market filters/search, trade quote and order actions, position scope and P&L summary remain present after adopting the reference shell.

- [ ] **Step 2: Run the screen tests and verify the structural assertions fail**

  Run: `npm test -- --runInBand tests/screens/live-data-screens.test.tsx`

- [ ] **Step 3: Implement the primary-tab compositions**

  Give each screen a blue atmospheric opening region, a navy context/summary surface, gold selected state, and readable list or form body. Preserve FlashList behavior, Zustand row selectors, native menus, and navigation destinations.

- [ ] **Step 4: Re-run the screen tests**

  Expected: PASS with unchanged backend call and navigation expectations.

### Task 3: Redesign Account and supporting information screens

**Files:**
- Modify: `src/screens/account-screen.tsx`
- Modify: `src/screens/balance-screen.tsx`
- Modify: `src/screens/activity-screen.tsx`
- Modify: `src/screens/signals-screen.tsx`
- Modify: `src/screens/notifications-screen.tsx`
- Modify: `src/screens/profile-screen.tsx`
- Modify: `src/screens/settings-screen.tsx`
- Modify: `src/screens/instrument-screen.tsx`
- Test: `tests/screens/live-data-screens.test.tsx`
- Test: any existing screen-specific specs under `tests/screens/`

- [ ] **Step 1: Extend tests around user-visible structure and live actions**

  Cover identity/account actions, balance and activity states, signal/notification actions, settings/profile controls, and instrument-detail trading navigation.

- [ ] **Step 2: Run the focused tests and confirm any new assertions fail before implementation**

- [ ] **Step 3: Migrate screens to the shared shell**

  Use blue for the upper identity/context region, navy for summary or grouped action panels, white for dense information, and gold only for the selected or primary control. Do not alter data fetching or route ownership.

- [ ] **Step 4: Re-run all affected screen tests**

  Expected: PASS with no dead taps or inaccessible controls.

### Task 4: Redesign native route-based sheets

**Files:**
- Modify: `src/screens/funding-screen.tsx`
- Modify: `src/screens/order-ticket-screen.tsx`
- Modify: `src/screens/modify-order-screen.tsx`
- Modify: `src/screens/account-switcher-screen.tsx`
- Modify: `src/screens/instrument-picker-screen.tsx`
- Modify: `src/screens/edit-phone-screen.tsx`
- Test: `tests/screens/live-data-screens.test.tsx`
- Test: relevant existing sheet tests under `tests/screens/`

- [ ] **Step 1: Add or extend tests for sheet controls and state transitions**

  Protect funding modes, idempotent submit states, order actions, selection behavior, and phone-edit controls.

- [ ] **Step 2: Apply the shared navy-header/white-body sheet treatment**

  Preserve native presentation, swipe dismissal, keyboard behavior, loading/error states, and confirmations. Use gold for selected methods, focused choices, and primary completion actions.

- [ ] **Step 3: Run the focused sheet tests**

  Expected: PASS; no real transaction or network request is made.

### Task 5: Visual QA and complete verification

**Files:**
- Modify: only previously touched files when visual inspection exposes a concrete defect

- [ ] **Step 1: Run static and automated verification**

  Run: `npx tsc --noEmit`

  Run: `npx expo lint`

  Run: `npm test -- --runInBand`

  Run: `git diff --check`

- [ ] **Step 2: Inspect representative phone-size screens**

  Review Home, Markets, Trade, Positions, Account, Instrument detail, Balance/Activity, and one form sheet at 390x844. Check safe areas, keyboard behavior, text truncation, list performance, selected states, and contrast.

- [ ] **Step 3: Fix concrete visual defects in one bounded pass and re-run verification**

  Expected: every command exits 0 and the screen families visibly share the approved reference language.
