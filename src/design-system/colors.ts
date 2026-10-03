/**
 * WaveXOne palette: Mac-style neutral glass.
 *
 * Everything is white and neutral grey — frosted white panes with hairline
 * edges on a light grey canvas, neutral shadows, near-black text. There are
 * no tints. Colour is spent on exactly three things: the brand navy on the
 * primary action (Buy, Deposit, Modify) and the logo; green and red for gain
 * and loss; and gold only where it means gold (logo, gold instrument, stars,
 * verified).
 *
 * Legacy keys (`ink`, `navy`, `accent*`, `onInk*`, `hero*`) keep their names
 * for call sites; their values follow this scheme.
 */
export const colors = {
  /** iOS grouped background. */
  bg: '#F2F2F7',
  /** Cards and grouped rows. */
  surface: '#FFFFFF',
  /** Glyphs and labels on a solid navy or coloured fill. */
  white: '#FFFFFF',
  /** Inset panels inside a card. */
  well: '#F2F2F7',

  /** The brand navy: the Wallet card, primary action, active tab. */
  royal: '#1E2A5E',
  brand: '#2C3C78',
  brandBright: '#2C3C78',
  brandSky: '#C7C7CC',
  brandTint: '#F2F2F7',
  brandTintStrong: '#E5E5EA',
  ice: '#1C1C1E',

  /** Stops for the navy Wallet card. */
  heroDeep: '#223066',
  heroMid: '#2F4080',
  heroLight: '#5068B0',

  /** Quiet controls: secondary buttons, the key round actions. */
  accent: '#E9E9EE',
  accentDeep: '#1C1C1E',
  accentSoft: '#F2F2F7',
  accentGlow: '#E5E5EA',

  ink: '#2C3C78',
  inkRaised: '#3A4C8C',
  inkLift: '#5068B0',
  inkDeep: '#223066',
  mist: '#C7C7CC',
  navy: '#2C3C78',
  navyTint: 'rgba(60, 60, 67, 0.06)',
  navyTintStrong: 'rgba(60, 60, 67, 0.10)',
  navySoft: '#E5E5EA',
  focusSurface: '#FFFFFF',

  /** The insight bar: a white card like any other. */
  night: '#FFFFFF',

  /** Gold, only where it means gold. */
  gold: '#E6BE3F',
  goldDeep: '#B8901E',
  goldSoft: '#FBF3D9',

  /** Stocks green and red. Text shades pass contrast on white. */
  green: '#1E7B34',
  greenOnInk: '#1E7B34',
  red: '#D70015',
  redOnInk: '#D70015',
  /** Gain and loss written on the navy Wallet card. */
  walletGain: '#8FE6AE',
  walletLoss: '#FFA9A2',
  /** Solid pill fills, as in the Stocks list. */
  greenFill: '#34C759',
  redFill: '#FF3B30',
  greenSoft: '#E4F6E8',
  greenSoftText: '#1E7A34',
  redSoft: '#FDE7E6',
  redSoftText: '#C4111F',

  /** Labels. */
  text: '#1C1C1E',
  textMuted: '#6E6E73',
  textSubtle: '#AEAEB2',

  /** Fills and separators. */
  track: 'rgba(118, 118, 128, 0.12)',
  divider: 'rgba(60, 60, 67, 0.12)',
  border: 'rgba(60, 60, 67, 0.14)',
  grid: 'rgba(60, 60, 67, 0.08)',

  logoInk: '#1E2A5E',
  logoOnInk: '#FFFFFF',

  /** Surfaces: solid white; the tab bar frosts on its own. */
  glass: 'rgba(255, 255, 255, 0.86)',
  glassStrong: 'rgba(255, 255, 255, 0.94)',
  glassHighlight: '#FFFFFF',
  glassEdge: 'rgba(60, 60, 67, 0.08)',
  glassOnInk: '#F2F2F7',
  glassOnInkStrong: '#E9E9EE',
  glassOnInkEdge: 'rgba(60, 60, 67, 0.10)',

  /** Foregrounds on feature cards, which are white. */
  onInk: '#1C1C1E',
  onInkMuted: '#6E6E73',
  onInkPanel: '#F2F2F7',
  onInkCircle: '#E9E9EE',
  onInkDivider: 'rgba(60, 60, 67, 0.12)',
  watermark: 'rgba(60, 60, 67, 0.05)',

  /** Icon-tile tints: soft fills used sparingly beside the navy. */
  tintBlue: '#F2F2F7',
  tintBlueInk: '#1C1C1E',
  tintViolet: '#F2F2F7',
  tintVioletInk: '#1C1C1E',
  tintAmber: '#FFF4E3',
  tintAmberInk: '#D9822B',
  tintMint: '#E5F7F0',
  tintMintInk: '#1E9467',
  tintRose: '#FFEDF0',
  tintRoseInk: '#D9466A',

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
