import { ScrollView, StyleSheet, View } from 'react-native'

import {
  AssetIcon,
  Button,
  ButtonSubText,
  Card,
  ChevronDownIcon,
  DeltaPill,
  Divider,
  Gutter,
  ListGroup,
  ListRow,
  Pressable,
  PressableScale,
  SCREEN_PADDING,
  Screen,
  SegmentedControl,
  Sparkline,
  TAB_BAR_CLEARANCE,
  Text,
  colors,
  radius,
  spacing,
  useActionMenu,
} from '../design-system'
import { directionOf, formatLots, formatMoney, formatPercent, formatPrice } from '../data/format'
import { applyQuote } from '../data/live-quote'
import { estimateRequiredMargin } from '../data/margin'
import { useTradeDraft, type OrderType } from '../data/trade-draft'
import { useAccountData } from '../features/accounts/use-account-data'
import { AccountSummaryUnavailable } from '../features/accounts/account-summary-unavailable'
import { useLiveQuote } from '../features/markets/use-live-quote'
import { useMarketData } from '../features/markets/use-market-data'
import { QueryStateView } from '../features/shared/query-state'
import { useAppNavigation } from '../navigation/use-app-navigation'

const ORDER_TYPES: readonly OrderType[] = ['Market', 'Limit', 'Stop']
const LOT_STEP = 0.01

/**
 * Trade tab. Not in the supplied mockups — an order ticket assembled from the
 * existing primitives, with the same Sell / Buy pair the detail screen uses.
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

  if (accountData.status !== 'ready' || !accountData.data.account || catalogue.status !== 'ready') {
    if (accountData.status === 'ready' && !accountData.data.account) {
      return <Screen><Gutter style={styles.state}><AccountSummaryUnavailable account={accountData.data.selectedAccount} /></Gutter></Screen>
    }
    const state = accountData.status !== 'ready' ? accountData : catalogue
    return (
      <Screen>
        <Gutter style={styles.state}>
          <QueryStateView state={state} render={() => null} />
        </Gutter>
      </Screen>
    )
  }

  const account = accountData.data.account
  const instrument = listed ? applyQuote(listed, quote) : undefined
  if (!instrument) {
    return <Screen><Gutter style={styles.state}><Text>No markets available.</Text></Gutter></Screen>
  }
  const margin = estimateRequiredMargin(
    instrument.price,
    instrument.contractSize,
    lots,
    account.leverage,
  )
  const spread = instrument.ask - instrument.bid

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
      : openOrderTicket(instrument.id, side, { lots, orderType })

  const direction = directionOf(instrument.changePercent)
  const [lotCount, lotUnit] = formatLots(lots).split(' ')

  return (
    <Screen>
      <Gutter style={styles.titleRow}>
        <Text variant="title">Trade</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Switch account"
          onPress={openAccountSwitcher}
          style={styles.accountPill}
        >
          <Text variant="caption" weight="semibold">
            {account.mode} · {account.number}
          </Text>
          <ChevronDownIcon size={16} color={colors.text} />
        </Pressable>
      </Gutter>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Gutter style={styles.hero}>
          <View style={styles.heroIdentity}>
            <AssetIcon
              kind={instrument.icon}
              label={instrument.iconLabel}
              tint={instrument.iconTint}
              symbol={instrument.symbol}
              category={instrument.category}
              size={40}
            />
            <View style={styles.instrumentIdentity}>
              <Text variant="section" numberOfLines={1}>
                {instrument.symbol}
              </Text>
              <Text variant="caption" color={colors.textMuted} numberOfLines={1}>
                {instrument.description}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${instrument.symbol}. Change market`}
              onPress={openInstrumentPicker}
              style={styles.changeMarket}
            >
              <Text variant="caption" weight="semibold">
                Change
              </Text>
              <ChevronDownIcon size={14} color={colors.text} />
            </Pressable>
          </View>

          <PressableScale
            scaleTo={0.99}
            onPress={() => openInstrument(instrument.id)}
            accessibilityLabel={`${instrument.symbol}, ${formatPrice(instrument.price, instrument.precision)}, ${formatPercent(instrument.changePercent)}. Open chart`}
          >
            <View style={styles.heroQuote}>
              <Text variant="hero" numberOfLines={1} adjustsFontSizeToFit>
                {formatPrice(instrument.price, instrument.precision)}
              </Text>
              <View style={styles.heroChange}>
                <DeltaPill label={formatPercent(instrument.changePercent)} direction={direction} />
                <Text variant="caption" color={colors.textMuted}>
                  today
                </Text>
              </View>
            </View>
            <Sparkline
              points={instrument.spark}
              width="fill"
              height={64}
              color={direction === 'down' ? colors.red : colors.green}
              fillOpacity={0.16}
              showEndpoint
            />
          </PressableScale>
        </Gutter>

        <Gutter>
          <SegmentedControl options={ORDER_TYPES} value={orderType} onChange={setOrderType} />
        </Gutter>

        <Gutter>
          <Card padded={false}>
            <View style={styles.formSection}>
              <Text variant="overline" color={colors.textSubtle}>
                Quantity
              </Text>
              <View style={styles.stepper}>
                <Stepper
                  label="−"
                  accessibilityLabel="Decrease volume"
                  onPress={() => setLots((previous) => previous - LOT_STEP)}
                />
                <View style={styles.lotsValue}>
                  <Text variant="displaySm">{lotCount}</Text>
                  <Text variant="caption" color={colors.textMuted}>
                    {lotUnit}
                  </Text>
                </View>
                <Stepper
                  label="+"
                  accessibilityLabel="Increase volume"
                  onPress={() => setLots((previous) => previous + LOT_STEP)}
                />
              </View>
            </View>
            <Divider />
            <View style={styles.formSection}>
              <Text variant="overline" color={colors.textSubtle}>
                Risk controls
              </Text>
              <Text variant="body" weight="medium">
                Stop loss · Take profit
              </Text>
              <Text variant="caption" color={colors.textMuted}>
                Optional. Set them on the confirmation step.
              </Text>
            </View>
          </Card>
        </Gutter>

        <Gutter>
          <ListGroup title="Margin">
            <ListRow
              compact
              label="Required margin"
              value={margin === null ? 'Unavailable' : formatMoney(margin)}
            />
            <ListRow compact label="Free margin" value={formatMoney(account.freeMargin)} />
            <ListRow
              compact
              label="Leverage"
              value={account.leverage > 0 ? `1:${account.leverage}` : 'Not configured'}
            />
            <ListRow compact label="Spread" value={formatPrice(spread, instrument.precision)} />
            <ListRow
              compact
              label="Contract size"
              value={`${instrument.contractSize.toLocaleString('en-US')} / lot`}
              divider={false}
            />
          </ListGroup>
          <Text variant="caption" color={colors.textSubtle} style={styles.disclaimer}>
            Every order passes through a confirmation step before it reaches the trading API.
          </Text>
        </Gutter>
      </ScrollView>

      <View style={styles.actionBar}>
        <TradeAction side="Sell" price={formatPrice(instrument.bid, instrument.precision)} onPress={() => openTicket('Sell')} />
        <TradeAction side="Buy" price={formatPrice(instrument.ask, instrument.precision)} onPress={() => openTicket('Buy')} />
      </View>
    </Screen>
  )
}

/** Sell on navy, Buy in the signature gold: side, then the price it fills at. */
function TradeAction({ side, price, onPress }: { side: 'Buy' | 'Sell'; price: string; onPress: () => void }) {
  const tone = side === 'Buy' ? 'gold' : 'ink'
  return (
    <Button tone={tone} style={styles.action} onPress={onPress} accessibilityLabel={`${side} at ${price}`}>
      <Text variant="overline" color={side === 'Buy' ? colors.ink : colors.onInkMuted}>
        {side}
      </Text>
      <ButtonSubText tone={tone}>{price}</ButtonSubText>
    </Button>
  )
}

function Stepper({
  label,
  accessibilityLabel,
  onPress,
}: {
  label: string
  accessibilityLabel: string
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={styles.stepperButton}
    >
      <Text variant="heading">{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  state: { paddingTop: 32 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    paddingBottom: 12,
  },
  accountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 44,
    paddingLeft: 14,
    paddingRight: 10,
    borderRadius: radius.pill,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  content: {
    paddingBottom: spacing.xl,
    gap: spacing.xl,
  },
  hero: {
    gap: spacing.md,
  },
  heroIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  instrumentIdentity: {
    flex: 1,
    gap: 1,
  },
  changeMarket: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.track,
  },
  heroQuote: {
    gap: spacing.xs,
    paddingBottom: spacing.sm,
  },
  heroChange: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  formSection: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepperButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderCurve: 'continuous',
    backgroundColor: colors.track,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lotsValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  disclaimer: {
    paddingTop: spacing.md,
    lineHeight: 18,
  },
  actionBar: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: spacing.md,
    paddingBottom: TAB_BAR_CLEARANCE - 36,
    backgroundColor: colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  action: {
    flex: 1,
  },
})
