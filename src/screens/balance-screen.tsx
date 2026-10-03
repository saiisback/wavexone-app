import { Fragment, useState } from 'react'
import { StyleSheet, View } from 'react-native'

import {
  Amount,
  BoltIcon,
  Card,
  DeltaPill,
  DepositIcon,
  Divider,
  EmptyState,
  IconChip,
  PageScreen,
  PressableScale,
  ProgressBar,
  Reveal,
  SCREEN_PADDING,
  SearchField,
  ShieldIcon,
  Text,
  TrendUpIcon,
  WalletIcon,
  WithdrawIcon,
  colors,
  radius,
  spacing,
  useActionMenu,
  useCountUp,
} from '../design-system'
import { useBackendQuery } from '../backend/provider'
import { MARKET_ROW_DIVIDER_INSET } from '../features/markets/market-group'
import { MarketRow } from '../features/markets/market-row'
import { useMarketData } from '../features/markets/use-market-data'
import { SectionHeader } from '../features/shared/section-header'
import { formatMoney, formatPercent, formatSignedMoney, trendOf } from '../data/format'
import { useSession, type MarketPeriod } from '../data/store'
import type { DetailedAccount, FundingMode } from '../data/types'
import { ActivityRow } from '../features/activity/activity-row'
import { useAccountData } from '../features/accounts/use-account-data'
import { AccountSummaryUnavailable } from '../features/accounts/account-summary-unavailable'
import { QueryStateView } from '../features/shared/query-state'
import { useAppNavigation } from '../navigation/use-app-navigation'

const PERIODS: readonly MarketPeriod[] = ['Today', 'This week', 'This month', 'This year']
/** How many funding records the "Recent funding" card lists. */
const RECENT_FUNDING = 4

/**
 * "Your Balance": the account's worth on a luminous card, money in and out,
 * where the equity sits, recent funding, then search and Market Watch.
 */
export function BalanceScreen() {
  const accountData = useAccountData()
  const account = accountData.status === 'ready' ? accountData.data.account : null

  return (
    <PageScreen
      back
      title="Balance"
      subtitle={account ? `${account.mode} · ${account.number}` : undefined}
    >
      {accountData.status !== 'ready' ? (
        <View style={styles.gutter}>
          <QueryStateView state={accountData} render={() => null} />
        </View>
      ) : !account ? (
        <View style={styles.gutter}>
          <AccountSummaryUnavailable account={accountData.data.selectedAccount} />
        </View>
      ) : (
        <BalanceOverview account={account} />
      )}

      <Reveal index={5} style={styles.gutter}>
        <MarketWatch />
      </Reveal>
    </PageScreen>
  )
}

function BalanceOverview({ account }: { account: DetailedAccount }) {
  const { openFunding, openInstrument } = useAppNavigation()
  const showMenu = useActionMenu()
  // Same key as Activity's Funds filter, so both share one request.
  const funds = useBackendQuery(`funds-history:${account.id}`, (backend) => backend.funds.history(account.id))
  // The history also carries closed trades; this card is money in and out only.
  const recent = funds.status === 'ready'
    ? funds.data.filter((entry) => entry.tab === 'Funds').slice(0, RECENT_FUNDING)
    : []

  const openFundingMenu = (id: string) => {
    const entry = recent.find((item) => item.id === id)
    if (!entry) return
    showMenu({
      title: entry.title,
      message: `${entry.subtitle} · ${entry.date} ${entry.time}`,
      options: entry.instrumentId
        ? [{ label: 'View chart', onSelect: () => openInstrument(entry.instrumentId as string) }]
        : [{ label: 'Make a deposit', onSelect: () => openFunding('deposit') }],
    })
  }

  return (
    <>
      <Reveal index={0} style={styles.gutter}>
        <BalanceCard account={account} />
      </Reveal>

      <Reveal index={1} style={[styles.gutter, styles.actions]}>
        {FUNDING_ACTIONS.map(({ mode, label, Icon }) => (
          <FundingAction key={mode} label={label} primary={mode === 'deposit'} onPress={() => openFunding(mode)}>
            <Icon size={22} color={mode === 'deposit' ? colors.white : colors.brand} />
          </FundingAction>
        ))}
      </Reveal>

      <Reveal index={2} style={[styles.gutter, styles.section]}>
        <SectionHeader title="Breakdown" />
        <Breakdown account={account} />
      </Reveal>

      <Reveal index={3} style={[styles.gutter, styles.section]}>
        <SectionHeader title="Recent funding" />
        {funds.status !== 'ready' ? (
          <QueryStateView state={funds} render={() => null} />
        ) : recent.length === 0 ? (
          <Card padded={false}>
            <EmptyState
              icon={<WalletIcon size={22} color={colors.navy} />}
              title="No funding yet"
              message="Deposits and withdrawals on this account appear here."
              action="Make a deposit"
              onAction={() => openFunding('deposit')}
            />
          </Card>
        ) : (
          <Card padded={false} style={styles.listCard}>
            {recent.map((entry, index) => (
              <Fragment key={entry.id}>
                {index > 0 ? <Divider inset={spacing.lg + 44 + spacing.md} /> : null}
                <ActivityRow
                  id={entry.id}
                  kind={entry.kind}
                  title={entry.title}
                  subtitle={entry.subtitle}
                  date={entry.date}
                  time={entry.time}
                  amount={entry.amount}
                  onMenu={openFundingMenu}
                />
              </Fragment>
            ))}
          </Card>
        )}
      </Reveal>
    </>
  )
}

/** The screen's one luminous moment: equity rolling up, with balance and open P&L. */
function BalanceCard({ account }: { account: DetailedAccount }) {
  const shown = useCountUp(account.equity)
  return (
    <Card tone="ink" style={styles.hero}>
      <Text variant="caption" color={colors.onInkMuted}>
        Your balance
      </Text>
      <Amount
        variant="hero"
        color={colors.onInk}
        numberOfLines={1}
        adjustsFontSizeToFit
        accessibilityLabel={`Total equity ${formatMoney(account.equity)}`}
      >
        {formatMoney(shown)}
      </Amount>
      <View style={styles.heroRow}>
        <View style={styles.heroChip}>
          <Text variant="caption" color={colors.onInkMuted}>
            Cash
          </Text>
          <Amount variant="caption" weight="semibold" color={colors.onInk}>
            {formatMoney(account.balance)}
          </Amount>
        </View>
        <View style={styles.heroChip}>
          <Text variant="caption" color={colors.onInkMuted}>
            Open P&amp;L
          </Text>
          <Amount
            variant="caption"
            weight="semibold"
            color={trendOf(account.floatingPnl) === 'flat'
              ? colors.onInk
              : account.floatingPnl < 0 ? colors.redOnInk : colors.greenOnInk}
          >
            {formatSignedMoney(account.floatingPnl)}
          </Amount>
        </View>
      </View>
    </Card>
  )
}

const FUNDING_ACTIONS: readonly { mode: FundingMode; label: string; Icon: typeof DepositIcon }[] = [
  { mode: 'deposit', label: 'Deposit', Icon: DepositIcon },
  { mode: 'withdraw', label: 'Withdraw', Icon: WithdrawIcon },
]

/** A disc over its label. Deposit is the solid brand disc; the rest are white. */
function FundingAction({
  label,
  primary,
  onPress,
  children,
}: {
  label: string
  primary: boolean
  onPress: () => void
  children: React.ReactNode
}) {
  return (
    <PressableScale accessibilityLabel={label} onPress={onPress} scaleTo={0.92} style={styles.action}>
      <View style={styles.actionInner}>
        <View style={[styles.disc, primary ? styles.discPrimary : styles.discPlain]}>{children}</View>
        <Text variant="caption" weight="medium" color={colors.text}>
          {label}
        </Text>
      </View>
    </PressableScale>
  )
}

/**
 * Where the equity sits, as category rows: a tinted tile, what it is and
 * its share of equity, the amount, and a thin bar of that share.
 */
function Breakdown({ account }: { account: DetailedAccount }) {
  const equity = account.equity
  const used = Math.max(equity - account.freeMargin, 0)
  const share = (value: number) => (equity > 0 ? Math.min(Math.max(value / equity, 0), 1) : 0)
  const rows = [
    {
      key: 'balance',
      title: 'Balance',
      value: formatMoney(account.balance),
      share: share(account.balance),
      Icon: WalletIcon,
      tone: 'blue' as const,
      ink: colors.tintBlueInk,
      bar: 'brand' as const,
    },
    {
      key: 'margin',
      title: 'Margin used',
      value: formatMoney(used),
      share: share(used),
      Icon: ShieldIcon,
      tone: 'amber' as const,
      ink: colors.tintAmberInk,
      bar: 'navy' as const,
    },
    {
      key: 'free',
      title: 'Free margin',
      value: formatMoney(account.freeMargin),
      share: share(account.freeMargin),
      Icon: BoltIcon,
      tone: 'mint' as const,
      ink: colors.tintMintInk,
      bar: 'green' as const,
    },
  ]

  return (
    <Card padded={false} style={styles.listCard}>
      {rows.map((row, index) => (
        <Fragment key={row.key}>
          {index > 0 ? <Divider inset={spacing.lg} /> : null}
          <View
            style={styles.category}
            accessible
            accessibilityLabel={`${row.title} ${row.value}, ${percentOf(row.share)} of equity`}
          >
            <View style={styles.categoryRow}>
              <IconChip size={42} shape="square" tone={row.tone}>
                <row.Icon size={20} color={row.ink} />
              </IconChip>
              <View style={styles.categoryText}>
                <Text variant="strong">{row.title}</Text>
                <Text variant="caption" color={colors.textMuted}>
                  {`${percentOf(row.share)} of equity`}
                </Text>
              </View>
              <Amount variant="strong" style={styles.tabular}>
                {row.value}
              </Amount>
            </View>
            <ProgressBar value={row.share} tone={row.bar} height={6} />
          </View>
        </Fragment>
      ))}
      <Divider inset={spacing.lg} />
      <View style={styles.category}>
        <View style={styles.categoryRow}>
          <IconChip size={42} shape="square" tone="violet">
            <TrendUpIcon size={20} color={colors.tintVioletInk} />
          </IconChip>
          <View style={styles.categoryText}>
            <Text variant="strong">Open P&amp;L</Text>
            <Text variant="caption" color={colors.textMuted}>
              Across open positions
            </Text>
          </View>
          <DeltaPill
            label={formatSignedMoney(account.floatingPnl)}
            direction={trendOf(account.floatingPnl)}
            size={14}
          />
        </View>
      </View>
    </Card>
  )
}

function percentOf(share: number) {
  return formatPercent(share * 100).replace('+', '')
}

/** Search and Market Watch, kept from the original Balance screen. */
function MarketWatch() {
  const { openInstrument } = useAppNavigation()
  const showMenu = useActionMenu()
  const [query, setQuery] = useState('')
  const { catalogue: markets } = useMarketData()
  const accountId = useSession((state) => state.accountId)
  const period = useSession((state) => state.marketPeriod)
  const setPeriod = useSession((state) => state.setMarketPeriod)
  // Real closes over the chosen period; rows keep the snapshot until they land.
  const sparks = useBackendQuery(
    `sparks:${accountId ?? 'none'}:${period}:${markets.status}`,
    (backend) => markets.status === 'ready'
      ? backend.markets.sparklines(markets.data.map((item) => item.id), period)
      : Promise.resolve(new Map<string, readonly number[]>()),
  )
  const sparkById = sparks.status === 'ready' ? sparks.data : undefined

  const needle = query.trim().toLowerCase()
  const catalogue = markets.status === 'ready' ? markets.data : []
  const rows = needle
    ? catalogue.filter(
        (item) =>
          item.symbol.toLowerCase().includes(needle) || item.name.toLowerCase().includes(needle),
      )
    : catalogue

  const pickPeriod = () =>
    showMenu({
      title: 'Market Watch period',
      options: PERIODS.map((option) => ({
        label: option,
        onSelect: () => setPeriod(option),
      })),
    })

  return (
    <View style={styles.section}>
      <SectionHeader title="Market Watch" action={period} withChevron onPressAction={pickPeriod} />
      <SearchField value={query} onChangeText={setQuery} />
      {markets.status !== 'ready' || markets.data.length === 0 ? (
        <QueryStateView
          state={markets}
          isEmpty={(data) => data.length === 0}
          emptyTitle="No markets available"
          render={() => null}
        />
      ) : rows.length === 0 ? (
        <View style={styles.noMatch}>
          <Text variant="body" color={colors.textMuted}>
            No markets match that search.
          </Text>
        </View>
      ) : (
        <Card padded={false} style={styles.marketCard}>
          {rows.map((item, index) => {
            const spark = sparkById?.get(item.id)
            // "Today" measures from the day's open; longer periods from their first close.
            const changeBase = period === 'Today' || !spark ? item.dayOpen : spark[0]
            return (
              <Fragment key={item.id}>
                {index > 0 ? <Divider inset={MARKET_ROW_DIVIDER_INSET} /> : null}
                <MarketRow
                  layout="row"
                  id={item.id}
                  symbol={item.symbol}
                  name={item.name}
                  price={item.price}
                  precision={item.precision}
                  changePercent={item.changePercent}
                  changeBase={changeBase}
                  iconKind={item.icon}
                  iconLabel={item.iconLabel}
                  iconTint={item.iconTint}
                  category={item.category}
                  spark={spark ?? item.spark}
                  sparkTone={spark ? undefined : item.sparkTone}
                  onPress={openInstrument}
                />
              </Fragment>
            )
          })}
        </Card>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  gutter: {
    paddingHorizontal: SCREEN_PADDING,
  },
  section: {
    gap: spacing.md,
  },

  hero: {
    paddingVertical: spacing.xl,
    gap: spacing.xs,
  },
  heroRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  heroChip: {
    flex: 1,
    gap: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    backgroundColor: colors.onInkPanel,
  },

  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  action: {
    flex: 1,
  },
  actionInner: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  disc: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discPrimary: {
    backgroundColor: colors.brand,
    boxShadow: '0px 10px 22px rgba(20, 24, 43, 0.25)',
  },
  discPlain: {
    backgroundColor: colors.glass,
    boxShadow: '0px 0px 0px 1px rgba(20, 24, 43, 0.04), 0px 8px 20px rgba(20, 24, 43, 0.07)',
  },

  listCard: {
    paddingVertical: spacing.xs,
  },
  category: {
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  categoryText: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },

  marketCard: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  noMatch: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
})
