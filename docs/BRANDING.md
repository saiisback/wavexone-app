# WavexOne branding

This guide records the identity implemented in the app. The source of truth is
`src/design-system/colors.ts`, `tokens.ts`, and `logo.tsx`; update these together
with this guide when the identity changes.

## Character

A calm, precise trading interface: navy anchors the identity, white and pale
neutral surfaces keep financial information readable, and gold provides restrained
emphasis. Large figures and clear spacing establish hierarchy. Green and red
communicate financial direction and status rather than general decoration.

## Logo and assets

The angular mark combines navy strokes with a gold gradient accent. The app
lockup reads **WavexOne**: “Wavex” uses Inter ExtraBold, the gold “O” uses the
regular face, and “ne” returns to the foreground colour. Use the existing
`Logo` and `LogoMark` components to preserve proportions and theme behaviour.
The mark's gold gradient runs from `#D4AF37` to `#F4E04D`.

- `assets/logo-mark.svg`: vector mark.
- `assets/app-icon.svg` and `assets/app-icon-ios.svg`: vector app icon artwork.
- `assets/icon.png`: configured application icon.
- `assets/android-icon-*.png`: Android adaptive icon layers.
- `assets/splash-icon.png`: splash artwork.

Preserve the mark's geometry and aspect ratio. Keep the mark legible against its
background and use the supplied foreground variants instead of recolouring it
arbitrarily. The current implementation does not define a formal minimum size
or clear-space measurement; do not treat one as an approved brand standard.

## Colour

| Role | Light appearance | Dark appearance |
| --- | --- | --- |
| Brand action (`brand`) | `#1E2A5E` | `#E6BE3F` |
| Fixed identity navy (`royal`) | `#1E2A5E` | `#1E2A5E` |
| Gold | `#E6BE3F` | `#E6BE3F` |
| Background | `#F6F7FA` | `#080D1A` |
| Surface | `#FFFFFF` | `#141D30` |
| Primary text | `#1C1C1E` | `#F2F4FA` |
| Secondary text | `#6E6E73` | `#B2BDD2` |
| Positive | `#1E7B34` | `#71D995` |
| Negative | `#D70015` | `#FF8585` |

The light onboarding/home atmosphere uses warm ivory-gold tokens
`#FFF0BF`, `#FFF6D8`, and `#F4CE68`. Navy feature surfaces use
`#111A42`, `#1E2A5E`, and `#334582`. Use semantic palette tokens through
`useColors()` and `useThemeStyles()` so light, dark, and system preferences
remain consistent. Instrument logos retain their own artwork colours.

## Typography

Inter is bundled in `assets/fonts/` with Regular, Medium, SemiBold, Bold, and
ExtraBold faces. Use the shared `Text` primitive and type tokens.

| Use | Size / line height (points) | Weight |
| --- | --- | --- |
| Hero figure | 46 / 54 | SemiBold |
| Secondary display | 34 / 40 | SemiBold |
| Screen title | 30 / 36 | SemiBold |
| Small display | 24 / 30 | SemiBold |
| Heading | 22 / 28 | SemiBold |
| Section title | 18 / 24 | SemiBold |
| Emphasised body | 16 / 21 | SemiBold |
| Body | 15 / 21 | Regular |
| Caption | 13 / 18 | Regular |
| Overline | 12 / 16 | Medium |
| Micro label | 11.5 / 15 | Medium |

Large numbers use tight tracking and tabular figures. Reserve ExtraBold for
the wordmark; everyday hierarchy comes from scale and spacing.

## Layout and surfaces

Use a 20-point screen gutter and the spacing scale 4, 8, 12, 16, 20, and 28.
Cards use 18-point corners, sheets 24, and hero sweeps 36. Pills use fully
rounded ends. Use shared shadows for subtle depth and frosted treatment for
the floating tab bar. Preserve the distinctive circular Trade control through
the custom bar. Keep market rows aligned and price changes easy to scan.

Use the existing design-system primitives for buttons, fields, sheets, icons,
and loading states. Motion should stay brief and gentle, honour reduced-motion
preferences, and avoid distracting from prices or order decisions. Review
branding changes in both appearances and on iOS, Android, and web.
