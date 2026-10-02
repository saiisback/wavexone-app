import * as Crypto from 'expo-crypto'
import { useState } from 'react'

import { Button, ButtonText, Field, Sheet, Text, colors, useActionMenu } from '../design-system'
import { mutationFailureMessage } from '../backend/errors'
import { useBackend, useInvalidateQueries } from '../backend/provider'
import { useAccountData } from '../features/accounts/use-account-data'
import { QueryStateView } from '../features/shared/query-state'
import { useAppNavigation } from '../navigation/use-app-navigation'

/** Digits with the usual separators, and enough digits to be a number. */
const PHONE = /^\+?[\d\s()-]+$/

/** Profile → Phone. Saved through `apiSaveProfile`. */
export function EditPhoneScreen() {
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
    void backend.accounts
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
      subtitle="Used by WaveXOne to contact you about your account"
      footer={
        <Button tone="gold" disabled={!canSave} onPress={save}>
          <ButtonText tone="gold">{saving ? 'Saving…' : 'Save'}</ButtonText>
        </Button>
      }
    >
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
      <Text variant="caption" color={colors.textMuted}>
        Your name, email and country are changed through WaveXOne support.
      </Text>
    </Sheet>
  )
}
