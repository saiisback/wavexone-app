import { Image } from 'expo-image'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import Svg, { Circle, G, Path } from 'react-native-svg'
import {
  siAirbnb, siAirbus, siAmd, siAmericanexpress, siBmw, siCardano, siCisco, siCocacola,
  siCoinbase, siDropbox, siEbay, siFerrari, siFord, siGodaddy, siHermes, siIntel,
  siLitecoin, siLufthansa, siMastercard, siNike, siPaypal, siPinterest, siPolkadot,
  siPorsche, siQualcomm, siShopify, siSiemens, siSnapchat, siStarbucks, siTripadvisor,
  siUber, siVisa, siVolkswagen, siWix, siXiaomi, siZoom, type SimpleIcon,
} from 'simple-icons'

import { resolveAssetLogo, type LogoSource } from './asset-logo'
import { colors } from './colors'
import { Text } from './text'
import { fonts } from './tokens'
import { instrumentMonogram, type AssetIconKind, type StockMarkKind } from './instrument-marks'

export type { AssetIconKind } from './instrument-marks'

export type AssetIconProps = {
  kind: AssetIconKind
  size?: number
  /** Symbol or initials used for the generic monogram. */
  label?: string
  /** Optional bullion tint. Unknown marks always use the semantic navy palette. */
  tint?: string
  /**
   * The instrument's ticker ("AAPL", "EUR/USD", "BTC/USD"). When given, the
   * badge shows the real company logo, coin or flags and keeps the drawn
   * mark only as a fallback.
   */
  symbol?: string
  /** Narrows the logo lookup; "Stocks", "Forex", "Crypto", "Indices", … */
  category?: string
}

/**
 * Round instrument badge.
 *
 * Real artwork first (see `asset-logo.ts`), drawn marks second: metals and
 * energy are always drawn, and anything whose logo fails to load falls back
 * to a tinted disc with the instrument's initials.
 */
export function AssetIcon({ kind, size = 44, label = '', tint, symbol, category }: AssetIconProps) {
  const drawn = <DrawnIcon kind={kind} size={size} label={label || symbol || ''} tint={tint} />
  const logo = symbol ? resolveAssetLogo(symbol, category) : null
  if (!logo) return drawn

  if (logo.type === 'pair') {
    const disc = Math.round(size * 0.72)
    return (
      <View style={{ width: size, height: size }}>
        <View style={[styles.pairQuote, { width: disc, height: disc }]}>
          <LogoImage
            key={logo.quote[0]?.uri}
            sources={logo.quote}
            size={disc}
            fallback={<CodeDisc code={logo.quoteCode} size={disc} />}
          />
        </View>
        <View
          style={[
            styles.pairBase,
            { width: disc + 4, height: disc + 4, borderRadius: (disc + 4) / 2 },
          ]}
        >
          <LogoImage
            key={logo.base[0]?.uri}
            sources={logo.base}
            size={disc}
            fallback={<CodeDisc code={logo.baseCode} size={disc} />}
          />
        </View>
      </View>
    )
  }

  // Keyed so a recycled list row starts again from the first source.
  return <LogoImage key={logo.sources[0]?.uri} sources={logo.sources} size={size} fallback={drawn} />
}

/** Walks `sources` on load errors; renders `fallback` once they are spent. */
function LogoImage({
  sources,
  size,
  fallback,
}: {
  sources: readonly LogoSource[]
  size: number
  fallback: React.ReactElement
}) {
  const [attempt, setAttempt] = useState(0)
  const source = sources[attempt]
  if (!source) return fallback

  const contained = source.fit === 'contain'
  const inner = contained ? Math.round(size * 0.64) : size

  return (
    <View
      style={[
        styles.disc,
        contained ? styles.plate : styles.well,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Image
        source={{ uri: source.uri }}
        contentFit={source.fit}
        cachePolicy="memory-disk"
        transition={140}
        onError={() => setAttempt((previous) => previous + 1)}
        style={{ width: inner, height: inner }}
        accessibilityIgnoresInvertColors
      />
      {/* A hairline keeps white logos and pale flags off the white card. */}
      <View pointerEvents="none" style={[styles.ring, { borderRadius: size / 2 }]} />
    </View>
  )
}

/** Fallback for a flag that failed: the currency code on a neutral disc. */
function CodeDisc({ code, size }: { code: string; size: number }) {
  return (
    <View style={[styles.disc, styles.well, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.code, { fontSize: size * 0.3 }]}>{code}</Text>
    </View>
  )
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

/** Compact, bundled silhouettes; no remote image, font or per-row request. */
const STOCK_PATHS: Record<StockMarkKind, readonly { d: string; fill: string }[]> = {
  apple: [{ fill: colors.ink, d: 'M29 8c.3 4-2.8 7-6 7-.3-3.6 2.6-6.7 6-7ZM32.5 25c0-4 3.3-6 3.5-6.1-2-3-5.2-3.5-6.4-3.5-2.8-.3-5.4 1.7-6.8 1.7-1.3 0-3.4-1.6-5.6-1.5-3 .1-5.8 1.8-7.3 4.4-3.2 5.6-.8 14 2.3 18.4 1.5 2.2 3.1 4.4 5.4 4.3 2.2-.1 3-1.4 5.7-1.4s3.5 1.4 5.8 1.3c2.4 0 3.8-2.2 5.2-4.4 1.7-2.4 2.4-4.7 2.5-4.8-4.7-2-4.3-8.4-4.3-8.4Z' }],
  tesla: [{ fill: colors.brandRed, d: 'M9 11c9-5 21-5 30 0l-2 4c-8-4-18-4-26 0ZM13 17c7-3 15-3 22 0l-3 4-5-2-3 23-3-23-5 2Z' }],
  nvidia: [{ fill: colors.brandGreen, d: 'M6 24c8-11 24-14 37-3v14H25v-5h13v-6c-9-6-18-6-26 0 6 7 16 9 23 3-4 1-9 0-12-3 3-4 8-4 11-1-1-7-12-9-18 1 4 7 13 9 20 5l-3 7C23 41 12 34 6 24ZM25 10h18v8c-6-4-12-5-18-4Z' }],
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
  meta: [{ fill: colors.brandBlue, d: 'M7 28c0-9 3-16 8-16 5 0 10 8 14 15 3 5 4 7 7 7 3 0 4-3 4-7 0-7-3-11-5-11-4 0-8 8-12 14-4 6-6 10-11 10-6 0-10-4-10-11l5-1Zm0 1c0 4 2 6 5 6 3 0 5-4 9-10 5-8 9-13 14-13 6 0 10 7 10 15s-3 13-9 13c-6 0-9-5-13-12-4-6-7-11-9-11-4 0-7 6-7 12Z' }],
  google: [
    { fill: colors.brandBlue, d: 'M41 21H24v7h10c-1 4-4 7-10 7v7c11 0 18-8 18-18Z' },
    { fill: colors.brandGreen, d: 'M24 42c6 0 11-2 14-5l-6-5c-2 2-5 3-8 3-5 0-9-3-11-7l-6 5c3 5 9 9 17 9Z' },
    { fill: colors.brandYellow, d: 'M13 28c-1-3-1-5 0-8l-6-5c-4 6-4 12 0 18Z' },
    { fill: colors.brandRed, d: 'M13 20c2-4 6-7 11-7 3 0 6 1 8 3l6-6c-4-3-8-4-14-4-8 0-14 4-17 9Z' },
  ],
  netflix: [
    { fill: colors.brandRedDeep, d: 'M12 8h8v33l-8 1ZM28 8h8v34l-8-1Z' },
    { fill: colors.brandRed, d: 'M12 8h8l16 34-8-1Z' },
  ],
  airbnb: [], airbus: [], amd: [], americanExpress: [], bmw: [], cisco: [], cocaCola: [],
  coinbase: [], dropbox: [], ebay: [], ferrari: [], ford: [], goDaddy: [], hermes: [],
  intel: [], lufthansa: [], mastercard: [], nike: [], paypal: [], pinterest: [], porsche: [],
  qualcomm: [], shopify: [], siemens: [], snapchat: [], starbucks: [], tripadvisor: [],
  uber: [], visa: [], volkswagen: [], wix: [], xiaomi: [], zoom: [],
}

const BRAND_ICONS: Partial<Record<AssetIconKind, SimpleIcon>> = {
  airbnb: siAirbnb, airbus: siAirbus, amd: siAmd, americanExpress: siAmericanexpress,
  bmw: siBmw, cisco: siCisco, cocaCola: siCocacola, coinbase: siCoinbase, dropbox: siDropbox,
  ebay: siEbay, ferrari: siFerrari, ford: siFord, goDaddy: siGodaddy, hermes: siHermes,
  intel: siIntel, lufthansa: siLufthansa, mastercard: siMastercard, nike: siNike,
  paypal: siPaypal, pinterest: siPinterest, porsche: siPorsche, qualcomm: siQualcomm,
  shopify: siShopify, siemens: siSiemens, snapchat: siSnapchat, starbucks: siStarbucks,
  tripadvisor: siTripadvisor, uber: siUber, visa: siVisa, volkswagen: siVolkswagen,
  wix: siWix, xiaomi: siXiaomi, zoom: siZoom,
  litecoin: siLitecoin, cardano: siCardano, polkadot: siPolkadot,
}

function BrandIcon({ icon, size }: { icon: SimpleIcon; size: number }) {
  return (
    <View style={[styles.box, styles.stock, { width: size, height: size, borderRadius: size / 2 }]}>
      <Svg width={size * 0.66} height={size * 0.66} viewBox="0 0 24 24">
        <Path d={icon.path} fill={`#${icon.hex}`} />
      </Svg>
    </View>
  )
}

function PairBadge({ label, size }: { label: string; size: number }) {
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

/** Bundled marks: metals, energy, brands, coins, pairs and monograms. */
function DrawnIcon({ kind, size, label, tint }: { kind: AssetIconKind; size: number; label: string; tint?: string }) {
  const brandIcon = BRAND_ICONS[kind]
  if (brandIcon) return <BrandIcon icon={brandIcon} size={size} />

  if (Object.hasOwn(STOCK_PATHS, kind) && STOCK_PATHS[kind as StockMarkKind].length > 0) {
    return (
      <View style={[styles.box, styles.stock, { width: size, height: size, borderRadius: size / 2 }]}>
        <Svg width={size * 0.8} height={size * 0.8} viewBox="0 0 48 48">
          {STOCK_PATHS[kind as StockMarkKind].map(({ d, fill }) => <Path key={d} d={d} fill={fill} />)}
        </Svg>
      </View>
    )
  }

  if (kind === 'gold' || kind === 'silver' || kind === 'copper' || kind === 'platinum' || kind === 'palladium') {
    const metalTints = {
      gold: colors.gold,
      silver: colors.silver,
      copper: '#B87333',
      platinum: '#8D98A7',
      palladium: '#697584',
    } as const
    const bullionTint = tint ?? metalTints[kind]
    return (
      <View style={[styles.box, { width: size, height: size }]}>
        <Bullion size={size * 0.94} tint={bullionTint} />
      </View>
    )
  }

  if (kind === 'forex') {
    return (
      <View style={[styles.box, { width: size, height: size }]}>
        <PairBadge label={label} size={size} />
      </View>
    )
  }

  if (kind === 'bitcoin' || kind === 'ethereum' || kind === 'oil' || kind === 'gas') {
    const disc = kind === 'bitcoin' ? colors.bitcoin : kind === 'ethereum' ? colors.ethereum : colors.ink
    return (
      <Svg width={size} height={size} viewBox="0 0 48 48">
        <Circle cx="24" cy="24" r="24" fill={disc} />
        {kind === 'bitcoin' ? (
          <Path fill={colors.onInk} fillRule="evenodd" d="M19 9h3v5h3V9h3v5c7 1 9 9 3 12 7 3 5 12-3 13v4h-3v-4h-3v4h-3v-4h-6v-4h3V18h-3v-4h6Zm3 9v7h4c5 0 5-7 0-7Zm0 11v6h5c5 0 5-6 0-6Z" transform="translate(3 -2) rotate(12 24 24)" />
        ) : kind === 'ethereum' ? (
          <>
            <Path fill={colors.onInk} d="M24 7 13 25l11 6 11-6Z" />
            <Path fill={colors.onInkMuted} d="m13 28 11 14 11-14-11 6Z" />
          </>
        ) : kind === 'oil' ? (
          <Path fill={colors.onInk} d="M24 7c-3 6-13 14-13 22a13 13 0 0 0 26 0c0-8-10-16-13-22Zm-7 23a7 7 0 0 0 7 7v-3a4 4 0 0 1-4-4Z" fillRule="evenodd" />
        ) : (
          <Path fill={colors.onInk} d="M27 5c2 8-5 10-2 16 2-3 5-5 8-6 4 5 7 10 7 16 0 9-7 14-16 14S8 39 8 30c0-8 5-14 11-20-1 7 1 10 4 12-1-8 2-13 4-17Zm-3 35c5 0 8-3 8-8 0-3-2-6-4-9 0 5-3 7-5 10-1-3-3-5-5-6-1 2-2 4-2 6 0 4 3 7 8 7Z" />
        )}
      </Svg>
    )
  }

  if (kind === 'eos') {
    return (
      <View style={[styles.box, styles.cryptoWordmark, { width: size, height: size, borderRadius: size / 2 }]}>
        <Text style={[styles.badgeText, { fontSize: size * 0.22 }]}>EOS</Text>
      </View>
    )
  }

  if (kind === 'index' || kind === 'stock') {
    const compact = label.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, kind === 'index' ? 5 : 4) || (kind === 'index' ? 'IDX' : 'STK')
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
      <Text style={[styles.glyph, { fontSize: size * 0.34 }]}>{instrumentMonogram(label)}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  disc: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  /** Behind cover artwork while it decodes. */
  well: {
    backgroundColor: colors.track,
  },
  /** Behind transparent marks. */
  plate: {
    backgroundColor: colors.surface,
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
  code: {
    fontFamily: fonts.bold,
    color: colors.textMuted,
    includeFontPadding: false,
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
  currencyBase: { left: 0, top: 2, backgroundColor: colors.navy },
  currencyQuote: { right: 0, bottom: 2, backgroundColor: colors.gold },
  currencyText: { fontFamily: fonts.bold, color: colors.onInk, includeFontPadding: false },
  currencyQuoteText: { color: colors.navy },
  marketBadge: { backgroundColor: colors.navy },
  cryptoWordmark: { backgroundColor: colors.ink },
  badgeText: { fontFamily: fonts.bold, color: colors.onInk, includeFontPadding: false },
  glyph: {
    fontFamily: fonts.bold,
    color: colors.navy,
    includeFontPadding: false,
    textAlign: 'center',
  },
})
