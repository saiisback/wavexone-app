# History, Appearance and Loading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Ship the approved themes and loading feedback, and enable date-wise history only when the backend contract is verified.
**Architecture:** Immutable semantic palettes and a reactive theme provider; existing backend query cache gains same-key refresh metadata; existing mutation controls expose pending state and synchronous intent guards. History remains behind verified backend capabilities.
**Tech Stack:** Expo57, React Native0.86, React19, Zustand, React Navigation, Jest.
**Spec:** ../specs/2026-10-18-history-appearance-loading-design.md

## Global Constraints

- Preserve dirty-worktree changes, native navigation state and backend identity.
- No real trades; no automatic mutation retry; preserve idempotency keys.
- Use design-system primitives, backend seam and SDK57 docs; no hand-edited native projects.
- Never invent older-history filters or substitute open time for close time.

## Review Focus

- Appearance persistence races: latest explicit choice wins and failures are visible.
- System changes affect only System preference; mounted sheets/charts update without remounting navigation.
- Old account or query results cannot appear under a new selection.
- A second confirmation callback cannot send the same financial intent again.
- Refresh failures retain same-key data and provide explicit recovery.

### Task 1: Reactive appearance

- [ ] RED: theme tests for persistence, restoration, explicit/System mode and mounted consumers.
- [ ] GREEN: immutable palettes and useColors/useThemeStyles/useTheme; persist public preference separately from session.
- [ ] Migrate colour consumers, navigation/status bars/chart appearance and Settings; configure automatic native appearance using supported SDK57 APIs.
- [ ] Run theme tests, full suite, lint and typecheck.

### Task 2: Shared loading feedback

- [ ] RED: pending Button duplicate taps, same-key refresh/failure, different-key isolation.
- [ ] GREEN: Button.loading, accessible busy/disabled, async invocation guard; ready query refreshing/refreshError/retry.
- [ ] Wire pending flags and confirmation guards into mutation screens; keep initial skeletons and visible refresh feedback.
- [ ] Run provider/button/screen tests and full suite.

### Task 3: Positions and history boundary

- [ ] Re-read authenticated history reference/collection for all-time filters, close timestamp and timezone.
- [ ] If verified: implement exact backend serialization and calendar presets, date grouping, incremental loading with RED/GREEN regressions.
- [ ] If still undocumented: retain labelled rolling24-hour history, record contract blocker and request handler/docs; do not fake All.
- [ ] RED/GREEN: position confirmation is single-use, pending feedback is visible, stale account confirmations cannot submit.
- [ ] Integrate reactive theme and refresh feedback in Positions.

### Task 4: Integration verification

- [ ] Full Jest, lint, typecheck, iOS/Android/web production bundle export.
- [ ] Fresh independent review and one bounded correction pass with regression tests.
- [ ] One UI detector pass; report any unavailable native visual verification.
- [ ] Report implemented vs blocked items and packaging status truthfully.

## Execution record — 2026-10-18

- Appearance and loading implemented; theme restoration precedes interface mount,
  explicit modes override System, navigation/backend/chart document identity is retained.
- Same-key refresh retains content with progress/error/retry feedback; new keys
  do not reuse another account's data. Position and order confirmation callbacks
  are consumed once; close/cancel buttons expose pending state.
- User confirmed UTC timestamps. All-time/date-range parameters and execution-close
  field remain undocumented in the authenticated API reference and collection.
  Ruling: keep verified rolling24-hour history labelled honestly; do not fake All
  or use opening timestamps as closing timestamps. Calendar presets remain blocked.
- Independent review found two P2 regressions: dark icon contrast and chart mode
  highlight. Both fixed with RED→GREEN rendered/runtime regression tests.
- Final verification: 883 tests pass across47 suites; typecheck, lint, diff check
  and iOS/Android/web exports pass. Existing asynchronous Home/Positions test
  act warnings remain; no test failed. Detector found no mechanical UI findings.
- No available iOS simulator; native visual verification not performed. The browser
  localhost inspection previously denied by policy was not retried or bypassed.
- Export: /tmp/wavexone-appearance-loading-final-20261018. No new cloud binary or
  store submission was made for these appearance/loading changes. Installed apps
  require a new binary (expo-updates is not configured).
