import { Divider } from '../../design-system'

/** Badge (36) plus the row's gap, so dividers start at the text. */
export const MARKET_ROW_DIVIDER_INSET = 48

/** Hairline between market rows, which sit directly on the page. */
export function MarketGroupSeparator() {
  return <Divider inset={MARKET_ROW_DIVIDER_INSET} />
}
