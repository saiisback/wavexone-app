import { StyleSheet, View } from 'react-native'
import { Stop } from 'react-native-svg'
import { LineChart } from 'react-native-wagmi-charts'

import { colors } from './colors'

export type SparklineProps = {
  /** Raw series; scaled to fit the box. */
  points: readonly number[]
  width?: number
  height?: number
  color?: string
  /** Line weight. */
  strokeWidth?: number
}

/**
 * wagmi-charts reserves this strip under every line chart for the cursor's
 * time label. A sparkline has no cursor, so the strip is drawn and clipped.
 */
const LABEL_STRIP = 40

/**
 * The little trend line on each market row: a smooth stroked path over a
 * soft wash that fades out before it reaches the baseline.
 *
 * Drawn by react-native-wagmi-charts, which animates the path when the
 * points change. Inside a recycling list, key the sparkline by instrument:
 * otherwise a recycled row morphs from the previous instrument's shape.
 */
export function Sparkline({
  points,
  width = 108,
  height = 44,
  color = colors.green,
  strokeWidth = 2,
}: SparklineProps) {
  const box = { width, height }
  if (points.length < 2) return <View style={box} />

  const data = points.map((value, index) => ({ timestamp: index, value }))

  return (
    <View style={[styles.clip, box]} pointerEvents="none">
      <LineChart.Provider data={data}>
        <LineChart width={width} height={height + LABEL_STRIP} yGutter={3}>
          <LineChart.Path
            color={color}
            width={strokeWidth}
            showInactivePath={false}
            pathProps={{ strokeLinecap: 'round', strokeLinejoin: 'round' }}
          >
            <LineChart.Gradient color={color}>
              <Stop offset="0%" stopColor={color} stopOpacity={0.24} />
              <Stop offset="100%" stopColor={color} stopOpacity={0} />
            </LineChart.Gradient>
          </LineChart.Path>
        </LineChart>
      </LineChart.Provider>
    </View>
  )
}

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
  },
})
