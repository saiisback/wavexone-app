import { useNavigation } from '@react-navigation/native'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import {
  AssetIcon,
  Delta,
  Divider,
  Pressable,
  SearchField,
  Sheet,
  Text,
  colors,
} from '../design-system'
import { directionOf, formatPercent, formatPrice } from '../data/format'
import { applyQuote } from '../data/live-quote'
import { useTradeDraft } from '../data/trade-draft'
import type { Instrument } from '../data/types'
import { useLiveQuote } from '../features/markets/use-live-quote'
import { useMarketData } from '../features/markets/use-market-data'
import { QueryStateView } from '../features/shared/query-state'

/** Instrument chooser for the Trade tab. */
export function InstrumentPickerScreen() {
  const { goBack } = useNavigation()
  const [query, setQuery] = useState('')
  const setInstrumentId = useTradeDraft((state) => state.setInstrumentId)
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
    setInstrumentId(instrumentId)
    goBack()
  }

  return (
    <Sheet title="Choose instrument" subtitle={`${instruments.length} markets available`}>
      {catalogue.status !== 'ready' ? (
        <QueryStateView state={catalogue} render={() => null} />
      ) : null}
      <SearchField value={query} onChangeText={setQuery} />

      {rows.length === 0 ? (
        <Text variant="body" color={colors.textMuted} style={styles.empty}>
          No markets match that search.
        </Text>
      ) : null}

      {rows.map((item, index) => (
        <View key={item.id}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={item.symbol}
            onPress={() => choose(item.id)}
            style={styles.row}
          >
            <AssetIcon
              kind={item.icon}
              label={item.iconLabel}
              tint={item.iconTint}
              symbol={item.symbol}
              category={item.category}
              size={38}
            />
            <View style={styles.identity}>
              <Text variant="strong" numberOfLines={1}>
                {item.symbol}
              </Text>
              <Text variant="caption" color={colors.textMuted} numberOfLines={1}>
                {item.name}
              </Text>
            </View>
            <PickerQuote instrument={item} />
          </Pressable>
          {index < rows.length - 1 ? <Divider /> : null}
        </View>
      ))}
    </Sheet>
  )
}

/** Price and change, streamed per row. */
function PickerQuote({ instrument }: { instrument: Instrument }) {
  const live = applyQuote(instrument, useLiveQuote(instrument.id))
  return (
    <View style={styles.quote}>
      <Text variant="strong">{formatPrice(live.price, live.precision)}</Text>
      <Delta
        label={formatPercent(live.changePercent)}
        direction={directionOf(live.changePercent)}
        size={14}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  identity: {
    flex: 1,
    gap: 3,
  },
  quote: {
    alignItems: 'flex-end',
    gap: 4,
  },
  empty: {
    paddingVertical: 24,
    textAlign: 'center',
  },
})
