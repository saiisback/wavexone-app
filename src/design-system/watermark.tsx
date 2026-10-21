import { useColors } from './theme'
import { StyleSheet, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'


/**
 * The oversized "W" printed faintly on every dark card, bleeding off the
 * right edge. Purely decorative, so it never reacts to touches.
 */
export function Watermark({
  size = 190,
  right = -34,
  bottom = -26,
  top,
  opacity = 1,
}: {
  size?: number
  right?: number
  bottom?: number
  top?: number
  opacity?: number
}) {
  const colors = useColors()

  return (
    <View
      pointerEvents="none"
      style={[
        styles.wrap,
        { right, opacity },
        top === undefined ? { bottom } : { top },
      ]}
    >
      <Svg width={size} height={size * 0.67} viewBox="0 0 108 72">
        <Path d="M0 0h28l19 44L66 0h22L56 72H34Z" fill={colors.watermark} />
        <Path d="M70 0h34L82 48Z" fill={colors.watermark} />
      </Svg>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
  },
})
