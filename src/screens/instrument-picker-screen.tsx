import { useColors } from '../design-system/theme'
import { Fragment, useState } from 'react'
import { StyleSheet } from 'react-native'

import {
  Card,
  Divider,
  EmptyState,
  SearchField,
  SearchIcon,
  Sheet,
  spacing,
  useSafeBack,
} from '../design-system'
import { tradingSpecification } from '../data/margin'
import { useTradeDraft } from '../data/trade-draft'
import { MARKET_ROW_DIVIDER_INSET } from '../features/markets/market-group'
import { MarketRow } from '../features/markets/market-row'
import { useMarketData } from '../features/markets/use-market-data'
import { QueryStateView } from '../features/shared/query-state'

/**
 * Instrument chooser for the Trade tab: search, then every market in one
 * white card, drawn with the same rows as the Markets tab.
 */
export function InstrumentPickerScreen() {
  const colors = useColors()

  const goBack = useSafeBack()
  const [query, setQuery] = useState('')
  const setInstrumentId = useTradeDraft((state) => state.setInstrumentId)
  const setLots = useTradeDraft((state) => state.setLots)
  const { catalogue } = useMarketData()
  const instruments = catalogue.status === 'ready' ? catalogue.data : []

  const needle = query.trim().toLowerCase()
  const rows = needle
    ? instruments.filter(
        (item) =>
          item.symbol.toLowerCase().includes(needle) || item.name.toLowerCase().includes(needle),
      )
    : instruments

  const choose = (instrumentId: string) => {
    const instrument = instruments.find((item) => item.id === instrumentId)
    const terms = instrument
      ? tradingSpecification(instrument.symbol, instrument.category)
      : null
    setInstrumentId(instrumentId)
    setLots(() => terms?.minimumLots ?? 0.01)
    goBack()
  }

  return (
    <Sheet title="Choose instrument" subtitle={`${instruments.length} markets available`}>
      {catalogue.status !== 'ready' ? (
        <QueryStateView state={catalogue} render={() => null} />
      ) : null}
      <SearchField value={query} onChangeText={setQuery} />

      {rows.length === 0 ? (
        <Card padded={false}>
          <EmptyState
            icon={<SearchIcon size={22} color={colors.brand} />}
            title="No markets found"
            message="No markets match that search."
          />
        </Card>
      ) : (
        <Card padded={false} style={styles.list}>
          {rows.map((item, index) => (
            <Fragment key={item.id}>
              {index > 0 ? <Divider inset={MARKET_ROW_DIVIDER_INSET} /> : null}
              <MarketRow
                layout="row"
                accessibilityLabel={item.symbol}
                id={item.id}
                symbol={item.symbol}
                name={item.name}
                price={item.price}
                precision={item.precision}
                changePercent={item.changePercent}
                changeBase={item.dayOpen}
                iconKind={item.icon}
                iconLabel={item.iconLabel}
                iconTint={item.iconTint}
                category={item.category}
                spark={item.spark}
                sparkTone={item.sparkTone}
                onPress={choose}
              />
            </Fragment>
          ))}
        </Card>
      )}
    </Sheet>
  )
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
})
