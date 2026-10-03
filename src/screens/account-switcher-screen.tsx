import * as Crypto from 'expo-crypto'
import { StyleSheet, View } from 'react-native'

import { mutationFailureMessage } from '../backend/errors'
import { useBackend, useInvalidateQueries } from '../backend/provider'
import {
  Amount,
  Button,
  ButtonRow,
  ButtonText,
  PlusIcon,
  PopIn,
  PressableScale,
  Reveal,
  Sheet,
  SwapIcon,
  Text,
  colors,
  radius,
  shadow,
  spacing,
  useActionMenu,
  useSafeBack,
} from '../design-system'
import { formatMoney, formatPercent, formatPrice, directionOf } from '../data/format'
import { useSession } from '../data/store'
import { hasAccountSummary, type Account } from '../data/types'
import { useAccountData } from '../features/accounts/use-account-data'
import { QueryStateView } from '../features/shared/query-state'

/** Reached from the account pill on Positions and Trade, and from More. */
export function AccountSwitcherScreen() {
  const goBack = useSafeBack()
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
      // Switching back (or reselecting a linked-only account) must load its
      // current portal summary instead of retaining a prior partial snapshot.
      invalidate('accounts:', 'profile:', 'funding:')
      goBack()
    } catch (error: unknown) {
      showMenu({
        title: 'Could not switch account',
        message: mutationFailureMessage(error),
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

  const openNewAccount = () =>
    showMenu({
      title: 'Open a new account',
      options: [
        { label: 'Open a demo account', onSelect: () => openAccount('demo') },
        { label: 'Request a live account', onSelect: () => openAccount('live') },
      ],
    })

  return (
    <Sheet
      title="Switch account"
      footer={
        <Button tone="ink" onPress={openNewAccount} accessibilityLabel="Open a new account">
          <ButtonRow>
            <PlusIcon size={18} color={colors.white} />
            <ButtonText tone="ink">Open a new account</ButtonText>
          </ButtonRow>
        </Button>
      }
    >
      <Reveal style={styles.intro}>
        <View style={styles.disc}>
          <SwapIcon size={26} color={colors.brand} />
        </View>
        <Text variant="heading" style={styles.centered}>
          Choose your account
        </Text>
        <Text variant="caption" color={colors.textMuted} style={styles.centered}>
          Applies across every screen
        </Text>
      </Reveal>

      <QueryStateView
        state={accountData}
        isEmpty={(data) => data.accounts.length === 0}
        emptyTitle="No trading accounts"
        render={(data) => (
          <View style={styles.options}>
            {data.accounts.map((item, index) => (
              <Reveal key={item.id} index={Math.min(index + 1, 8)} distance={10}>
                <AccountCard
                  account={item}
                  active={item.id === activeId}
                  onPress={(id) => void choose(id)}
                />
              </Reveal>
            ))}
          </View>
        )}
      />
    </Sheet>
  )
}

/**
 * One account as a selectable option card: radio, mode chip and number,
 * then its figures. The selected card is outlined in the brand.
 */
function AccountCard({
  account,
  active,
  onPress,
}: {
  account: Account
  active: boolean
  onPress: (accountId: string) => void
}) {
  const summary = hasAccountSummary(account)
    ? `Equity ${formatMoney(account.equity)}. Leverage 1:${account.leverage}. Month ${formatPercent(account.changePercent)}.`
    : `Balance ${formatPrice(account.balance, 2)}. Select to load full account details.`
  const demo = account.mode === 'DEMO'

  return (
    <PressableScale
      scaleTo={0.98}
      accessibilityLabel={`Select ${account.mode} account ${account.number}${active ? ', selected' : ''}. ${summary}`}
      onPress={() => onPress(account.id)}
    >
      <View style={[styles.card, active ? styles.cardActive : null]}>
        <View style={styles.header}>
          <View style={[styles.radio, active ? styles.radioActive : null]}>
            {active ? (
              <PopIn>
                <View style={styles.radioDot} />
              </PopIn>
            ) : null}
          </View>
          <View style={styles.identity}>
            <Text variant="strong" style={styles.number}>
              {account.number}
            </Text>
            <Text variant="caption" color={colors.textMuted}>
              {demo ? 'Demo account' : 'Live account'}
            </Text>
          </View>
          <View style={[styles.modeChip, demo ? styles.modeChipDemo : styles.modeChipLive]}>
            <View style={[styles.modeDot, demo ? styles.modeDotDemo : styles.modeDotLive]} />
            <Text variant="micro" weight="semibold" color={demo ? colors.goldDeep : colors.greenSoftText}>
              {account.mode}
            </Text>
          </View>
        </View>

        {hasAccountSummary(account) ? (
          <View style={[styles.figures, active ? styles.figuresActive : null]}>
            <View style={styles.figureWide}>
              <Text variant="caption" color={colors.textMuted}>
                Equity
              </Text>
              <Amount variant="strong" numberOfLines={1}>
                {formatMoney(account.equity)}
              </Amount>
            </View>
            <View style={styles.figure}>
              <Text variant="caption" color={colors.textMuted}>
                Leverage
              </Text>
              <Text variant="strong">1:{account.leverage}</Text>
            </View>
            <View style={[styles.figure, styles.figureEnd]}>
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
        ) : (
          <View style={[styles.figures, styles.linkedSummary, active ? styles.figuresActive : null]}>
            <View style={styles.figure}>
              <Text variant="caption" color={colors.textMuted}>
                Balance
              </Text>
              <Text variant="strong">{formatPrice(account.balance, 2)}</Text>
            </View>
            <Text variant="caption" color={colors.textMuted} style={styles.linkedHint}>
              Select to load full account details
            </Text>
          </View>
        )}
      </View>
    </PressableScale>
  )
}

const RADIO = 22

const styles = StyleSheet.create({
  intro: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  disc: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    backgroundColor: colors.brandTintStrong,
    boxShadow: `0px 0px 0px 8px ${colors.brandTint}`,
  },
  centered: {
    textAlign: 'center',
  },
  options: {
    gap: spacing.md,
  },
  card: {
    padding: spacing.lg,
    gap: spacing.lg,
    borderRadius: radius.card,
    borderCurve: 'continuous',
    backgroundColor: colors.glass,
    borderWidth: 1.5,
    borderColor: 'transparent',
    boxShadow: shadow.card,
  },
  cardActive: {
    borderColor: colors.brand,
    backgroundColor: colors.brandTint,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  radio: {
    width: RADIO,
    height: RADIO,
    borderRadius: RADIO / 2,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.glass,
  },
  radioActive: {
    borderColor: colors.brand,
    backgroundColor: colors.brand,
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.glass,
  },
  identity: {
    flex: 1,
    gap: 1,
  },
  number: {
    fontVariant: ['tabular-nums'],
  },
  modeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  modeChipLive: { backgroundColor: colors.greenSoft },
  modeChipDemo: { backgroundColor: colors.goldSoft },
  modeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  modeDotLive: { backgroundColor: colors.green },
  modeDotDemo: { backgroundColor: colors.gold },
  figures: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: spacing.md,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    backgroundColor: colors.well,
  },
  figuresActive: {
    backgroundColor: colors.glass,
  },
  linkedSummary: {
    alignItems: 'flex-end',
  },
  linkedHint: {
    flex: 2,
    textAlign: 'right',
  },
  figureWide: {
    flex: 1.4,
    gap: 2,
  },
  figure: {
    flex: 1,
    gap: 2,
  },
  figureEnd: {
    alignItems: 'flex-end',
  },
})
