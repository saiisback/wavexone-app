import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import {
  ArrowLeftIcon,
  AssetIcon,
  Button,
  ButtonSubText,
  ButtonText,
  Card,
  CircleButton,
  Delta,
  Gutter,
  Pressable,
  Screen,
  StarIcon,
  Text,
  colors,
  fonts,
  radius,
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

/** Bars short enough that a scrubbed point should read as a time of day. */
const INTRADAY: ReadonlySet<Timeframe> = new Set(['1D', '5D', '1W'])

/**
 * Instrument detail: quote card, timeframe switch, chart, period range and
 * the Sell / Buy pair. Touching the chart scrubs the quote card.
 */
export function InstrumentScreen() {
  const { goBack } = useNavigation()
  const { params } = useRoute<InstrumentRoute>()
  const { openOrderTicket } = useAppNavigation()

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
    <>
      <Gutter>
        <QuoteCard instrument={instrument} series={series} timeframe={timeframe} />
      </Gutter>

      <Gutter style={styles.timeframes}>
        {TIMEFRAMES.map((option) => {
          const selected = option === timeframe
          return (
            <Pressable
              key={option}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => setTimeframe(option)}
              style={[styles.timeframe, selected ? styles.timeframeSelected : null]}
            >
              <Text style={[styles.timeframeLabel, selected ? styles.timeframeLabelSelected : null]}>
                {option}
              </Text>
            </Pressable>
          )
        })}
      </Gutter>

      <Gutter style={styles.chart}>
        <QueryStateView
          state={chart}
          render={() => (series ? <PriceChart series={series} /> : null)}
        />
      </Gutter>

      {series ? (
        <Gutter>
          <RangeStrip series={series} instrument={instrument} />
        </Gutter>
      ) : null}
    </>
  )

  return (
    <Screen>
      <Gutter style={styles.header}>
        <CircleButton onPress={goBack} accessibilityLabel="Go back">
          <ArrowLeftIcon size={22} color={colors.text} />
        </CircleButton>

        <View style={styles.headerTitle}>
          <View style={styles.headerSymbol}>
            <AssetIcon
              kind={instrument.icon}
              label={instrument.iconLabel}
              tint={instrument.iconTint}
              symbol={instrument.symbol}
              category={instrument.category}
              size={24}
            />
            <Text variant="heading" style={styles.symbol}>
              {instrument.symbol}
            </Text>
          </View>
          <Text variant="caption" color={colors.textMuted} numberOfLines={1}>
            {instrument.description}
          </Text>
        </View>

        <CircleButton
          onPress={favorite}
          accessibilityLabel={isFavorite ? 'Remove from favourites' : 'Add to favourites'}
        >
          <StarIcon size={22} color={isFavorite ? colors.gold : colors.text} filled={isFavorite} />
        </CircleButton>
      </Gutter>

      <View style={styles.content}>
        {/* The provider spans the quote card and the plot so one cursor drives both. */}
        {series ? <PriceChartProvider series={series}>{content}</PriceChartProvider> : content}
      </View>

      <Gutter style={styles.actions}>
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
      </Gutter>
    </Screen>
  )
}

/**
 * Dark quote card. With a chart loaded the price and caption follow the
 * crosshair; without one they show the live quote and the long name.
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
    <View style={styles.quote}>
      <View style={styles.quoteTop}>
        <AssetIcon
          kind={instrument.icon}
          label={instrument.iconLabel}
          tint={instrument.iconTint}
          symbol={instrument.symbol}
          category={instrument.category}
          size={36}
        />
        <Text variant="caption" color={colors.onInkMuted} style={styles.quoteName} numberOfLines={1}>
          {instrument.description}
        </Text>
        <View style={styles.today}>
          <Delta label={formatPercent(instrument.changePercent)} direction={direction} onInk size={15} />
          <Text variant="micro" color={colors.onInkMuted}>
            Today
          </Text>
        </View>
      </View>

      <View style={styles.quoteBody}>
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
      </View>
    </View>
  )
}

/** The period's open, high and low, plus the current spread. */
function RangeStrip({ series, instrument }: { series: ChartSeries; instrument: Instrument }) {
  const { precision } = instrument
  const cells = [
    { label: 'Open', value: formatPrice(series.points[0], precision) },
    { label: 'High', value: formatPrice(Math.max(...series.points), precision) },
    { label: 'Low', value: formatPrice(Math.min(...series.points), precision) },
    { label: 'Spread', value: formatPrice(Math.max(0, instrument.ask - instrument.bid), precision) },
  ]
  return (
    <Card padded={false} style={styles.range}>
      {cells.map((cell, index) => (
        <View key={cell.label} style={[styles.rangeCell, index > 0 ? styles.rangeDivider : null]}>
          <Text variant="micro" color={colors.textMuted}>
            {cell.label}
          </Text>
          <Text style={styles.rangeValue} numberOfLines={1} adjustsFontSizeToFit>
            {cell.value}
          </Text>
        </View>
      ))}
    </Card>
  )
}

const styles = StyleSheet.create({
  state: { paddingTop: 32 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 14,
  },
  headerTitle: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 8,
  },
  headerSymbol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  symbol: {
    fontSize: 20,
  },
  content: {
    flex: 1,
    paddingBottom: 14,
    gap: 14,
  },
  chart: {
    flex: 1,
  },

  quote: {
    backgroundColor: colors.ink,
    borderRadius: 24,
    borderCurve: 'continuous',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 18,
    gap: 12,
    overflow: 'hidden',
  },
  quoteTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  quoteName: {
    flex: 1,
  },
  today: {
    alignItems: 'flex-end',
    gap: 1,
  },
  quoteBody: {
    gap: 4,
  },

  timeframes: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeframe: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderCurve: 'continuous',
  },
  timeframeSelected: {
    backgroundColor: colors.ink,
  },
  timeframeLabel: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.textMuted,
  },
  timeframeLabelSelected: {
    fontFamily: fonts.bold,
    color: colors.onInk,
  },

  range: {
    flexDirection: 'row',
    borderRadius: 20,
    paddingVertical: 12,
  },
  rangeCell: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 4,
  },
  rangeDivider: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.divider,
  },
  rangeValue: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },

  actions: {
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 12,
  },
  action: {
    flex: 1,
  },
})
