import { useState } from 'react'
import { StyleSheet, View, type LayoutChangeEvent, type TextStyle } from 'react-native'
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { Stop } from 'react-native-svg'
import { AnimatedText, LineChart } from 'react-native-wagmi-charts'

import { Card, Text, colors, fonts, radius, type } from '../../design-system'
import { formatPrice } from '../../data/format'
import type { ChartSeries } from '../../data/types'
import { formatPercentWorklet, formatPriceWorklet, formatStampWorklet } from './worklet-format'
import './price-chart.css'

/**
 * The instrument chart, drawn by react-native-wagmi-charts.
 *
 * Split in three so the dark quote card above the plot can follow the
 * finger: `PriceChartProvider` owns the cursor, `PriceChart` is the plot and
 * `ChartReadout` is the price / date line that swaps to the scrubbed point.
 * Both of the latter must sit inside the provider.
 */
export function PriceChartProvider({
  series,
  children,
}: {
  series: ChartSeries
  children: React.ReactNode
}) {
  const data = series.points.map((value, index) => ({
    timestamp: series.times?.[index] ?? index,
    value,
  }))
  return (
    // Fixed to the round axis so the gridlines and the path agree.
    <LineChart.Provider data={data} yRange={{ min: series.min, max: series.max }}>
      {children}
    </LineChart.Provider>
  )
}

export type PriceChartProps = {
  series: ChartSeries
  /** Line and cursor colour. */
  color?: string
  /** Digits for the scrubbing tooltip; the axis's own decimals when absent. */
  precision?: number
}

/**
 * wagmi-charts reserves this strip under every line chart for its own time
 * label. The column labels here replace it, so the strip hangs below the
 * plot, transparent, rather than squeezing the line.
 */
const LABEL_STRIP = 40
/** How long a finger rests on the chart before the crosshair takes over. */
const SCRUB_HOLD_MS = 160

/** Space above the highest and below the lowest tick. */
const Y_GUTTER = 16

type Size = { width: number; height: number }

/**
 * The plot: faint hairline gridlines and a quiet price axis, a bright brand
 * line over a soft wash that fades to nothing, a dashed guide at the
 * period's first price, a pulsing dot on the live price, and a crosshair
 * (rule, ringed dot and a navy price tooltip) that eases in under a finger
 * or the pointer on web.
 *
 * Fills whatever space the parent gives it, so the card reaches the
 * Sell / Buy pair on every screen height.
 */
export function PriceChart({ series, color: override, precision }: PriceChartProps) {
  // Apple Stocks convention: green when the period closed above where it
  // opened, red when below.
  const first = series.points[0] ?? 0
  const final = series.points[series.points.length - 1] ?? first
  const color = override ?? (final < first ? colors.red : colors.green)
  // undefined until the first layout pass; nothing is drawn before then.
  const [size, setSize] = useState<Size | undefined>(undefined)

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout
    setSize((previous) =>
      previous?.width === width && previous?.height === height ? previous : { width, height },
    )
  }

  const ticks = buildTicks(series.min, series.max, series.step)
  const tickLabels = ticks.map((tick) => tick.toFixed(series.axisDecimals ?? 0))
  const axisWidth = 12 + Math.max(...tickLabels.map((label) => label.length)) * 7.6
  const last = series.points.length - 1
  const digits = precision ?? series.axisDecimals ?? 2
  // The tooltip text is a read-only input with no intrinsic width on web.
  const tipWidth = formatPrice(series.max, digits).length * 7.8 + 4
  const formatTip = ({ value }: { value: string }) => {
    'worklet'
    return formatPriceWorklet(Number(value), digits)
  }

  /** Same mapping wagmi uses for the path: `max` at the top gutter. */
  const tickY = (value: number, height: number) =>
    Y_GUTTER + ((series.max - value) / (series.max - series.min || 1)) * (height - Y_GUTTER * 2)

  return (
    <Card padded={false} style={styles.card}>
      <View style={styles.plotRow}>
        {/* The id scopes the web sizing fix in price-chart.css. */}
        <View nativeID="wavex-price-chart" style={styles.plot} onLayout={onLayout}>
          {size === undefined ? null : (
            <>
              {ticks.map((tick) => (
                <View
                  key={tick}
                  pointerEvents="none"
                  style={[styles.gridline, { top: tickY(tick, size.height) }]}
                />
              ))}

              <LineChart
                width={size.width}
                height={size.height + LABEL_STRIP}
                yGutter={Y_GUTTER}
                style={styles.chart}
              >
                <LineChart.Path
                  color={color}
                  width={2.4}
                  pathProps={{ strokeLinecap: 'round', strokeLinejoin: 'round' }}
                >
                  <LineChart.Gradient color={color}>
                    <Stop offset="0%" stopColor={color} stopOpacity={0.22} />
                    <Stop offset="55%" stopColor={color} stopOpacity={0.07} />
                    <Stop offset="100%" stopColor={color} stopOpacity={0} />
                  </LineChart.Gradient>
                  <LineChart.HorizontalLine
                    at={{ index: 0 }}
                    color={colors.textSubtle}
                    lineProps={{ strokeDasharray: '3 6', strokeWidth: 1, strokeOpacity: 0.7 }}
                  />
                  <LineChart.Dot at={last} color={color} size={4} hasPulse />
                </LineChart.Path>

                {/*
                  Touch-and-hold to scrub, as in Apple Stocks. Activating on
                  first contact swallowed every swipe that started on the
                  chart — including the back swipe.
                */}
                <LineChart.CursorCrosshair
                  minDurationMs={SCRUB_HOLD_MS}
                  color={color}
                  size={12}
                  outerSize={40}
                  crosshairProps={{ style: styles.crosshairDot }}
                  crosshairOuterProps={{ style: styles.crosshairHalo }}
                >
                  <CursorGuide height={size.height} color={color} />
                  <LineChart.Tooltip
                    position="top"
                    cursorGutter={30}
                    yGutter={2}
                    xGutter={4}
                    format={formatTip}
                    style={styles.tooltip}
                    textStyle={[styles.tooltipText, { width: tipWidth }]}
                  />
                  <LineChart.HoverTrap />
                </LineChart.CursorCrosshair>
              </LineChart>
            </>
          )}
        </View>

        <View style={{ width: axisWidth }} pointerEvents="none">
          {size === undefined
            ? null
            : tickLabels.map((label, index) => (
                <Text
                  key={label}
                  variant="micro"
                  color={colors.textSubtle}
                  style={[styles.axisLabel, { top: tickY(ticks[index], size.height) - 8 }]}
                >
                  {label}
                </Text>
              ))}
        </View>
      </View>

      <View style={[styles.columns, { paddingRight: axisWidth }]} pointerEvents="none">
        {series.labels.map((label, index) => (
          <Text
            key={`${label}-${index}`}
            variant="micro"
            color={colors.textSubtle}
            style={styles.column}
          >
            {label}
          </Text>
        ))}
      </View>
    </Card>
  )
}

/**
 * Vertical rule through the crosshair while the plot is being touched,
 * fading in and out rather than blinking, and drawn in the line's colour.
 */
function CursorGuide({ height, color }: { height: number; color: string }) {
  const { currentX, isActive } = LineChart.useChart()
  // A plain number animated on its own, read by the style below.
  const shown = useSharedValue(0)
  useAnimatedReaction(
    () => isActive.get(),
    (active) => {
      shown.set(withTiming(active ? 1 : 0, { duration: 140 }))
    },
  )
  const style = useAnimatedStyle(() => ({
    opacity: shown.get() * 0.45,
    transform: [{ translateX: currentX.get() }],
  }))
  return <Animated.View pointerEvents="none" style={[styles.guide, { height, backgroundColor: color }, style]} />
}

export type ChartReadoutProps = {
  /** Shown while nothing is touched: the streamed price. */
  price: number
  precision: number
  /** Shown under the price while nothing is touched. */
  caption: string
  /** Bars are intraday, so the scrubbed time reads hours and minutes. */
  intraday: boolean
  /** The series carries real bar times (fixtures without them show no date). */
  hasTimes: boolean
  priceStyle?: TextStyle
  captionStyle?: TextStyle
}

/**
 * Price and caption that follow the crosshair: the scrubbed close, its time
 * and its change from the start of the period. Updated on the UI thread.
 */
export function ChartReadout({
  price,
  precision,
  caption,
  intraday,
  hasTimes,
  priceStyle,
  captionStyle,
}: ChartReadoutProps) {
  const { currentIndex, isActive, data } = LineChart.useChart()
  const values = (data ?? []).map((point) => point.value)
  const stamps = (data ?? []).map((point) => point.timestamp)
  const idlePrice = formatPrice(price, precision)

  const priceText = useDerivedValue(() => {
    const index = currentIndex.get()
    if (!isActive.get() || index < 0 || index >= values.length) return idlePrice
    return formatPriceWorklet(values[index], precision)
  }, [idlePrice, values, precision])

  const captionText = useDerivedValue(() => {
    const index = currentIndex.get()
    if (!isActive.get() || index < 0 || index >= values.length) return caption
    const first = values[0]
    const change = first ? ((values[index] - first) / first) * 100 : 0
    const when = hasTimes ? `${formatStampWorklet(stamps[index], intraday)}  ·  ` : ''
    return `${when}${formatPercentWorklet(change)}`
  }, [caption, values, stamps, intraday, hasTimes])

  return (
    // wagmi's AnimatedText is a read-only TextInput; grouping it under one
    // label keeps screen readers from announcing two text fields.
    <View accessible accessibilityRole="text" accessibilityLabel={`${idlePrice}, ${caption}`} style={styles.readoutGroup}>
      <AnimatedText text={priceText} style={[styles.readout, priceStyle]} />
      <AnimatedText text={captionText} style={[styles.readout, captionStyle]} />
    </View>
  )
}

/** Counted rather than accumulated, so 1.1 - 0.001 steps do not drift. */
function buildTicks(min: number, max: number, step: number) {
  const count = Math.max(1, Math.round((max - min) / step))
  return Array.from({ length: count + 1 }, (_, index) => max - index * step)
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    paddingTop: 14,
    paddingBottom: 6,
    paddingLeft: 14,
    paddingRight: 8,
    borderRadius: radius.card,
  },
  plotRow: {
    flex: 1,
    flexDirection: 'row',
  },
  plot: {
    flex: 1,
  },
  chart: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  gridline: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.grid,
  },
  guide: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 1,
    marginLeft: -0.5,
    opacity: 0,
    zIndex: -1,
  },
  crosshairDot: {
    borderWidth: 3,
    borderColor: colors.surface,
    boxShadow: '0px 3px 10px rgba(20, 24, 43, 0.30)',
  },
  crosshairHalo: {
    opacity: 0.14,
  },
  tooltip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderCurve: 'continuous',
    backgroundColor: colors.brand,
    boxShadow: '0px 6px 16px rgba(20, 24, 43, 0.28)',
  },
  tooltipText: {
    fontFamily: fonts.semibold,
    fontSize: 12.5,
    lineHeight: 16,
    color: colors.onInk,
    textAlign: 'center',
    padding: 0,
    borderWidth: 0,
    fontVariant: ['tabular-nums'],
  },
  axisLabel: {
    position: 'absolute',
    left: 8,
    fontVariant: ['tabular-nums'],
  },
  columns: {
    flexDirection: 'row',
    height: 28,
    alignItems: 'center',
  },
  column: {
    flex: 1,
    textAlign: 'center',
  },
  readoutGroup: {
    gap: 4,
  },
  readout: {
    padding: 0,
    margin: 0,
    borderWidth: 0,
    includeFontPadding: false,
  },
})

/** Used by the hero read-out's text styles: the live price at hero size. */
export const readoutFonts = {
  price: { ...type.hero, fontSize: 42, lineHeight: 50, letterSpacing: -1.6, color: colors.onInk },
  caption: { ...type.caption, fontSize: 14, lineHeight: 18, color: colors.onInkMuted },
} as const
