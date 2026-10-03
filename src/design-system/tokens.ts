import type { TextStyle } from 'react-native'

/**
 * Layout primitives. The mockups are a 390pt-wide iPhone frame, so these
 * numbers are already in points and need no scaling.
 */

/** Horizontal gutter used by every screen. */
export const SCREEN_PADDING = 20

export const radius = {
  sm: 8,
  md: 12,
  lg: 14,
  xl: 18,
  /** Cards, list groups and sheets: tighter than a pill, softer than a tile. */
  card: 12,
  /** Big sweep on the full-bleed balance header. */
  header: 34,
  /** Anything pill shaped. */
  pill: 999,
} as const

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  /** Between the sections of a screen. */
  xxl: 32,
} as const

/**
 * `fontFamily` values are the file names registered through the `expo-font`
 * config plugin in app.json, so the faces are embedded at build time and are
 * available on first frame — no async loading state.
 */
export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
} as const

/**
 * A deliberately small type scale. Hierarchy comes from size steps that are
 * far enough apart to read at a glance, then weight and colour:
 *
 *   40  the one hero number on a screen (equity, live price)
 *   28  screen titles
 *   18  section titles
 *   16  content: instrument names, prices
 *   12–13 labels and secondary information
 */
/** Figures line up in columns and do not jitter as a price ticks. */
const TABULAR: TextStyle['fontVariant'] = ['tabular-nums']

export const type = {
  /** The single most important number on a screen. */
  hero: {
    fontFamily: fonts.bold,
    fontSize: 40,
    lineHeight: 46,
    letterSpacing: -1,
    fontVariant: TABULAR,
  },
  /** Screen titles: "Positions", "Activity". */
  title: { fontFamily: fonts.extrabold, fontSize: 28, lineHeight: 34, letterSpacing: -0.5 },
  /** Section headings and the greeting. */
  heading: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 28 },
  /** Section titles: "Watchlist", "Top movers". */
  section: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 24, letterSpacing: -0.2 },
  /** Large secondary numbers: floating P&L, a summary total. */
  display: {
    fontFamily: fonts.bold,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.6,
    fontVariant: TABULAR,
  },
  /** Secondary hero numbers. */
  displaySm: {
    fontFamily: fonts.bold,
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.4,
    fontVariant: TABULAR,
  },
  /** Emphasised body: symbols, prices, button labels. */
  strong: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 21 },
  /** Default body. */
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 21 },
  /** Row subtitles, axis labels, metadata. */
  caption: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 17 },
  /** Tab-bar labels and badges. */
  micro: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 15 },
  /** Small caps label above a value: "TOTAL EQUITY", "REQUIRED MARGIN". */
  overline: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
} as const

/** Soft lift used by the floating cards and the tab bar. */
export const shadow = {
  card: '0px 1px 2px rgba(30, 42, 94, 0.04)',
  raised: '0px 6px 18px rgba(30, 42, 94, 0.08)',
  /** Navy hero cards: a soft navy pool under the card, no hard edge. */
  hero: '0px 10px 24px rgba(23, 33, 80, 0.22)',
  fab: '0px 6px 16px rgba(30, 42, 94, 0.20)',
} as const
