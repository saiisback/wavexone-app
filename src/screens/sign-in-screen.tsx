import { useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native'

import { useAppSession } from '../backend/session-provider'
import {
  Button,
  ButtonText,
  Card,
  Field,
  Gutter,
  Logo,
  Screen,
  Text,
  colors,
  spacing,
} from '../design-system'

export function SignInScreen() {
  const session = useAppSession()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const canSubmit = identifier.trim().length > 0 && password.length > 0 && !submitting

  const submit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      await session.signIn(identifier.trim(), password)
    } finally {
      setPassword('')
      setSubmitting(false)
    }
  }

  if (session.state === 'maintenance') {
    return (
      <Screen edges={['top', 'bottom']} style={styles.centered}>
        <Gutter style={styles.stateContent}>
          <Logo size={28} />
          <Text variant="title">Service temporarily unavailable</Text>
          <Text color={colors.textMuted}>{session.error}</Text>
          <Button onPress={() => void session.retryRestore()} accessibilityLabel="Retry connection">
            <ButtonText>Try again</ButtonText>
          </Button>
        </Gutter>
      </Screen>
    )
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
        >
          <Gutter style={styles.content}>
            <View style={styles.heading}>
              <Logo size={28} />
              <Text variant="title">Welcome back</Text>
              <Text color={colors.textMuted}>
                Sign in with your WaveXOne email or account number.
              </Text>
            </View>

            {session.state === 'verification-required' ? (
              <Card tone="goldSoft" style={styles.notice}>
                <Text variant="strong">Verification required</Text>
                <Text color={colors.textMuted}>
                  Verify your account in the client portal, then sign in again.
                </Text>
              </Card>
            ) : null}

            <View style={styles.form}>
              <Field
                label="Email or account number"
                accessibilityLabel="Email or account number"
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="username"
                value={identifier}
                onChangeText={setIdentifier}
                returnKeyType="next"
              />
              <Field
                label="Password"
                accessibilityLabel="Password"
                secureTextEntry
                textContentType="password"
                value={password}
                onChangeText={setPassword}
                returnKeyType="done"
                onSubmitEditing={() => void submit()}
                invalid={Boolean(session.error)}
                hint={session.error ?? undefined}
              />
              <Button
                onPress={() => void submit()}
                disabled={!canSubmit}
                accessibilityLabel={submitting ? 'Signing in' : 'Sign in'}
              >
                <ButtonText>{submitting ? 'Signing in…' : 'Sign in'}</ButtonText>
              </Button>
            </View>
          </Gutter>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },
  content: { gap: spacing.xl },
  heading: { gap: spacing.sm },
  form: { gap: spacing.md },
  notice: { padding: spacing.md, gap: spacing.xs },
  centered: { justifyContent: 'center' },
  stateContent: { gap: spacing.md },
})
