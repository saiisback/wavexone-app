import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import { useState } from 'react'
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
  useActionMenu,
} from '../design-system'
import { useBackendQuery } from '../backend/provider'
import { formatMoney } from '../data/format'
import { useSession } from '../data/store'
import type { FundingMode } from '../data/types'
import { useAccountData } from '../features/accounts/use-account-data'
import { QueryStateView } from '../features/shared/query-state'
import type { RootStackParamList } from '../navigation/types'

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
 * Nothing is submitted. The guide requires a confirmation step and a staging
 * environment before any funding mutation is wired up, so the primary action
 * explains where the flow stops.
 */
export function FundingScreen() {
  const { params } = useRoute<FundingRoute>()
  const { goBack } = useNavigation()
  const showMenu = useActionMenu()

  const mode = params.mode
  const copy = COPY[mode]
  const accountData = useAccountData()
  const account = accountData.status === 'ready' ? accountData.data.account : null
  const configuration = useBackendQuery(`funding:${account?.id ?? 'none'}`, (backend) =>
    account ? backend.funds.configuration(account.id) : Promise.reject(new Error('No account')),
  )
  const selectAccountId = useSession((state) => state.selectAccount)

  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('')
  const [destinationId, setDestinationId] = useState('')

  if (!account || accountData.status !== 'ready' || configuration.status !== 'ready') {
    const state = accountData.status !== 'ready' ? accountData : configuration
    return (
      <Sheet title={copy.title} subtitle={copy.subtitle}>
        <QueryStateView state={state} render={() => null} />
      </Sheet>
    )
  }

  const accounts = accountData.data.accounts
  const fundingMethods = {
    deposit: configuration.data.depositMethods,
    withdraw: configuration.data.withdrawalMethods,
  }
  const quickAmounts = configuration.data.quickAmounts
  const selectedMethod =
    method ||
    (mode === 'withdraw' ? fundingMethods.withdraw[0] : fundingMethods.deposit[0]) ||
    ''
  const selectedDestinationId =
    destinationId || accounts.find((item) => item.id !== account.id)?.id || account.id

  const parsed = Number(amount.replace(/[^0-9.]/g, ''))
  const value = Number.isFinite(parsed) ? parsed : 0
  const exceedsBalance = mode !== 'deposit' && value > configuration.data.availableFund
  const canSubmit = value > 0 && !exceedsBalance

  const destination = accounts.find((item) => item.id === selectedDestinationId) ?? account

  const pickMethod = () =>
    showMenu({
      title: mode === 'withdraw' ? 'Withdraw to' : 'Pay with',
      options: (mode === 'withdraw' ? fundingMethods.withdraw : fundingMethods.deposit).map(
        (option) => ({ label: option, onSelect: () => setMethod(option) }),
      ),
    })

  const pickAccount = (onPick: (id: string) => void, exclude?: string) =>
    showMenu({
      title: 'Choose account',
      options: accounts
        .filter((item) => item.id !== exclude)
        .map((item) => ({
          label: `${item.mode} · ${item.number} — ${formatMoney(item.equity)}`,
          onSelect: () => onPick(item.id),
        })),
    })

  const submit = () =>
    showMenu({
      title: `${copy.title} ${formatMoney(value)}`,
      message:
        'Funding is disabled in this build. It needs test methods that cannot move real money, plus the confirmation step described in the integration guide.',
      options: [{ label: 'Close', onSelect: goBack }],
    })

  return (
    <Sheet
      title={copy.title}
      subtitle={copy.subtitle}
      footer={
        <Button tone="gold" disabled={!canSubmit} onPress={submit}>
          <ButtonText tone="gold">{copy.cta}</ButtonText>
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
          <Text variant="strong">{formatMoney(configuration.data.availableFund)}</Text>
        </View>
      </Card>

      {mode === 'transfer' ? (
        <ListGroup>
          <ListRow
            label="From"
            value={`${account.mode} · ${account.number}`}
            onPress={() => pickAccount(selectAccountId, selectedDestinationId)}
          />
          <ListRow
            label="To"
            value={`${destination.mode} · ${destination.number}`}
            divider={false}
            onPress={() => pickAccount(setDestinationId, account.id)}
          />
        </ListGroup>
      ) : (
        <ListGroup>
          <ListRow
            label={mode === 'withdraw' ? 'Destination' : 'Payment method'}
            value={selectedMethod}
            divider={false}
            onPress={pickMethod}
          />
        </ListGroup>
      )}

      <Field
        label="Amount"
        prefix="$"
        value={amount}
        onChangeText={setAmount}
        placeholder="0.00"
        keyboardType="decimal-pad"
        inputMode="decimal"
        invalid={exceedsBalance}
        hint={
          exceedsBalance
            ? `Above the available ${formatMoney(configuration.data.availableFund)}`
            : `Minimum ${formatMoney(
                mode === 'withdraw'
                  ? configuration.data.minimumWithdrawal
                  : configuration.data.minimumDeposit,
              )}`
        }
      />

      <QuickPicks
        values={quickAmounts}
        selected={quickAmounts.includes(value) ? value : undefined}
        onSelect={(next) => setAmount(String(next))}
        format={(next) => `$${next.toLocaleString('en-US')}`}
      />

      <Text variant="caption" color={colors.textMuted} style={styles.note}>
        {mode === 'withdraw'
          ? 'Withdrawals require an OTP and a saved destination before they can be submitted.'
          : 'Funds usually settle within one business day.'}
      </Text>
    </Sheet>
  )
}

const styles = StyleSheet.create({
  balance: {
    padding: 16,
    borderRadius: 18,
    gap: 12,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  note: {
    lineHeight: 20,
  },
})
