import { useColors, useThemeStyles } from '../design-system/theme'
import type { Palette } from '../design-system/colors'
import { StyleSheet, View } from 'react-native'

import {
  Avatar,
  Badge,
  Card,
  CheckIcon,
  ClockIcon,
  Gutter,
  IconChip,
  InfoIcon,
  ListGroup,
  ListRow,
  PageScreen,
  ProgressBar,
  Reveal,
  ShieldIcon,
  Text,
  UserIcon,
  VerifiedIcon,
  radius,
  spacing,
  useActionMenu,
} from '../design-system'
import type { Profile } from '../data/types'
import { useAccountData } from '../features/accounts/use-account-data'
import { QueryStateView } from '../features/shared/query-state'
import { useAppNavigation } from '../navigation/use-app-navigation'

const TITLE = 'Profile & verification'

/** Account → Profile & verification. */
export function ProfileScreen() {
  const colors = useColors()
  const styles = useThemeStyles(themeStyles)

  const showMenu = useActionMenu()
  const { openEditPhone } = useAppNavigation()
  const accountData = useAccountData()

  // `apiSaveProfile` takes only a name and a mobile number, so these two
  // cannot be changed from the app.
  const changeThroughSupport = (field: string) =>
    showMenu({
      title: field,
      message: `Your ${field.toLowerCase()} is changed through WaveXOne support, not in the app.`,
      options: [{ label: 'Got it' }],
    })

  if (accountData.status !== 'ready') {
    return (
      <PageScreen back title={TITLE} tone="reference">
        <Gutter>
          <QueryStateView state={accountData} render={() => null} />
        </Gutter>
      </PageScreen>
    )
  }

  const { profile } = accountData.data
  const kycTone = profile.kycStatus === 'Verified' ? 'buy' : 'neutral'

  return (
    <PageScreen back title={TITLE} tone="reference">
      <Reveal>
        <Gutter>
          <Card style={styles.identity}>
            <View style={styles.avatarRing}>
              <Avatar uri={profile.avatarUrl} size={84} />
              {profile.verified ? (
                <View style={styles.avatarBadge}>
                  <VerifiedIcon size={22} />
                </View>
              ) : null}
            </View>
            <View style={styles.name}>
              <Text variant="heading" style={styles.centered} numberOfLines={2}>
                {profile.holder}
              </Text>
              <Text variant="caption" color={colors.textMuted} style={styles.centered}>
                {profile.email}
              </Text>
            </View>
            <View style={styles.identityChips}>
              <View style={styles.chip}>
                <UserIcon size={14} color={colors.brand} />
                <Text variant="micro" color={colors.brand}>
                  {profile.country}
                </Text>
              </View>
              <View style={[styles.chip, profile.verified ? styles.chipVerified : null]}>
                <ShieldIcon size={14} color={profile.verified ? colors.greenSoftText : colors.textMuted} />
                <Text variant="micro" color={profile.verified ? colors.greenSoftText : colors.textMuted}>
                  {profile.verified ? 'Verified' : 'Not verified'}
                </Text>
              </View>
            </View>
          </Card>
        </Gutter>
      </Reveal>

      <Reveal index={1}>
        <Gutter>
          <VerificationStatus status={profile.kycStatus} />
        </Gutter>
      </Reveal>

      <Reveal index={2}>
        <Gutter>
          <ListGroup title="Contact">
            <ListRow
              label="Email"
              value={profile.email}
              onPress={() => changeThroughSupport('Email')}
            />
            <ListRow label="Phone" value={profile.phone} onPress={openEditPhone} />
            <ListRow
              label="Country"
              value={profile.country}
              divider={false}
              onPress={() => changeThroughSupport('Country')}
            />
          </ListGroup>
        </Gutter>
      </Reveal>

      <Reveal index={3}>
        <Gutter>
          <ListGroup title="Documents">
            <ListRow
              icon={<UserIcon size={20} color={colors.tintBlueInk} />}
              tone="blue"
              label="Identity document"
              detail="Passport ending 4721"
              trailing={<Badge tone={kycTone}>{profile.kycStatus}</Badge>}
            />
            <ListRow
              icon={<ShieldIcon size={20} color={colors.tintVioletInk} />}
              tone="violet"
              label="Proof of address"
              detail="Utility bill, Nov 2022"
              trailing={<Badge tone={kycTone}>{profile.kycStatus}</Badge>}
              divider={false}
            />
          </ListGroup>
        </Gutter>
      </Reveal>

      <Reveal index={4}>
        <Gutter style={styles.note}>
          <InfoIcon size={16} color={colors.textSubtle} />
          <Text variant="caption" color={colors.textMuted} style={styles.noteText}>
            Document upload opens once the KYC field list, file limits and rejection reasons are
            supplied by the backend team.
          </Text>
        </Gutter>
      </Reveal>
    </PageScreen>
  )
}

const KYC_STEPS: Record<Profile['kycStatus'], { done: number; caption: string }> = {
  'Not started': { done: 0, caption: 'Submit your documents to start verification.' },
  'In review': { done: 1, caption: 'Your documents are with the WaveXOne team.' },
  Verified: { done: 2, caption: 'Your identity and address are confirmed.' },
}

/**
 * Where verification stands, in the reference "goal card" shape: the
 * status, a thick progress bar, the steps, and a coloured band underneath.
 */
function VerificationStatus({ status }: { status: Profile['kycStatus'] }) {
  const colors = useColors()
  const styles = useThemeStyles(themeStyles)

  const { done, caption } = KYC_STEPS[status]
  const complete = done === 2
  return (
    <Card padded={false}>
      <View style={styles.statusBody}>
        <View style={styles.statusHead}>
          <IconChip tone={complete ? 'mint' : 'amber'} size={42} shape="square">
            {complete
              ? <ShieldIcon size={20} color={colors.tintMintInk} />
              : <ClockIcon size={20} color={colors.tintAmberInk} />}
          </IconChip>
          <View style={styles.statusText}>
            <Text variant="caption" color={colors.textMuted}>
              Verification
            </Text>
            <Text variant="section">{status}</Text>
          </View>
          <Text variant="displaySm" color={complete ? colors.green : colors.text}>
            {`${done}/2`}
          </Text>
        </View>
        <ProgressBar value={done / 2} tone={complete ? 'green' : 'brand'} height={10} />
        <View style={styles.steps}>
          <Step label="Documents submitted" done={done >= 1} />
          <Step label="Review complete" done={done >= 2} />
        </View>
      </View>
      <View style={[styles.band, complete ? styles.bandDone : styles.bandPending]}>
        <Text variant="caption" weight="medium" color={complete ? colors.greenSoftText : colors.tintAmberInk}>
          {caption}
        </Text>
      </View>
    </Card>
  )
}

function Step({ label, done }: { label: string; done: boolean }) {
  const colors = useColors()
  const styles = useThemeStyles(themeStyles)

  return (
    <View style={styles.step}>
      <View style={[styles.stepDot, done ? styles.stepDotDone : null]}>
        {done ? <CheckIcon size={11} color={colors.white} /> : null}
      </View>
      <Text variant="caption" color={done ? colors.text : colors.textMuted}>
        {label}
      </Text>
    </View>
  )
}

const themeStyles = (colors: Palette) => (StyleSheet.create({
  identity: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xxl,
  },
  avatarRing: {
    padding: 4,
    borderRadius: 50,
    backgroundColor: colors.surface,
    boxShadow: `0px 0px 0px 6px ${colors.brandTint}, 0px 12px 28px rgba(20, 24, 43, 0.18)`,
    marginBottom: spacing.xs,
  },
  avatarBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    padding: 2,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  name: {
    gap: 2,
    alignItems: 'center',
  },
  centered: {
    textAlign: 'center',
  },
  identityChips: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTint,
  },
  chipVerified: {
    backgroundColor: colors.greenSoft,
  },

  statusBody: {
    padding: spacing.xl,
    gap: spacing.lg,
  },
  statusHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  statusText: {
    flex: 1,
    gap: 1,
  },
  steps: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  stepDotDone: {
    borderColor: colors.green,
    backgroundColor: colors.green,
  },
  band: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  bandDone: {
    backgroundColor: colors.greenSoft,
  },
  bandPending: {
    backgroundColor: colors.tintAmber,
  },

  note: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  noteText: {
    flex: 1,
    lineHeight: 19,
  },
}))
