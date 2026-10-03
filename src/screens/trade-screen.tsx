import { StyleSheet, View } from 'react-native'

import {
  Amount,
  AssetIcon,
  Button,
  ButtonSubText,
  Card,
  ChevronDownIcon,
  Delta,
  Divider,
  Glass,
  Gutter,
  ListRow,
  LiveDot,
  PageScreen,
  PressableScale,
  ProgressBar,
  QuickPicks,
  Reveal,
  SCREEN_PADDING,
  SegmentedControl,
  ShieldIcon,
  Sparkline,
  Text,
  TickFlash,
  colors,
  radius,
  shadow,
  spacing,
  useActionMenu,
  useCountUp,
  useTabBarTop,
} from '../design-system'
import { directionOf, formatLots, formatMoney, formatPercent, formatPrice } from '../data/format'
import { applyQuote } from '../data/live-quote'
import {
  adjustOrderLots,
  estimateRequiredMargin,
  normalizeOrderLots,
  tradingSpecification,
} from '../data/margin'
import { useTradeDraft, type OrderType } from '../data/trade-draft'
import type { Instrument } from '../data/types'
import { useAccountData } from '../features/accounts/use-account-data'
import { AccountPill } from '../features/accounts/account-pill'
import { AccountSummaryUnavailable } from '../features/accounts/account-summary-unavailable'
import { useLiveQuote } from '../features/markets/use-live-quote'
import { useMarketData } from '../features/markets/use-market-data'
import { QueryStateView } from '../features/shared/query-state'
import { LotStepper } from '../features/trade/ticket-parts'
import { useAppNavigation } from '../navigation/use-app-navigation'

const ORDER_TYPES: readonly OrderType[] = ['Market', 'Limit', 'Stop']
/** One-tap volumes under the stepper. */
const LOT_PICKS: readonly number[] = [0.01, 0.1, 0.5, 1, 5, 10]
/** The docked Sell / Buy bar: padding plus one button. */
const DOCK_HEIGHT = 76

/**
 * Trade tab: pick a market, read its live price, size the order, then Sell
 * or Buy from the bar docked above the tab bar. Every order still passes
 * through the order ticket sheet before it reaches the API.
 */
export function TradeScreen() {
  const { openAccountSwitcher, openInstrumentPicker, openOrderTicket, openInstrument } =
    useAppNavigation()
  const showMenu = useActionMenu()

  const accountData = useAccountData()
  const { catalogue } = useMarketData()
  const instrumentId = useTradeDraft((state) => state.instrumentId)
  const orderType = useTradeDraft((state) => state.orderType)
  const lots = useTradeDraft((state) => state.lots)
  const setOrderType = useTradeDraft((state) => state.setOrderType)
  const setLots = useTradeDraft((state) => state.setLots)

  const listed = catalogue.status === 'ready'
    ? catalogue.data.find((item) => item.id === instrumentId) ?? catalogue.data[0]
    : undefined
  const quote = useLiveQuote(listed?.id)
  const tabBarTop = useTabBarTop()

  if (accountData.status !== 'ready' || !accountData.data.account || catalogue.status !== 'ready') {
    if (accountData.status === 'ready' && !accountData.data.account) {
      return (
        <PageScreen title="Trade">
          <Gutter>
            <AccountSummaryUnavailable account={accountData.data.selectedAccount} />
          </Gutter>
        </PageScreen>
      )
    }
    const state = accountData.status !== 'ready' ? accountData : catalogue
    return (
      <PageScreen title="Trade">
        <Gutter>
          <QueryStateView state={state} render={() => null} />
        </Gutter>
      </PageScreen>
    )
  }

  const account = accountData.data.account
  const accountPill = (
    <AccountPill tone="light" mode={account.mode} number={account.number} onPress={openAccountSwitcher} />
  )
  const instrument = listed ? applyQuote(listed, quote) : undefined
  if (!instrument) {
    return (
      <PageScreen title="Trade" trailing={accountPill}>
        <Gutter>
          <Text color={colors.textMuted}>No markets available.</Text>
        </Gutter>
      </PageScreen>
    )
  }
  const terms = tradingSpecification(instrument.symbol, instrument.category)
  const orderLots = normalizeOrderLots(lots, terms)
  const margin = estimateRequiredMargin(
    instrument.price,
    instrument.contractSize,
    orderLots,
    account.leverage,
    terms?.marginRate,
  )

  // The API's `type=stop` is a two-legged HFT order, not a stop entry, so
  // there is nothing honest to send for Stop yet.
  const openTicket = (side: 'Buy' | 'Sell') =>
    orderType === 'Stop'
      ? showMenu({
          title: 'Stop orders unavailable',
          message:
            'The trading API has no confirmed single stop-entry order yet. Use Market or Limit for now.',
          options: [{ label: 'Got it' }],
        })
      : openOrderTicket(instrument.id, side, { lots: orderLots, orderType })

  const explainProtection = () =>
    showMenu({
      title: 'Stop loss · Take profit',
      message:
        'Choose Sell or Buy first. The confirmation step lets you set an optional stop loss and take profit before the order is sent.',
      options: [{ label: 'Got it' }],
    })

  const [lotCount, lotUnit] = formatLots(orderLots).split(' ')
  const lotPicks = LOT_PICKS.filter((value) => value >= (terms?.minimumLots ?? 0.01))
  // The docked Sell / Buy bar floats above the tab bar; keep the form clear of it.
  const dockClearance = tabBarTop + DOCK_HEIGHT + spacing.xxl
  const marginShare = margin === null || account.freeMargin <= 0 ? null : margin / account.freeMargin

  return (
    <PageScreen
      title="Trade"
      subtitle={`${orderType} order · ${instrument.symbol}`}
      trailing={accountPill}
      bottomInset={dockClearance}
      overlay={
        <Glass blur style={[styles.dock, { bottom: tabBarTop + spacing.sm }]}>
          <TradeAction
            side="Sell"
            price={formatPrice(instrument.bid, instrument.precision)}
            onPress={() => openTicket('Sell')}
          />
          <TradeAction
            side="Buy"
            price={formatPrice(instrument.ask, instrument.precision)}
            onPress={() => openTicket('Buy')}
          />
        </Glass>
      }
    >
      <Gutter style={styles.top}>
        <Reveal index={0}>
          <PressableScale
            scaleTo={0.98}
            onPress={openInstrumentPicker}
            accessibilityLabel={`${instrument.symbol}. Change market`}
          >
            <Card padded={false} style={styles.selector}>
              <AssetIcon
                kind={instrument.icon}
                label={instrument.iconLabel}
                tint={instrument.iconTint}
                symbol={instrument.symbol}
                category={instrument.category}
                size={44}
              />
              <View style={styles.selectorText}>
                <Text variant="strong" numberOfLines={1}>
                  {instrument.symbol}
                </Text>
                <Text variant="caption" color={colors.textMuted} numberOfLines={1}>
                  {instrument.description}
                </Text>
              </View>
              <View style={styles.changePill}>
                <Text variant="caption" weight="semibold" color={colors.brand}>
                  Change
                </Text>
                <ChevronDownIcon size={14} color={colors.brand} />
              </View>
            </Card>
          </PressableScale>
        </Reveal>

        <Reveal index={1}>
          <PriceCard instrument={instrument} onOpen={() => openInstrument(instrument.id)} />
        </Reveal>
      </Gutter>

      <Reveal index={2}>
        <Gutter>
          <SegmentedControl options={ORDER_TYPES} value={orderType} onChange={setOrderType} />
        </Gutter>
      </Reveal>

      <Reveal index={3}>
        <Gutter>
          <Card padded={false}>
            <View style={styles.builder}>
              <View style={styles.builderHead}>
                <Text variant="section">Quantity</Text>
                <Text variant="caption" color={colors.textMuted}>
                  {`Steps of ${formatLots(terms?.lotStep ?? 0.01)}`}
                </Text>
              </View>
              <LotStepper
                lots={lotCount}
                unit={lotUnit}
                onDecrease={() => setLots((previous) => adjustOrderLots(previous, -1, terms))}
                onIncrease={() => setLots((previous) => adjustOrderLots(previous, 1, terms))}
              />
              <View style={styles.picks}>
                <QuickPicks
                  values={lotPicks}
                  selected={lotPicks.includes(orderLots) ? orderLots : undefined}
                  onSelect={(next) => setLots(() => normalizeOrderLots(next, terms))}
                  format={(next) => next.toFixed(2)}
                />
              </View>
            </View>

            <Divider />

            <View style={styles.stats}>
              <Stat label="Required margin" value={margin === null ? 'Unavailable' : formatMoney(margin)} />
              <Stat label="Free margin" value={formatMoney(account.freeMargin)} align="end" />
            </View>
            {marginShare === null ? null : (
              <View style={styles.meter}>
                <ProgressBar value={marginShare} tone={marginShare > 1 ? 'red' : 'navy'} height={6} />
                <Text variant="caption" color={marginShare > 1 ? colors.red : colors.textMuted}>
                  {`This order uses ${formatPercent(Math.min(marginShare, 9.99) * 100).replace('+', '')} of your free margin`}
                </Text>
              </View>
            )}
            <View style={styles.statsSecondary}>
              <Stat
                label="Leverage"
                value={terms ? `1:${terms.leverage}` : account.leverage > 0 ? `1:${account.leverage}` : 'Not configured'}
                small
              />
              <Stat
                label="Contract size"
                value={`${instrument.contractSize.toLocaleString('en-US')} / lot`}
                small
                align="end"
              />
            </View>

            <Divider />

            <View style={styles.protection}>
              <ListRow
                icon={<ShieldIcon size={20} color={colors.brandBright} />}
                label="Stop loss · Take profit"
                detail="Optional. Set them on the confirmation step."
                onPress={explainProtection}
                divider={false}
              />
            </View>
          </Card>
        </Gutter>
      </Reveal>

      <Reveal index={4}>
        <Gutter>
          <Text variant="caption" color={colors.textSubtle} style={styles.disclaimer}>
            Every order passes through a confirmation step before it reaches the trading API.
          </Text>
        </Gutter>
      </Reveal>
    </PageScreen>
  )
}

/**
 * The screen's one luminous moment: the live price rolling to its value,
 * the day's change, bid / spread / ask on frosted wells and the day's line
 * running off the bottom edge. Tapping it opens the full chart.
 */
function PriceCard({ instrument, onOpen }: { instrument: Instrument; onOpen: () => void }) {
  const direction = directionOf(instrument.changePercent)
  const shown = useCountUp(instrument.price)
  const price = formatPrice(instrument.price, instrument.precision)
  const spread = instrument.ask - instrument.bid

  return (
    <PressableScale
      scaleTo={0.985}
      onPress={onOpen}
      accessibilityLabel={`${instrument.symbol}, ${price}, ${formatPercent(instrument.changePercent)}. Open chart`}
    >
      <Card tone="ink" padded={false} style={styles.priceCard}>
        <View style={styles.priceBody}>
          <View style={styles.priceHead}>
            <View style={styles.live}>
              <LiveDot color={colors.greenOnInk} size={7} />
              <Text variant="caption" weight="medium" color={colors.onInkMuted}>
                Live price
              </Text>
            </View>
            <Text variant="caption" weight="medium" color={colors.onInkMuted}>
              {instrument.symbol}
            </Text>
          </View>

          <TickFlash value={instrument.price} style={styles.priceFlash}>
            <Amount
              variant="hero"
              color={colors.onInk}
              numberOfLines={1}
              adjustsFontSizeToFit
              accessibilityLabel={price}
            >
              {formatPrice(shown, instrument.precision)}
            </Amount>
          </TickFlash>
          <View style={styles.change}>
            <View style={[styles.deltaPill, direction === 'down' ? styles.deltaDown : direction === 'up' ? styles.deltaUp : null]}>
              <Delta label={formatPercent(instrument.changePercent)} direction={direction} onInk size={13} />
            </View>
            <Text variant="caption" color={colors.onInkMuted}>
              today · tap for chart
            </Text>
          </View>

          <View style={styles.wells}>
            <QuoteWell label="Bid" value={formatPrice(instrument.bid, instrument.precision)} />
            <QuoteWell label="Spread" value={formatPrice(spread, instrument.precision)} />
            <QuoteWell label="Ask" value={formatPrice(instrument.ask, instrument.precision)} />
          </View>
        </View>

        <View style={styles.chart} pointerEvents="none">
          <Sparkline
            points={instrument.spark}
            width="fill"
            height={64}
            color={direction === 'down' ? colors.red : colors.green}
            fillOpacity={0.26}
            showEndpoint
          />
        </View>
      </Card>
    </PressableScale>
  )
}

/** One figure on the price card's bid / spread / ask strip. */
function QuoteWell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.well}>
      <Text variant="micro" color={colors.onInkMuted}>
        {label}
      </Text>
      <Text variant="strong" color={colors.onInk} numberOfLines={1} adjustsFontSizeToFit style={styles.wellValue}>
        {value}
      </Text>
    </View>
  )
}

/** A caption over its value, as on the order builder's margin block. */
function Stat({
  label,
  value,
  align = 'start',
  small = false,
}: {
  label: string
  value: string
  align?: 'start' | 'end'
  small?: boolean
}) {
  return (
    <View style={[styles.stat, align === 'end' ? styles.alignEnd : null]}>
      <Text variant="caption" color={colors.textMuted}>
        {label}
      </Text>
      {small ? (
        <Text variant="strong" numberOfLines={1} style={styles.tabular}>
          {value}
        </Text>
      ) : (
        <Amount variant="displaySm" numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Amount>
      )}
    </View>
  )
}

/** Sell on the graphite-edged white pill, Buy on graphite: side, then its fill price. */
function TradeAction({ side, price, onPress }: { side: 'Buy' | 'Sell'; price: string; onPress: () => void }) {
  const tone = side === 'Buy' ? 'brand' : 'night'
  return (
    <Button tone={tone} style={styles.action} onPress={onPress} accessibilityLabel={`${side} at ${price}`}>
      <Text variant="micro" color={side === 'Buy' ? 'rgba(255, 255, 255, 0.72)' : colors.textMuted}>
        {side}
      </Text>
      <ButtonSubText tone={tone}>{price}</ButtonSubText>
    </Button>
  )
}

const styles = StyleSheet.create({
  top: {
    gap: spacing.md,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    paddingRight: spacing.lg,
  },
  selectorText: {
    flex: 1,
    gap: 1,
  },
  changePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 34,
    paddingLeft: 14,
    paddingRight: 10,
    borderRadius: radius.pill,
    borderCurve: 'continuous',
    backgroundColor: colors.brandTint,
  },
  priceCard: {
    boxShadow: shadow.hero,
  },
  priceBody: {
    padding: spacing.xl,
    paddingBottom: spacing.sm,
    gap: spacing.xs,
  },
  priceHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  live: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  change: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  deltaPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.track,
  },
  deltaUp: {
    backgroundColor: colors.greenSoft,
  },
  deltaDown: {
    backgroundColor: colors.redSoft,
  },
  priceFlash: {
    alignSelf: 'flex-start',
  },
  wells: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  well: {
    flex: 1,
    gap: 2,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    backgroundColor: colors.glassOnInk,
    borderWidth: 1,
    borderColor: colors.glassOnInkEdge,
  },
  wellValue: {
    fontSize: 15,
    fontVariant: ['tabular-nums'],
  },
  chart: {
    marginTop: spacing.xs,
  },
  builder: {
    padding: spacing.xl,
    gap: spacing.lg,
  },
  builderHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  picks: {
    alignItems: 'center',
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
  },
  statsSecondary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    backgroundColor: colors.well,
  },
  stat: {
    flexShrink: 1,
    gap: 2,
  },
  alignEnd: {
    alignItems: 'flex-end',
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
  meter: {
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
  },
  protection: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  disclaimer: {
    paddingHorizontal: spacing.xs,
    textAlign: 'center',
    lineHeight: 18,
  },
  dock: {
    position: 'absolute',
    left: SCREEN_PADDING - 6,
    right: SCREEN_PADDING - 6,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: 6,
    borderRadius: radius.pill,
    borderCurve: 'continuous',
    boxShadow: shadow.float,
  },
  action: {
    flex: 1,
  },
})
