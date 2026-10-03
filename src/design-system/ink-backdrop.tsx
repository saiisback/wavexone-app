import { StyleSheet, View } from 'react-native'
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg'

import { colors } from './colors'
import { Watermark } from './watermark'

/**
 * The depth behind every navy hero surface: a diagonal wash from a lifted
 * navy to a deeper one, a soft light in the top corner and the brand "W".
 * Drawn absolutely behind the content and never reacts to touches.
 */
export function InkBackdrop({ watermark = true }: { watermark?: boolean }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="ink-wash" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors.inkLift} />
            <Stop offset="0.55" stopColor={colors.ink} />
            <Stop offset="1" stopColor={colors.inkDeep} />
          </LinearGradient>
          <RadialGradient id="ink-light" cx="0.15" cy="0" rx="0.7" ry="0.9">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.1} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#ink-wash)" />
        <Rect width="100%" height="100%" fill="url(#ink-light)" />
      </Svg>
      {watermark ? <Watermark size={150} right={-26} bottom={-28} /> : null}
    </View>
  )
}
