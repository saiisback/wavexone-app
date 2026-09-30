import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
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
  useActionMenu,
} from '../design-system'
import { formatLots, formatMoney, formatPrice } from '../data/format'
import { useAccountData } from '../features/accounts/use-account-data'
import { useMarketData } from '../features/markets/use-market-data'
import { QueryStateView } from '../features/shared/query-state'
import type { RootStackParamList } from '../navigation/types'

type OrderRoute = RouteProp<RootStackParamList, 'OrderTicket'>

const LOT_STEP = 0.01
const MIN_LOTS = 0.01

/**
 * Order confirmation. The guide requires a confirmation step in front of
 * every order, so Sell / Buy anywhere in the app lands here rather than
 * firing a request.
 */
export function OrderTicketScreen() {
  const { params } = useRoute<OrderRoute>()
  const { goBack } = useNavigation()
  const showMenu = useActionMenu()

  const accountData = useAccountData()
  const { catalogue } = useMarketData()
  const side = params.side

  const [lots, setLots] = useState(0.5)
  const [stopLoss, setStopLoss] = useState('')
  const [takeProfit, setTakeProfit] = useState('')

  if (accountData.status !== 'ready' || !accountData.data.account || catalogue.status !== 'ready') {
    const state = accountData.status !== 'ready' ? accountData : catalogue
    return (
      <Sheet title={`${side} order`}>
        <QueryStateView state={state} render={() => null} />
      </Sheet>
    )
  }

  const account = accountData.data.account
  const instrument = catalogue.data.find((item) => item.id === params.instrumentId)
  if (!instrument) {
    return <Sheet title={`${side} order`}><Text>Instrument unavailable.</Text></Sheet>
  }

  const price = side === 'Buy' ? instrument.ask : instrument.bid
  const margin = (price * instrument.contractSize * lots) / account.leverage
  const exceedsMargin = margin > account.freeMargin

  const step = (direction: 1 | -1) =>
    setLots((previous) => Math.max(MIN_LOTS, round(previous + direction * LOT_STEP)))

  const place = () =>
    showMenu({
      title: `${side} ${formatLots(lots)} ${instrument.symbol}`,
      message:
        'Order placement is disabled in this build. It needs a staging account and written authorisation before any trading mutation runs.',
      options: [{ label: 'Close', onSelect: goBack }],
    })

  return (
    <Sheet
      title={`${side} ${instrument.symbol}`}
      subtitle={instrument.description}
      footer={
        <Button tone={side === 'Buy' ? 'gold' : 'ink'} disabled={exceedsMargin} onPress={place}>
          <ButtonText tone={side === 'Buy' ? 'gold' : 'ink'}>
            {`${side} at ${formatPrice(price, instrument.precision)}`}
          </ButtonText>
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
          value={formatMoney(margin)}
          tint={exceedsMargin ? colors.red : undefined}
        />
        <Divider />
        <SummaryRow label="Free margin" value={formatMoney(account.freeMargin)} />
        <Divider />
        <SummaryRow label="Leverage" value={`1:${account.leverage}`} />
      </Card>

      {exceedsMargin ? (
        <Text variant="caption" color={colors.red}>
          This volume needs more margin than the account has free.
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
    borderRadius: 18,
  },
  identity: {
    flex: 1,
    gap: 3,
  },
  volume: {
    padding: 16,
    borderRadius: 18,
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
    borderRadius: 18,
    gap: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
})
