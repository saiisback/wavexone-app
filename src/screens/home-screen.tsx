import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { ScrollView, StyleSheet, View } from 'react-native'

import {
  Avatar,
  BellIcon,
  Delta,
  Gutter,
  Pressable,
  PressableScale,
  Screen,
  TAB_BAR_CLEARANCE,
  Text,
  Watermark,
  colors,
} from '../design-system'
import { directionOf, formatMoney, formatPercent } from '../data/format'
import { useAccountData } from '../features/accounts/use-account-data'
import { QueryStateView, UnavailableState } from '../features/shared/query-state'
import { useAppNavigation } from '../navigation/use-app-navigation'
import type { HomeStackParamList } from '../navigation/types'

type Navigation = NativeStackNavigationProp<HomeStackParamList, 'Dashboard'>

/** Home tab: greeting, portfolio summary, two stat tiles and the signal feed. */
export function HomeScreen() {
  const { navigate } = useNavigation<Navigation>()
  const { openTab } = useAppNavigation()
  const accountData = useAccountData()

  if (accountData.status !== 'ready' || !accountData.data.account) {
    return (
      <Screen>
        <Gutter style={styles.state}>
          <QueryStateView
            state={accountData}
            isEmpty={(data) => data.account === null}
            emptyTitle="No trading account"
            render={() => null}
          />
        </Gutter>
      </Screen>
    )
  }

  const { account, profile } = accountData.data
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
              onPress={() => navigate('Notifications')}
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
          <PressableScale onPress={() => navigate('Balance')} scaleTo={0.985}>
            <View style={styles.portfolio}>
              <View style={styles.portfolioBand}>
                <Text variant="strong">Your Portfolio</Text>
                <Text variant="body">{account.asOf}</Text>
              </View>

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
            </View>
          </PressableScale>
        </Gutter>

        <Gutter>
          <UnavailableState
            title="Trading signals unavailable"
            message="No confirmed trading-signal endpoint is available for this account."
          />
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
    gap: 18,
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
    borderRadius: 24,
    borderCurve: 'continuous',
    backgroundColor: colors.navy,
    overflow: 'hidden',
  },
  // Rounded on all four corners: the bottom pair reveals the dark card behind.
  portfolioBand: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.gold,
    borderRadius: 24,
    borderCurve: 'continuous',
    paddingHorizontal: 20,
    paddingVertical: 17,
  },
  portfolioBody: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 22,
    gap: 6,
  },
  portfolioMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  tiles: {
    flexDirection: 'row',
    gap: 12,
  },
  tile: {
    flex: 1,
    padding: 15,
    borderRadius: 20,
    gap: 8,
  },
  tileLabel: {
    fontSize: 15,
  },
  tileHeadline: {
    fontSize: 21,
  },
  tileValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  tileFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  tileFine: {
    fontSize: 13,
  },

  section: {
    paddingTop: 2,
  },
  signal: {
    padding: 18,
    borderRadius: 20,
    gap: 14,
  },
  signalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  signalIdentity: {
    gap: 3,
  },
  signalHeadline: {
    fontSize: 19,
    lineHeight: 26,
    color: colors.text,
  },
  signalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
})
