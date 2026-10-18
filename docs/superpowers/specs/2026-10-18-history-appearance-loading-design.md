# Closed history, appearance and loading feedback

## Approved intent

Make every closed trade discoverable by date, offer saved Light/Dark/System
appearance, and acknowledge taps immediately while reads or mutations are pending.
Preserve the existing mobile layout, navy/gold identity, navigation, live data,
and trading confirmation/idempotency safeguards. No financial actions are needed
to test these changes.

## Closed history

Positions → Closed offers All (default), Today, Yesterday, Last Week, Last Month,
and Last Year. Last means the previous complete calendar period; weeks run
Monday through Sunday. Each result is grouped by closing date, newest first.
The selected range and timezone basis are visible. Page requests stay account-
and range-scoped, deduplicate order IDs, and use virtualized rows and incremental
loading rather than downloading every page before showing any result.

Changing account or range resets pagination. A response for an old selection
must never replace the current selection. Initial loads show skeletons; loading
more preserves existing rows and shows a footer spinner. End-of-list, empty,
error and retry states remain distinct. Closed positions never receive live
mark-to-market P&L updates.

### Required API verification

The verified endpoint is `history_of_closed_orders`, with page, token, type,
filter, from and to parameters. Only `filter=24hr` with empty from/to has a
documented example. The official downloaded collection repeats that example.
Do not invent an all-time filter, a date encoding, or unsupported pagination
semantics. Verify a supported all-time/date-range request using authoritative
backend documentation or server source before enabling these presets as live.

Current position `time` is a timezone-unspecified server string; it has not been
verified as execution-close time. Verify the close timestamp and its timezone
before grouping/filtering by it. Do not substitute open time or silently parse
an unspecified server timezone as device time. Use broker calendar dates when
the server supplies its zone, and label that basis in the UI.

The exact documented `{status:"fail",message:"No Results"}` response is empty
history; other failures must not become empty lists. If the required contract
cannot be verified, retain the honestly labelled supported history and report
the missing backend contract; do not present partial data as all trades.

## Appearance

Settings gains an Appearance control with Light, Dark and System. Default is
System. Persist only this public preference separately from authentication;
sign-out must neither reveal account data nor discard the device preference.
System follows OS changes only when selected; explicit modes ignore OS changes.
Restore preference before the main interface appears to avoid theme flashing.

Light preserves the approved warm ivory/gold atmosphere and navy typography.
Dark uses deep navy/near-black canvas, raised navy surfaces, light typography,
and gold selection emphasis. Gains and losses keep semantic green/red with
contrast appropriate to each surface. Images/brand marks retain intentional
brand colours; do not invert pixels or apply a global colour filter.

Use a reactive shared semantic theme with typed palette roles. Migrate static
colour consumers and colour-bearing stylesheet definitions so mounted screens,
menus, sheets, tabs, charts, fields, loading/error states, status bar and
navigation surfaces update consistently. Theme changes must not recreate the
backend, remount navigation, reset forms, lose scroll positions, or interrupt
an in-flight order. No new native dependencies are planned.

## Loading and interaction feedback

Use the existing design-system buttons and query boundary, not separate loading
implementations in each screen. A pending action shows its spinner and meaningful
verb (for example Updating…); expose accessibility busy/disabled state. Lock a
mutation synchronously at invocation, before awaiting its request, so repeated
taps cannot duplicate it. Preserve the original idempotency key for one intent;
do not retry a mutation automatically.

First reads show skeletons. Same-key refreshes keep existing data visible with
a visible refreshing indicator. A different account or range must show its own
loading state, not stale data labelled as the new selection. Preserve existing
data after a failed same-key refresh with reviewed error copy and explicit
retry. Do not show success before server acknowledgement, and distinguish
ambiguous trading failures from known rejection.

Navigation itself receives immediate pressed feedback; do not delay navigation
behind unrelated network reads or introduce arbitrary spinner timers. A local
appearance selection updates immediately; report persistence failure without
silently claiming the preference was saved.

## Verification and delivery

Follow Expo SDK57 documentation before changing Expo/React Native APIs. Use
the backend seam, React Navigation and shared design-system primitives. Preserve
all unrelated dirty-worktree changes. Use apply_patch for source edits.

Tests cover calendar boundaries (including year changes and DST in the verified
zone), exact server range serialization, close-time grouping, empty/error history,
pagination, stale account/range responses, persisted appearance restoration,
system-vs-explicit mode changes, mounted-screen theme updates, refresh feedback,
and double-tap mutation suppression. No tests place real trades.

Run the full Jest suite, lint, typecheck and production bundle exports before
completion. Verify Light/Dark and loading/error/empty states on mobile, with
one batched inspection and at most one correction pass; disclose unavailable
device verification. Run the Impeccable detector once on changed UI targets.

Existing installed binaries will not receive this automatically: expo-updates
is not configured. Packaging or uploading a new build is separate from claiming
the application is publicly live. Apple review approval remains external.
