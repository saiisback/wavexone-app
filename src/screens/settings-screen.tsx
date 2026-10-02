import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { ScrollView, StyleSheet } from 'react-native'

import {
  Gutter,
  ListGroup,
  ListRow,
  Screen,
  Switch,
  TAB_BAR_CLEARANCE,
  Text,
  colors,
} from '../design-system'
import { ScreenHeader } from '../features/shared/screen-header'
import { useOpenClientPortal } from '../features/shared/use-client-portal'
import { useSession, type SettingKey } from '../data/store'
import type { MoreStackParamList } from '../navigation/types'

type Navigation = NativeStackNavigationProp<MoreStackParamList, 'Settings'>

export function SettingsScreen() {
  const { navigate } = useNavigation<Navigation>()
  const openPortal = useOpenClientPortal()

  return (
    <Screen>
      <ScreenHeader title="Settings" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Gutter>
          <Text variant="caption" color={colors.textMuted}>
            NOTIFICATIONS
          </Text>
        </Gutter>

        <Gutter>
          <ListGroup>
            <SettingToggle settingKey="priceAlerts" label="Price alerts" />
            <SettingToggle settingKey="orderFills" label="Order fills" />
            <SettingToggle settingKey="marketNews" label="Market news" divider={false} />
          </ListGroup>
        </Gutter>

        <Gutter style={styles.sectionLabel}>
          <Text variant="caption" color={colors.textMuted}>
            SECURITY
          </Text>
        </Gutter>

        <Gutter>
          <ListGroup>
            <SettingToggle settingKey="biometricUnlock" label="Biometric unlock" />
            <ListRow
              label="Confirm every order"
              detail="Required — cannot be turned off"
              trailing={<Switch value onValueChange={noop} disabled />}
            />
            <ListRow
              label="Change password"
              divider={false}
              onPress={() =>
                // `sentotp`/`savepass` exist, but their `type`, `name` and
                // `data` values are undocumented — not something to guess
                // on a password route. The portal handles it meanwhile.
                openPortal({
                  title: 'Change password',
                  reason: 'Passwords are changed in the client portal.',
                })
              }
            />
          </ListGroup>
        </Gutter>

        <Gutter style={styles.sectionLabel}>
          <Text variant="caption" color={colors.textMuted}>
            ACCOUNT
          </Text>
        </Gutter>

        <Gutter>
          <ListGroup>
            <ListRow label="Profile & verification" onPress={() => navigate('Profile')} />
            <ListRow label="Transaction history" onPress={() => navigate('Activity')} />
            <ListRow label="App version" value="1.0.0 (dev)" divider={false} />
          </ListGroup>
        </Gutter>
      </ScrollView>
    </Screen>
  )
}

/**
 * Subscribes to one flag, so flipping a switch re-renders that row only.
 */
function SettingToggle({
  settingKey,
  label,
  divider = true,
}: {
  settingKey: SettingKey
  label: string
  divider?: boolean
}) {
  const value = useSession((state) => state.settings[settingKey])
  const toggle = useSession((state) => state.toggleSetting)

  return (
    <ListRow
      label={label}
      divider={divider}
      trailing={
        <Switch
          value={value}
          onValueChange={() => toggle(settingKey)}
          accessibilityLabel={label}
        />
      }
    />
  )
}

const noop = () => {}

const styles = StyleSheet.create({
  content: {
    paddingBottom: TAB_BAR_CLEARANCE,
    gap: 10,
  },
  sectionLabel: {
    paddingTop: 10,
  },
})
