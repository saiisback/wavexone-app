import { StyleSheet, View, type DimensionValue } from 'react-native'
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg'

/**
 * The page canvas: neutral light grey with a soft pool of white light at the
 * top and a slightly deeper grey lower down — no hue — so frosted white
 * panes read as glass, the way macOS windows sit on the desktop. Static and
 * fixed behind the scroll view; purely decorative.
 */
export function Aurora({ height = '100%' }: { height?: DimensionValue }) {
  return (
    <View pointerEvents="none" style={[styles.wrap, { height }]}>
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <RadialGradient id="aurora-light" cx="0.5" cy="0" rx="0.9" ry="0.4">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.9} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="aurora-shade" cx="0.5" cy="1" rx="1" ry="0.5">
            <Stop offset="0" stopColor="#E3E3E8" stopOpacity={0.8} />
            <Stop offset="1" stopColor="#E3E3E8" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#aurora-light)" />
        <Rect width="100%" height="100%" fill="url(#aurora-shade)" />
      </Svg>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
})
