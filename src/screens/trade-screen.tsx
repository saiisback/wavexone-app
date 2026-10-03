import { ScrollView, StyleSheet, View } from 'react-native'

import {
  AssetIcon,
  Button,
  ButtonSubText,
  ButtonText,
  Card,
  ChevronDownIcon,
  ChevronRightIcon,
  Delta,
  Divider,
  Gutter,
  Pressable,
  PressableScale,
  Screen,
  SegmentedControl,
  TAB_BAR_CLEARANCE,
  Text,
  colors,
  radius,
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
          <Text variant="body">
            {account.mode} · {account.number}
          </Text>
          <ChevronDownIcon size={18} color={colors.text} />
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
          >
            <Card style={styles.instrument}>
              <AssetIcon
                kind={instrument.icon}
                label={instrument.iconLabel}
                tint={instrument.iconTint}
                size={42}
              />
              <View style={styles.instrumentIdentity}>
                <Text variant="strong" numberOfLines={1}>
                  {instrument.symbol}
                </Text>
                <Text variant="caption" color={colors.textMuted} numberOfLines={1}>
                  {instrument.description}
                </Text>
              </View>
              <View style={styles.instrumentQuote}>
                <Text variant="strong">{formatPrice(instrument.price, instrument.precision)}</Text>
                <Delta
                  label={formatPercent(instrument.changePercent)}
                  direction={directionOf(instrument.changePercent)}
                  size={15}
                />
              </View>
              <ChevronRightIcon size={20} color={colors.textSubtle} />
            </Card>
          </PressableScale>
        </Gutter>

        <Gutter>
          <SegmentedControl options={ORDER_TYPES} value={orderType} onChange={setOrderType} />
        </Gutter>

        <Gutter>
          <Card style={styles.volume}>
            <Text variant="body" color={colors.textMuted}>
              Volume
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
          <Card style={styles.summary}>
            <SummaryRow
              label="Required margin"
              value={margin === null ? 'Unavailable' : formatMoney(margin)}
            />
            <Divider />
            <SummaryRow label="Free margin" value={formatMoney(account.freeMargin)} />
            <Divider />
            <SummaryRow label="Spread" value={formatPrice(spread, instrument.precision)} />
            <Divider />
            <SummaryRow
              label="Contract size"
              value={`${instrument.contractSize.toLocaleString('en-US')} / lot`}
            />
            <Divider />
            <SummaryRow
              label="Leverage"
              value={account.leverage > 0 ? `1:${account.leverage}` : 'Not configured'}
            />
          </Card>
        </Gutter>

        <Gutter>
          <Text variant="caption" color={colors.textMuted} style={styles.disclaimer}>
            Every order passes through a confirmation step before it reaches the trading API.
          </Text>
        </Gutter>
      </ScrollView>

      <Gutter style={styles.actions}>
        <Button
          tone="ink"
          style={styles.action}
          onPress={() => openTicket('Sell')}
        >
          <ButtonText tone="ink">Sell</ButtonText>
          <ButtonSubText tone="ink">
            {formatPrice(instrument.bid, instrument.precision)}
          </ButtonSubText>
        </Button>
        <Button
          tone="gold"
          style={styles.action}
          onPress={() => openTicket('Buy')}
        >
          <ButtonText tone="gold">Buy</ButtonText>
          <ButtonSubText tone="gold">
            {formatPrice(instrument.ask, instrument.precision)}
          </ButtonSubText>
        </Button>
      </Gutter>
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

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text variant="body" color={colors.textMuted}>
        {label}
      </Text>
      <Text variant="strong">{value}</Text>
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
    paddingBottom: 16,
  },
  accountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    paddingLeft: 16,
    paddingRight: 12,
    borderRadius: radius.pill,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  content: {
    paddingBottom: 20,
    gap: 14,
  },
  instrument: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 20,
  },
  instrumentIdentity: {
    flex: 1,
    gap: 3,
  },
  instrumentQuote: {
    alignItems: 'flex-end',
    gap: 5,
  },
  volume: {
    padding: 16,
    borderRadius: 20,
    gap: 12,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepperButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderCurve: 'continuous',
    backgroundColor: colors.track,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lots: {
    fontSize: 24,
  },
  summary: {
    padding: 16,
    borderRadius: 20,
    gap: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  disclaimer: {
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    paddingBottom: TAB_BAR_CLEARANCE - 36,
  },
  action: {
    flex: 1,
  },
})
