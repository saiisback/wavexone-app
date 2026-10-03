import { StyleSheet, View } from 'react-native'

import { Divider, colors, radius, spacing } from '../../design-system'

/** Tile (42) plus the row's gap, so dividers start at the text. */
export const MARKET_ROW_DIVIDER_INSET = 54

/**
 * One cell of a virtualised market list drawn as a single white card.
 * A FlashList cannot wrap its rows in one `Card`, so each cell paints its
 * slice: the hairline sides always, the rounded top on the first cell and
 * the rounded bottom on the last.
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

/** Matches the hairline ring in `shadow.card`. */
const EDGE = 'rgba(20, 24, 43, 0.06)'

const styles = StyleSheet.create({
  cell: {
    backgroundColor: colors.glass,
    paddingHorizontal: spacing.lg,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: EDGE,
  },
  first: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    borderCurve: 'continuous',
    paddingTop: spacing.xs,
  },
  last: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomLeftRadius: radius.card,
    borderBottomRightRadius: radius.card,
    borderCurve: 'continuous',
    paddingBottom: spacing.xs,
    // A soft pool under the group's foot only, so cells show no seams.
    boxShadow: '0px 12px 20px -14px rgba(20, 24, 43, 0.10)',
  },
})
