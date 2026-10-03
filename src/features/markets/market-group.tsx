import { StyleSheet, View } from 'react-native'

import { Divider, colors, radius } from '../../design-system'

/** Badge (36) plus the row's leading padding and gap, so dividers start at the text. */
export const MARKET_ROW_DIVIDER_INSET = 62

/**
 * One cell of a virtualised market list drawn as a single grouped card.
 * A FlashList cannot wrap its rows in one `Card`, so each cell paints its
 * slice of the card: side borders always, the rounded top on the first cell
 * and the rounded bottom on the last.
 */
export function MarketGroupCell({
  index,
  count,
  children,
}: {
  index: number
  count: number
  children: React.ReactNode
}) {
  return (
    <View style={[styles.cell, index === 0 ? styles.first : null, index === count - 1 ? styles.last : null]}>
      {children}
    </View>
  )
}

/** Hairline between grouped rows, on the card's own surface. */
export function MarketGroupSeparator() {
  return (
    <View style={styles.cell}>
      <Divider inset={MARKET_ROW_DIVIDER_INSET} />
    </View>
  )
}

const styles = StyleSheet.create({
  cell: {
    backgroundColor: colors.surface,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  first: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    borderCurve: 'continuous',
  },
  last: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomLeftRadius: radius.card,
    borderBottomRightRadius: radius.card,
    borderCurve: 'continuous',
  },
})
