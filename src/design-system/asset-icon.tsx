import { useColors, useThemeStyles } from './theme'
import type { Palette } from './colors'
import { StyleSheet, View } from 'react-native'
import Svg, { Circle, G, Path, SvgXml } from 'react-native-svg'

import {
  BRAND_MARKS,
  COIN_MARKS,
  FLAG_SVGS,
  type ArtworkMark,
  type FlagCode,
} from './artwork.generated'
import { Text } from './text'
import { fonts } from './tokens'
import {
  currencyPairFlags,
  indexFlag,
  instrumentIconLabel,
  instrumentMark,
  instrumentMonogram,
  type AssetIconKind,
  type DrawnStockKind,
  type InstrumentArtworkCategory,
} from './instrument-marks'

export type { AssetIconKind } from './instrument-marks'

export type AssetIconProps = {
  kind: AssetIconKind
  size?: number
  /** Symbol or initials used for the generic monogram. */
  label?: string
  /** Optional bullion tint. Unknown marks always use the semantic navy palette. */
  tint?: string
  /**
   * The instrument's ticker ("AAPL", "EUR/USD", "US30"). Picks the flags for
   * pairs and indices, and a better mark when `kind` is only `generic`.
   */
  symbol?: string
  /** Narrows the `generic` lookup; "Stocks", "Forex", "Crypto", "Indices", … */
  category?: string
}

/**
 * Round instrument badge, drawn only from artwork bundled with the app
 * (`artwork.generated.ts` and the hand-drawn marks below): no badge ever
 * fetches an image. Anything unrecognised gets a navy monogram.
 */
export function AssetIcon({ kind, size = 44, label = '', tint, symbol, category }: AssetIconProps) {
  const colors = useColors()
  const DRAWN_STOCKS = useThemeStyles(themeDRAWN_STOCKS)
  const styles = useThemeStyles(themeStyles)

  const mark =
    kind === 'generic' && symbol
      ? instrumentMark(symbol, category as InstrumentArtworkCategory | undefined)
      : kind
  const text = label || (symbol ? instrumentIconLabel(symbol) : '')
  const ticker = symbol ?? text

  const artwork = BRAND_MARKS[mark as keyof typeof BRAND_MARKS] ?? COIN_MARKS[mark as keyof typeof COIN_MARKS]
  if (artwork) return <MarkDisc mark={artwork} size={size} />

  if (Object.hasOwn(DRAWN_STOCKS, mark)) {
    return (
      <View style={[styles.box, styles.stock, { width: size, height: size, borderRadius: size / 2 }]}>
        <Svg width={size * 0.8} height={size * 0.8} viewBox="0 0 48 48">
          {DRAWN_STOCKS[mark as DrawnStockKind].map(({ d, fill }) => <Path key={d} d={d} fill={fill} />)}
        </Svg>
        <Ring size={size} />
      </View>
    )
  }

  if (mark === 'gold' || mark === 'silver' || mark === 'copper' || mark === 'platinum' || mark === 'palladium') {
    const metalTints = {
      gold: colors.gold,
      silver: colors.silver,
      copper: '#B87333',
      platinum: '#8D98A7',
      palladium: '#697584',
    } as const
    const bullionTint = tint ?? metalTints[mark]
    return (
      <View style={[styles.box, { width: size, height: size }]}>
        <Bullion size={size * 0.94} tint={bullionTint} />
      </View>
    )
  }

  if (mark === 'forex') {
    const flags = currencyPairFlags(ticker)
    return (
      <View style={[styles.box, { width: size, height: size }]}>
        {flags ? <FlagPair base={flags[0]} quote={flags[1]} size={size} /> : <PairBadge label={text} size={size} />}
      </View>
    )
  }

  if (mark === 'bitcoin' || mark === 'ethereum' || mark === 'oil' || mark === 'gas') {
    const disc = mark === 'bitcoin' ? colors.bitcoin : mark === 'ethereum' ? colors.ethereum : colors.royal
    return (
      <Svg width={size} height={size} viewBox="0 0 48 48">
        <Circle cx="24" cy="24" r="24" fill={disc} />
        {mark === 'bitcoin' ? (
          <Path fill={colors.white} fillRule="evenodd" d="M19 9h3v5h3V9h3v5c7 1 9 9 3 12 7 3 5 12-3 13v4h-3v-4h-3v4h-3v-4h-6v-4h3V18h-3v-4h6Zm3 9v7h4c5 0 5-7 0-7Zm0 11v6h5c5 0 5-6 0-6Z" transform="translate(3 -2) rotate(12 24 24)" />
        ) : mark === 'ethereum' ? (
          <>
            <Path fill={colors.white} d="M24 7 13 25l11 6 11-6Z" />
            <Path fill={colors.onInkMuted} d="m13 28 11 14 11-14-11 6Z" />
          </>
        ) : mark === 'oil' ? (
          <Path fill={colors.white} d="M24 7c-3 6-13 14-13 22a13 13 0 0 0 26 0c0-8-10-16-13-22Zm-7 23a7 7 0 0 0 7 7v-3a4 4 0 0 1-4-4Z" fillRule="evenodd" />
        ) : (
          <Path fill={colors.white} d="M27 5c2 8-5 10-2 16 2-3 5-5 8-6 4 5 7 10 7 16 0 9-7 14-16 14S8 39 8 30c0-8 5-14 11-20-1 7 1 10 4 12-1-8 2-13 4-17Zm-3 35c5 0 8-3 8-8 0-3-2-6-4-9 0 5-3 7-5 10-1-3-3-5-5-6-1 2-2 4-2 6 0 4 3 7 8 7Z" />
        )}
      </Svg>
    )
  }

  if (mark === 'eos') {
    return (
      <View style={[styles.box, styles.cryptoWordmark, { width: size, height: size, borderRadius: size / 2 }]}>
        <Text style={[styles.badgeText, { fontSize: size * 0.22 }]}>EOS</Text>
      </View>
    )
  }

  if (mark === 'index') {
    const flag = indexFlag(ticker)
    if (flag) return <FlagDisc code={flag} size={size} />
  }

  if (mark === 'index' || mark === 'stock') {
    const compact = text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, mark === 'index' ? 5 : 4) || (mark === 'index' ? 'IDX' : 'STK')
    return (
      <View style={[styles.box, styles.marketBadge, { width: size, height: size, borderRadius: size / 2 }]}>
        <Text style={[styles.badgeText, { fontSize: size * (compact.length > 4 ? 0.16 : 0.2) }]}>{compact}</Text>
      </View>
    )
  }

  return (
    <View
      style={[
        styles.box,
        styles.disc,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.navySoft },
      ]}
    >
      <Text style={[styles.glyph, { fontSize: size * 0.34 }]}>{instrumentMonogram(text)}</Text>
    </View>
  )
}

/** A bundled single-path brand or coin mark on its plate. */
function MarkDisc({ mark, size }: { mark: ArtworkMark; size: number }) {
  const colors = useColors()
  const styles = useThemeStyles(themeStyles)

  return (
    <View style={[styles.box, { width: size, height: size, borderRadius: size / 2, backgroundColor: mark.plate }]}>
      <Svg width={size * 0.58} height={size * 0.58} viewBox="0 0 24 24">
        <Path d={mark.path} fill={mark.fill} />
      </Svg>
      {mark.plate === colors.surface ? <Ring size={size} /> : null}
    </View>
  )
}

/** A square flag clipped to a circle. */
function FlagDisc({ code, size }: { code: FlagCode; size: number }) {
  const styles = useThemeStyles(themeStyles)

  return (
    <View style={[styles.box, styles.disc, { width: size, height: size, borderRadius: size / 2 }]}>
      <SvgXml xml={FLAG_SVGS[code]} width={size} height={size} />
      <Ring size={size} />
    </View>
  )
}

/** Two overlapping flags: the base currency in front, the quote behind. */
function FlagPair({ base, quote, size }: { base: FlagCode; quote: FlagCode; size: number }) {
  const styles = useThemeStyles(themeStyles)

  const disc = Math.round(size * 0.72)
  return (
    <View style={{ width: size, height: size }}>
      <View style={styles.pairQuote}>
        <FlagDisc code={quote} size={disc} />
      </View>
      <View style={[styles.pairBase, { width: disc + 4, height: disc + 4, borderRadius: (disc + 4) / 2 }]}>
        <FlagDisc code={base} size={disc} />
      </View>
    </View>
  )
}

/** A hairline that keeps white plates and pale flags off a white card. */
function Ring({ size }: { size: number }) {
  const styles = useThemeStyles(themeStyles)

  return <View pointerEvents="none" style={[styles.ring, { borderRadius: size / 2 }]} />
}

/** Three stacked bullion bars — XAU and XAG. */
function Bullion({ size, tint }: { size: number; tint: string }) {
  return (
    <Svg width={size} height={size * 0.92} viewBox="0 0 48 44">
      <G fill={tint} stroke={tint} strokeWidth={3} strokeLinejoin="round">
        <Path d="M17.5 5.5h13l3.5 15h-20Z" />
        <Path d="M6.5 24.5h12l3.5 14H3Z" />
        <Path d="M29.5 24.5h12L45 38.5H26Z" />
      </G>
    </Svg>
  )
}

/** Multi-colour marks drawn by hand; everything else comes from `artwork.generated.ts`. */
const themeDRAWN_STOCKS = (colors: Palette): Record<DrawnStockKind, readonly { d: string; fill: string }[]> => ({
  microsoft: [
    { fill: colors.brandRed, d: 'M9 9h14v14H9Z' },
    { fill: colors.brandGreen, d: 'M25 9h14v14H25Z' },
    { fill: colors.brandBlue, d: 'M9 25h14v14H9Z' },
    { fill: colors.brandYellow, d: 'M25 25h14v14H25Z' },
  ],
  amazon: [
    { fill: colors.ink, d: 'M15 16c1-5 5-7 10-7 7 0 10 3 10 9v10l2 3-5 4-3-3c-3 3-6 3-9 3-6 0-9-3-9-8 0-7 8-9 17-9v-1c0-3-1-4-4-4-2 0-4 1-4 4Zm13 7c-5 0-9 1-9 4 0 2 1 3 3 3 4 0 6-3 6-7Z' },
    { fill: colors.brandOrange, d: 'M8 37c9 5 21 5 30 0-7 9-23 9-30 0Zm24-2 9-1-1 9-3-5Z' },
  ],
})

/** Fallback for a pair whose currencies have no bundled flag. */
function PairBadge({ label, size }: { label: string; size: number }) {
  const styles = useThemeStyles(themeStyles)

  const pair = label.toUpperCase().replace(/[^A-Z]/g, '')
  const base = pair.slice(0, 3) || 'FX'
  const quote = pair.slice(3, 6) || 'FX'
  const coin = size * 0.66
  return (
    <View style={[styles.pair, { width: size, height: size }]}>
      <View style={[styles.currencyDisc, styles.currencyBase, { width: coin, height: coin, borderRadius: coin / 2 }]}>
        <Text style={[styles.currencyText, { fontSize: size * 0.18 }]}>{base}</Text>
      </View>
      <View style={[styles.currencyDisc, styles.currencyQuote, { width: coin, height: coin, borderRadius: coin / 2 }]}>
        <Text style={[styles.currencyText, styles.currencyQuoteText, { fontSize: size * 0.18 }]}>{quote}</Text>
      </View>
    </View>
  )
}

const themeStyles = (colors: Palette) => (StyleSheet.create({
  box: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  disc: {
    overflow: 'hidden',
  },
  ring: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderWidth: 1,
    borderColor: 'rgba(16, 24, 40, 0.08)',
  },
  pairQuote: {
    position: 'absolute',
    right: 0,
    bottom: 0,
  },
  pairBase: {
    position: 'absolute',
    left: -2,
    top: -2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  stock: { backgroundColor: colors.surface },
  pair: { justifyContent: 'center' },
  currencyDisc: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  currencyBase: { left: 0, top: 2, backgroundColor: colors.royal },
  currencyQuote: { right: 0, bottom: 2, backgroundColor: colors.gold },
  currencyText: { fontFamily: fonts.bold, color: colors.white, includeFontPadding: false },
  currencyQuoteText: { color: colors.royal },
  marketBadge: { backgroundColor: colors.royal },
  cryptoWordmark: { backgroundColor: colors.royal },
  badgeText: { fontFamily: fonts.bold, color: colors.white, includeFontPadding: false },
  glyph: {
    fontFamily: fonts.bold,
    color: colors.navy,
    includeFontPadding: false,
    textAlign: 'center',
  },
}))
