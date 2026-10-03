import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import * as Crypto from 'expo-crypto'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'

import {
  Button,
  ButtonText,
  Card,
  Divider,
  Field,
  ListGroup,
  ListRow,
  QuickPicks,
  Sheet,
  Text,
  colors,
  spacing,
  useActionMenu,
} from '../design-system'
import type { FundingConfiguration, FundingRequest } from '../backend/contract'
import { BackendError } from '../backend/errors'
import { useBackend, useBackendQuery, useInvalidateQueries } from '../backend/provider'
import { formatMoney, formatPrice } from '../data/format'
import { hasAccountSummary, type Account, type DetailedAccount, type FundingMode } from '../data/types'
import { useAccountData } from '../features/accounts/use-account-data'
import { AccountSummaryUnavailable } from '../features/accounts/account-summary-unavailable'
import { AFTER_FUNDING } from '../features/shared/query-keys'
import { QueryStateView } from '../features/shared/query-state'
import type { RootStackParamList } from '../navigation/types'
import { useAppNavigation } from '../navigation/use-app-navigation'

type FundingRoute = RouteProp<RootStackParamList, 'Funding'>

const COPY: Record<FundingMode, { title: string; subtitle: string; cta: string }> = {
  deposit: {
    title: 'Deposit',
    subtitle: 'Add funds to your trading account',
    cta: 'Continue to payment',
  },
  withdraw: {
    title: 'Withdraw',
    subtitle: 'Send funds to a saved destination',
    cta: 'Request withdrawal',
  },
  transfer: {
    title: 'Transfer',
    subtitle: 'Move funds between your accounts',
    cta: 'Review transfer',
  },
}

/**
 * Deposit, withdraw and internal transfer share this sheet — the same three
 * inputs with different copy, mirroring `apiSubmitDeposit`,
 * `apiSubmitWithdraw` and `apiTransfer`.
 *
 * Every submission goes through a confirmation step, and runs only in a build
 * whose phase allows funding (guide §8). A refusal is explained in a menu.
 */
export function FundingScreen() {
  const { params } = useRoute<FundingRoute>()
  const mode = params.mode
  const copy = COPY[mode]
  const accountData = useAccountData()
  const account = accountData.status === 'ready' ? accountData.data.account : null
  const configuration = useBackendQuery(`funding:${account?.id ?? 'none'}`, (backend) =>
    account ? backend.funds.configuration(account.id) : Promise.resolve(null),
  )
  if (accountData.status === 'ready' && !account) {
    return <Sheet title={copy.title} subtitle={copy.subtitle}><AccountSummaryUnavailable account={accountData.data.selectedAccount} /></Sheet>
  }
  if (!account || accountData.status !== 'ready' || configuration.status !== 'ready') {
    const state = accountData.status !== 'ready' ? accountData : configuration
    return (
      <Sheet title={copy.title} subtitle={copy.subtitle}>
        <QueryStateView state={state} render={() => null} />
      </Sheet>
    )
  }

  return (
    <FundingForm
      key={`${mode}:${account.id}`}
      mode={mode}
      account={account}
      accounts={accountData.data.accounts}
      configuration={configuration.data!}
    />
  )
}

type SubmissionState = 'idle' | 'submitting' | 'awaitingOtp' | 'succeeded'

/** Account-scoped state prevents an OTP or confirmation surviving an account switch. */
function FundingForm({ mode, account, accounts, configuration }: {
  mode: FundingMode
  account: DetailedAccount
  accounts: readonly Account[]
  configuration: FundingConfiguration
}) {
  const copy = COPY[mode]
  const { goBack } = useNavigation()
  const showMenu = useActionMenu()
  const backend = useBackend()
  const { openAccountSwitcher } = useAppNavigation()
  const invalidate = useInvalidateQueries()
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('')
  const [destinationId, setDestinationId] = useState('')
  const [otp, setOtp] = useState('')
  const [details, setDetails] = useState<Record<string, string>>({})
  const [submission, setSubmission] = useState<SubmissionState>('idle')
  const [withdrawal, setWithdrawal] = useState<{
    request: Omit<FundingRequest, 'otp' | 'idempotencyKey'>
    fields: FundingConfiguration['withdrawalFields']
  } | null>(null)
  // Synchronous guard covers taps that arrive before React renders the disabled button.
  const busy = useRef(false)
  const latestConfirmation = useRef(0)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const methods = (mode === 'withdraw' ? configuration.withdrawalMethods : configuration.depositMethods)
    .filter((option) => option.trim().length > 0)
  const quickAmounts = configuration.quickAmounts.filter((value) => Number.isFinite(value) && value > 0)
  const selectedMethod = withdrawal?.request.method ?? (methods.includes(method) ? method : methods[0] ?? '')
  const selectedDestinationId =
    destinationId || accounts.find((item) => item.id !== account.id)?.id || ''

  const validDecimal = /^\d+(?:\.\d{0,2})?$/.test(amount.trim())
  const parsed = validDecimal ? Number(amount) : 0
  const value = Number.isFinite(parsed) ? parsed : 0
  const minimum = mode === 'withdraw'
    ? configuration.minimumWithdrawal
    : mode === 'deposit' ? configuration.minimumDeposit : 0
  const exceedsBalance = mode !== 'deposit' && value > configuration.availableFund
  const withdrawalFields = mode === 'withdraw' ? withdrawal?.fields ?? configuration.withdrawalFields : []
  const destinationDetails = Object.fromEntries(
    withdrawalFields.map((field) => [field.name, (details[field.name] ?? '').trim()]),
  )
  const destinationComplete = withdrawalFields.every((field) => destinationDetails[field.name] !== '')
  const destination = accounts.find((item) => item.id === selectedDestinationId)
  const transferAvailable = Boolean(destination && destination.id !== account.id)
  const unavailable = mode === 'transfer'
    ? transferAvailable ? '' : 'Transfer requires two different accounts.'
    : !selectedMethod
      ? 'No funding methods are available for this account.'
      : !methods.includes(selectedMethod) ? 'The selected method is no longer available. Close this sheet and review a new withdrawal.' : ''
  const awaitingOtp = submission === 'awaitingOtp'
  const locked = submission !== 'idle'
  const submitting = submission === 'submitting'
  const canSubmit = value > 0 && value >= minimum && !exceedsBalance && destinationComplete &&
    !unavailable && !submitting && submission !== 'succeeded' && (!awaitingOtp || /^\d+$/.test(otp.trim()))
  // Native menus retain their callbacks across renders. A changed rule, linked
  // account, or draft must require a fresh review before that callback can act.
  // Compare values so a refresh returning the same eligibility remains usable.
  const confirmationEligibility = JSON.stringify([
    minimum,
    mode === 'deposit' ? null : configuration.availableFund,
    mode === 'transfer' ? [] : methods,
    mode === 'withdraw' ? configuration.withdrawalFields : [],
    accounts.map((item) => [item.id, item.mode, item.number]),
    value, selectedMethod, selectedDestinationId, destinationDetails, otp,
  ])
  useLayoutEffect(() => {
    latestConfirmation.current += 1
  }, [confirmationEligibility])
  const cta = submitting
    ? 'Submitting…'
    : submission === 'succeeded'
      ? 'Request submitted'
      : mode === 'withdraw' && !awaitingOtp ? 'Send withdrawal code' : copy.cta

  const pickMethod = () =>
    showMenu({
      title: mode === 'withdraw' ? 'Withdraw to' : 'Pay with',
      options: methods.map(
        (option) => ({ label: option, onSelect: () => setMethod(option) }),
      ),
    })

  const pickAccount = (onPick: (id: string) => void, exclude?: string) =>
    showMenu({
      title: 'Choose account',
      options: accounts
        .filter((item) => item.id !== exclude)
        .map((item) => ({
          label: `${item.mode} · ${item.number} — ${
            hasAccountSummary(item) ? formatMoney(item.equity) : formatPrice(item.balance, 2)
          }`,
          onSelect: () => onPick(item.id),
        })),
    })

  const submit = () => {
    if (!canSubmit || busy.current || !mounted.current) return
    const confirmation = ++latestConfirmation.current
    // Each displayed confirmation is consumed once, even after a rejected request.
    let consumed = false
    showMenu({
      title: `${copy.title} ${formatMoney(value)}`,
      message: `${account.mode} · ${account.number}${mode === 'transfer' ? ` → ${destination?.mode} · ${destination?.number}` : ` · ${selectedMethod}`}. Confirm this request. It is submitted once and is not automatically retried.`,
      options: [{
        label: `Confirm ${copy.title.toLowerCase()}`,
        destructive: mode !== 'deposit',
        onSelect: () => {
          if (consumed || confirmation !== latestConfirmation.current || busy.current || !mounted.current) return
          consumed = true
          busy.current = true
          setSubmission('submitting')
          void (async () => {
            try {
              const idempotencyKey = Crypto.randomUUID()
              const amountValue = value.toFixed(2)
              if (mode === 'deposit') {
                await backend.funds.deposit({ accountId: account.id, amount: amountValue, method: selectedMethod, idempotencyKey })
              } else if (mode === 'transfer') {
                await backend.funds.transfer({ fromAccountId: account.id, toAccountId: selectedDestinationId, amount: amountValue, idempotencyKey })
              } else if (awaitingOtp) {
                await backend.funds.requestWithdrawal({ ...withdrawal!.request, otp: otp.trim(), idempotencyKey })
              } else {
                const request = { accountId: account.id, amount: amountValue, method: selectedMethod, details: destinationDetails }
                await backend.funds.sendWithdrawalOtp({ accountId: request.accountId, amount: request.amount, details: request.details, idempotencyKey })
                busy.current = false
                if (mounted.current) {
                  setWithdrawal({ request, fields: withdrawalFields })
                  setSubmission('awaitingOtp')
                }
                return
              }
              if (mounted.current) setSubmission('succeeded')
              invalidate(...AFTER_FUNDING)
              if (mounted.current) goBack()
            } catch (error: unknown) {
              busy.current = false
              if (!mounted.current) return
              setSubmission(awaitingOtp ? 'awaitingOtp' : 'idle')
              showMenu({ title: 'Request not confirmed', message: fundingFailureMessage(error), options: [{ label: 'Got it' }] })
            }
          })()
        },
      }],
    })
  }

  return (
    <Sheet
      title={copy.title}
      subtitle={copy.subtitle}
      footer={
        <Button tone="gold" disabled={!canSubmit} onPress={submit}>
          <ButtonText tone="gold">{cta}</ButtonText>
        </Button>
      }
    >
      <Card style={styles.balance}>
        <View style={styles.balanceRow}>
          <Text variant="body" color={colors.textMuted}>
            {mode === 'deposit' ? 'Depositing to' : 'From'}
          </Text>
          <Text variant="strong">
            {account.mode} · {account.number}
          </Text>
        </View>
        <Divider />
        <View style={styles.balanceRow}>
          <Text variant="body" color={colors.textMuted}>
            Available
          </Text>
          <Text variant="strong">{formatMoney(configuration.availableFund)}</Text>
        </View>
      </Card>

      {mode === 'transfer' ? (
        <ListGroup>
          <ListRow
            label="From"
            value={`${account.mode} · ${account.number}`}
            onPress={locked || !transferAvailable ? undefined : openAccountSwitcher}
          />
          <ListRow
            label="To"
            value={destination ? `${destination.mode} · ${destination.number}` : 'No other account'}
            divider={false}
            onPress={locked || !transferAvailable ? undefined : () => pickAccount(setDestinationId, account.id)}
          />
        </ListGroup>
      ) : (
        <ListGroup>
          <ListRow
            label={mode === 'withdraw' ? 'Destination' : 'Payment method'}
            value={selectedMethod}
            divider={false}
            onPress={locked || !selectedMethod ? undefined : pickMethod}
          />
        </ListGroup>
      )}

      {unavailable ? <Text variant="caption" color={colors.textMuted}>{unavailable}</Text> : null}

      <Field
        label="Amount"
        prefix="$"
        value={amount}
        onChangeText={setAmount}
        editable={!locked}
        accessibilityLabel="Amount"
        placeholder="0.00"
        keyboardType="decimal-pad"
        inputMode="decimal"
        invalid={exceedsBalance}
        hint={
          exceedsBalance
            ? `Above the available ${formatMoney(configuration.availableFund)}`
            : mode === 'transfer' ? 'Enter an amount to transfer' : `Minimum ${formatMoney(minimum)}`
        }
      />

      {!locked ? (
        <QuickPicks
          values={quickAmounts}
          selected={quickAmounts.includes(value) ? value : undefined}
          onSelect={(next) => setAmount(String(next))}
          format={(next) => `$${next.toLocaleString('en-US')}`}
        />
      ) : null}

      {withdrawalFields.map((field) => (
        <Field
          key={field.id}
          label={field.label}
          value={details[field.name] ?? ''}
          editable={!locked}
          accessibilityLabel={field.label}
          onChangeText={(text) => setDetails((previous) => ({ ...previous, [field.name]: text }))}
          autoCapitalize="none"
          autoCorrect={false}
        />
      ))}

      {mode === 'withdraw' && (awaitingOtp || (submitting && otp !== '')) ? (
        <Field
          label="OTP"
          value={otp}
          onChangeText={setOtp}
          editable={!submitting}
          accessibilityLabel="OTP"
          hint="Enter the code sent to you to confirm this withdrawal."
          placeholder="Enter withdrawal code"
          keyboardType="number-pad"
        />
      ) : null}

      <Text variant="caption" color={colors.textMuted} style={styles.note}>
        {mode === 'withdraw'
          ? 'Withdrawals require an OTP and a saved destination before they can be submitted.'
          : 'Funds usually settle within one business day.'}
      </Text>
    </Sheet>
  )
}

function fundingFailureMessage(error: unknown): string {
  if (error instanceof BackendError && error.kind === 'rejected') {
    return 'That request was declined. Review your details before submitting again.'
  }
  if (error instanceof BackendError && error.kind === 'auth') {
    return 'Your session has expired. Sign in again and check your account activity before making another attempt.'
  }
  return 'We could not confirm this request. Check your account activity before making another attempt.'
}

const styles = StyleSheet.create({
  balance: {
    padding: spacing.xl,
    gap: spacing.lg,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  note: {
    lineHeight: 20,
  },
})
