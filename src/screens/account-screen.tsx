import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Linking, ScrollView, StyleSheet, View } from 'react-native'

import {
  Avatar,
  Card,
  ChevronRightIcon,
  CodeIcon,
  ExternalLinkIcon,
  Gutter,
  HeadsetIcon,
  ListGroup,
  ListRow,
  Logo,
  LogoutIcon,
  MarketsIcon,
  PositionsIcon,
  PressableScale,
  Screen,
  SettingsIcon,
  SwapIcon,
  TAB_BAR_CLEARANCE,
  Text,
  UserIcon,
  VerifiedIcon,
  WalletIcon,
  colors,
  radius,
  useActionMenu,
} from '../design-system'
import { useAppSession } from '../backend/session-provider'
import { useAccountData } from '../features/accounts/use-account-data'
import { AccountSummaryUnavailable } from '../features/accounts/account-summary-unavailable'
import { QueryStateView } from '../features/shared/query-state'
import { useOpenClientPortal } from '../features/shared/use-client-portal'
import { useAppNavigation } from '../navigation/use-app-navigation'
import type { MoreStackParamList } from '../navigation/types'

type Navigation = NativeStackNavigationProp<MoreStackParamList, 'Account'>

/** More tab: identity card, the two menu groups, and the support banner. */
export function AccountScreen() {
  const { navigate } = useNavigation<Navigation>()
  const { openAccountSwitcher, openHomeScreen } = useAppNavigation()
  const showMenu = useActionMenu()
  const openPortal = useOpenClientPortal()
  const { signOut } = useAppSession()
  const accountData = useAccountData()

  const notConnected = (title: string, message: string) =>
    showMenu({ title, message, options: [{ label: 'Got it' }] })

  const openSupport = () =>
    showMenu({
      title: '24/7 Support',
      message: 'Choose how you would like to reach the team.',
      options: [
        {
          label: 'Email support',
          onSelect: () => {
            Linking.openURL('mailto:support@wavexone.com').catch(() => {})
          },
        },
        {
          label: 'Live chat',
          onSelect: () =>
            notConnected(
              'Live chat',
              'No support endpoint has been supplied yet — see the integration guide §4.8.',
            ),
        },
      ],
    })

  const openClientPortal = () => openPortal({ title: 'Open the client portal?' })

  const confirmLogout = () =>
    showMenu({
      title: 'Log out?',
      message: 'Stored tokens and the portal session cookie are cleared on logout.',
      options: [
        {
          label: 'Log out',
          destructive: true,
          onSelect: () => void signOut(),
        },
      ],
    })

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

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Gutter style={styles.masthead}>
          <Text variant="title">Account</Text>
          <Logo size={18} />
        </Gutter>

        <Gutter>
          <PressableScale scaleTo={0.99} onPress={() => navigate('Profile')}>
            <Card style={styles.profile}>
              <Avatar uri={profile.avatarUrl} size={56} />
              <View style={styles.profileIdentity}>
                <View style={styles.profileName}>
                  <Text variant="strong" numberOfLines={1} style={styles.profileNameText}>
                    {profile.holder}
                  </Text>
                  {profile.verified ? <VerifiedIcon size={18} /> : null}
                </View>
                <Text variant="caption" color={colors.textMuted} numberOfLines={1}>
                  {account.mode === 'DEMO' ? 'Demo' : 'Live'} account · {account.number}
                </Text>
              </View>
              <ChevronRightIcon size={20} color={colors.textMuted} />
            </Card>
          </PressableScale>
        </Gutter>

        <Gutter>
          <ListGroup title="Account">
            <ListRow
              icon={<WalletIcon size={20} color={colors.text} />}
              label="Balance & funding"
              onPress={() => openHomeScreen('Balance')}
            />
            <ListRow
              icon={<PositionsIcon size={20} color={colors.text} />}
              label="Transaction history"
              onPress={() => navigate('Activity')}
            />
            <ListRow
              icon={<UserIcon size={20} color={colors.text} />}
              label="Profile & verification"
              onPress={() => navigate('Profile')}
            />
            <ListRow
              icon={<MarketsIcon size={20} color={colors.text} filled />}
              label="Trading signals"
              onPress={() => navigate('Signals')}
            />
            <ListRow
              icon={<ExternalLinkIcon size={20} color={colors.text} />}
              label="Client portal"
              onPress={openClientPortal}
            />
            <ListRow
              icon={<CodeIcon size={20} color={colors.text} />}
              label="API access"
              onPress={() =>
                // No API-key route exists in either collection; the portal issues them.
                openPortal({
                  title: 'API access',
                  reason: 'Your API secret and API link are issued in the client portal.',
                })
              }
            />
            <ListRow
              icon={<HeadsetIcon size={20} color={colors.text} />}
              label="Support"
              divider={false}
              onPress={openSupport}
            />
          </ListGroup>
        </Gutter>

        <Gutter>
          <ListGroup title="App">
            <ListRow
              icon={<SettingsIcon size={20} color={colors.text} />}
              label="Settings"
              onPress={() => navigate('Settings')}
            />
            <ListRow
              icon={<SwapIcon size={20} color={colors.text} />}
              label="Switch account"
              onPress={openAccountSwitcher}
            />
            <ListRow
              icon={<LogoutIcon size={20} color={colors.text} />}
              label="Log out"
              divider={false}
              destructive
              onPress={confirmLogout}
            />
          </ListGroup>
        </Gutter>

        <Gutter>
          <PressableScale scaleTo={0.99} onPress={openSupport}>
            <Card tone="goldSoft" style={styles.support}>
              <HeadsetIcon size={26} color={colors.text} />
              <View style={styles.supportCopy}>
                <Text variant="strong">24/7 Support</Text>
                <Text variant="caption" color={colors.textMuted}>
                  Our team is always here to help.
                </Text>
              </View>
              <ChevronRightIcon size={22} color={colors.text} />
            </Card>
          </PressableScale>
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
    gap: 24,
  },
  masthead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 4,
  },

  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: radius.card,
  },
  profileIdentity: {
    flex: 1,
    gap: 3,
  },
  profileName: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  profileNameText: {
    flexShrink: 1,
    fontSize: 18,
    lineHeight: 23,
  },

  support: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: radius.card,
  },
  supportCopy: {
    flex: 1,
    gap: 3,
  },
})
