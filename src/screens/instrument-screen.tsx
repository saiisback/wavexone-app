import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import {
  ArrowLeftIcon,
  AssetIcon,
  Button,
  ButtonSubText,
  ButtonText,
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
import { PriceChart } from '../features/chart/price-chart'
import { useBackendQuery } from '../backend/provider'
import { withLivePrice } from '../data/chart-series'
import { directionOf, formatPercent, formatPrice } from '../data/format'
import { applyQuote } from '../data/live-quote'
import { useSession } from '../data/store'
import type { Timeframe } from '../data/types'
import { useLiveQuote } from '../features/markets/use-live-quote'
import { useMarketData } from '../features/markets/use-market-data'
import { QueryStateView } from '../features/shared/query-state'
import { useAppNavigation } from '../navigation/use-app-navigation'
import type { RootStackParamList } from '../navigation/types'

type InstrumentRoute = RouteProp<RootStackParamList, 'Instrument'>
const TIMEFRAMES: readonly Timeframe[] = ['1D', '5D', '1W', '1M', '3M', '6M']

/** Instrument detail: quote, timeframe switch, chart and the Sell / Buy pair. */
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

  const direction = directionOf(instrument.changePercent)

  const favorite = () => {
    const next = !isFavorite
    toggleFavorite(instrument.id)
    void setFavorite(instrument.id, next).catch(() => toggleFavorite(instrument.id))
  }

  return (
    <Screen>
      <Gutter style={styles.header}>
        <CircleButton onPress={goBack} accessibilityLabel="Go back">
          <ArrowLeftIcon size={22} color={colors.text} />
        </CircleButton>

        <View style={styles.headerTitle}>
          <Text variant="heading" style={styles.symbol}>
            {instrument.symbol}
          </Text>
          <Text variant="body" color={colors.textMuted}>
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
        <Gutter>
          <View style={styles.quote}>
            <View style={styles.quoteMark} pointerEvents="none">
              <AssetIcon
                kind={instrument.icon}
                tint={QUOTE_MARK_TINT}
                size={96}
                label={instrument.iconLabel}
              />
            </View>

            <View style={styles.quoteIdentity}>
              <Text variant="displaySm" color={colors.onInk}>
                {formatPrice(instrument.price, instrument.precision)}
              </Text>
              <Text variant="body" color={colors.onInkMuted}>
                {instrument.description}
              </Text>
            </View>

            <Delta label={formatPercent(instrument.changePercent)} direction={direction} onInk />
          </View>
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
                <Text
                  style={[styles.timeframeLabel, selected ? styles.timeframeLabelSelected : null]}
                >
                  {option}
                </Text>
              </Pressable>
            )
          })}
        </Gutter>

        <Gutter style={styles.chart}>
          <QueryStateView
            state={chart}
            render={(loaded) => {
              // The newest point follows the streamed price.
              const series = withLivePrice(loaded, quote?.price)
              return <PriceChart
                // Remounting per timeframe keeps the plot's measured size honest
                // when the axis gutter width changes with longer labels.
                key={timeframe}
                series={series.points}
                opens={series.opens}
                months={series.labels}
                cursorIndex={series.cursorIndex}
                cursorOpen={series.cursorOpen}
                cursorClose={series.cursorClose}
                min={series.min}
                max={series.max}
                step={series.step}
                axisDecimals={series.axisDecimals}
                precision={instrument.precision}
              />
            }}
          />
        </Gutter>
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

/** The instrument mark printed faintly inside the dark quote card. */
const QUOTE_MARK_TINT = 'rgba(255, 255, 255, 0.08)'

const styles = StyleSheet.create({
  state: { paddingTop: 32 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 18,
  },
  headerTitle: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  symbol: {
    fontSize: 21,
  },
  content: {
    flex: 1,
    paddingBottom: 18,
    gap: 16,
  },
  chart: {
    flex: 1,
  },

  quote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.ink,
    borderRadius: 24,
    borderCurve: 'continuous',
    paddingHorizontal: 20,
    paddingVertical: 22,
    overflow: 'hidden',
  },
  quoteMark: {
    position: 'absolute',
    left: '46%',
    bottom: -14,
  },
  quoteIdentity: {
    flex: 1,
    gap: 4,
  },

  timeframes: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeframe: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: radius.pill,
    borderCurve: 'continuous',
  },
  timeframeSelected: {
    backgroundColor: colors.ink,
  },
  timeframeLabel: {
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.text,
  },
  timeframeLabelSelected: {
    fontFamily: fonts.bold,
    color: colors.onInk,
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
