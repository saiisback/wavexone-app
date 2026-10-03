import { StyleSheet, View } from 'react-native'
import Svg, { Circle, G, Path } from 'react-native-svg'

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
}

/**
 * Round instrument badge. Everything other than the drawn marks falls back
 * to a tinted disc with the instrument's initials.
 */
export function AssetIcon({ kind, size = 44, label = '', tint }: AssetIconProps) {
  if (Object.hasOwn(STOCK_PATHS, kind)) {
    return (
      <View style={[styles.box, styles.stock, { width: size, height: size, borderRadius: size / 2 }]}>
        <Svg width={size * 0.8} height={size * 0.8} viewBox="0 0 48 48">
          {STOCK_PATHS[kind as StockMarkKind].map(({ d, fill }) => <Path key={d} d={d} fill={fill} />)}
        </Svg>
      </View>
    )
  }

  if (kind === 'gold' || kind === 'silver') {
    const bullionTint = tint ?? (kind === 'gold' ? colors.gold : colors.silver)
    return (
      <View style={[styles.box, { width: size, height: size }]}>
        <Bullion size={size * 0.94} tint={bullionTint} />
      </View>
    )
  }

  if (kind === 'euro') {
    return (
      <View style={[styles.box, { width: size, height: size }]}>
        <EuroFlag size={size} />
      </View>
    )
  }

  if (kind === 'bitcoin' || kind === 'ethereum' || kind === 'oil') {
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
        ) : (
          <Path fill={colors.onInk} d="M24 7c-3 6-13 14-13 22a13 13 0 0 0 26 0c0-8-10-16-13-22Zm-7 23a7 7 0 0 0 7 7v-3a4 4 0 0 1-4-4Z" fillRule="evenodd" />
        )}
      </Svg>
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
    overflow: 'hidden',
  },
  stock: { backgroundColor: colors.surface },
  glyph: {
    fontFamily: fonts.bold,
    color: colors.navy,
    includeFontPadding: false,
    textAlign: 'center',
  },
})
