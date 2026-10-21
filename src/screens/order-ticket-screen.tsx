import { useColors, useThemeStyles } from '../design-system/theme'
import type { Palette } from '../design-system/colors'
import { useRoute, type RouteProp } from '@react-navigation/native'
import * as Crypto from 'expo-crypto'
import { useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'

import {
  ArrowRightIcon,
  AssetIcon,
  Badge,
  Button,
  ButtonRow,
  ButtonText,
  Card,
  Divider,
  Field,
  IconChip,
  LiveDot,
  PopIn,
  Reveal,
  Sheet,
  ShieldIcon,
  Text,
  radius,
  spacing,
  useActionMenu,
  useSafeBack,
} from '../design-system'
import { formatLots, formatMoney, formatPrice } from '../data/format'
import { applyQuote } from '../data/live-quote'
import {
  adjustOrderLots,
  estimateRequiredMargin,
  normalizeOrderLots,
  tradingSpecification,
} from '../data/margin'
import { useAccountData } from '../features/accounts/use-account-data'
import { AccountSummaryUnavailable } from '../features/accounts/account-summary-unavailable'
import { useLiveQuote } from '../features/markets/use-live-quote'
import { useMarketData } from '../features/markets/use-market-data'
import { QueryStateView } from '../features/shared/query-state'
import { KeyValueRow, LotStepper, SheetIntro } from '../features/trade/ticket-parts'
import { mutationFailureMessage } from '../backend/errors'
import { useBackend, useInvalidateQueries } from '../backend/provider'
import { AFTER_TRADE } from '../features/shared/query-keys'
import type { RootStackParamList } from '../navigation/types'
import { useSession } from '../data/store'

type OrderRoute = RouteProp<RootStackParamList, 'OrderTicket'>

const DECIMAL = /^\d+(\.\d+)?$/

/**
 * Order confirmation. The guide requires a confirmation step in front of
 * every order, so Sell / Buy anywhere in the app lands here rather than
 * firing a request.
 */
export function OrderTicketScreen() {
  const colors = useColors()
  const styles = useThemeStyles(themeStyles)

  const { params } = useRoute<OrderRoute>()
  const goBack = useSafeBack()
  const showMenu = useActionMenu()
  const backend = useBackend()
  const placing = useRef(false)
  const [submitting, setSubmitting] = useState(false)

  const invalidate = useInvalidateQueries()

  const accountData = useAccountData()
  const { catalogue } = useMarketData()
  const side = params.side
  const isLimit = params.orderType === 'Limit'

  // Tickets opened directly from Markets/Instrument detail have no draft
  // quantity. Start at the common LP minimum instead of 0.50, which is an
  // unnecessarily large first order for Forex and metals.
  const [lots, setLots] = useState(params.lots ?? 0.01)
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
  const terms = tradingSpecification(instrument.symbol, instrument.category)
  const orderLots = normalizeOrderLots(lots, terms)
  const limitValid = DECIMAL.test(limitPrice.trim()) && Number(limitPrice) > 0
  const price = isLimit && limitValid ? Number(limitPrice) : marketPrice
  const margin = estimateRequiredMargin(
    price,
    instrument.contractSize,
    orderLots,
    account.leverage,
    terms?.marginRate,
  )
  const exceedsMargin = margin !== null && margin > account.freeMargin
  const protectionValid = [stopLoss, takeProfit].every(
    (value) => value.trim() === '' || DECIMAL.test(value.trim()),
  )
  const canPlace = !exceedsMargin && protectionValid && (!isLimit || limitValid)

  const step = (direction: 1 | -1) =>
    setLots((previous) => adjustOrderLots(previous, direction, terms))

  const place = () => {
    if (placing.current) return
    let consumed = false
    showMenu({
      title: `${side} ${formatLots(orderLots)} ${instrument.symbol}`,
      message: isLimit
        ? `Confirm this ${side.toLowerCase()} limit order at ${limitPrice.trim()}. It will be submitted once and is not automatically retried.`
        : `Confirm this ${side.toLowerCase()} order. It will be submitted once and is not automatically retried.`,
      options: [{
        label: `Confirm ${side}`,
        destructive: true,
        onSelect: () => {
          if (consumed || placing.current) return
          consumed = true
          placing.current = true
          setSubmitting(true)
          const idempotencyKey = Crypto.randomUUID()
          void backend.orders.place({
            instrumentId: instrument.id,
            side,
            lots: orderLots.toFixed(2),
            ...(isLimit ? { limitPrice: limitPrice.trim() } : {}),
            stopLoss: stopLoss.trim() || undefined,
            takeProfit: takeProfit.trim() || undefined,
            idempotencyKey,
          }).then(() => {
            const title = isLimit ? 'Limit order placed' : `${side} confirmed`
            const message = isLimit
              ? `${side} limit for ${formatLots(orderLots)} ${instrument.symbol} is pending at ${limitPrice.trim()}. Account ${account.number}.`
              : `${side} order for ${formatLots(orderLots)} ${instrument.symbol} was confirmed. Account ${account.number}.`
            useSession.getState().addLocalNotification({
              id: `local:order:${idempotencyKey}`,
              kind: 'order',
              title,
              body: message,
              time: new Date().toISOString(),
            })
            invalidate(...AFTER_TRADE)
            // Present while the ticket is still mounted; dismissing a native
            // sheet first can swallow the iOS confirmation during transition.
            showMenu({ title, message, options: [{ label: 'Done', onSelect: goBack }] })
          }).catch((error: unknown) => {
            placing.current = false
            setSubmitting(false)
            showMenu({
              title: 'Order not confirmed',
              message: mutationFailureMessage(error),
              options: [{ label: 'Got it' }],
            })
          })
        },
      }],
    })
  }

  const [lotCount, lotUnit] = formatLots(orderLots).split(' ')
  const tone = side === 'Buy' ? 'gold' : 'ink'

  return (
    <Sheet
      title="Review order"
      footer={
        <Button tone={tone} disabled={!canPlace || submitting} loading={submitting} onPress={place}>
          <ButtonRow>
            <ButtonText tone={tone}>
              {submitting ? 'Submitting order…' : isLimit
                ? limitValid ? `${side} limit at ${limitPrice.trim()}` : `${side} limit`
                : `${side} at ${formatPrice(price, instrument.precision)}`}
            </ButtonText>
            <ArrowRightIcon size={18} color={side === 'Buy' ? colors.homePanel : colors.white} />
          </ButtonRow>
        </Button>
      }
    >
      <Reveal index={0}>
        <SheetIntro
          icon={
            <AssetIcon
              kind={instrument.icon}
              label={instrument.iconLabel}
              tint={instrument.iconTint}
              symbol={instrument.symbol}
              category={instrument.category}
              size={52}
            />
          }
          title={`${side}${isLimit ? ' limit' : ''} ${instrument.symbol}`}
          subtitle={instrument.description}
        >
          <PopIn delay={240}>
            <Badge tone={side === 'Buy' ? 'buy' : 'sell'}>{side}</Badge>
          </PopIn>
          <View style={styles.quotePill}>
            <LiveDot color={colors.green} size={6} />
            <Text variant="caption" weight="medium" color={colors.textMuted} style={styles.tabular}>
              {formatPrice(instrument.bid, instrument.precision)} / {formatPrice(instrument.ask, instrument.precision)}
            </Text>
          </View>
        </SheetIntro>
      </Reveal>

      <Reveal index={1}>
        <Card style={styles.volume}>
          <View style={styles.cardHead}>
            <Text variant="caption" weight="medium" color={colors.textMuted}>
              Volume
            </Text>
            <Text variant="caption" color={colors.textSubtle}>
              {`${instrument.contractSize.toLocaleString('en-US')} / lot`}
            </Text>
          </View>
          <LotStepper compact lots={lotCount} unit={lotUnit} onDecrease={() => step(-1)} onIncrease={() => step(1)} />
        </Card>
      </Reveal>

      {isLimit ? (
        <Reveal index={2}>
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
        </Reveal>
      ) : null}

      <Reveal index={3}>
        <Card style={styles.protectionCard}>
          <View style={styles.protectionHead}>
            <IconChip tone="mint" size={36} shape="square">
              <ShieldIcon size={18} color={colors.tintMintInk} />
            </IconChip>
            <View style={styles.protectionTitle}>
              <Text variant="strong">Protection</Text>
              <Text variant="caption" color={colors.textMuted}>
                Optional. Leave blank for none.
              </Text>
            </View>
          </View>
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
        </Card>
      </Reveal>

      <Reveal index={4}>
        <Card style={styles.summary}>
          <KeyValueRow label="Account" value={`${account.mode} · ${account.number}`} />
          <Divider />
          <KeyValueRow
            label={isLimit ? 'Limit price' : 'Fill price'}
            value={isLimit && !limitValid ? '—' : formatPrice(price, instrument.precision)}
          />
          <Divider />
          <KeyValueRow label="Free margin" value={formatMoney(account.freeMargin)} />
          <Divider />
          <KeyValueRow
            label="Leverage"
            value={terms ? `1:${terms.leverage}` : account.leverage > 0 ? `1:${account.leverage}` : 'Not configured'}
          />
          <KeyValueRow
            well
            label="Required margin"
            value={margin === null ? 'Unavailable' : formatMoney(margin)}
            tint={exceedsMargin ? colors.red : undefined}
          />
        </Card>
      </Reveal>

      {exceedsMargin ? (
        <Text variant="caption" color={colors.red} style={styles.note}>
          This volume needs more margin than the account has free.
        </Text>
      ) : margin === null ? (
        <Text variant="caption" color={colors.textMuted} style={styles.note}>
          Margin estimate unavailable. The broker will validate available margin when you confirm.
        </Text>
      ) : null}
    </Sheet>
  )
}

const themeStyles = (colors: Palette) => (StyleSheet.create({
  quotePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 26,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    borderCurve: 'continuous',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
  volume: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  protectionCard: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  protectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  protectionTitle: {
    flex: 1,
    gap: 1,
  },
  protection: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  protectionField: {
    flex: 1,
  },
  summary: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  note: {
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
}))
