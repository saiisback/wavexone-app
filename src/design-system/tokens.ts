import type { TextStyle } from 'react-native'

/**
 * Layout primitives, in points for a 390pt-wide iPhone frame.
 */

/** Horizontal gutter used by every screen. */
export const SCREEN_PADDING = 20

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 18,
  /** Cards, list groups and tiles. */
  card: 18,
  /** The content sheet's top corners, where it overlaps the hero. */
  sheet: 24,
  /** The hero's own bottom sweep. */
  header: 36,
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
  xxl: 28,
} as const

/**
 * `fontFamily` values are the file names registered through the `expo-font`
 * config plugin in app.json, so the faces are embedded at build time.
 */
export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
} as const

/** Figures line up in columns and do not jitter as a price ticks. */
const TABULAR: TextStyle['fontVariant'] = ['tabular-nums']

/**
 * Hierarchy comes from size and tracking, not weight: large figures are
 * semibold with tight tracking, labels are regular and muted. Nothing in
 * the scale is heavier than bold.
 */
export const type = {
  /** The single most important number on a screen. */
  hero: {
    fontFamily: fonts.semibold,
    fontSize: 46,
    lineHeight: 54,
    letterSpacing: -1.8,
    fontVariant: TABULAR,
  },
  /** Screen titles: "Positions", "Activity". */
  title: { fontFamily: fonts.semibold, fontSize: 30, lineHeight: 36, letterSpacing: -0.9 },
  /** Sheet titles and the greeting. */
  heading: { fontFamily: fonts.semibold, fontSize: 22, lineHeight: 28, letterSpacing: -0.5 },
  /** Section titles: "Watchlist", "Top movers". */
  section: { fontFamily: fonts.semibold, fontSize: 18, lineHeight: 24, letterSpacing: -0.35 },
  /** Large secondary numbers: floating P&L, a summary total. */
  display: {
    fontFamily: fonts.semibold,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -1.1,
    fontVariant: TABULAR,
  },
  /** Tile figures. */
  displaySm: {
    fontFamily: fonts.semibold,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.6,
    fontVariant: TABULAR,
  },
  /** Emphasised body: symbols, prices, button labels. */
  strong: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 21, letterSpacing: -0.2 },
  /** Default body. */
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, letterSpacing: -0.1 },
  /** Row subtitles, axis labels, metadata. */
  caption: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  /** Tab-bar labels and badges. */
  micro: { fontFamily: fonts.medium, fontSize: 11.5, lineHeight: 15 },
  /** Small label above a value: "Total equity", "Required margin". */
  overline: {
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.1,
  },
} as const

/**
 * Apple glass depth: a bright inset line along each card's top edge (light
 * catching the glass), a hairline ring that defines the edge, and a soft,
 * neutral pool underneath. Inset shadows render natively on the new
 * architecture and on web.
 */
export const shadow = {
  card: '0px 1px 2px rgba(17, 26, 66, 0.04), 0px 8px 24px rgba(17, 26, 66, 0.06)',
  raised: '0px 2px 5px rgba(17, 26, 66, 0.07), 0px 12px 28px rgba(17, 26, 66, 0.09)',
  /** Feature cards: same as any card. */
  hero: '0px 16px 34px rgba(17, 26, 66, 0.22)',
  /** The Trade button. */
  fab: '0px 8px 22px rgba(17, 26, 66, 0.24)',
  /** The floating tab bar. */
  float: '0px 8px 30px rgba(0, 0, 0, 0.10)',
} as const

/** Shared motion: quick in, gentle settle. */
export const motion = {
  fast: 160,
  base: 280,
  reveal: 340,
  /** Delay between siblings revealed in sequence. */
  stagger: 40,
  spring: { damping: 18, stiffness: 190, mass: 0.9 },
  /** A softer spring for things that travel: thumbs, indicators. */
  glide: { damping: 22, stiffness: 220, mass: 0.8 },
} as const
