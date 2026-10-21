import { useColors, useThemeStyles } from '../design-system/theme'
import type { Palette } from '../design-system/colors'
import * as Crypto from 'expo-crypto'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import {
  Button,
  ButtonText,
  Card,
  Field,
  InfoIcon,
  Reveal,
  Sheet,
  Text,
  UserIcon,
  spacing,
  useActionMenu,
} from '../design-system'
import { mutationFailureMessage } from '../backend/errors'
import { useBackend, useInvalidateQueries } from '../backend/provider'
import { useAccountData } from '../features/accounts/use-account-data'
import { QueryStateView } from '../features/shared/query-state'
import { useAppNavigation } from '../navigation/use-app-navigation'

/** Digits with the usual separators, and enough digits to be a number. */
const PHONE = /^\+?[\d\s()-]+$/

/** Profile → Phone. Saved through `apiSaveProfile`. */
export function EditPhoneScreen() {
  const colors = useColors()
  const styles = useThemeStyles(themeStyles)

  const { goBack } = useAppNavigation()
  const showMenu = useActionMenu()
  const backend = useBackend()
  const invalidate = useInvalidateQueries()
  const accountData = useAccountData()

  // `undefined` until edited, so the field shows the saved number.
  const [input, setInput] = useState<string>()
  const [saving, setSaving] = useState(false)

  if (accountData.status !== 'ready') {
    return (
      <Sheet title="Phone">
        <QueryStateView state={accountData} render={() => null} />
      </Sheet>
    )
  }

  const saved = accountData.data.profile.phone
  const phone = (input ?? saved).trim()
  const valid = PHONE.test(phone) && phone.replace(/\D/g, '').length >= 6
  const canSave = valid && phone !== saved && !saving

  const save = () => {
    setSaving(true)
    return backend.accounts
      .saveProfile({ phone, idempotencyKey: Crypto.randomUUID() })
      .then(() => {
        invalidate('profile:', 'accounts:')
        goBack()
      })
      .catch((error: unknown) => {
        setSaving(false)
        showMenu({
          title: 'Phone not saved',
          message: mutationFailureMessage(error),
          options: [{ label: 'Got it' }],
        })
      })
  }

  return (
    <Sheet
      title="Phone"
      footer={
        <Button tone="gold" disabled={!canSave} loading={saving} onPress={save}>
          <ButtonText tone="gold">{saving ? 'Saving…' : 'Save'}</ButtonText>
        </Button>
      }
    >
      <Reveal style={styles.intro}>
        <View style={styles.disc}>
          <UserIcon size={26} color={colors.brand} />
        </View>
        <Text variant="caption" color={colors.textMuted} style={styles.centered}>
          Used by WaveXOne to contact you about your account
        </Text>
      </Reveal>

      <Reveal index={1}>
        <Card style={styles.form}>
          <Field
            label="Phone number"
            value={input ?? saved}
            onChangeText={setInput}
            placeholder="+44 7700 900123"
            keyboardType="phone-pad"
            inputMode="tel"
            autoComplete="tel"
            invalid={phone !== '' && !valid}
            hint={phone !== '' && !valid ? 'Enter a phone number, including the country code.' : undefined}
          />
        </Card>
      </Reveal>

      <Reveal index={2} style={styles.note}>
        <InfoIcon size={16} color={colors.textSubtle} />
        <Text variant="caption" color={colors.textMuted} style={styles.noteText}>
          Your name, email and country are changed through WaveXOne support.
        </Text>
      </Reveal>
    </Sheet>
  )
}

const themeStyles = (colors: Palette) => (StyleSheet.create({
  intro: {
    alignItems: 'center',
    gap: spacing.md,
    paddingBottom: spacing.sm,
  },
  disc: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandTintStrong,
    boxShadow: `0px 0px 0px 8px ${colors.brandTint}`,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  centered: {
    textAlign: 'center',
    maxWidth: 280,
  },
  form: {
    padding: spacing.lg,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  noteText: {
    flex: 1,
  },
}))
