# WavexOne — mobile UI

React Native (Expo) implementation of the WavexOne trading app. The backend
provider supports mock and live data; network access and mutations are governed
by the backend gate. See [the backend contract](src/backend/README.md) before
configuring a live environment.

The visual identity is documented in [the branding guide](docs/BRANDING.md).

## Running it

```bash
npm install
```

```bash
npx expo start
```

Then press `i` / `a` for a simulator, or `w` for the browser. Native builds
need a development build rather than Expo Go, because the Inter faces are
embedded through the `expo-font` config plugin:

```bash
npx expo run:ios
```

## Screens

| Screen | Where it lives | Source |
|---|---|---|
| Dashboard — greeting, portfolio, signals | Home tab | mockup |
| Your Balance — funding actions, Market Watch | Home → portfolio card, or More → Funds | mockup |
| Instrument detail — quote, chart, Sell / Buy | above the tabs | mockup |
| Positions — floating P&L, open / pending / closed | Positions tab | mockup |
| Activity — month summary, grouped history | More → Funds → Transaction history | mockup |
| Account — profile, menus, support banner | More tab | mockup |
| Markets — search, category filter, full catalogue | Markets tab | designed to match |
| Trade — order ticket | Trade tab | designed to match |
| Notifications, Trading Signals, Profile, Settings | pushed from the screens above | designed to match |
| Deposit / Withdraw / Transfer, Order ticket, Switch account, Instrument picker | native form sheets | designed to match |

The screens marked *designed to match* were not in the supplied artwork. They
are built from the same primitives and introduce no new visual rules.

## Every control does something

There are no dead taps. Controls fall into three groups:

- **Navigation and state** — tabs, back buttons, segmented controls,
  timeframes, search, filters, favourites, account switching, settings
  toggles, notification read state. These all work end to end.
- **Menus** — press and hold a market row, or tap a `⋮`, for a context menu.
  iOS gets a real `UIAlertController` action sheet; other platforms get a
  native `Modal` equivalent. No menu dependency, no JS-drawn popover.
- **Actions that need the backend** — placing or closing an order, submitting
  a deposit or withdrawal, logging out, uploading KYC documents. These open a
  confirmation step that states plainly what is missing, which is also the
  confirmation UI the integration guide requires in front of every mutation.

## Layout

```
src/design-system/   colours, type scale, and every shared primitive
src/features/        composite pieces per domain (market row, position card, chart)
src/screens/         one file per screen
src/navigation/      navigators, param lists, the custom tab bar
src/data/            fixtures, domain types, session store, Intl formatters
src/backend/         the network seam
tests/               jest specs, mirroring the src/ tree
```

`src/design-system/colors.ts` and `tokens.ts` hold every colour and dimension.
The colour values were sampled pixel by pixel from the mockups in the repo
root, so treat that file as the source of truth rather than re-deriving shades
at call sites.

### Performance notes

- Every list is a `FlashList`. Activity supplies `getItemType` so section
  headers and rows recycle into separate pools.
- Rows take primitives, never style objects, and look up their own instrument
  through a `Map` rather than a `.find` inside `renderItem`.
- Per-row state (favourite, unread, setting) is read with a Zustand selector
  inside the row, so toggling one row re-renders that row instead of the list.
- `renderItem`, `keyExtractor` and separators are hoisted out of render where
  they close over nothing.
- `Intl` formatters are created once at module scope.
- React Compiler is enabled, so there is no hand-written `memo` / `useCallback`.

## Backend

The `WaveXBackend` module specified in `WAVEXONE_BACKEND_INTEGRATION_GUIDE.md`
§5 lives in `src/backend/` — see [its README](src/backend/README.md) for what
is implemented, what is blocked, and on what.

In short: authentication, the safety policy and the fixture implementation are
done; the real data calls are not, because the guide documents which endpoint
backs each screen but not what any of them returns. `createBackend()` returns
the fixture implementation unless three `EXPO_PUBLIC_` values point it at a
real host.

Things the guide calls out that this build already respects:

- **Market Sentiment** and the **`<50ms` execution** tile on the dashboard are
  static design copy. No endpoint backs them, so they are not presented as
  account data.
- Every order, close, withdrawal and transfer passes through a confirmation
  step before it would reach the API.
- "Confirm every order" is shown in Settings as required and non-disableable.
- The client portal row asks before leaving the app for an external URL.

## Checks

```bash
npx tsc --noEmit && npx expo lint && npm test
```
