/**
 * Palette sampled directly from the WavexOne mockups.
 * Every value here came out of the source artwork rather than being invented,
 * so treat this file as the single source of truth for colour.
 */
export const colors = {
  /** Page background behind every card. */
  bg: '#F7F7F7',
  /** Card / sheet surface. */
  surface: '#FFFFFF',
  /** Filled dark surfaces: balance card, price card, Sell button, Trade FAB. */
  ink: '#1A1A1A',
  /** Slightly lifted dark, used for the chart tooltip. */
  inkRaised: '#2F2F2F',
  /** Navy surface for the home portfolio card and the Trade FAB. */
  navy: '#1E2A5E',

  /** Brand gold. Buy button, active segment, portfolio band, chart line. */
  gold: '#E6BE3F',
  /** Deeper gold for small marks (verified badge, active "More" dots). */
  goldDeep: '#E5AF0B',
  /** Tinted gold surface for the support banner. */
  goldSoft: '#FCF1CA',

  /** Positive value on a light surface. */
  green: '#1E9E4F',
  /** Positive value on a dark surface — the mockups brighten it noticeably. */
  greenOnInk: '#3FDB72',
  /** Negative value on a light surface. */
  red: '#E5382B',

  /** "Buy" badge. */
  greenSoft: '#D0F7DA',
  greenSoftText: '#1E9E4F',
  /** "Sell" badge. */
  redSoft: '#FDD8D5',
  redSoftText: '#D9271F',

  /** Primary text. */
  text: '#1A1A1A',
  /** Secondary text: subtitles, axis labels, placeholders. */
  textMuted: '#8B9095',
  /** Tertiary text and chevrons. */
  textSubtle: '#A8ADB2',

  /** Segmented-control track and the "Close position" button. */
  track: '#EEF0F1',
  /** Hairline between rows inside a card. */
  divider: '#ECEDEE',
  /** 1px outline on circular header buttons and the account pill. */
  border: '#E6E8E9',
  /** Chart gridlines. */
  grid: '#EDEDED',

  /** Logo wordmark on a light background. */
  logoInk: '#4A4F5A',
  /** Logo wordmark on a dark background. */
  logoOnInk: '#8A919D',

  /** Translucent layers used on top of `ink` surfaces. */
  onInk: '#FFFFFF',
  onInkMuted: 'rgba(255, 255, 255, 0.72)',
  onInkPanel: 'rgba(255, 255, 255, 0.14)',
  onInkCircle: 'rgba(255, 255, 255, 0.22)',
  onInkDivider: 'rgba(255, 255, 255, 0.18)',
  /** The oversized "W" watermark printed on dark cards. */
  watermark: 'rgba(255, 255, 255, 0.09)',

  /** Instrument brand colours. */
  bitcoin: '#F7931A',
  euBlue: '#0B4499',
  euStar: '#F2C94C',
} as const

export type ColorName = keyof typeof colors
