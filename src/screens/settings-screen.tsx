import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  BellIcon,
  CheckIcon,
  ClockIcon,
  Gutter,
  InfoIcon,
  ListGroup,
  ListRow,
  PageScreen,
  PositionsIcon,
  Reveal,
  ShieldIcon,
  Switch,
  TrendUpIcon,
  UserIcon,
  colors,
} from '../design-system'
import { useOpenClientPortal } from '../features/shared/use-client-portal'
import { useSession, type SettingKey } from '../data/store'
import type { MoreStackParamList } from '../navigation/types'

type Navigation = NativeStackNavigationProp<MoreStackParamList, 'Settings'>

export function SettingsScreen() {
  const { navigate } = useNavigation<Navigation>()
  const openPortal = useOpenClientPortal()

  return (
    <PageScreen back title="Settings">
      <Reveal>
        <Gutter>
          <ListGroup title="Notifications">
            <SettingToggle
              settingKey="priceAlerts"
              label="Price alerts"
              icon={<TrendUpIcon size={20} color={colors.tintMintInk} />}
              tone="mint"
            />
            <SettingToggle
              settingKey="orderFills"
              label="Order fills"
              icon={<PositionsIcon size={20} color={colors.tintBlueInk} />}
              tone="blue"
            />
            <SettingToggle
              settingKey="marketNews"
              label="Market news"
              icon={<BellIcon size={20} color={colors.tintAmberInk} />}
              tone="amber"
              divider={false}
            />
          </ListGroup>
        </Gutter>
      </Reveal>

      <Reveal index={1}>
        <Gutter>
          <ListGroup title="Security">
            <SettingToggle
              settingKey="biometricUnlock"
              label="Biometric unlock"
              icon={<UserIcon size={20} color={colors.tintVioletInk} />}
              tone="violet"
            />
            <ListRow
              icon={<CheckIcon size={20} color={colors.brand} />}
              label="Confirm every order"
              detail="Required — cannot be turned off"
              trailing={<Switch value onValueChange={noop} disabled />}
            />
            <ListRow
              icon={<ShieldIcon size={20} color={colors.tintRoseInk} />}
              tone="rose"
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
      </Reveal>

      <Reveal index={2}>
        <Gutter>
          <ListGroup title="Account">
            <ListRow
              icon={<UserIcon size={20} color={colors.tintMintInk} />}
              tone="mint"
              label="Profile & verification"
              onPress={() => navigate('Profile')}
            />
            <ListRow
              icon={<ClockIcon size={20} color={colors.tintVioletInk} />}
              tone="violet"
              label="Transaction history"
              onPress={() => navigate('Activity')}
            />
            <ListRow
              icon={<InfoIcon size={20} color={colors.brand} />}
              label="App version"
              value="1.0.0 (dev)"
              divider={false}
            />
          </ListGroup>
        </Gutter>
      </Reveal>
    </PageScreen>
  )
}

/**
 * Subscribes to one flag, so flipping a switch re-renders that row only.
 */
function SettingToggle({
  settingKey,
  label,
  icon,
  tone,
  divider = true,
}: {
  settingKey: SettingKey
  label: string
  icon?: React.ReactNode
  tone?: 'blue' | 'violet' | 'amber' | 'mint' | 'rose'
  divider?: boolean
}) {
  const value = useSession((state) => state.settings[settingKey])
  const toggle = useSession((state) => state.toggleSetting)

  return (
    <ListRow
      icon={icon}
      tone={tone}
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
