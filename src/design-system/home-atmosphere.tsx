import { useColors } from './theme'
import { StyleSheet, View } from 'react-native'
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg'


/**
 * Warm ivory-gold light field for the reference-led app shell.
 * SVG gradients keep the same falloff on iOS, Android and web without
 * introducing another native dependency.
 */
export function HomeAtmosphere() {
  const colors = useColors()

  return (
    <View pointerEvents="none" style={styles.layer}>
      <Svg width="100%" height="100%" viewBox="0 0 390 1200" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="home-canvas" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.referenceCanvasTop} />
            <Stop offset="0.28" stopColor={colors.referenceCanvas} />
            <Stop offset="0.62" stopColor={colors.referenceCanvasWarm} />
            <Stop offset="1" stopColor={colors.referenceCanvas} />
          </LinearGradient>
          <RadialGradient id="home-light" cx="0.12" cy="0.04" rx="0.88" ry="0.48">
            <Stop offset="0" stopColor={colors.sheen} stopOpacity={0.72} />
            <Stop offset="0.42" stopColor={colors.referenceCanvasTop} stopOpacity={0.3} />
            <Stop offset="1" stopColor={colors.referenceCanvasTop} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="home-depth" cx="0.92" cy="0.42" rx="0.86" ry="0.46">
            <Stop offset="0" stopColor={colors.referenceCanvasWarm} stopOpacity={0.96} />
            <Stop offset="0.58" stopColor={colors.gold} stopOpacity={0.24} />
            <Stop offset="1" stopColor={colors.referenceCanvas} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="390" height="1200" fill="url(#home-canvas)" />
        <Circle cx="70" cy="36" r="330" fill="url(#home-light)" />
        <Circle cx="420" cy="470" r="430" fill="url(#home-depth)" />
      </Svg>
    </View>
  )
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
  },
})
