import { Image } from 'expo-image'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import Svg, { Circle, Defs, G, LinearGradient, Path, Stop } from 'react-native-svg'

import { resolveAssetLogo, type LogoSource } from './asset-logo'
import { colors } from './colors'
import { Text } from './text'
import { fonts } from './tokens'

export type AssetIconKind = 'gold' | 'silver' | 'euro' | 'bitcoin' | 'ethereum' | 'oil' | 'generic'

export type AssetIconProps = {
  kind: AssetIconKind
  size?: number
  /** Shown by the `generic` kind — one or two letters. */
  label?: string
  /** Shown by the `generic` kind. */
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
  const drawn = <DrawnIcon kind={kind} size={size} label={label || initials(symbol)} tint={tint} />
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

function DrawnIcon({
  kind,
  size,
  label,
  tint,
}: {
  kind: AssetIconKind
  size: number
  label: string
  tint?: string
}) {
  if (kind === 'gold' || kind === 'silver') {
    const metal = kind === 'gold' ? GOLD : SILVER
    return (
      <View
        style={[
          styles.disc,
          { width: size, height: size, borderRadius: size / 2, backgroundColor: metal.disc },
        ]}
      >
        <Bullion size={size * 0.6} tint={tint ?? metal.bars} />
      </View>
    )
  }

  if (kind === 'euro') {
    return (
      <View style={[styles.disc, { width: size, height: size, borderRadius: size / 2 }]}>
        <EuroFlag size={size} />
      </View>
    )
  }

  if (kind === 'oil') {
    return (
      <View
        style={[
          styles.disc,
          { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.ink },
        ]}
      >
        <OilDrop size={size * 0.52} />
      </View>
    )
  }

  if (kind === 'bitcoin' || kind === 'ethereum') {
    return (
      <View
        style={[
          styles.disc,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: kind === 'bitcoin' ? colors.bitcoin : '#627EEA',
          },
        ]}
      >
        <Text style={[styles.glyph, { fontSize: size * 0.5, color: colors.surface }]}>
          {kind === 'bitcoin' ? '₿' : 'Ξ'}
        </Text>
      </View>
    )
  }

  // An explicit tint keeps the old solid disc; otherwise a soft tone keyed
  // to the label, so neighbouring rows do not all read as the same badge.
  const tone = tint ? { disc: tint, text: colors.surface } : toneFor(label)
  return (
    <View
      style={[
        styles.disc,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: tone.disc },
      ]}
    >
      <Text
        style={[styles.glyph, { fontSize: size * (label.length > 1 ? 0.36 : 0.46), color: tone.text }]}
      >
        {label}
      </Text>
    </View>
  )
}

const GOLD = { disc: colors.goldSoft, bars: colors.goldDeep }
const SILVER = { disc: '#EEF0F3', bars: '#9AA3AD' }

/** Soft disc + strong letter pairs for the initials badge. */
const TONES = [
  { disc: '#E7EDFF', text: '#3355D1' },
  { disc: '#DDF5EA', text: '#127A4B' },
  { disc: '#FFF0D6', text: '#B26A00' },
  { disc: '#FDE4DF', text: '#C2410C' },
  { disc: '#EEE6FF', text: '#6B3FD6' },
  { disc: '#DDF3F7', text: '#0E7C90' },
  { disc: '#FCE4EE', text: '#BE2D63' },
  { disc: '#ECEEF1', text: '#41474F' },
] as const

function toneFor(label: string) {
  let hash = 0
  for (let index = 0; index < label.length; index += 1) {
    hash = (hash * 31 + label.charCodeAt(index)) >>> 0
  }
  return TONES[hash % TONES.length]
}

function initials(symbol: string | undefined) {
  return symbol ? symbol.replace(/^[A-Za-z]:/, '').replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() : ''
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

/** A crude-oil drop with a highlight, on the ink disc. */
function OilDrop({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Defs>
        <LinearGradient id="oil-drop" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.gold} />
          <Stop offset="1" stopColor={colors.goldDeep} />
        </LinearGradient>
      </Defs>
      <Path d="M12 2.2c3.6 4.6 6.6 8.6 6.6 12.2a6.6 6.6 0 1 1-13.2 0C5.4 10.8 8.4 6.8 12 2.2Z" fill="url(#oil-drop)" />
      <Path d="M9.2 14.6a3 3 0 0 0 2.4 3" stroke={colors.ink} strokeOpacity={0.45} strokeWidth={1.6} strokeLinecap="round" fill="none" />
    </Svg>
  )
}

/** Circle of twelve stars on the EU blue disc. */
function EuroFlag({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Circle cx="24" cy="24" r="24" fill={colors.euBlue} />
      <G fill={colors.euStar}>
        {STAR_ANGLES.map((angle) => {
          const rad = (angle * Math.PI) / 180
          return (
            <Path
              key={angle}
              d={STAR_PATH}
              transform={`translate(${24 + 14.5 * Math.sin(rad)} ${24 - 14.5 * Math.cos(rad)})`}
            />
          )
        })}
      </G>
    </Svg>
  )
}

/** Twelve evenly spaced positions, clock-face order. */
const STAR_ANGLES = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]

/** A five-pointed star with its centroid at the origin, radius ~3.2. */
const STAR_PATH = 'M0 -3.2 0.94 -1 3.2 -1 1.4 0.4 2.1 2.6 0 1.3 -2.1 2.6 -1.4 0.4 -3.2 -1 -0.94 -1Z'

const styles = StyleSheet.create({
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
  glyph: {
    fontFamily: fonts.bold,
    includeFontPadding: false,
    textAlign: 'center',
  },
  code: {
    fontFamily: fonts.bold,
    color: colors.textMuted,
    includeFontPadding: false,
  },
})
