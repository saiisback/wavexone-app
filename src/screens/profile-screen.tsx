import { ScrollView, StyleSheet, View } from 'react-native'

import {
  Avatar,
  Badge,
  Card,
  Gutter,
  ListGroup,
  ListRow,
  Screen,
  TAB_BAR_CLEARANCE,
  Text,
  VerifiedIcon,
  colors,
  useActionMenu,
} from '../design-system'
import { ScreenHeader } from '../features/shared/screen-header'
import { useAccountData } from '../features/accounts/use-account-data'
import { QueryStateView } from '../features/shared/query-state'
import { useAppNavigation } from '../navigation/use-app-navigation'

/** Account → Profile & verification. */
export function ProfileScreen() {
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
      <Screen>
        <ScreenHeader title="Profile & verification" />
        <Gutter style={styles.state}>
          <QueryStateView state={accountData} render={() => null} />
        </Gutter>
      </Screen>
    )
  }

  const { profile } = accountData.data

  return (
    <Screen>
      <ScreenHeader title="Profile & verification" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Gutter>
          <Card style={styles.identity}>
            <Avatar uri={profile.avatarUrl} size={72} />
            <View style={styles.name}>
              <View style={styles.nameRow}>
                <Text variant="heading" style={styles.nameText}>
                  {profile.holder}
                </Text>
                {profile.verified ? <VerifiedIcon size={20} /> : null}
              </View>
              <Text variant="body" color={colors.textMuted}>
                {profile.country}
              </Text>
            </View>
          </Card>
        </Gutter>

        <Gutter>
          <ListGroup>
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

        <Gutter style={styles.sectionLabel}>
          <Text variant="caption" color={colors.textMuted}>
            VERIFICATION
          </Text>
        </Gutter>

        <Gutter>
          <ListGroup>
            <ListRow
              label="Identity document"
              detail="Passport ending 4721"
              trailing={<Badge tone="buy">{profile.kycStatus}</Badge>}
            />
            <ListRow
              label="Proof of address"
              detail="Utility bill, Nov 2022"
              trailing={<Badge tone="buy">{profile.kycStatus}</Badge>}
              divider={false}
            />
          </ListGroup>
        </Gutter>

        <Gutter>
          <Text variant="caption" color={colors.textMuted} style={styles.note}>
            Document upload opens once the KYC field list, file limits and rejection reasons are
            supplied by the backend team.
          </Text>
        </Gutter>
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  state: { paddingTop: 32 },
  content: {
    paddingBottom: TAB_BAR_CLEARANCE,
    gap: 14,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
    borderRadius: 20,
  },
  name: {
    flex: 1,
    gap: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nameText: {
    fontSize: 20,
  },
  sectionLabel: {
    paddingTop: 6,
  },
  note: {
    lineHeight: 20,
  },
})
