import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { ScrollView, StyleSheet, View } from 'react-native'

import {
  Avatar,
  BellIcon,
  ChevronDownIcon,
  Delta,
  Gutter,
  Pressable,
  PressableScale,
  Screen,
  TAB_BAR_CLEARANCE,
  Text,
  Watermark,
  colors,
  radius,
  spacing,
} from '../design-system'
import { useBackendQuery } from '../backend/provider'
import { directionOf, formatMoney, formatPercent } from '../data/format'
import type { DetailedAccount, Profile } from '../data/types'
import { useAccountData } from '../features/accounts/use-account-data'
import { AccountSummaryUnavailable } from '../features/accounts/account-summary-unavailable'
import { MarketRow } from '../features/markets/market-row'
import { useMarketData } from '../features/markets/use-market-data'
import { QueryStateView, UnavailableState } from '../features/shared/query-state'
import { SectionHeader } from '../features/shared/section-header'
import { useAppNavigation } from '../navigation/use-app-navigation'
import type { HomeStackParamList } from '../navigation/types'

type Navigation = NativeStackNavigationProp<HomeStackParamList, 'Dashboard'>

/** Home tab: greeting, linked-account portfolio and a live three-market overview. */
export function HomeScreen() {
  const { navigate } = useNavigation<Navigation>()
  const accountData = useAccountData()

  if (accountData.status !== 'ready' || !accountData.data.account) {
    return (
      <Screen>
        <Gutter style={styles.state}>
          <QueryStateView
            state={accountData}
            render={(data) => <AccountSummaryUnavailable account={data.selectedAccount} />}
          />
        </Gutter>
      </Screen>
    )
  }

  const { account, profile } = accountData.data

  return <HomeDashboard account={account} profile={profile} onNotifications={() => navigate('Notifications')} />
}

function HomeDashboard({
  account,
  profile,
  onNotifications,
}: {
  account: DetailedAccount
  profile: Profile
  onNotifications: () => void
}) {
  const { openAccountSwitcher, openHomeScreen, openInstrument, openTab } = useAppNavigation()
  const { catalogue } = useMarketData()
  const markets = catalogue.status === 'ready' ? catalogue.data.slice(0, 3) : []
  const marketIds = markets.map((item) => item.id)
  const sparks = useBackendQuery(
    `home-sparks:${account.id}:${marketIds.join(',') || 'none'}`,
    (backend) => marketIds.length > 0
      ? backend.markets.sparklines(marketIds, 'Today')
      : Promise.resolve(new Map<string, readonly number[]>()),
  )
  const sparkById = sparks.status === 'ready' ? sparks.data : undefined
  const unread = 0

  return (
    <Screen>
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Gutter style={styles.greetingRow}>
          <Text variant="heading" weight="regular" style={styles.greeting}>
            Hello,{' '}
            <Text variant="heading" weight="extrabold" style={styles.greeting}>
              {profile.holder.split(' ')[0]}!
            </Text>
          </Text>

          <View style={styles.greetingActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
              hitSlop={8}
              style={styles.notificationButton}
              onPress={onNotifications}
            >
              <BellIcon size={26} color={colors.text} />
              {unread > 0 ? <View style={styles.bellDot} /> : null}
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open account"
              onPress={() => openTab('More')}
            >
              <Avatar uri={profile.avatarUrl} size={48} />
            </Pressable>
          </View>
        </Gutter>

        <Gutter>
          <View style={styles.portfolio}>
            <View style={styles.portfolioBand}>
              <Text variant="strong" color={colors.onInk}>Your Portfolio</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Switch account, ${account.mode} ${account.number}`}
                onPress={openAccountSwitcher}
                hitSlop={6}
                style={styles.accountPill}
              >
                <Text variant="strong" style={styles.accountPillLabel}>
                  {account.mode} · {account.number}
                </Text>
                <ChevronDownIcon size={16} color={colors.onInk} />
              </Pressable>
            </View>

            <PressableScale
              accessibilityLabel={`Open balance. Total equity ${formatMoney(account.equity)}. Change ${formatPercent(account.changePercent)}.`}
              onPress={() => openHomeScreen('Balance')}
              scaleTo={0.985}
            >
              <View style={styles.portfolioBody}>
                <Watermark size={150} right={-24} bottom={-30} />
                <View style={styles.portfolioMeta}>
                  <Text variant="body" color={colors.onInkMuted}>
                    Total Equity
                  </Text>
                  <Delta
                    label={formatPercent(account.changePercent)}
                    direction={directionOf(account.changePercent)}
                    onInk
                  />
                </View>
                <Text variant="display" color={colors.onInk}>
                  {formatMoney(account.equity)}
                </Text>
              </View>
            </PressableScale>
          </View>
        </Gutter>

        <Gutter style={styles.marketSection}>
          <SectionHeader
            title="Market overview"
            action="See all"
            onPressAction={() => openTab('Markets')}
          />
          {catalogue.status === 'ready' && markets.length === 0 ? (
            <UnavailableState
              title="Markets unavailable"
              message="No live markets are available for this account right now."
            />
          ) : catalogue.status !== 'ready' ? (
            <QueryStateView state={catalogue} render={() => null} />
          ) : (
            <View style={styles.marketRows}>
              {markets.map((item) => (
                <MarketRow
                  key={item.id}
                  id={item.id}
                  symbol={item.symbol}
                  name={item.name}
                  price={item.price}
                  precision={item.precision}
                  changePercent={item.changePercent}
                  changeBase={item.dayOpen}
                  iconKind={item.icon}
                  iconLabel={item.iconLabel}
                  iconTint={item.iconTint}
                  spark={sparkById?.get(item.id) ?? item.spark}
                  sparkTone={sparkById?.has(item.id) ? undefined : item.sparkTone}
                  onPress={openInstrument}
                />
              ))}
            </View>
          )}
        </Gutter>
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  state: { paddingTop: 32 },
  content: {
    paddingTop: 12,
    paddingBottom: TAB_BAR_CLEARANCE,
    gap: spacing.xxl,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  greeting: {
    fontSize: 24,
    lineHeight: 30,
  },
  greetingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  notificationButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellDot: {
    position: 'absolute',
    top: -1,
    right: -2,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: colors.gold,
  },

  portfolio: {
    borderRadius: radius.card,
    borderCurve: 'continuous',
    backgroundColor: colors.navy,
    overflow: 'hidden',
  },
  portfolioBand: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.onInkDivider,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  accountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    minHeight: 44,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.onInkPanel,
  },
  accountPillLabel: {
    color: colors.onInk,
    fontSize: 13,
    lineHeight: 17,
  },
  portfolioBody: {
    padding: spacing.xl,
    gap: spacing.sm,
  },
  portfolioMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  marketSection: {
    gap: spacing.md,
  },
  marketRows: {
    gap: spacing.md,
  },

})
