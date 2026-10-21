import { useColors } from './theme'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Stop } from 'react-native-svg'
import { LineChart } from 'react-native-wagmi-charts'

import './sparkline.css'

export type SparklineProps = {
  /** Raw series; scaled to fit the box. */
  points: readonly number[]
  /** `fill` takes the width of the parent, measured on layout. */
  width?: number | 'fill'
  height?: number
  color?: string
  /** Line weight. */
  strokeWidth?: number
  /** Marks the latest value with a dot, for lines large enough to read it. */
  showEndpoint?: boolean
  /** Strength of the wash under the line, 0–1. */
  fillOpacity?: number
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
export function Sparkline({ width = 108, ...props }: SparklineProps) {
  const [measured, setMeasured] = useState(0)
  if (width !== 'fill') return <SparklinePath {...props} width={width} />
  return (
    <View onLayout={(event) => setMeasured(Math.round(event.nativeEvent.layout.width))}>
      {measured > 0 ? <SparklinePath key={measured} {...props} width={measured} /> : <View style={{ height: props.height ?? 44 }} />}
    </View>
  )
}

function SparklinePath({
  points,
  width,
  height = 44,
  color,
  strokeWidth = 2,
  showEndpoint = false,
  fillOpacity = 0.24,
}: Omit<SparklineProps, 'width'> & { width: number }) {
  const colors = useColors()
  color ??= colors.green

  const box = { width, height }
  if (points.length < 2) return <View style={box} />

  const data = points.map((value, index) => ({ timestamp: index, value }))
  // The chart has no horizontal gutter; leave room for the dot's halo.
  const chartWidth = showEndpoint ? width - DOT : width
  const gutter = showEndpoint ? DOT : 3

  return (
    // The id scopes the web sizing fix in sparkline.css.
    <View nativeID="wavex-sparkline" style={[styles.clip, box]} pointerEvents="none">
      <LineChart.Provider data={data}>
        <LineChart width={chartWidth} height={height + LABEL_STRIP} yGutter={gutter}>
          <LineChart.Path
            color={color}
            width={strokeWidth}
            showInactivePath={false}
            pathProps={{ strokeLinecap: 'round', strokeLinejoin: 'round' }}
          >
            <LineChart.Gradient color={color}>
              <Stop offset="0%" stopColor={color} stopOpacity={fillOpacity} />
              <Stop offset="100%" stopColor={color} stopOpacity={0} />
            </LineChart.Gradient>
          </LineChart.Path>
        </LineChart>
      </LineChart.Provider>
      {showEndpoint ? <EndpointDot points={points} x={chartWidth} height={height} gutter={gutter} color={color} /> : null}
    </View>
  )
}

const DOT = 6

/**
 * The latest value, placed with the same scale the chart uses
 * (wagmi maps the range onto `[height - gutter, gutter]`).
 */
function EndpointDot({
  points,
  x,
  height,
  gutter,
  color,
}: {
  points: readonly number[]
  x: number
  height: number
  gutter: number
  color: string
}) {
  const min = Math.min(...points)
  const max = Math.max(...points)
  const last = points[points.length - 1]
  const share = max === min ? 0.5 : (last - min) / (max - min)
  const y = height - gutter - share * (height - 2 * gutter)
  return (
    <View
      // Hex colour plus alpha: a soft ring of the line's own colour.
      style={[styles.halo, { left: x - DOT, top: y - DOT, backgroundColor: `${color}33` }]}
    >
      <View style={[styles.dot, { backgroundColor: color }]} />
    </View>
  )
}

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
  },
  halo: {
    position: 'absolute',
    width: DOT * 2,
    height: DOT * 2,
    borderRadius: DOT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
  },
})
