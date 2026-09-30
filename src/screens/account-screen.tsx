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
  useActionMenu,
} from '../design-system'
import { useAppSession } from '../backend/session-provider'
import { profile } from '../data/mock'
import { selectAccount, useSession } from '../data/store'
import { useAppNavigation } from '../navigation/use-app-navigation'
import type { MoreStackParamList } from '../navigation/types'

type Navigation = NativeStackNavigationProp<MoreStackParamList, 'Account'>

const CLIENT_PORTAL_URL = 'https://portal.wavexone.com'

/** More tab: identity card, the two menu groups, and the support banner. */
export function AccountScreen() {
  const { navigate } = useNavigation<Navigation>()
  const { openAccountSwitcher, openHomeScreen } = useAppNavigation()
  const showMenu = useActionMenu()
  const { signOut } = useAppSession()

  const account = useSession(selectAccount)

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

  const openFunds = () =>
    showMenu({
      title: 'Funds',
      options: [
        { label: 'Balance & funding', onSelect: () => openHomeScreen('Balance') },
        { label: 'Transaction history', onSelect: () => navigate('Activity') },
      ],
    })

  const openClientPortal = () =>
    showMenu({
      title: 'Open the client portal?',
      message: `This leaves the app and opens ${CLIENT_PORTAL_URL} in your browser.`,
      options: [
        {
          label: 'Open in browser',
          onSelect: () => {
            Linking.openURL(CLIENT_PORTAL_URL).catch(() => {
              showMenu({
                title: 'Could not open the portal',
                message: 'No browser is available to handle that link.',
                options: [{ label: 'Got it' }],
              })
            })
          },
        },
      ],
    })

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

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Gutter style={styles.masthead}>
          <Logo size={21} />
          <Text variant="heading" style={styles.mastheadTitle}>
            Account
          </Text>
        </Gutter>

        <Gutter>
          <PressableScale scaleTo={0.99} onPress={() => navigate('Profile')}>
            <Card style={styles.profile}>
              <Avatar uri={profile.avatarUrl} size={76} />
              <View style={styles.profileIdentity}>
                <View style={styles.profileName}>
                  <Text variant="heading" style={styles.profileNameText}>
                    {profile.holder}
                  </Text>
                  {profile.verified ? <VerifiedIcon size={20} /> : null}
                </View>
                <Text variant="body" color={colors.textMuted}>
                  {account.mode} account
                </Text>
                <Text variant="body" color={colors.textMuted}>
                  {account.number}
                </Text>
              </View>
              <ChevronRightIcon size={22} color={colors.text} />
            </Card>
          </PressableScale>
        </Gutter>

        <Gutter>
          <ListGroup>
            <ListRow
              icon={<WalletIcon size={24} color={colors.text} />}
              label="Funds"
              onPress={openFunds}
            />
            <ListRow
              icon={<UserIcon size={24} color={colors.text} />}
              label="Profile & verification"
              onPress={() => navigate('Profile')}
            />
            <ListRow
              icon={<MarketsIcon size={24} color={colors.text} filled />}
              label="Trading signals"
              onPress={() => openHomeScreen('Signals')}
            />
            <ListRow
              icon={<ExternalLinkIcon size={24} color={colors.text} />}
              label="Client portal"
              onPress={openClientPortal}
            />
            <ListRow
              icon={<CodeIcon size={24} color={colors.text} />}
              label="API access"
              onPress={() =>
                notConnected(
                  'API access',
                  'Key issuance runs through the portal endpoints, which are not connected yet.',
                )
              }
            />
            <ListRow
              icon={<HeadsetIcon size={24} color={colors.text} />}
              label="Support"
              divider={false}
              onPress={openSupport}
            />
          </ListGroup>
        </Gutter>

        <Gutter>
          <ListGroup>
            <ListRow
              icon={<SettingsIcon size={24} color={colors.text} />}
              label="Settings"
              onPress={() => navigate('Settings')}
            />
            <ListRow
              icon={<SwapIcon size={24} color={colors.text} />}
              label="Switch account"
              onPress={openAccountSwitcher}
            />
            <ListRow
              icon={<LogoutIcon size={24} color={colors.text} />}
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
  content: {
    paddingTop: 10,
    paddingBottom: TAB_BAR_CLEARANCE,
    gap: 14,
  },
  masthead: {
    alignItems: 'center',
    gap: 4,
    paddingBottom: 2,
  },
  mastheadTitle: {
    fontSize: 24,
  },

  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
    borderRadius: 20,
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
    fontSize: 20,
  },

  support: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 20,
  },
  supportCopy: {
    flex: 1,
    gap: 3,
  },
})
