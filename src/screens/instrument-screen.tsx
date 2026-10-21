import { useColors, useThemeStyles } from '../design-system/theme'
import type { Palette } from '../design-system/colors'
import { useRoute, type RouteProp } from '@react-navigation/native'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import {
  ArrowLeftIcon,
  AssetIcon,
  Button,
  ButtonSubText,
  ButtonText,
  Card,
  CircleButton,
  Delta,
  Glass,
  Gutter,
  HomeAtmosphere,
  LiveDot,
  ProgressBar,
  Reveal,
  Screen,
  SegmentedControl,
  StarIcon,
  Text,
  TickFlash,
  radius,
  shadow,
  spacing,
  useSafeBack,
} from '../design-system'
import { readoutFonts } from '../features/chart/chart-readout-fonts'
import { TradingViewChart } from '../features/chart/tradingview-chart'
import { useBackendQuery } from '../backend/provider'
import { withLivePrice } from '../data/chart-series'
import { directionOf, formatPercent, formatPrice } from '../data/format'
import { applyQuote } from '../data/live-quote'
import { useSession } from '../data/store'
import type { CandleInterval, ChartSeries, Instrument, Timeframe } from '../data/types'
import { useLiveQuote } from '../features/markets/use-live-quote'
import { useSetFavorite } from '../features/markets/use-market-data'
import { QueryStateView } from '../features/shared/query-state'
import { useAppNavigation } from '../navigation/use-app-navigation'
import type { RootStackParamList } from '../navigation/types'

type InstrumentRoute = RouteProp<RootStackParamList, 'Instrument'>
const TIMEFRAMES: readonly Timeframe[] = ['1D', '5D', '1W', '1M', '3M', '6M']
const INTERVALS: readonly ('Auto' | CandleInterval)[] = ['Auto', '1m', '5m', '15m', '1h', '4h', '1D']

/** How the idle caption names each timeframe's window. */
const PERIOD_NAMES: Record<Timeframe, string> = {
  '1D': 'today',
  '5D': 'past 5 days',
  '1W': 'past week',
  '1M': 'past month',
  '3M': 'past 3 months',
  '6M': 'past 6 months',
}

/** Height of the plot card; the page scrolls, so the chart gets a fixed stage. */
const CHART_HEIGHT = 420
/** Room under the scroll content for the docked Sell / Buy bar. */
const DOCK_CLEARANCE = 112

/**
 * Instrument detail: a luminous live-price card, a timeframe switch with a
 * gliding thumb, the chart on a white card, a grid of quote statistics, and
 * the Sell / Buy pair docked at the foot. TradingView handles its own
 * crosshair readout while the price card continues to show the live quote.
 */
export function InstrumentScreen() {
  const colors = useColors()
  const styles = useThemeStyles(themeStyles)

  const goBack = useSafeBack()
  const { params } = useRoute<InstrumentRoute>()
  const { openOrderTicket } = useAppNavigation()
  const insets = useSafeAreaInsets()
  const { height } = useWindowDimensions()
  const scroll = useRef<ScrollView>(null)

  const [timeframe, setTimeframe] = useState<Timeframe>('1M')
  const [interval, setInterval] = useState<'Auto' | CandleInterval>('Auto')
  const [expanded, setExpanded] = useState(false)
  const [retained, setRetained] = useState<{ id: string; range: Timeframe; interval: typeof interval; series: ChartSeries }>()
  const [chartAttempt, setChartAttempt] = useState(0)
  const setFavorite = useSetFavorite()
  const instrumentState = useBackendQuery(`instrument:${params.instrumentId}`, (backend) =>
    backend.markets.quoteSnapshot([params.instrumentId]),
  )
  const chart = useBackendQuery(`chart:${params.instrumentId}:${timeframe}:${interval}`, (backend) =>
    interval === 'Auto' ? backend.markets.candles(params.instrumentId, timeframe) : backend.markets.candles(params.instrumentId, timeframe, interval),
  )
  // Keep the last completed window visible without an extra effect-driven render.
  if (chart.status === 'ready' && (retained?.series !== chart.data || retained.id !== params.instrumentId || retained.range !== timeframe || retained.interval !== interval)) {
    setRetained({ id: params.instrumentId, range: timeframe, interval, series: chart.data })
  }
  useEffect(() => { scroll.current?.scrollTo({ y: 0, animated: false }) }, [expanded])

  const quote = useLiveQuote(params.instrumentId)
  const listed = instrumentState.status === 'ready' ? instrumentState.data[0] : undefined
  const instrument = listed ? applyQuote(listed, quote) : undefined
  const displayed = chart.status === 'ready'
    ? { range: timeframe, interval, series: chart.data }
    : retained?.id === params.instrumentId ? retained : undefined
  const baseSeries = displayed?.series
  const series = useMemo(() => baseSeries ? withLivePrice(baseSeries, quote?.price ?? listed?.price) : undefined,
    [baseSeries, quote?.price, listed?.price])

  const isFavorite = useSession((state) => state.favorites.has(params.instrumentId))
  const toggleFavorite = useSession((state) => state.toggleFavorite)

  if (instrumentState.status !== 'ready' || !instrument) {
    return (
      <Screen aurora={false} style={styles.root}>
        <HomeAtmosphere />
        <Gutter style={styles.state}>
          <QueryStateView state={instrumentState} emptyTitle="Instrument unavailable" render={() => null} />
        </Gutter>
      </Screen>
    )
  }

  const favorite = () => {
    const next = !isFavorite
    toggleFavorite(instrument.id)
    void setFavorite(instrument.id, next).catch(() => toggleFavorite(instrument.id))
  }

  // The newest point follows the streamed price.

  const content = (
    <ScrollView
      ref={scroll}
      scrollEnabled={!expanded || height < 560}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.scroll, { paddingBottom: expanded ? insets.bottom : DOCK_CLEARANCE + Math.max(insets.bottom, 14) }]}
    >
      <Reveal index={0} style={expanded ? styles.hidden : undefined}>
        <Gutter>
          <QuoteCard instrument={instrument} series={series} timeframe={displayed?.range ?? timeframe} />
        </Gutter>
      </Reveal>

      <Reveal index={1} distance={10}>
        <Gutter style={styles.controls}>
          <Text variant="caption" color={colors.textMuted}>Date window</Text>
          <SegmentedControl options={TIMEFRAMES} value={timeframe} onChange={setTimeframe} />
          <Text variant="caption" color={colors.textMuted}>Candle interval</Text>
          <SegmentedControl options={INTERVALS} value={interval} onChange={setInterval} />
          <Button tone="ink" accessibilityLabel={expanded ? 'Close fullscreen chart' : 'Expand chart'} onPress={() => setExpanded((value) => !value)}>
            <ButtonText tone="ink">{expanded ? 'Close fullscreen chart' : 'Expand chart'}</ButtonText>
          </Button>
          {chart.status === 'loading' && <Text variant="caption" accessibilityLiveRegion="polite">Loading chart…</Text>}
          {chart.status === 'error' && <QueryStateView state={chart} render={() => null} />}
          {interval !== 'Auto' && <Text variant="caption" color={colors.textMuted}>Up to 500 candles within this window.</Text>}
        </Gutter>
      </Reveal>

      <Reveal index={2}>
        <Gutter style={[styles.chart, { height: expanded ? Math.max(180, height - insets.top - insets.bottom - 300) : Math.min(CHART_HEIGHT, Math.max(280, height * 0.52)) }]}>
          {series ? (
            <TradingViewChart
              key={`${instrument.id}:${chartAttempt}`}
              symbol={instrument.symbol}
              timeframe={displayed?.range ?? timeframe}
              interval={displayed?.interval === 'Auto' ? undefined : displayed?.interval}
              expanded={expanded}
              precision={instrument.precision}
              series={series}
              fallback={
                <Card style={styles.chartState}>
                  <Text variant="strong">Chart unavailable</Text>
                  <Text variant="caption" color={colors.textMuted}>Reload the chart to try again.</Text>
                  <Button tone="ink" onPress={() => setChartAttempt((attempt) => attempt + 1)}>
                    <ButtonText tone="ink">Reload chart</ButtonText>
                  </Button>
                </Card>
              }
            />
          ) : (
              <Card style={styles.chartState}>
                <QueryStateView state={chart} render={() => null} />
              </Card>
            )}
        </Gutter>
      </Reveal>

      <Reveal index={3} style={expanded ? styles.hidden : undefined}>
        <Gutter style={styles.section}>
          <Text variant="section">Market stats</Text>
          <Stats series={series} instrument={instrument} timeframe={displayed?.range ?? timeframe} />
        </Gutter>
      </Reveal>
    </ScrollView>
  )

  return (
    <Screen aurora={false} style={styles.root}>
      <HomeAtmosphere />
      <Gutter style={[styles.header, expanded && styles.hidden]}>
        <CircleButton size={42} tone="outline" onPress={goBack} accessibilityLabel="Go back">
          <ArrowLeftIcon size={20} color={colors.brand} />
        </CircleButton>

        <View style={styles.headerTitle}>
          <Text variant="strong" color={colors.brand} style={styles.symbol} numberOfLines={1}>
            {instrument.symbol}
          </Text>
          <Text variant="caption" color={colors.referenceMuted} numberOfLines={1}>
            {instrument.description}
          </Text>
        </View>

        <CircleButton
          size={42}
          tone={isFavorite ? 'gold' : 'outline'}
          onPress={favorite}
          accessibilityLabel={isFavorite ? 'Remove from favourites' : 'Add to favourites'}
        >
          <StarIcon size={20} color={isFavorite ? colors.homePanel : colors.brand} filled={isFavorite} />
        </CircleButton>
      </Gutter>

      <View style={styles.content}>
        {content}
      </View>

      <Glass blur lifted={false} style={[styles.dock, { paddingBottom: Math.max(insets.bottom, 14) }, expanded && styles.hidden]}>
        <Button tone="ink" style={styles.action} onPress={() => openOrderTicket(instrument.id, 'Sell')}>
          <ButtonText tone="ink">Sell</ButtonText>
          <ButtonSubText tone="ink">
            {formatPrice(instrument.bid, instrument.precision)}
          </ButtonSubText>
        </Button>
        <Button tone="gold" style={styles.action} onPress={() => openOrderTicket(instrument.id, 'Buy')}>
          <ButtonText tone="gold">Buy</ButtonText>
          <ButtonSubText tone="gold">
            {formatPrice(instrument.ask, instrument.precision)}
          </ButtonSubText>
        </Button>
      </Glass>
    </Screen>
  )
}

/**
 * The luminous price card. With a chart loaded the price and caption follow
 * the crosshair; without one they show the live quote and the long name.
 */
function QuoteCard({
  instrument,
  series,
  timeframe,
}: {
  instrument: Instrument
  series: ChartSeries | undefined
  timeframe: Timeframe
}) {
  const colors = useColors()
  const styles = useThemeStyles(themeStyles)

  const direction = directionOf(instrument.changePercent)
  const first = series?.points[0]
  const periodChange = first ? ((instrument.price - first) / first) * 100 : undefined

  return (
    <Card tone="ink" padded={false} style={styles.quote}>
      <View style={styles.quoteTop}>
        <View style={styles.markDisc}>
          <AssetIcon
            kind={instrument.icon}
            label={instrument.iconLabel}
            tint={instrument.iconTint}
            symbol={instrument.symbol}
            category={instrument.category}
            size={30}
          />
        </View>
        <View style={styles.live}>
          <LiveDot color={colors.greenOnInk} size={7} />
          <Text variant="caption" weight="medium" color={colors.onInkMuted}>
            Live price
          </Text>
        </View>
        <View style={styles.today}>
          <Delta label={formatPercent(instrument.changePercent)} direction={direction} onInk size={13} />
          <Text variant="micro" color={colors.onInkMuted}>
            Today
          </Text>
        </View>
      </View>

      <TickFlash value={instrument.price} style={styles.quoteBody}>
        <Text style={readoutFonts.price}>{formatPrice(instrument.price, instrument.precision)}</Text>
        <Text style={readoutFonts.caption}>
          {periodChange === undefined ? instrument.description : `${formatPercent(periodChange)} ${PERIOD_NAMES[timeframe]}`}
        </Text>
      </TickFlash>
    </Card>
  )
}

/**
 * Bid, ask and spread as wells, then the period's range: its low and high
 * either side of a bar marking where the price sits now, over the open.
 */
function Stats({
  series,
  instrument,
  timeframe,
}: {
  series: ChartSeries | undefined
  instrument: Instrument
  timeframe: Timeframe
}) {
  const colors = useColors()
  const styles = useThemeStyles(themeStyles)

  const { precision } = instrument
  const quote = [
    { label: 'Bid', value: formatPrice(instrument.bid, precision) },
    { label: 'Ask', value: formatPrice(instrument.ask, precision) },
    { label: 'Spread', value: formatPrice(Math.max(0, instrument.ask - instrument.bid), precision) },
  ]
  const low = series ? Math.min(...series.points) : undefined
  const high = series ? Math.max(...series.points) : undefined
  const share = low !== undefined && high !== undefined && high > low
    ? (instrument.price - low) / (high - low)
    : 0.5

  return (
    <Card padded={false} style={styles.stats}>
      <View style={styles.wells}>
        {quote.map((cell) => (
          <Card key={cell.label} tone="well" padded={false} style={styles.well}>
            <Text variant="caption" color={colors.textMuted}>
              {cell.label}
            </Text>
            <Text variant="strong" style={styles.wellValue} numberOfLines={1} adjustsFontSizeToFit>
              {cell.value}
            </Text>
          </Card>
        ))}
      </View>

      {series && low !== undefined && high !== undefined ? (
        <Card tone="well" padded={false} style={styles.range}>
          <View style={styles.rangeHead}>
            <Text variant="caption" color={colors.textMuted}>
              {`Range · ${PERIOD_NAMES[timeframe]}`}
            </Text>
            <Text variant="caption" color={colors.textMuted}>
              {'Open '}
              <Text variant="caption" weight="semibold" color={colors.text}>
                {formatPrice(series.points[0], precision)}
              </Text>
            </Text>
          </View>
          <ProgressBar value={share} tone="brand" height={6} />
          <View style={styles.rangeEnds}>
            <View>
              <Text variant="micro" color={colors.textMuted}>
                Low
              </Text>
              <Text variant="strong" style={styles.wellValue}>
                {formatPrice(low, precision)}
              </Text>
            </View>
            <View style={styles.rangeHigh}>
              <Text variant="micro" color={colors.textMuted}>
                High
              </Text>
              <Text variant="strong" style={styles.wellValue}>
                {formatPrice(high, precision)}
              </Text>
            </View>
          </View>
        </Card>
      ) : null}
    </Card>
  )
}

const themeStyles = (colors: Palette) => (StyleSheet.create({
  hidden: { display: 'none' },
  controls: { gap: spacing.xs },
  root: {
    backgroundColor: colors.referenceCanvas,
  },
  state: { paddingTop: 32 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  headerTitle: {
    flex: 1,
    alignItems: 'center',
    gap: 1,
    paddingHorizontal: spacing.sm,
  },
  symbol: {
    fontSize: 17,
  },
  content: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  scroll: {
    paddingTop: spacing.xl,
    gap: spacing.lg,
  },
  chart: {
    height: CHART_HEIGHT,
  },
  chartState: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.md,
  },
  section: {
    gap: spacing.md,
    paddingTop: spacing.xs,
  },

  quote: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  quoteTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  markDisc: {
    width: 40,
    height: 40,
    borderRadius: 13,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.onInkPanel,
  },
  live: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  today: {
    alignItems: 'flex-end',
    gap: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.lg,
    backgroundColor: colors.glassOnInk,
  },
  quoteBody: {
    alignSelf: 'flex-start',
  },

  stats: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  wells: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  well: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: 3,
  },
  wellValue: {
    fontVariant: ['tabular-nums'],
  },
  range: {
    padding: spacing.md,
    gap: spacing.md,
  },
  rangeHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rangeEnds: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rangeHigh: {
    alignItems: 'flex-end',
  },

  dock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: spacing.md,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.xl,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    boxShadow: shadow.float,
  },
  action: {
    flex: 1,
  },
}))
