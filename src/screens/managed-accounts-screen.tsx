import { useColors, useThemeStyles } from '../design-system/theme'
import type { Palette } from '../design-system/colors'
import { FlashList } from '@shopify/flash-list'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { BackButton, Button, ButtonText, Card, EmptyState, Gutter, HomeAtmosphere, PageBar, PageTitle, SegmentedControl, TAB_BAR_CLEARANCE, Text, spacing, useHeroScroll } from '../design-system'
import { useBackendQuery } from '../backend/provider'
import type { ManagedFollower, ManagedKind, ManagedPerson, ManagedReport, ManagedView } from '../backend/managed-accounts'
import { formatPrice } from '../data/format'
import { useSession } from '../data/store'
import { useAccountData } from '../features/accounts/use-account-data'
import { AccountPill } from '../features/accounts/account-pill'
import { QueryStateView } from '../features/shared/query-state'
import { useOpenClientPortal } from '../features/shared/use-client-portal'
import { useAppNavigation } from '../navigation/use-app-navigation'

const KINDS: readonly ManagedKind[] = ['PAMM', 'MAM']
const VIEWS: readonly ManagedView[] = ['Investor', 'Manager']
const FILTERS = ['Browse', 'Following'] as const

/** Read-only directories and role-aware access; no allocation is executed from a list. */
export function ManagedAccountsScreen() {
  const colors = useColors()
  const styles = useThemeStyles(themeStyles)

  const [kind, setKind] = useState<ManagedKind>('PAMM')
  const [view, setView] = useState<ManagedView>('Investor')
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('Browse')
  const [selection, setSelection] = useState<{ scope: string; follower: ManagedFollower } | null>(null)
  const accountId = useSession((state) => state.accountId)
  const accountData = useAccountData()
  const account = accountData.status === 'ready' ? accountData.data.selectedAccount : null
  const { openAccountSwitcher } = useAppNavigation()
  const openPortal = useOpenClientPortal()
  const insets = useSafeAreaInsets()
  const { scrollY, onScrollJS } = useHeroScroll()
  const scope = `${accountId ?? 'none'}:${kind}:${view}`
  const follower = selection?.scope === scope ? selection.follower : null
  const directory = useBackendQuery<{ managers: readonly ManagedPerson[]; followers: readonly ManagedFollower[] }>(`managed:${scope}:${filter}`, async (backend) => {
    if (!accountId) return { managers: [], followers: [] }
    if (view === 'Manager') return { managers: [], followers: await backend.managedAccounts.followers(kind) }
    const data = await (filter === 'Following' ? backend.managedAccounts.following(kind) : backend.managedAccounts.directory(kind))
    return { managers: data.managers, followers: [] }
  })
  const rows: readonly (ManagedPerson | ManagedFollower)[] = directory.status === 'ready'
    ? view === 'Investor' ? directory.data.managers : directory.data.followers : []
  const portal = () => openPortal({
    title: `${kind} ${view === 'Manager' ? 'manager dashboard' : 'investments'}`,
    reason: view === 'Manager'
      ? 'Manage program settings and settlement actions in the client portal.'
      : 'Review manager terms and manage allocations in the client portal. Browsing here does not invest funds.',
  })

  return (
    <View style={styles.root}>
      <HomeAtmosphere />
      {follower ? <FollowerReport key={`${scope}:${follower.id}`} kind={kind} follower={follower} onBack={() => setSelection(null)} /> : <FlashList
        data={rows}
        keyExtractor={managerKey}
        onScroll={onScrollJS}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: insets.top + spacing.sm, paddingBottom: TAB_BAR_CLEARANCE }}
        ListHeaderComponent={<View style={styles.header}>
          <PageTitle title="Managed accounts" tone="reference" scrollY={scrollY} leading={<BackButton tone="reference" />} />
          <Gutter style={styles.controls}>
            <QueryStateView state={accountData} render={() => null} />
            {rows.length > 0 ? <QueryStateView state={directory} render={() => null} /> : null}
            {account && <View style={styles.account}><AccountPill mode={account.mode} number={account.number} onPress={openAccountSwitcher} /></View>}
            <SegmentedControl options={KINDS} value={kind} onChange={setKind} />
            <SegmentedControl options={VIEWS} value={view} onChange={setView} />
            {view === 'Investor' && <SegmentedControl options={FILTERS} value={filter} onChange={setFilter} />}
            <Text variant="caption" color={colors.textMuted}>{view === 'Investor' ? 'Manager performance is reported by the server. Past results do not guarantee future returns.' : 'Followers and P&L reports are reported by the server for the selected account.'}</Text>
          </Gutter>
        </View>}
        renderItem={({ item }) => <Gutter style={styles.row}>{'managerId' in item
          ? <FollowerRow follower={item} onReport={() => setSelection({ scope, follower: item })} />
          : <ManagerRow manager={item} />}</Gutter>}
        ListEmptyComponent={<Gutter style={styles.empty}>
          {!accountId ? <EmptyState title="Choose an account" message="Select your trading account to view managed accounts." action="Choose account" onAction={openAccountSwitcher} />
            : <QueryStateView state={directory} render={() => view === 'Manager'
              ? <EmptyState title="No followers reported" message={`No ${kind} follower relationships were returned for this account. Program settings are available in the client portal.`} />
              : <EmptyState title={filter === 'Following' ? 'No followed managers' : 'No managers available'} message="Check the selected account and program, or manage your accounts in the client portal." />}
            />}
        </Gutter>}
        ListFooterComponent={<Gutter style={styles.footer}>
          <Button tone="ink" accessibilityLabel="Open managed-account client portal" onPress={portal}><ButtonText tone="ink">{view === 'Manager' ? 'Open manager dashboard' : 'Manage investments'}</ButtonText></Button>
          <Text variant="caption" color={colors.textMuted}>Opens the client portal. No funds move from this screen.</Text>
        </Gutter>}
      />}
      {!follower && <PageBar title="Managed accounts" tone="reference" scrollY={scrollY} />}
    </View>
  )
}

const managerKey = (manager: ManagedPerson | ManagedFollower) => manager.id

function FollowerRow({ follower, onReport }: { follower: ManagedFollower; onReport: () => void }) {
  const styles = useThemeStyles(themeStyles)

  return <Card style={styles.manager}>
    <Text variant="strong">{follower.name}</Text>
    <View style={styles.metrics}>
      <Metric label="Share" value={`${formatPrice(follower.share, 2)}%`} />
      {follower.investment !== undefined && <Metric label="Investment" value={reportNumber(follower.investment)} />}
      {follower.sharedPnl !== undefined && <Metric label="Shared P&L" value={reportNumber(follower.sharedPnl)} />}
    </View>
    <Button tone="ink" accessibilityLabel={`View report for ${follower.name}`} onPress={onReport}><ButtonText tone="ink">View report</ButtonText></Button>
  </Card>
}

const reportNumber = (value: number) => String(Number(value.toFixed(8)))

function FollowerReport({ kind, follower, onBack }: { kind: ManagedKind; follower: ManagedFollower; onBack: () => void }) {
  const colors = useColors()
  const styles = useThemeStyles(themeStyles)

  const accountId = useSession((state) => state.accountId)
  const insets = useSafeAreaInsets()
  const query = useBackendQuery(`managed-report:${accountId}:${kind}:${follower.managerId}:${follower.userId}`, (backend) =>
    backend.managedAccounts.report(kind, { managerId: follower.managerId, userId: follower.userId }),
  )
  return <FlashList<ManagedReport['rows'][number]>
    data={query.status === 'ready' ? query.data.rows : []}
    keyExtractor={(row) => row.id}
    contentContainerStyle={{ paddingTop: insets.top + spacing.sm, paddingBottom: TAB_BAR_CLEARANCE }}
    ListHeaderComponent={<Gutter style={styles.controls}>
      <Button tone="ink" accessibilityLabel="Back to followers" onPress={onBack}><ButtonText tone="ink">Back to followers</ButtonText></Button>
      <Text variant="title">{follower.name}</Text>
      <Text variant="strong">{kind} P&L report</Text>
      <Text variant="caption" color={colors.textMuted}>Server-reported values. Currency is not specified by this report.</Text>
      <QueryStateView state={query} render={(report) => <ReportTotals report={report} />} />
    </Gutter>}
    renderItem={({ item }) => <Gutter style={styles.row}><Card style={styles.manager}>
      <Text variant="strong">Order {item.orderId}</Text>
      {'updatedAt' in item && <Text variant="caption" color={colors.textMuted}>{item.updatedAt}</Text>}
      <View style={styles.metrics}>
        <Metric label="Manager P&L" value={reportNumber(item.managerPnl)} />
        <Metric label="Investor P&L" value={reportNumber(item.userPnl)} />
        {'totalPnl' in item && <Metric label="Total shared P&L" value={reportNumber(item.totalPnl)} />}
      </View>
    </Card></Gutter>}
    ListEmptyComponent={query.status === 'ready' ? <Gutter style={styles.empty}><EmptyState title="No report entries" message="The server returned no orders for this relationship." /></Gutter> : null}
  />
}

function ReportTotals({ report }: { report: ManagedReport }) {
  const styles = useThemeStyles(themeStyles)

  return <Card style={styles.manager}><Text variant="strong">Reported totals</Text><View style={styles.metrics}>
    <Metric label="Manager P&L" value={reportNumber(report.totals.managerPnl)} />
    {report.kind === 'PAMM' && <><Metric label="Investor P&L" value={reportNumber(report.totals.userPnl)} /><Metric label="Total shared P&L" value={reportNumber(report.totals.totalPnl)} /><Metric label="Share" value={`${report.share}%`} /></>}
  </View></Card>
}

function ManagerRow({ manager }: { manager: ManagedPerson }) {
  const colors = useColors()
  const styles = useThemeStyles(themeStyles)

  return <Card style={styles.manager}>
    <View style={styles.nameRow}>
      <Text variant="strong" style={styles.name}>{manager.name}</Text>
      {manager.following && <Text variant="caption" color={colors.brand}>Following</Text>}
    </View>
    <View style={styles.metrics}>
      {manager.growth !== undefined && <Metric label="Growth" value={`${formatPrice(manager.growth, 2)}%`} />}
      {manager.drawdown !== undefined && <Metric label="Drawdown" value={`${formatPrice(manager.drawdown, 2)}%`} />}
      {manager.followers !== undefined && <Metric label="Followers" value={String(manager.followers)} />}
      {manager.risk !== undefined && <Metric label="Risk level" value={String(manager.risk)} />}
      {manager.fund !== undefined && <Metric label="Reported funds" value={formatPrice(manager.fund, 2)} />}
    </View>
  </Card>
}

function Metric({ label, value }: { label: string; value: string }) {
  const colors = useColors()
  const styles = useThemeStyles(themeStyles)

  return <View style={styles.metric}><Text variant="caption" color={colors.textMuted}>{label}</Text><Text variant="strong">{value}</Text></View>
}

const themeStyles = (colors: Palette) => (StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { paddingBottom: spacing.lg },
  controls: { gap: spacing.md },
  account: { alignItems: 'flex-start' },
  empty: { paddingVertical: spacing.xl },
  row: { paddingBottom: spacing.md },
  manager: { gap: spacing.md },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  name: { flex: 1 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  metric: { minWidth: 90, gap: spacing.xs },
  footer: { gap: spacing.sm, paddingVertical: spacing.lg },
}))
