import { useNavigation } from '@react-navigation/native'
import * as Crypto from 'expo-crypto'
import { StyleSheet, View } from 'react-native'

import { mutationFailureMessage } from '../backend/errors'
import { useBackend, useInvalidateQueries } from '../backend/provider'
import {
  Badge,
  Card,
  PressableScale,
  Sheet,
  Text,
  VerifiedIcon,
  colors,
  useActionMenu,
} from '../design-system'
import { formatMoney, formatPercent, directionOf } from '../data/format'
import { useSession } from '../data/store'
import type { Account } from '../data/types'
import { useAccountData } from '../features/accounts/use-account-data'
import { QueryStateView } from '../features/shared/query-state'

/** Reached from the account pill on Positions and Trade, and from More. */
export function AccountSwitcherScreen() {
  const { goBack } = useNavigation()
  const showMenu = useActionMenu()
  const backend = useBackend()
  const invalidate = useInvalidateQueries()
  const accountData = useAccountData()

  const activeId = useSession((state) => state.accountId)
  const select = useSession((state) => state.selectAccount)

  const choose = async (accountId: string) => {
    try {
      await backend.accounts.switchAccount({
        accountId,
        idempotencyKey: Crypto.randomUUID(),
      })
      select(accountId)
      goBack()
    } catch {
      showMenu({
        title: 'Could not switch account',
        message: 'Your previous account is still selected. Try again.',
        options: [{ label: 'Got it' }],
      })
    }
  }

  const openAccount = (kind: 'demo' | 'live') => {
    void backend.accounts
      .openAccount({ kind, idempotencyKey: Crypto.randomUUID() })
      .then(() => {
        invalidate('accounts:', 'profile:')
        showMenu({
          title: kind === 'demo' ? 'Demo account opened' : 'Request sent',
          message:
            kind === 'demo'
              ? 'It appears in this list once the account data refreshes.'
              : 'WaveXOne reviews live account requests. The account appears here once it is opened.',
          options: [{ label: 'Got it' }],
        })
      })
      .catch((error: unknown) =>
        showMenu({
          title: kind === 'demo' ? 'Demo account not opened' : 'Request not sent',
          message: mutationFailureMessage(error),
          options: [{ label: 'Got it' }],
        }),
      )
  }

  return (
    <Sheet title="Switch account" subtitle="Applies across every screen">
      <QueryStateView
        state={accountData}
        isEmpty={(data) => data.accounts.length === 0}
        emptyTitle="No trading accounts"
        render={(data) => (
          <>
            {data.accounts.map((item) => (
              <AccountCard
                key={item.id}
                account={item}
                active={item.id === activeId}
                onPress={(id) => void choose(id)}
              />
            ))}
          </>
        )}
      />

      <PressableScale
        scaleTo={0.99}
        onPress={() =>
          showMenu({
            title: 'Open a new account',
            options: [
              { label: 'Open a demo account', onSelect: () => openAccount('demo') },
              { label: 'Request a live account', onSelect: () => openAccount('live') },
            ],
          })
        }
      >
        <Card style={styles.add}>
          <Text variant="strong" color={colors.textMuted}>
            + Open a new account
          </Text>
        </Card>
      </PressableScale>
    </Sheet>
  )
}

function AccountCard({
  account,
  active,
  onPress,
}: {
  account: Account
  active: boolean
  onPress: (accountId: string) => void
}) {
  return (
    <PressableScale scaleTo={0.99} onPress={() => onPress(account.id)}>
      <Card style={[styles.card, active ? styles.cardActive : null]}>
        <View style={styles.header}>
          <Text variant="strong">{account.number}</Text>
          <Badge tone={account.mode === 'DEMO' ? 'neutral' : 'buy'}>{account.mode}</Badge>
          {active ? <VerifiedIcon size={18} /> : null}
        </View>

        <View style={styles.figures}>
          <View style={styles.figure}>
            <Text variant="caption" color={colors.textMuted}>
              Equity
            </Text>
            <Text variant="strong">{formatMoney(account.equity)}</Text>
          </View>
          <View style={styles.figure}>
            <Text variant="caption" color={colors.textMuted}>
              Leverage
            </Text>
            <Text variant="strong">1:{account.leverage}</Text>
          </View>
          <View style={styles.figure}>
            <Text variant="caption" color={colors.textMuted}>
              Month
            </Text>
            <Text
              variant="strong"
              color={directionOf(account.changePercent) === 'down' ? colors.red : colors.green}
            >
              {formatPercent(account.changePercent)}
            </Text>
          </View>
        </View>
      </Card>
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 20,
    gap: 14,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cardActive: {
    borderColor: colors.gold,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  figures: {
    flexDirection: 'row',
  },
  figure: {
    flex: 1,
    gap: 3,
  },
  add: {
    padding: 18,
    borderRadius: 20,
    alignItems: 'center',
  },
})
