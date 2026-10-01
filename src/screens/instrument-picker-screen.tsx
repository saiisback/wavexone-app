import { useNavigation } from '@react-navigation/native'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import {
  AssetIcon,
  Delta,
  Divider,
  Input,
  Pressable,
  SearchIcon,
  Sheet,
  Text,
  colors,
  fonts,
  radius,
} from '../design-system'
import { directionOf, formatPercent, formatPrice } from '../data/format'
import { useTradeDraft } from '../data/trade-draft'
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
      <View style={styles.searchField}>
        <SearchIcon size={20} color={colors.text} />
        <Input
          value={query}
          onChangeText={setQuery}
          placeholder="Search markets"
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
          autoCorrect={false}
          returnKeyType="search"
        />
      </View>

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
            <AssetIcon kind={item.icon} label={item.iconLabel} tint={item.iconTint} size={38} />
            <View style={styles.identity}>
              <Text variant="strong" numberOfLines={1}>
                {item.symbol}
              </Text>
              <Text variant="caption" color={colors.textMuted} numberOfLines={1}>
                {item.name}
              </Text>
            </View>
            <View style={styles.quote}>
              <Text variant="strong">{formatPrice(item.price, item.precision)}</Text>
              <Delta
                label={formatPercent(item.changePercent)}
                direction={directionOf(item.changePercent)}
                size={14}
              />
            </View>
          </Pressable>
          {index < rows.length - 1 ? <Divider /> : null}
        </View>
      ))}
    </Sheet>
  )
}

const styles = StyleSheet.create({
  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 50,
    borderRadius: radius.pill,
    borderCurve: 'continuous',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.text,
    padding: 0,
  },
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
