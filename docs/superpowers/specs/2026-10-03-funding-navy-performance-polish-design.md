# Funding, Navy UI, and Performance Polish Design

## Goal

Ship a presentable mobile trading experience in which deposit, withdrawal, and transfer are reachable through the real backend, the visual system consistently uses WaveXOne navy (`#1E2A5E`) instead of black, market rows carry recognizable asset and stock marks, and repeat navigation does not reload data unnecessarily.

## Scope

This work refines the existing React Native application. It preserves React Navigation, the current screen hierarchy, native route-based sheets, the backend seam, server-owned account/market data, mutation confirmations, and idempotency protection.

The work covers:

- the shared funding screen and its three modes;
- the portal funding adapters and local phase configuration;
- shared query caching and loading presentation;
- shared colors, buttons, cards, navigation states, and market icons;
- Home, Balance, Markets, account selection, and funding paths affected by those shared components.

It does not add fabricated balances, quotes, accounts, or instruments. It does not submit a real transaction during automated or agent verification.

## Funding behavior

The local app build will enable Phase 3 through its environment configuration. The endpoint registry remains the enforcement boundary, so production builds can still choose a lower phase explicitly.

The supplied Client Portal Postman collection is the request contract:

- `apiSubmitDeposit`: multipart fields `amount`, `method`, `targetAccountId`, and optional `proof`;
- `apiSendWithdrawOtp`: JSON fields `sourceId`, `amount`, and `withdrawAddress`;
- `apiSubmitWithdraw`: JSON fields `sourceId`, `amount`, `method`, `withdrawAddress`, and `otp`;
- `apiTransfer`: JSON fields `source`, `destination`, `amount`, and `memo`;
- `submitDemoDeposit`: form field `deposit_amount`.

Every mutation uses a fresh idempotency key for one confirmed user intent and is never retried automatically. Buttons enter a submitting state and cannot be double-tapped. A successful withdrawal OTP request changes the same sheet into an OTP-completion state rather than asking the user to infer the next step. Transfer requires two distinct linked accounts. Amount validation uses the server configuration and available-fund values. Demo deposits remain limited to the currently selected demo account.

Server failures use the normalized backend error model. The UI does not display unreviewed server strings or claim that an ambiguous mutation failed safely.

## Visual direction

The product remains a premium light interface in Operate mode. Navy is the primary structural and action color, while gold is scarce and reserved for important financial actions, verification, and selected emphasis.

Shared semantic roles will be updated rather than adding screen-specific color patches:

- page canvas: subtly cool off-white;
- elevated cards and sheets: white;
- primary text, dark panels, filled controls, navigation selection, and focus treatment: `#1E2A5E`;
- secondary navy surfaces: pale navy tints with verified contrast;
- primary financial action: gold on navy-aware foregrounds;
- success and loss colors remain green and red and retain text/icon cues.

Cards use one radius and border vocabulary, quieter shadows, consistent internal spacing, and a clear data hierarchy. Funding forms group account, method, amount, and confirmation information in the order users act on them. Touch targets remain at least 44 points and controls keep accessible names.

## Market and stock marks

`AssetIcon` becomes the single instrument-mark component. It will use bundled local vector marks for supported high-frequency stock tickers and existing first-class crypto, metals, currency, energy, and index symbols. Symbols are normalized before matching so exchange suffixes such as `AAPL.OQ` still resolve.

Unrecognized server instruments receive a consistent navy-tinted monogram fallback derived only from their symbol. Images do not make per-row third-party network requests, avoiding tracking, layout shift, and slower lists. Market data itself remains entirely server-driven; only presentation metadata is mapped locally.

## Loading and cache behavior

The current query provider deletes completed reads as soon as the final consumer unmounts. Navigating away and back therefore repeats account, profile, market, and funding requests and restores large blocking spinners.

Completed read promises will remain in the provider cache for a short bounded freshness window. Mounted consumers continue sharing one promise, explicit invalidation still removes matching entries immediately, and account-scoped keys continue preventing data from leaking across account changes. Rejected reads are not retained as successful cache entries.

Content-shaped skeletons replace centered blocking spinners on primary surfaces. Existing content stays visible during explicit background invalidation, while first load reserves the final layout dimensions to prevent visual jumping. Performance tests will assert request counts across unmount/remount and account-key changes rather than relying on subjective speed alone.

## Components and files

- `src/backend/provider.tsx`: bounded completed-query retention and invalidation behavior.
- `src/backend/adapters/client-portal.ts`, `src/backend/live-backend.ts`, `src/backend/endpoints.ts`: verified funding contract and acknowledgements where tests expose gaps.
- `.env.local`: opt the local build into Phase 3.
- `src/screens/funding-screen.tsx`: progressive funding flow, submitting state, validation, and polished hierarchy.
- `src/design-system/colors.ts`, shared buttons/cards/loading primitives: semantic navy palette and coherent states.
- `src/design-system/asset-icon.tsx`: bundled instrument and stock marks with monogram fallback.
- market, Home, Balance, and navigation surfaces: consume shared components rather than duplicate styles.
- mirrored tests under `tests/backend`, `tests/screens`, `tests/features`, and `tests/design-system` as appropriate.

## Verification

Implementation follows red-green-refactor for funding, caching, and icon resolution. Automated funding tests use fake transports only and verify method, encoding, field names, idempotency, disabled/submitting states, and invalidation. No test reaches production.

Before completion:

- run targeted regression tests while implementing;
- run `npx tsc --noEmit`;
- run `npx expo lint`;
- run `npm test`;
- run `git diff --check`;
- run the Impeccable detector once over changed UI targets;
- inspect the shipped phone-size simulator once, fix defects in one batch, and perform at most one confirmation pass.

The final real-money or demo mutation test remains user-operated on their device after reviewing the account, amount, method, and destination.
