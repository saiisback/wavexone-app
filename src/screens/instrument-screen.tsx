import { useRoute, type RouteProp } from '@react-navigation/native'
import { useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
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
  LiveDot,
  ProgressBar,
  Reveal,
  Screen,
  SegmentedControl,
  StarIcon,
  Text,
  TickFlash,
  colors,
  radius,
  shadow,
  spacing,
  useSafeBack,
} from '../design-system'
import {
  ChartReadout,
  PriceChart,
  PriceChartProvider,
  readoutFonts,
} from '../features/chart/price-chart'
import { useBackendQuery } from '../backend/provider'
import { withLivePrice } from '../data/chart-series'
import { directionOf, formatPercent, formatPrice } from '../data/format'
import { applyQuote } from '../data/live-quote'
import { useSession } from '../data/store'
import type { ChartSeries, Instrument, Timeframe } from '../data/types'
import { useLiveQuote } from '../features/markets/use-live-quote'
import { useMarketData } from '../features/markets/use-market-data'
import { QueryStateView } from '../features/shared/query-state'
import { useAppNavigation } from '../navigation/use-app-navigation'
import type { RootStackParamList } from '../navigation/types'

type InstrumentRoute = RouteProp<RootStackParamList, 'Instrument'>
const TIMEFRAMES: readonly Timeframe[] = ['1D', '5D', '1W', '1M', '3M', '6M']

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
const CHART_HEIGHT = 288
/** Room under the scroll content for the docked Sell / Buy bar. */
const DOCK_CLEARANCE = 112

/** Bars short enough that a scrubbed point should read as a time of day. */
const INTRADAY: ReadonlySet<Timeframe> = new Set(['1D', '5D', '1W'])

/**
 * Instrument detail: a luminous live-price card, a timeframe switch with a
 * gliding thumb, the chart on a white card, a grid of quote statistics, and
 * the Sell / Buy pair docked at the foot. Touching the chart scrubs the
 * price card.
 */
export function InstrumentScreen() {
  const goBack = useSafeBack()
  const { params } = useRoute<InstrumentRoute>()
  const { openOrderTicket } = useAppNavigation()
  const insets = useSafeAreaInsets()

  const [timeframe, setTimeframe] = useState<Timeframe>('1M')
  const { catalogue, setFavorite } = useMarketData()
  const chart = useBackendQuery(`chart:${params.instrumentId}:${timeframe}`, (backend) =>
    backend.markets.candles(params.instrumentId, timeframe),
  )

  const quote = useLiveQuote(params.instrumentId)
  const listed =
    catalogue.status === 'ready'
      ? catalogue.data.find((item) => item.id === params.instrumentId)
      : undefined
  const instrument = listed ? applyQuote(listed, quote) : undefined

  const isFavorite = useSession((state) => state.favorites.has(params.instrumentId))
  const toggleFavorite = useSession((state) => state.toggleFavorite)

  if (catalogue.status !== 'ready' || !instrument) {
    return (
      <Screen>
        <Gutter style={styles.state}>
          <QueryStateView state={catalogue} emptyTitle="Instrument unavailable" render={() => null} />
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
  const series = chart.status === 'ready' ? withLivePrice(chart.data, quote?.price) : undefined

  const content = (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.scroll, { paddingBottom: DOCK_CLEARANCE + Math.max(insets.bottom, 14) }]}
    >
      <Reveal index={0}>
        <Gutter>
          <QuoteCard instrument={instrument} series={series} timeframe={timeframe} />
        </Gutter>
      </Reveal>

      <Reveal index={1} distance={10}>
        <Gutter>
          <SegmentedControl options={TIMEFRAMES} value={timeframe} onChange={setTimeframe} />
        </Gutter>
      </Reveal>

      <Reveal index={2}>
        <Gutter style={styles.chart}>
          {series ? (
            <PriceChart series={series} precision={instrument.precision} />
          ) : (
            <Card style={styles.chartState}>
              <QueryStateView state={chart} render={() => null} />
            </Card>
          )}
        </Gutter>
      </Reveal>

      <Reveal index={3}>
        <Gutter style={styles.section}>
          <Text variant="section">Market stats</Text>
          <Stats series={series} instrument={instrument} timeframe={timeframe} />
        </Gutter>
      </Reveal>
    </ScrollView>
  )

  return (
    <Screen>
      <Gutter style={styles.header}>
        <CircleButton size={42} onPress={goBack} accessibilityLabel="Go back">
          <ArrowLeftIcon size={20} color={colors.text} />
        </CircleButton>

        <View style={styles.headerTitle}>
          <Text variant="strong" style={styles.symbol} numberOfLines={1}>
            {instrument.symbol}
          </Text>
          <Text variant="caption" color={colors.textMuted} numberOfLines={1}>
            {instrument.description}
          </Text>
        </View>

        <CircleButton
          size={42}
          onPress={favorite}
          accessibilityLabel={isFavorite ? 'Remove from favourites' : 'Add to favourites'}
        >
          <StarIcon size={20} color={isFavorite ? colors.gold : colors.text} filled={isFavorite} />
        </CircleButton>
      </Gutter>

      <View style={styles.content}>
        {/* The provider spans the quote card and the plot so one cursor drives both. */}
        {series ? <PriceChartProvider series={series}>{content}</PriceChartProvider> : content}
      </View>

      <Glass blur lifted={false} style={[styles.dock, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <Button tone="night" style={styles.action} onPress={() => openOrderTicket(instrument.id, 'Sell')}>
          <ButtonText tone="night">Sell</ButtonText>
          <ButtonSubText tone="night">
            {formatPrice(instrument.bid, instrument.precision)}
          </ButtonSubText>
        </Button>
        <Button tone="brand" style={styles.action} onPress={() => openOrderTicket(instrument.id, 'Buy')}>
          <ButtonText tone="brand">Buy</ButtonText>
          <ButtonSubText tone="brand">
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
        {series ? (
          <ChartReadout
            price={instrument.price}
            precision={instrument.precision}
            caption={
              periodChange === undefined
                ? instrument.description
                : `${formatPercent(periodChange)} ${PERIOD_NAMES[timeframe]}`
            }
            intraday={INTRADAY.has(timeframe)}
            hasTimes={series.times !== undefined}
            priceStyle={readoutFonts.price}
            captionStyle={readoutFonts.caption}
          />
        ) : (
          <>
            <Text style={readoutFonts.price}>{formatPrice(instrument.price, instrument.precision)}</Text>
            <Text style={readoutFonts.caption}>{instrument.description}</Text>
          </>
        )}
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

const styles = StyleSheet.create({
  state: { paddingTop: 32 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
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
  },
  scroll: {
    paddingTop: spacing.xs,
    gap: spacing.lg,
  },
  chart: {
    height: CHART_HEIGHT,
  },
  chartState: {
    flex: 1,
    justifyContent: 'center',
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
})
