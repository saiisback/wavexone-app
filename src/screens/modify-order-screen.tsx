import { useRoute, type RouteProp } from '@react-navigation/native'
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
  Sheet,
  Text,
  colors,
  useActionMenu,
} from '../design-system'
import type { ModifyOrderRequest } from '../backend/contract'
import { mutationFailureMessage } from '../backend/errors'
import { useBackend, useBackendQuery, useInvalidateQueries } from '../backend/provider'
import { formatLots, formatPrice } from '../data/format'
import { applyQuote, markPosition } from '../data/live-quote'
import { useAccountData } from '../features/accounts/use-account-data'
import { AccountSummaryUnavailable } from '../features/accounts/account-summary-unavailable'
import { useLiveQuote } from '../features/markets/use-live-quote'
import { useMarketData } from '../features/markets/use-market-data'
import { AFTER_TRADE } from '../features/shared/query-keys'
import { QueryStateView } from '../features/shared/query-state'
import type { RootStackParamList } from '../navigation/types'
import { useAppNavigation } from '../navigation/use-app-navigation'

type ModifyRoute = RouteProp<RootStackParamList, 'ModifyOrder'>

const DECIMAL = /^\d+(\.\d+)?$/

/**
 * Stop loss / take profit edit for an order already on the account. Reads the
 * same `positions:` query as the Positions tab, so opening it costs no request.
 */
export function ModifyOrderScreen() {
  const { params } = useRoute<ModifyRoute>()
  const { goBack } = useAppNavigation()
  const showMenu = useActionMenu()
  const backend = useBackend()
  const invalidate = useInvalidateQueries()

  const accountData = useAccountData()
  const { catalogue } = useMarketData()
  const accountId = accountData.status === 'ready' ? accountData.data.account?.id : null
  const positions = useBackendQuery(`positions:${accountId ?? 'none'}`, (client) =>
    accountId ? client.orders.list(accountId) : Promise.resolve([]),
  )

  const position = positions.status === 'ready'
    ? positions.data.find((item) => item.id === params.positionId)
    : undefined
  const quote = useLiveQuote(position?.instrumentId)
  const listed = catalogue.status === 'ready' && position
    ? catalogue.data.find((item) => item.id === position.instrumentId)
    : undefined
  const instrument = listed ? applyQuote(listed, quote) : undefined

  // `undefined` until the user edits, so the fields can show the order's
  // current values without copying them into state during render.
  const [stopLossInput, setStopLoss] = useState<string>()
  const [takeProfitInput, setTakeProfit] = useState<string>()

  if (accountData.status === 'ready' && !accountData.data.account) {
    return <Sheet title="Modify order"><AccountSummaryUnavailable account={accountData.data.selectedAccount} /></Sheet>
  }

  if (positions.status !== 'ready' || catalogue.status !== 'ready') {
    const state = positions.status !== 'ready' ? positions : catalogue
    return (
      <Sheet title="Modify order">
        <QueryStateView state={state} render={() => null} />
      </Sheet>
    )
  }

  if (!position || !instrument || position.state === 'Closed') {
    return (
      <Sheet title="Modify order">
        <Text color={colors.textMuted}>This order is no longer open on the account.</Text>
      </Sheet>
    )
  }

  const initialStopLoss = priceText(position.stopLoss, instrument.precision)
  const initialTakeProfit = priceText(position.takeProfit, instrument.precision)
  const stopLoss = (stopLossInput ?? initialStopLoss).trim()
  const takeProfit = (takeProfitInput ?? initialTakeProfit).trim()

  // Emptying a field that had a level removes it: the mobile modify routes
  // read `0` as "none" (API reference §2.4).
  const stopLossError = fieldError(stopLoss)
  const takeProfitError = fieldError(takeProfit)
  const changed = stopLoss !== initialStopLoss || takeProfit !== initialTakeProfit
  // The pending route needs the trigger resent; without one it cannot be called.
  const trigger = position.state === 'Pending' && position.trigger
    ? position.trigger.toFixed(instrument.precision)
    : undefined
  const missingTrigger = position.state === 'Pending' && trigger === undefined
  const canSubmit = changed && !stopLossError && !takeProfitError && !missingTrigger

  const submit = () =>
    showMenu({
      title: `Modify ${instrument.symbol}`,
      message: `Stop loss ${stopLoss || '—'} · Take profit ${takeProfit || '—'}. Sent once and not automatically retried.`,
      options: [{
        label: 'Confirm changes',
        onSelect: () => {
          const base = {
            positionId: position.id,
            stopLoss: levelValue(stopLoss, initialStopLoss),
            takeProfit: levelValue(takeProfit, initialTakeProfit),
            idempotencyKey: Crypto.randomUUID(),
          }
          const request: ModifyOrderRequest = trigger === undefined
            ? { ...base, state: 'Open' }
            : { ...base, state: 'Pending', trigger }
          void backend.orders.modify(request).then(() => {
            invalidate(...AFTER_TRADE)
            goBack()
          }).catch((error: unknown) => showMenu({
            title: 'Changes not confirmed',
            message: mutationFailureMessage(error),
            options: [{ label: 'Got it' }],
          }))
        },
      }],
    })

  return (
    <Sheet
      title={`Modify ${instrument.symbol}`}
      subtitle={position.state === 'Pending' ? 'Pending order' : 'Open position'}
      footer={
        <Button tone="gold" disabled={!canSubmit} onPress={submit}>
          <ButtonText tone="gold">Save changes</ButtonText>
        </Button>
      }
    >
      <Card style={styles.instrument}>
        <AssetIcon
          kind={instrument.icon}
          label={instrument.iconLabel}
          tint={instrument.iconTint}
          size={42}
        />
        <View style={styles.identity}>
          <Text variant="strong">{instrument.symbol}</Text>
          <Text variant="caption" color={colors.textMuted}>
            {formatLots(position.lots)} · {position.state === 'Pending' ? 'Trigger' : 'Entry'}{' '}
            {formatPrice(position.state === 'Pending' ? position.current : position.entry, instrument.precision)}
          </Text>
        </View>
        <Badge tone={position.side === 'Buy' ? 'buy' : 'sell'}>{position.side}</Badge>
      </Card>

      <View style={styles.protection}>
        <View style={styles.protectionField}>
          <Field
            label="Stop loss"
            value={stopLoss}
            onChangeText={setStopLoss}
            placeholder="—"
            keyboardType="decimal-pad"
            inputMode="decimal"
            invalid={stopLossError !== undefined}
            hint={stopLossError}
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
            invalid={takeProfitError !== undefined}
            hint={takeProfitError}
          />
        </View>
      </View>

      <Card style={styles.summary}>
        <SummaryRow
          label="Current price"
          value={formatPrice(markPosition(position, instrument, quote).current, instrument.precision)}
        />
        <Divider />
        <SummaryRow
          label="Bid / Ask"
          value={`${formatPrice(instrument.bid, instrument.precision)} / ${formatPrice(instrument.ask, instrument.precision)}`}
        />
      </Card>

      {missingTrigger ? (
        <Text variant="caption" color={colors.red}>
          The server did not report this order&apos;s trigger price, so it cannot be modified here.
        </Text>
      ) : null}
    </Sheet>
  )
}

/** Blank for a level the order does not carry. A zero level is no level. */
function priceText(value: number | undefined, precision: number): string {
  return value === undefined || value === 0 ? '' : value.toFixed(precision)
}

function fieldError(value: string): string | undefined {
  if (value === '') return undefined
  return DECIMAL.test(value) ? undefined : 'Enter a price, e.g. 1.0850'
}

/** A cleared level is sent as `0`; one that never existed is left out. */
function levelValue(value: string, initial: string): string | undefined {
  if (value !== '') return value
  return initial === '' ? undefined : '0'
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
  instrument: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 18,
  },
  identity: {
    flex: 1,
    gap: 3,
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
    borderRadius: 18,
    gap: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
})
