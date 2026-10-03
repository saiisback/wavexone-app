import { ScrollView, StyleSheet, View } from 'react-native'

import {
  AssetIcon,
  Button,
  ButtonSubText,
  Card,
  ChevronDownIcon,
  ChevronRightIcon,
  Delta,
  Divider,
  Gutter,
  Pressable,
  PressableScale,
  SCREEN_PADDING,
  Screen,
  SegmentedControl,
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
        <Gutter>
          <PressableScale
            scaleTo={0.99}
            onPress={openInstrumentPicker}
            onLongPress={() => openInstrument(instrument.id)}
            accessibilityLabel={`${instrument.symbol}, ${formatPrice(instrument.price, instrument.precision)}, ${formatPercent(instrument.changePercent)}. Change market`}
          >
            <View style={styles.hero}>
              <View style={styles.heroIdentity}>
                <AssetIcon
                  kind={instrument.icon}
                  label={instrument.iconLabel}
                  tint={instrument.iconTint}
                  symbol={instrument.symbol}
                  category={instrument.category}
                  size={32}
                />
                <View style={styles.instrumentIdentity}>
                  <Text variant="strong" numberOfLines={1}>
                    {instrument.symbol}
                  </Text>
                  <Text variant="caption" color={colors.textMuted} numberOfLines={1}>
                    {instrument.description}
                  </Text>
                </View>
                <View style={styles.changeMarket}>
                  <Text variant="caption" weight="medium" color={colors.textMuted}>
                    Change
                  </Text>
                  <ChevronRightIcon size={16} color={colors.textMuted} />
                </View>
              </View>
              <View style={styles.heroQuote}>
                <Text variant="display" style={styles.heroPrice}>
                  {formatPrice(instrument.price, instrument.precision)}
                </Text>
                <Delta label={formatPercent(instrument.changePercent)} direction={direction} size={15} />
              </View>
            </View>
          </PressableScale>
        </Gutter>

        <Gutter>
          <SegmentedControl options={ORDER_TYPES} value={orderType} onChange={setOrderType} />
        </Gutter>

        <Gutter>
          <Card style={styles.volume}>
            <Text variant="caption" weight="medium" color={colors.textMuted}>
              Quantity
            </Text>
            <View style={styles.stepper}>
              <Stepper
                label="−"
                accessibilityLabel="Decrease volume"
                onPress={() => setLots((previous) => previous - LOT_STEP)}
              />
              <Text variant="displaySm" style={styles.lots}>
                {formatLots(lots)}
              </Text>
              <Stepper
                label="+"
                accessibilityLabel="Increase volume"
                onPress={() => setLots((previous) => previous + LOT_STEP)}
              />
            </View>
          </Card>
        </Gutter>

        <Gutter>
          <Card style={styles.protection}>
            <View style={styles.protectionText}>
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
          <Card style={styles.summary}>
            <View style={styles.summaryGrid}>
              <SummaryCell
                label="Required margin"
                value={margin === null ? 'Unavailable' : formatMoney(margin)}
              />
              <SummaryCell label="Free margin" value={formatMoney(account.freeMargin)} />
              <SummaryCell label="Spread" value={formatPrice(spread, instrument.precision)} />
              <SummaryCell
                label="Leverage"
                value={account.leverage > 0 ? `1:${account.leverage}` : 'Not configured'}
              />
            </View>
            <Divider />
            <View style={styles.summaryFooter}>
              <Text variant="caption" color={colors.textMuted}>
                Contract size
              </Text>
              <Text variant="caption" weight="semibold">
                {`${instrument.contractSize.toLocaleString('en-US')} / lot`}
              </Text>
            </View>
          </Card>
        </Gutter>

        <Gutter>
          <Text variant="caption" color={colors.textSubtle} style={styles.disclaimer}>
            Every order passes through a confirmation step before it reaches the trading API.
          </Text>
        </Gutter>
      </ScrollView>

      <View style={styles.actionBar}>
        <Button
          tone="ink"
          style={styles.action}
          onPress={() => openTicket('Sell')}
          accessibilityLabel={`Sell at ${formatPrice(instrument.bid, instrument.precision)}`}
        >
          <Text variant="caption" weight="semibold" color={colors.onInkMuted} style={styles.actionLabel}>
            SELL
          </Text>
          <ButtonSubText tone="ink">
            {formatPrice(instrument.bid, instrument.precision)}
          </ButtonSubText>
        </Button>
        <Button
          tone="gold"
          style={styles.action}
          onPress={() => openTicket('Buy')}
          accessibilityLabel={`Buy at ${formatPrice(instrument.ask, instrument.precision)}`}
        >
          <Text variant="caption" weight="semibold" color={colors.ink} style={styles.actionLabel}>
            BUY
          </Text>
          <ButtonSubText tone="gold">
            {formatPrice(instrument.ask, instrument.precision)}
          </ButtonSubText>
        </Button>
      </View>
    </Screen>
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

function SummaryCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryCell}>
      <Text variant="caption" color={colors.textMuted}>
        {label}
      </Text>
      <Text variant="strong" numberOfLines={1} style={styles.summaryValue}>
        {value}
      </Text>
    </View>
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
    gap: spacing.lg,
  },
  hero: {
    gap: spacing.md,
    paddingTop: spacing.xs,
  },
  heroIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  instrumentIdentity: {
    flex: 1,
    gap: 1,
  },
  changeMarket: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    minHeight: 44,
  },
  heroQuote: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    columnGap: spacing.md,
  },
  heroPrice: {
    fontVariant: ['tabular-nums'],
  },
  volume: {
    padding: spacing.lg,
    gap: spacing.md,
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
  lots: {
    fontSize: 24,
    fontVariant: ['tabular-nums'],
  },
  protection: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  protectionText: {
    gap: 2,
  },
  summary: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: spacing.md,
  },
  summaryCell: {
    width: '50%',
    gap: 2,
  },
  summaryValue: {
    fontVariant: ['tabular-nums'],
  },
  summaryFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  disclaimer: {
    lineHeight: 18,
    textAlign: 'center',
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
  actionLabel: {
    letterSpacing: 1,
  },
})
