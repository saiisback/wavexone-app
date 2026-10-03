/**
 * WaveXOne semantic palette: navy structure, a light canvas and scarce gold.
 * Keep foreground/surface pairs here so all screens share accessible contrast.
 */
export const colors = {
  /** Page background behind every card. */
  bg: '#F5F6FA',
  /** Card / sheet surface. */
  surface: '#FFFFFF',
  /** Filled dark surfaces: balance card, price card, Sell button, Trade FAB. */
  ink: '#1E2A5E',
  /** Slightly lifted dark, used for the chart tooltip. */
  inkRaised: '#303F74',
  /** Navy surface for the home portfolio card and the Trade FAB. */
  navy: '#1E2A5E',
  /** Selected rows, quiet controls and skeletons. */
  navySoft: '#E9EDF6',
  /** Input focus background. The outline uses navy itself. */
  focusSurface: '#F2F4FA',

  /** Primary finance action and brand/verification accents. */
  gold: '#E6BE3F',
  /** Deeper gold for small marks (verified badge, active "More" dots). */
  goldDeep: '#E5AF0B',
  /** Tinted gold surface for the support banner. */
  goldSoft: '#FCF1CA',

  /** Positive value on a light surface. */
  green: '#167C3B',
  /** Positive value on a dark surface — the mockups brighten it noticeably. */
  greenOnInk: '#3FDB72',
  /** Negative value on a light surface. */
  red: '#CC3026',
  /** Negative value on navy, with a readable luminance difference. */
  redOnInk: '#FF8B83',

  /** "Buy" badge. */
  greenSoft: '#D0F7DA',
  greenSoftText: '#167C3B',
  /** "Sell" badge. */
  redSoft: '#FDD8D5',
  redSoftText: '#B8241C',

  /** Primary text. */
  text: '#1E2A5E',
  /** Secondary text: subtitles, axis labels, placeholders. */
  textMuted: '#5D6880',
  /** Tertiary text and chevrons. */
  textSubtle: '#626E86',

  /** Segmented-control track and the "Close position" button. */
  track: '#E9EDF6',
  /** Hairline between rows inside a card. */
  divider: '#E6E9F1',
  /** 1px outline on circular header buttons and the account pill. */
  border: '#DCE1EC',
  /** Chart gridlines. */
  grid: '#E9EDF6',

  /** Logo wordmark on a light background. */
  logoInk: '#1E2A5E',
  /** Logo wordmark on a dark background. */
  logoOnInk: '#C0C8DE',

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
  ethereum: '#627EEA',
  silver: '#A4AFBF',
  euBlue: '#0B4499',
  euStar: '#F2C94C',
  /** Bundled stock artwork, never financial gain/loss indicators. */
  brandRed: '#E53139',
  brandRedDeep: '#B71927',
  brandGreen: '#76B900',
  brandBlue: '#1877F2',
  brandYellow: '#FBBC05',
  brandOrange: '#F49B21',
} as const

export type ColorName = keyof typeof colors
