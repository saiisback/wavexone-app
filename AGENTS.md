This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npm test                    # jest
npm run test:live           # read-only regression suite against the real API (tests/live/)
npm run capture:fixtures    # same, and refresh tests/fixtures/captured/ (demo login only)
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint, typecheck and tests before declaring any task done.

Unit tests replay real server traffic from `tests/fixtures/captured/` (loaded
through `tests/fixtures/captured/index.ts`) rather than hand-written payloads.
The signed-in live suite reads `WAVEX_LIVE_EMAIL` / `WAVEX_LIVE_PASSWORD`
from `.env.local`; never commit them, and capture only with a demo login.

## Navigation & Routing

This project uses **React Navigation**, not Expo Router.

- Navigators live in `src/navigation/`. `root-navigator.tsx` holds the native stack, `tab-navigator.tsx` the tabs plus the per-tab native stacks, `types.ts` the param lists.
- Stacks are `@react-navigation/native-stack`. Screens draw their own headers, so `headerShown` is off everywhere.
- The tab bar is a custom component (`src/navigation/tab-bar.tsx`) rather than a native one: the design puts a floating circular Trade button through the bar and gives each tab a different selected treatment. Do not swap it for a native tab bar without re-reading the mockups.
- Screens that keep the tab bar visible (Balance, Activity) are pushed inside a tab's stack. Screens that replace it (Instrument detail) sit in the root stack above the tabs.
- Docs: https://reactnavigation.org/docs/native-stack-navigator

## Project layout

```
src/design-system/   colours, type scale, and every shared primitive; screens import only from here
src/features/        composite pieces tied to one domain (market row, position card, chart, …)
src/screens/         one file per screen
src/navigation/      navigators, param lists, the custom tab bar
src/data/            fixtures, domain types, session store, and hoisted Intl formatters
src/backend/         the network seam — see src/backend/README.md
tests/               jest specs, mirroring the src/ tree they cover
```

### Conventions

- **Sheets** are routes, not JS bottom sheets. Add them to the `Stack.Group`
  in `root-navigator.tsx` and wrap the body in the `Sheet` primitive; the
  platform supplies swipe-to-dismiss, the backdrop and keyboard avoidance.
- **Menus** go through `useActionMenu()`. It is a real `UIAlertController` on
  iOS and a native `Modal` elsewhere. Do not hand-roll a popover.
- **Cross-navigator routes** go through `useAppNavigation()`. Never reach for
  `navigation.getParent()` in a screen.
- **Per-row state** is read inside the row with a Zustand selector
  (`useSession((s) => s.favorites.has(id))`), not passed down from the list.
- **No dead taps.** If a control cannot do its real job yet, open an action
  menu that says what is missing — do not render an inert button.

- Never import `Text`, `Pressable`, or an image component from `react-native` / a package inside a screen. Go through `src/design-system`.
- Colours and sizes come from `colors.ts` and `tokens.ts`. Both were sampled from the mockups in the repo root; changing a value there changes it everywhere.
- **Network access** goes through `useBackend()` / `useBackendQuery()` from
  `src/backend/provider`. Never call `fetch` from a screen, a feature or the
  design system — `src/backend/http.ts` is the only `fetch` in the app, and
  the policy in `src/backend/gate.ts` is what keeps the guide's §6 rules
  enforceable.
- **Mutations need an idempotency key.** Several trading mutations are `GET`
  requests, so a retry can place a second order. Nothing in this repo retries
  automatically; do not add a retry wrapper.

- `src/data/mock.ts` is a fixture module. It is reached through
  `createMockBackend()` rather than imported by new code. Screens still import
  it directly today; migrating them to `useBackendQuery` is the next step.

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md
