import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import * as Crypto from 'expo-crypto'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import {
  AssetIcon,
  Badge,
  Button,
  ButtonText,
  Card,
  Divider,
  Field,
  Pressable,
  Sheet,
  Text,
  colors,
  radius,
  useActionMenu,
} from '../design-system'
import { formatLots, formatMoney, formatPrice } from '../data/format'
import { applyQuote } from '../data/live-quote'
import { estimateRequiredMargin } from '../data/margin'
import { useAccountData } from '../features/accounts/use-account-data'
import { AccountSummaryUnavailable } from '../features/accounts/account-summary-unavailable'
import { useLiveQuote } from '../features/markets/use-live-quote'
import { useMarketData } from '../features/markets/use-market-data'
import { QueryStateView } from '../features/shared/query-state'
import { mutationFailureMessage } from '../backend/errors'
import { useBackend, useInvalidateQueries } from '../backend/provider'
import { AFTER_TRADE } from '../features/shared/query-keys'
import type { RootStackParamList } from '../navigation/types'

type OrderRoute = RouteProp<RootStackParamList, 'OrderTicket'>

const LOT_STEP = 0.01
const MIN_LOTS = 0.01
const DECIMAL = /^\d+(\.\d+)?$/

/**
 * Order confirmation. The guide requires a confirmation step in front of
 * every order, so Sell / Buy anywhere in the app lands here rather than
 * firing a request.
 */
export function OrderTicketScreen() {
  const { params } = useRoute<OrderRoute>()
  const { goBack } = useNavigation()
  const showMenu = useActionMenu()
  const backend = useBackend()

  const invalidate = useInvalidateQueries()

  const accountData = useAccountData()
  const { catalogue } = useMarketData()
  const side = params.side
  const isLimit = params.orderType === 'Limit'

  const [lots, setLots] = useState(params.lots ?? 0.5)
  const [limitPrice, setLimitPrice] = useState('')
  const [stopLoss, setStopLoss] = useState('')
  const [takeProfit, setTakeProfit] = useState('')
  const quote = useLiveQuote(params.instrumentId)

  if (accountData.status !== 'ready' || !accountData.data.account || catalogue.status !== 'ready') {
    if (accountData.status === 'ready' && !accountData.data.account) {
      return <Sheet title={`${side} order`}><AccountSummaryUnavailable account={accountData.data.selectedAccount} /></Sheet>
    }
    const state = accountData.status !== 'ready' ? accountData : catalogue
    return (
      <Sheet title={`${side} order`}>
        <QueryStateView state={state} render={() => null} />
      </Sheet>
    )
  }

  const account = accountData.data.account
  const listed = catalogue.data.find((item) => item.id === params.instrumentId)
  const instrument = listed ? applyQuote(listed, quote) : undefined
  if (!instrument) {
    return <Sheet title={`${side} order`}><Text>Instrument unavailable.</Text></Sheet>
  }

  const marketPrice = side === 'Buy' ? instrument.ask : instrument.bid
  const limitValid = DECIMAL.test(limitPrice.trim()) && Number(limitPrice) > 0
  const price = isLimit && limitValid ? Number(limitPrice) : marketPrice
  const margin = estimateRequiredMargin(price, instrument.contractSize, lots, account.leverage)
  const exceedsMargin = margin !== null && margin > account.freeMargin
  const protectionValid = [stopLoss, takeProfit].every(
    (value) => value.trim() === '' || DECIMAL.test(value.trim()),
  )
  const canPlace = !exceedsMargin && protectionValid && (!isLimit || limitValid)

  const step = (direction: 1 | -1) =>
    setLots((previous) => Math.max(MIN_LOTS, round(previous + direction * LOT_STEP)))

  const place = () =>
    showMenu({
      title: `${side} ${formatLots(lots)} ${instrument.symbol}`,
      message: isLimit
        ? `Confirm this ${side.toLowerCase()} limit order at ${limitPrice.trim()}. It will be submitted once and is not automatically retried.`
        : `Confirm this ${side.toLowerCase()} order. It will be submitted once and is not automatically retried.`,
      options: [{
        label: `Confirm ${side}`,
        destructive: true,
        onSelect: () => {
          void backend.orders.place({
            instrumentId: instrument.id,
            side,
            lots: lots.toFixed(2),
            ...(isLimit ? { limitPrice: limitPrice.trim() } : {}),
            stopLoss: stopLoss.trim() || undefined,
            takeProfit: takeProfit.trim() || undefined,
            idempotencyKey: Crypto.randomUUID(),
          }).then(() => {
            invalidate(...AFTER_TRADE)
            goBack()
          }).catch((error: unknown) => showMenu({
            title: 'Order not confirmed',
            message: mutationFailureMessage(error),
            options: [{ label: 'Got it' }],
          }))
        },
      }],
    })

  return (
    <Sheet
      title={`${side}${isLimit ? ' limit' : ''} ${instrument.symbol}`}
      subtitle={instrument.description}
      footer={
        <Button tone={side === 'Buy' ? 'gold' : 'ink'} disabled={!canPlace} onPress={place}>
          <ButtonText tone={side === 'Buy' ? 'gold' : 'ink'}>
            {isLimit
              ? limitValid ? `${side} limit at ${limitPrice.trim()}` : `${side} limit`
              : `${side} at ${formatPrice(price, instrument.precision)}`}
          </ButtonText>
        </Button>
      }
    >
      <Card style={styles.instrument}>
        <AssetIcon
          kind={instrument.icon}
          label={instrument.iconLabel}
          tint={instrument.iconTint}
          symbol={instrument.symbol}
          category={instrument.category}
          size={42}
        />
        <View style={styles.identity}>
          <Text variant="strong">{instrument.symbol}</Text>
          <Text variant="caption" color={colors.textMuted}>
            {formatPrice(instrument.bid, instrument.precision)} /{' '}
            {formatPrice(instrument.ask, instrument.precision)}
          </Text>
        </View>
        <Badge tone={side === 'Buy' ? 'buy' : 'sell'}>{side}</Badge>
      </Card>

      <Card style={styles.volume}>
        <Text variant="body" color={colors.textMuted}>
          Volume
        </Text>
        <View style={styles.stepper}>
          <Stepper label="−" onPress={() => step(-1)} />
          <Text variant="displaySm" style={styles.lots}>
            {formatLots(lots)}
          </Text>
          <Stepper label="+" onPress={() => step(1)} />
        </View>
      </Card>

      {isLimit ? (
        <Field
          label="Limit price"
          value={limitPrice}
          onChangeText={setLimitPrice}
          placeholder={formatPrice(marketPrice, instrument.precision)}
          keyboardType="decimal-pad"
          inputMode="decimal"
          invalid={limitPrice.trim() !== '' && !limitValid}
          hint="The order waits on the account until this price is reached."
        />
      ) : null}

      <View style={styles.protection}>
        <View style={styles.protectionField}>
          <Field
            label="Stop loss"
            value={stopLoss}
            onChangeText={setStopLoss}
            placeholder="—"
            keyboardType="decimal-pad"
            inputMode="decimal"
          />
        </View>
        <View style={styles.protectionField}>
          <Field
            label="Take profit"
            value={takeProfit}
            onChangeText={setTakeProfit}
            placeholder="—"
            keyboardType="decimal-pad"
            inputMode="decimal"
          />
        </View>
      </View>

      <Card style={styles.summary}>
        <SummaryRow label="Account" value={`${account.mode} · ${account.number}`} />
        <Divider />
        <SummaryRow
          label="Required margin"
          value={margin === null ? 'Unavailable' : formatMoney(margin)}
          tint={exceedsMargin ? colors.red : undefined}
        />
        <Divider />
        <SummaryRow label="Free margin" value={formatMoney(account.freeMargin)} />
        <Divider />
        <SummaryRow
          label="Leverage"
          value={account.leverage > 0 ? `1:${account.leverage}` : 'Not configured'}
        />
      </Card>

      {exceedsMargin ? (
        <Text variant="caption" color={colors.red}>
          This volume needs more margin than the account has free.
        </Text>
      ) : margin === null ? (
        <Text variant="caption" color={colors.textMuted}>
          Margin estimate unavailable. The broker will validate available margin when you confirm.
        </Text>
      ) : null}
    </Sheet>
  )
}

function Stepper({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label === '+' ? 'Increase volume' : 'Decrease volume'}
      onPress={onPress}
      style={styles.stepperButton}
    >
      <Text variant="heading">{label}</Text>
    </Pressable>
  )
}

function SummaryRow({ label, value, tint }: { label: string; value: string; tint?: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text variant="body" color={colors.textMuted}>
        {label}
      </Text>
      <Text variant="strong" color={tint}>
        {value}
      </Text>
    </View>
  )
}

/** Keeps lot sizes free of binary floating-point drift in the display. */
function round(value: number) {
  return Math.round(value * 100) / 100
}

const styles = StyleSheet.create({
  instrument: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radius.card,
  },
  identity: {
    flex: 1,
    gap: 3,
  },
  volume: {
    padding: 16,
    borderRadius: radius.card,
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
  protection: {
    flexDirection: 'row',
    gap: 12,
  },
  protectionField: {
    flex: 1,
  },
  summary: {
    padding: 16,
    borderRadius: radius.card,
    gap: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
})
