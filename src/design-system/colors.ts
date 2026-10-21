/**
 * WaveXOne palette: American navy, warm white and restrained gold.
 *
 * Warm white and pale navy build the canvas. American navy carries the
 * account card and primary actions; gold is reserved for the identity and
 * small moments of emphasis. Green and red remain purely semantic.
 *
 * Legacy keys (`ink`, `navy`, `accent*`, `onInk*`, `hero*`) keep their names
 * for call sites; their values follow this scheme.
 */
export const colors = {
  /** iOS grouped background. */
  bg: '#F6F7FA',
  /** Cards and grouped rows. */
  surface: '#FFFFFF',
  /** Glyphs and labels on a solid navy or coloured fill. */
  white: '#FFFFFF',
  /** Inset panels inside a card. */
  well: '#F0F2F6',

  /** The brand navy: the Wallet card, primary action, active tab. */
  royal: '#1E2A5E',
  brand: '#1E2A5E',
  brandBright: '#334582',
  brandSky: '#C7C7CC',
  brandTint: '#EEF1F8',
  brandTintStrong: '#DEE4F2',
  ice: '#FFFFFF',

  /** Stops for the navy Wallet card. */
  heroDeep: '#111A42',
  heroMid: '#1E2A5E',
  heroLight: '#334582',

  /** Warm ivory-gold canvas sampled from the approved onboarding reference. */
  referenceCanvas: '#FFF0BF',
  referenceCanvasTop: '#FFF6D8',
  referenceCanvasWarm: '#F4CE68',
  referenceMuted: 'rgba(30, 42, 94, 0.62)',
  referenceLine: 'rgba(30, 42, 94, 0.10)',
  referenceBar: '#FFF8DE',
  /** Legacy canvas aliases retained for older call sites. */
  homeSky: '#FFF8DE',
  homeSkyLight: '#FFFCF3',
  homeSkyDeep: '#FFE8A3',
  homePanel: '#111936',
  homePanelRaised: '#1A254C',
  homeBlack: '#080B13',
  homeLine: 'rgba(255, 255, 255, 0.10)',

  /** Quiet controls: secondary buttons, the key round actions. */
  accent: '#E9E9EE',
  accentDeep: '#1C1C1E',
  accentSoft: '#F2F2F7',
  accentGlow: '#E5E5EA',

  ink: '#1E2A5E',
  inkRaised: '#283873',
  inkLift: '#3B4F8F',
  inkDeep: '#111A42',
  mist: '#C7C7CC',
  navy: '#1E2A5E',
  navyTint: 'rgba(30, 42, 94, 0.07)',
  navyTintStrong: 'rgba(30, 42, 94, 0.12)',
  navySoft: '#DEE4F2',
  navyOnMuted: 'rgba(255, 255, 255, 0.68)',
  navyDivider: 'rgba(255, 255, 255, 0.18)',
  focusSurface: '#FFFFFF',

  /** The insight bar: a white card like any other. */
  night: '#1E2A5E',

  /** Gold, only where it means gold. */
  gold: '#E6BE3F',
  goldDeep: '#B8901E',
  goldSoft: '#FBF3D9',
  /** Stocks green and red. Text shades pass contrast on white. */
  green: '#1E7B34',
  greenOnInk: '#8FE6AE',
  red: '#D70015',
  redOnInk: '#FFA9A2',
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
  glass: '#FFFFFF',
  glassStrong: '#FFFFFF',
  glassHighlight: '#FFFFFF',
  glassEdge: 'rgba(60, 60, 67, 0.08)',
  frost: 'rgba(255, 255, 255, 0.82)',
  frostStrong: 'rgba(255, 255, 255, 0.96)',
  frostSoft: 'rgba(255, 255, 255, 0.66)',
  compactBar: 'rgba(250, 250, 252, 0.9)',
  sheen: '#FFFFFF',
  glassBorder: 'rgba(255, 255, 255, 0.9)',
  glassOnInk: 'rgba(255, 255, 255, 0.10)',
  glassOnInkStrong: 'rgba(255, 255, 255, 0.14)',
  glassOnInkEdge: 'rgba(255, 255, 255, 0.18)',

  /** Foregrounds and inset surfaces on navy feature cards. */
  onInk: '#FFFFFF',
  onInkMuted: 'rgba(255, 255, 255, 0.68)',
  onInkPanel: 'rgba(255, 255, 255, 0.10)',
  onInkCircle: 'rgba(255, 255, 255, 0.12)',
  onInkDivider: 'rgba(255, 255, 255, 0.18)',
  watermark: 'rgba(255, 255, 255, 0.05)',

  /** Icon-tile tints: soft fills used sparingly beside the navy. */
  tintBlue: '#F2F2F7',
  tintBlueInk: '#1C1C1E',
  tintViolet: '#F2F2F7',
  tintVioletInk: '#1C1C1E',
  tintAmber: '#FFF4E3',
  tintAmberInk: '#8A570B',
  tintMint: '#E5F7F0',
  tintMintInk: '#176B4B',
  tintRose: '#FFEDF0',
  tintRoseInk: '#AD294B',

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

/** Immutable semantic palettes. Brand artwork colours deliberately stay fixed. */
export type Palette = { readonly [K in ColorName]: string }
export const darkColors: Palette = Object.freeze({
  ...colors,
  bg: '#080D1A', surface: '#141D30', well: '#1C2840',
  referenceCanvas: '#0C1324', referenceCanvasTop: '#111B31', referenceCanvasWarm: '#283249',
  referenceMuted: '#B2BDD2', referenceLine: 'rgba(218, 226, 246, 0.14)', referenceBar: '#141D30',
  homeSky: '#0C1324', homeSkyLight: '#111B31', homeSkyDeep: '#17243B',
  brand: '#E6BE3F', royal: '#1E2A5E', brandBright: '#F0D477',
  brandTint: '#26314A', brandTintStrong: '#34425D',
  accent: '#29354B', accentDeep: '#F2F4FA', accentSoft: '#1C2840', accentGlow: '#34425D',
  ink: '#DCE3F6', inkRaised: '#DCE3F6', inkLift: '#B8C9F4',
  navy: '#DCE3F6', navyTint: 'rgba(218,226,246,0.08)', navyTintStrong: 'rgba(218,226,246,0.14)', navySoft: '#34425D',
  focusSurface: '#1C2840', goldDeep: '#E6BE3F', goldSoft: '#393320',
  green: '#71D995', red: '#FF8585', greenSoft: '#173B2D', greenSoftText: '#8BE7AC', redSoft: '#43252E', redSoftText: '#FFA3AA',
  text: '#F2F4FA', textMuted: '#B2BDD2', textSubtle: '#98A7C2',
  logoInk: '#FFFFFF',
  track: 'rgba(218,226,246,0.12)', divider: 'rgba(218,226,246,0.13)', border: 'rgba(218,226,246,0.18)', grid: 'rgba(218,226,246,0.08)',
  glass: '#141D30', glassStrong: '#1C2840', glassHighlight: '#26314A', glassEdge: 'rgba(218,226,246,0.13)',
  frost: 'rgba(20,29,48,0.92)', frostStrong: 'rgba(20,29,48,0.97)', frostSoft: 'rgba(20,29,48,0.86)', compactBar: 'rgba(12,19,36,0.94)', sheen: '#1C2840', glassBorder: 'rgba(218,226,246,0.13)',
  tintBlue: '#25334F', tintBlueInk: '#C2D5FF', tintViolet: '#332B49', tintVioletInk: '#D9C8FF',
  tintAmber: '#3D321F', tintAmberInk: '#F7D28A', tintMint: '#193A33', tintMintInk: '#99E6C5', tintRose: '#412B37', tintRoseInk: '#FFB4CC',
})
Object.freeze(colors)
