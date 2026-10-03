import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Linking, StyleSheet, View } from 'react-native'

import {
  Avatar,
  Card,
  ChevronRightIcon,
  CodeIcon,
  ExternalLinkIcon,
  Gutter,
  HeadsetIcon,
  IconChip,
  ListGroup,
  ListRow,
  Logo,
  LogoutIcon,
  MarketsIcon,
  PageScreen,
  PositionsIcon,
  PressableScale,
  Reveal,
  SettingsIcon,
  SwapIcon,
  Text,
  UserIcon,
  VerifiedIcon,
  WalletIcon,
  colors,
  radius,
  spacing,
  useActionMenu,
} from '../design-system'
import { useAppSession } from '../backend/session-provider'
import type { DetailedAccount, Profile } from '../data/types'
import { useAccountData } from '../features/accounts/use-account-data'
import { AccountSummaryUnavailable } from '../features/accounts/account-summary-unavailable'
import { QueryStateView } from '../features/shared/query-state'
import { useOpenClientPortal } from '../features/shared/use-client-portal'
import { useAppNavigation } from '../navigation/use-app-navigation'
import type { MoreStackParamList } from '../navigation/types'

type Navigation = NativeStackNavigationProp<MoreStackParamList, 'Account'>

/**
 * More tab: the profile hero, quick shortcuts into the menu, the two menu
 * groups, and the support banner.
 */
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

  const trailing = <Logo size={15} />

  if (accountData.status !== 'ready' || !accountData.data.account) {
    return (
      <PageScreen title="Account" trailing={trailing}>
        <Gutter style={styles.state}>
          <QueryStateView
            state={accountData}
            render={(data) => <AccountSummaryUnavailable account={data.selectedAccount} />}
          />
        </Gutter>
      </PageScreen>
    )
  }

  const { account, profile } = accountData.data

  const shortcuts: readonly Shortcut[] = [
    { label: 'Funds', Icon: WalletIcon, tone: 'blue', ink: colors.tintBlueInk, onPress: () => openHomeScreen('Balance') },
    { label: 'Activity', Icon: PositionsIcon, tone: 'violet', ink: colors.tintVioletInk, onPress: () => navigate('Activity') },
    { label: 'Signals', Icon: MarketsIcon, tone: 'amber', ink: colors.tintAmberInk, onPress: () => navigate('Signals') },
    { label: 'Support', Icon: HeadsetIcon, tone: 'mint', ink: colors.tintMintInk, onPress: openSupport },
  ]

  return (
    <PageScreen title="Account" trailing={trailing}>
      <Reveal>
        <Gutter>
          <ProfileHero account={account} profile={profile} onPress={() => navigate('Profile')} />
        </Gutter>
      </Reveal>

      <Gutter style={styles.shortcuts}>
        {shortcuts.map((item, index) => (
          <Reveal key={item.label} index={index + 1} distance={10} style={styles.shortcutCell}>
            <ShortcutTile {...item} />
          </Reveal>
        ))}
      </Gutter>

      <Reveal index={3}>
        <Gutter>
          <ListGroup title="Account">
            <ListRow
              icon={<WalletIcon size={20} color={colors.tintBlueInk} />}
              tone="blue"
              label="Balance & funding"
              onPress={() => openHomeScreen('Balance')}
            />
            <ListRow
              icon={<PositionsIcon size={20} color={colors.tintVioletInk} />}
              tone="violet"
              label="Transaction history"
              onPress={() => navigate('Activity')}
            />
            <ListRow
              icon={<UserIcon size={20} color={colors.tintMintInk} />}
              tone="mint"
              label="Profile & verification"
              onPress={() => navigate('Profile')}
            />
            <ListRow
              icon={<MarketsIcon size={20} color={colors.tintAmberInk} filled />}
              tone="amber"
              label="Trading signals"
              onPress={() => navigate('Signals')}
            />
            <ListRow
              icon={<ExternalLinkIcon size={20} color={colors.brand} />}
              label="Client portal"
              onPress={openClientPortal}
            />
            <ListRow
              icon={<CodeIcon size={20} color={colors.tintVioletInk} />}
              tone="violet"
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
              icon={<HeadsetIcon size={20} color={colors.tintMintInk} />}
              tone="mint"
              label="Support"
              divider={false}
              onPress={openSupport}
            />
          </ListGroup>
        </Gutter>
      </Reveal>

      <Reveal index={4}>
        <Gutter>
          <ListGroup title="App">
            <ListRow
              icon={<SettingsIcon size={20} color={colors.brand} />}
              label="Settings"
              onPress={() => navigate('Settings')}
            />
            <ListRow
              icon={<SwapIcon size={20} color={colors.tintBlueInk} />}
              tone="blue"
              label="Switch account"
              onPress={openAccountSwitcher}
            />
            <ListRow
              icon={<LogoutIcon size={20} color={colors.tintRoseInk} />}
              tone="rose"
              label="Log out"
              divider={false}
              destructive
              onPress={confirmLogout}
            />
          </ListGroup>
        </Gutter>
      </Reveal>

      <Reveal index={5}>
        <Gutter>
          <PressableScale scaleTo={0.98} onPress={openSupport} accessibilityLabel="24/7 Support. Our team is always here to help.">
            <Card tone="tint" style={styles.support}>
              <IconChip tone="surface" size={48}>
                <HeadsetIcon size={24} color={colors.brand} />
              </IconChip>
              <View style={styles.supportCopy}>
                <Text variant="strong">24/7 Support</Text>
                <Text variant="caption" color={colors.textMuted}>
                  Our team is always here to help.
                </Text>
              </View>
              <View style={styles.supportArrow}>
                <ChevronRightIcon size={18} color={colors.onInk} />
              </View>
            </Card>
          </PressableScale>
        </Gutter>
      </Reveal>
    </PageScreen>
  )
}

/**
 * Who is signed in and which account they are on, on the screen's one
 * luminous card. Opens the profile.
 */
function ProfileHero({
  account,
  profile,
  onPress,
}: {
  account: DetailedAccount
  profile: Profile
  onPress: () => void
}) {
  const demo = account.mode === 'DEMO'
  return (
    <PressableScale
      scaleTo={0.98}
      onPress={onPress}
      accessibilityLabel={`${profile.holder}${profile.verified ? ', verified' : ''}. ${account.mode} account ${account.number}. Open profile`}
    >
      <Card tone="ink" style={styles.hero}>
        <View style={styles.heroRow}>
          <View style={styles.avatarRing}>
            <Avatar uri={profile.avatarUrl} size={64} />
          </View>
          <View style={styles.identity}>
            <View style={styles.nameRow}>
              <Text variant="section" color={colors.onInk} numberOfLines={1} style={styles.name}>
                {profile.holder}
              </Text>
              {profile.verified ? <VerifiedIcon size={18} /> : null}
            </View>
            <Text variant="caption" color={colors.onInkMuted} numberOfLines={1}>
              {profile.email}
            </Text>
          </View>
          <View style={styles.heroChevron}>
            <ChevronRightIcon size={18} color={colors.onInk} />
          </View>
        </View>

        <View style={styles.heroFoot}>
          <View style={styles.modeChip}>
            <View style={[styles.modeDot, demo ? styles.modeDotDemo : null]} />
            <Text variant="micro" weight="semibold" color={colors.onInk} style={styles.modeLabel}>
              {demo ? 'DEMO' : 'LIVE'}
            </Text>
          </View>
          <Text variant="caption" weight="medium" color={colors.onInk} style={styles.number}>
            {`Account ${account.number}`}
          </Text>
          <Text variant="caption" color={colors.onInkMuted}>
            {profile.verified ? 'Verified' : profile.kycStatus}
          </Text>
        </View>
      </Card>
    </PressableScale>
  )
}

type Shortcut = {
  label: string
  Icon: typeof WalletIcon
  tone: 'blue' | 'violet' | 'amber' | 'mint'
  ink: string
  onPress: () => void
}

/** A square white tile into one of the menu's own destinations. */
function ShortcutTile({ label, Icon, tone, ink, onPress }: Shortcut) {
  return (
    <PressableScale scaleTo={0.94} onPress={onPress} accessibilityLabel={label}>
      <Card style={styles.tile}>
        <IconChip tone={tone} size={42} shape="square">
          <Icon size={20} color={ink} />
        </IconChip>
        <Text variant="caption" weight="medium" numberOfLines={1}>
          {label}
        </Text>
      </Card>
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  state: { paddingTop: spacing.lg },

  hero: {
    padding: spacing.xl,
    gap: spacing.xl,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  avatarRing: {
    padding: 3,
    borderRadius: 40,
    backgroundColor: colors.glass,
    boxShadow: '0px 8px 20px rgba(20, 24, 43, 0.28)',
  },
  identity: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    flexShrink: 1,
  },
  heroChevron: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.glassOnInk,
    borderWidth: 1,
    borderColor: colors.glassOnInkEdge,
  },
  heroFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    paddingTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderTopColor: colors.onInkDivider,
  },
  modeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.glassOnInkStrong,
  },
  modeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.greenOnInk,
  },
  modeDotDemo: {
    backgroundColor: colors.gold,
  },
  modeLabel: {
    letterSpacing: 0.6,
  },
  number: {
    flex: 1,
    fontVariant: ['tabular-nums'],
  },

  shortcuts: {
    flexDirection: 'row',
    gap: spacing.md - 2,
  },
  shortcutCell: {
    flex: 1,
  },
  tile: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.xl,
  },

  support: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
  },
  supportCopy: {
    flex: 1,
    gap: 2,
  },
  supportArrow: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand,
  },
})
