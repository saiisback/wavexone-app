import { useColors } from './theme'
import { useId } from 'react'
import { StyleSheet, View } from 'react-native'
import Svg, { Defs, LinearGradient, Polygon, Stop } from 'react-native-svg'

import { Text } from './text'
import { fonts } from './tokens'

type Tone = 'light' | 'dark'

/**
 * Exact polygons from wavexone.com/icon.svg, with its background removed
 * and bounds trimmed. White strokes become navy only on light surfaces.
 */
export function LogoMark({ size = 28, tone = 'light' }: { size?: number; tone?: Tone }) {
  const colors = useColors()

  const gradientId = `wavex-gold-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const ink = tone === 'dark' ? colors.logoOnInk : colors.logoInk
  return (
    <Svg width={size * (419.98 / 166.2)} height={size} viewBox="3 8.81 419.98 166.2">
      <Defs>
        <LinearGradient id={gradientId} x1="317.99" y1="71.98" x2="422.98" y2="71.98" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#d4af37" />
          <Stop offset="1" stopColor="#f4e04d" />
        </LinearGradient>
      </Defs>
      <Polygon points="87.7 175.01 168.94 175.01 84.24 8.81 3 8.81 87.7 175.01" fill={ink} />
      <Polygon points="168.94 175.01 87.7 175.01 172.37 8.81 253.61 8.81 168.94 175.01" fill={ink} />
      <Polygon points="317.99 55.44 341.74 8.81 422.98 8.81 358.61 135.15 317.99 55.44" fill={`url(#${gradientId})`} />
      <Polygon points="257.04 175.01 338.28 175.01 253.61 8.81 172.37 8.81 257.04 175.01" fill={ink} />
    </Svg>
  )
}

/**
 * Full lockup. "Wavex" is heavy, the "O" is a light gold ring and "ne"
 * returns to the wordmark grey.
 */
export function Logo({ size = 22, tone = 'light' }: { size?: number; tone?: Tone }) {
  const colors = useColors()

  const ink = tone === 'dark' ? colors.logoOnInk : colors.logoInk
  return (
    <View style={styles.row}>
      <LogoMark size={size * 0.95} tone={tone} />
      <Text style={[styles.word, { fontSize: size * 1.05, color: ink }]}>
        <Text style={[styles.heavy, { fontSize: size * 1.05, color: ink }]}>Wavex</Text>
        <Text style={[styles.word, { fontSize: size * 1.05, color: colors.gold }]}>O</Text>
        <Text style={[styles.word, { fontSize: size * 1.05, color: ink }]}>ne</Text>
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  word: {
    fontFamily: fonts.regular,
    letterSpacing: -0.2,
  },
  heavy: {
    fontFamily: fonts.extrabold,
    letterSpacing: -0.4,
  },
})
