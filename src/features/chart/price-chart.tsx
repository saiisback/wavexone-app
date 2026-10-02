import { useState } from 'react'
import { StyleSheet, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native'
import Svg, { Circle, Defs, LinearGradient, Line, Path, Rect, Stop } from 'react-native-svg'

import { Card, DeltaTriangle, Text, colors, fonts } from '../../design-system'
import { formatPrice } from '../../data/format'

export type PriceChartProps = {
  series: readonly number[]
  /** Per-point opens; when present, touching the plot reads any point. */
  opens?: readonly number[]
  /** Column labels; the plot is divided into this many equal sections. */
  months: readonly string[]
  /** Index in `series` the crosshair reads. */
  cursorIndex: number
  cursorOpen: number
  cursorClose: number
  /** Axis bounds — fixed rather than derived so the labels stay round. */
  min: number
  max: number
  step: number
  /** Digits on the price axis. */
  axisDecimals?: number
  /** Digits in the open / close read-out. */
  precision?: number
}

type Size = { width: number; height: number }

const MONTH_ROW = 34

/**
 * The instrument chart.
 *
 * Drawn by hand with react-native-svg: a charting library cannot reproduce
 * the dashed crosshair, the gold cursor dot and the floating open/close
 * tooltip exactly as specified. The crosshair rests on the newest point and
 * follows a finger dragged across the plot.
 *
 * The plot fills whatever space the parent gives it, so the card reaches the
 * Sell / Buy pair on every screen height.
 */
export function PriceChart({
  series,
  opens,
  months,
  cursorIndex: restingIndex,
  cursorOpen: restingOpen,
  cursorClose: restingClose,
  min,
  max,
  step,
  axisDecimals = 0,
  precision = 2,
}: PriceChartProps) {
  // undefined until the first layout pass; nothing is drawn before then.
  const [size, setSize] = useState<Size | undefined>(undefined)
  // The point under the finger while the plot is being touched.
  const [touchIndex, setTouchIndex] = useState<number | null>(null)

  const inspecting = touchIndex !== null && opens !== undefined
  const cursorIndex = inspecting ? touchIndex : restingIndex
  const cursorOpen = inspecting ? (opens[touchIndex] ?? restingOpen) : restingOpen
  const cursorClose = inspecting ? (series[touchIndex] ?? restingClose) : restingClose

  const track = (event: GestureResponderEvent) => {
    if (!size || series.length < 2) return
    const index = Math.round((event.nativeEvent.locationX / size.width) * (series.length - 1))
    setTouchIndex(Math.max(0, Math.min(series.length - 1, index)))
  }

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout
    setSize((previous) => {
      if (previous?.width === width && previous?.height === height) return previous
      return { width, height }
    })
  }

  const ticks = buildTicks(min, max, step)
  const tickLabels = ticks.map((tick) => tick.toFixed(axisDecimals))
  const gutter = 14 + Math.max(...tickLabels.map((label) => label.length)) * 8.6

  return (
    <Card style={styles.card}>
      <View style={styles.plotRow}>
        <View
          style={styles.plot}
          onLayout={onLayout}
          onStartShouldSetResponder={() => opens !== undefined}
          onMoveShouldSetResponder={() => opens !== undefined}
          onResponderTerminationRequest={() => false}
          onResponderGrant={track}
          onResponderMove={track}
          onResponderRelease={() => setTouchIndex(null)}
          onResponderTerminate={() => setTouchIndex(null)}
        >
          {size === undefined ? null : (
            <Plot
              size={size}
              series={series}
              columns={months.length}
              rows={ticks.length - 1}
              cursorIndex={cursorIndex}
              min={min}
              max={max}
            />
          )}
        </View>

        <View style={{ width: gutter }}>
          {tickLabels.map((label, index) => (
            <Text
              key={label}
              variant="caption"
              color={colors.textMuted}
              style={[
                styles.axisLabel,
                { top: (index / (ticks.length - 1)) * (size?.height ?? 0) - 9 },
              ]}
            >
              {label}
            </Text>
          ))}
        </View>
      </View>

      <View style={[styles.months, { paddingRight: gutter }]}>
        {months.map((month) => (
          <Text key={month} variant="caption" color={colors.textMuted} style={styles.month}>
            {month}
          </Text>
        ))}
      </View>

      {size === undefined ? null : (
        <Tooltip
          open={cursorOpen}
          close={cursorClose}
          precision={precision}
          size={size}
          x={cursorX(size.width, series.length, cursorIndex)}
          y={cursorY(size.height, min, max, series[cursorIndex] ?? min)}
        />
      )}
    </Card>
  )
}

function Plot({
  size,
  series,
  columns,
  rows,
  cursorIndex,
  min,
  max,
}: {
  size: Size
  series: readonly number[]
  columns: number
  rows: number
  cursorIndex: number
  min: number
  max: number
}) {
  const { width, height } = size
  const stepX = width / (series.length - 1)
  const toY = (value: number) => ((max - value) / (max - min)) * height

  const points = series.map(
    (value, index) => `${(index * stepX).toFixed(2)} ${toY(value).toFixed(2)}`,
  )
  const line = `M${points.join(' L')}`
  const area = `${line} L${width} ${height} L0 ${height} Z`

  const cx = cursorX(width, series.length, cursorIndex)
  const cy = toY(series[cursorIndex] ?? min)

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="chart-wash" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.gold} stopOpacity={0.16} />
          <Stop offset="1" stopColor={colors.gold} stopOpacity={0} />
        </LinearGradient>
      </Defs>

      {/* Horizontal gridlines, one per axis tick. */}
      {range(rows + 1).map((index) => (
        <Line
          key={`h-${index}`}
          x1={0}
          x2={width}
          y1={(index / rows) * height}
          y2={(index / rows) * height}
          stroke={colors.grid}
          strokeWidth={1}
        />
      ))}

      {/* Vertical gridlines between month columns. */}
      {range(columns - 1).map((index) => (
        <Line
          key={`v-${index}`}
          x1={((index + 1) / columns) * width}
          x2={((index + 1) / columns) * width}
          y1={0}
          y2={height}
          stroke={colors.grid}
          strokeWidth={1}
        />
      ))}

      <Rect
        x={0.5}
        y={0.5}
        width={width - 1}
        height={height - 1}
        fill="none"
        stroke={colors.grid}
        strokeWidth={1}
      />

      <Path d={area} fill="url(#chart-wash)" />
      <Path
        d={line}
        fill="none"
        stroke={colors.gold}
        strokeWidth={2.6}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Crosshair on the cursor value. */}
      <Line x1={0} x2={width} y1={cy} y2={cy} stroke={colors.text} strokeWidth={1.4} strokeDasharray="7 6" />
      <Line x1={cx} x2={cx} y1={0} y2={height} stroke={colors.text} strokeWidth={1.4} strokeDasharray="7 6" />

      <Circle cx={cx} cy={cy} r={7.5} fill={colors.gold} stroke={colors.text} strokeWidth={1.6} />
    </Svg>
  )
}

/**
 * Dark read-out beside the crosshair intersection: lower-left by default,
 * flipped to stay inside the plot near its edges.
 */
function Tooltip({
  open,
  close,
  precision,
  size,
  x,
  y,
}: {
  open: number
  close: number
  precision: number
  size: Size
  x: number
  y: number
}) {
  const left = x - TOOLTIP_WIDTH - 12 >= 0 ? x - TOOLTIP_WIDTH - 12 : x + 12
  const below = y + 16 + TOOLTIP_HEIGHT <= size.height
  const top = below ? y + 16 : Math.max(0, y - 16 - TOOLTIP_HEIGHT)
  return (
    <View
      pointerEvents="none"
      style={[styles.tooltip, { left: Math.min(left, size.width - TOOLTIP_WIDTH), top }]}
    >
      <TooltipRow label="Open" value={open} precision={precision} direction="up" />
      <TooltipRow label="Close" value={close} precision={precision} direction="down" />
    </View>
  )
}

function TooltipRow({
  label,
  value,
  precision,
  direction,
}: {
  label: string
  value: number
  precision: number
  direction: 'up' | 'down'
}) {
  return (
    <View style={styles.tooltipRow}>
      <Text style={styles.tooltipLabel}>{label}</Text>
      <DeltaTriangle direction={direction} color={colors.onInk} size={12} />
      <Text style={styles.tooltipValue}>{formatPrice(value, precision)}</Text>
    </View>
  )
}

const TOOLTIP_WIDTH = 158
const TOOLTIP_HEIGHT = 72

function cursorX(width: number, length: number, index: number) {
  return (width / (length - 1)) * index
}

function cursorY(height: number, min: number, max: number, value: number) {
  return ((max - value) / (max - min)) * height
}

/** Counted rather than accumulated, so 1.1 - 0.001 steps do not drift. */
function buildTicks(min: number, max: number, step: number) {
  const count = Math.max(1, Math.round((max - min) / step))
  return Array.from({ length: count + 1 }, (_, index) => max - index * step)
}

function range(count: number) {
  return Array.from({ length: count }, (_, index) => index)
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    padding: 18,
    borderRadius: 20,
  },
  plotRow: {
    flex: 1,
    flexDirection: 'row',
  },
  plot: {
    flex: 1,
  },
  axisLabel: {
    position: 'absolute',
    left: 12,
    fontSize: 15,
  },
  months: {
    flexDirection: 'row',
    height: MONTH_ROW,
    alignItems: 'center',
  },
  month: {
    flex: 1,
    textAlign: 'center',
    fontSize: 15,
  },
  tooltip: {
    position: 'absolute',
    width: TOOLTIP_WIDTH,
    backgroundColor: colors.inkRaised,
    borderRadius: 14,
    borderCurve: 'continuous',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 8,
    marginLeft: 18,
    marginTop: 18,
  },
  tooltipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tooltipLabel: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.onInkMuted,
    width: 42,
  },
  tooltipValue: {
    flex: 1,
    textAlign: 'right',
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.onInk,
  },
})
