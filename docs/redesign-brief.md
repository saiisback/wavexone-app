# WaveXOne redesign brief

The redesign replaces the layouts themselves, not only the colours. The old app put
a heavy navy slab at the top of every tab, with an overlapping sheet under it. The
new app is a light, airy, premium fintech UI. It is modelled on a soft-gradient
finance reference: white matte cards, one luminous brand moment per screen, refined
typography, and motion that feels alive.

**The brand colour is unchanged:** navy `#1E2A5E` (`colors.brand`). Every blue is that
navy or a lighter step of the same hue (`brandBright`, `brandSky`, `brandTint`,
`heroMid`, `heroLight`). Gold is now a tiny accent only: favourite star, verified
mark, demo dot. It is never used for a big button or a selected state.

## Principles

1. **Light canvas, white matte cards.** Page `colors.bg` (#F5F6FA). Cards are white with
   `shadow.card`, which is a hairline ring plus a wide soft pool. Card radius is 24, inner wells
   (`Card tone="well"`) radius 18. There is no glass sheen and no heavy borders.
2. **One luminous moment per screen.** Use the brand gradient (`Card tone="ink"` or
   `<InkBackdrop/>`) for a screen's single key figure: home equity, floating P&L,
   live price, net result. Everything else is white.
3. **Typography does the hierarchy.** Big figures are semibold with tight tracking
   (`hero`, `display`, `displaySm`). Labels are `caption` in `textMuted`. Never use
   extrabold. Money goes through `Amount` (minor units faded). Section titles use `section` (18).
4. **Colour carries meaning only:** brand, gain (`green`/`greenSoft`) and loss (`red`/`redSoft`).
   Icon tiles may use the soft category tints (`IconChip tone="blue|violet|amber|mint|rose"`
   with the matching `colors.tint*Ink` glyph colour) to make lists scannable, like the
   reference's colourful icon tiles.
5. **Inverted bar for insight.** A near-black pill (`colors.night`) with a `SparkleIcon`
   carries the one "insight/status" line on a screen (see `MarginInsight` in home-screen).
6. **Pills everywhere.** Buttons are full pills (`Button`, 54pt). Primary is `tone="ink"`
   (solid navy). `tone="brand"` is the gradient for the single hero CTA. `tone="night"` is
   Sell or inverted. `tone="track"` is secondary. Use `ButtonRow` for label + arrow icon:
   "Continue →".
7. **Motion.** Everything is on Reanimated and runs on the UI thread:
   - `Reveal index={n}` staggers blocks in (fade + rise + tiny scale). Wrap each
     screen section and the first ~8 list items.
   - `useCountUp(value)` rolls the hero figure up on mount and glides on ticks
     (render `formatMoney(shown)` into `Amount`, and put the real value in `accessibilityLabel`).
   - `PopIn` for badges and dots, `LiveDot` beside streaming prices.
   - `ProgressBar` fills in. `Donut` sweeps in segment by segment.
   - `SegmentedControl` (navy thumb gliding on a white track) for tabs inside a screen.
   - `PressableScale` on every tappable card or row.
8. **No dead taps, no new features.** Keep every existing behaviour, handler, query,
   navigation call, accessibility label and testID. You change layout and visuals only.

## Layouts

- **Home** uses `HeroScreen` (gradient hero + sheet). Done; use it as the reference
  implementation: `src/screens/home-screen.tsx`.
- **Every other tab and pushed page** uses `PageScreen` from the design system:
  large title on the light canvas, optional `subtitle`, `trailing` controls (account
  pill, filter, add button), `back` for pushed pages. A frosted bar takes the title
  over on scroll. For FlashList screens, compose `PageTitle` + `PageBar` + `useHeroScroll`
  yourself (see `src/design-system/page-layout.tsx`).
- **Sheets** keep using `Sheet`, which now has a round ✕ and a white footer. Inside, follow
  the reference "subscription" sheet: a centred icon disc (brandTint ring), a centred
  title and subtitle, then **option cards** (white card; selected = brand 1.5pt outline
  + `brandTint` fill + filled radio) and a full-width pill CTA in the footer.
- `AccountPill tone="light"` sits in page headers. On gradients it is `tone="onInk"`.

## Reference patterns to reuse

- **Stat tile:** `IconChip` (tinted, 42) on top, then caption label, then `displaySm` value
  (home `StatTile`).
- **Category row card** (reference "Groceries 31% of total, +12% vs last month"): tinted
  icon tile, title + caption on the left, value + delta pill on the right, and a thin
  `ProgressBar` along the bottom.
- **Goal card** (reference "House by the Sea"): a big figure with an "out of" caption,
  a thick progress bar, a "Your progress … / … left" row, and an optional coloured status
  band at the bottom of the card.
- **Donut summary:** a `Donut` with the total in the centre, and a legend beside or below it.
- **Transaction row:** tinted icon tile, title, a meta line with small coloured tags, and an
  amount on the right in green or red.

## Rules (from AGENTS.md)

- Screens import UI only from `src/design-system`. They never import `Text`, `Pressable` or
  image components from `react-native`.
- Colours and sizes come from `colors.ts` / `tokens.ts`.
- Do not edit `src/design-system/index.ts` or any file outside your assigned list.
  If you need a new building block, put it in your feature folder.
- Do not touch backend, data, navigation or test files unless your list says so.
- Before finishing, run `npx tsc --noEmit`, `npx expo lint` and `npx jest` (all must pass).
  Then check your screens in the web preview at http://localhost:8093 (390×844 viewport).
