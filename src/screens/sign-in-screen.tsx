import { useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native'

import { useAppSession } from '../backend/session-provider'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import {
  ArrowRightIcon,
  Button,
  ButtonRow,
  ButtonText,
  Card,
  ClockIcon,
  Field,
  Gutter,
  InfoIcon,
  InkBackdrop,
  Logo,
  Reveal,
  SCREEN_PADDING,
  Screen,
  ShieldIcon,
  SparkleIcon,
  Text,
  colors,
  radius,
  shadow,
  spacing,
} from '../design-system'

export function SignInScreen() {
  const session = useAppSession()
  const insets = useSafeAreaInsets()
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
        <Gutter>
          <Reveal>
            <Card style={styles.stateCard}>
              <Logo size={22} />
              <View style={styles.stateDisc}>
                <ClockIcon size={26} color={colors.tintAmberInk} />
              </View>
              <Text variant="heading" style={styles.centerText}>
                Service temporarily unavailable
              </Text>
              <Text color={colors.textMuted} style={styles.centerText}>
                {session.error}
              </Text>
              <Button
                tone="ink"
                onPress={() => void session.retryRestore()}
                accessibilityLabel="Retry connection"
                style={styles.stretch}
              >
                <ButtonText tone="ink">Try again</ButtonText>
              </Button>
            </Card>
          </Reveal>
        </Gutter>
      </Screen>
    )
  }

  return (
    <Screen edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={[styles.hero, { paddingTop: insets.top + 40 }]}>
            <InkBackdrop />
            <Reveal style={styles.brandRow}>
              <View style={styles.logoPlate}>
                <Logo size={20} tone="dark" />
              </View>
            </Reveal>
            <Reveal index={1} style={styles.heading}>
              <View style={styles.eyebrow}>
                <SparkleIcon size={14} color={colors.onInk} />
                <Text variant="micro" weight="semibold" color={colors.onInk}>
                  Trade global markets
                </Text>
              </View>
              <Text variant="hero" color={colors.onInk} style={styles.headline}>
                Welcome back
              </Text>
              <Text color={colors.onInkMuted} style={styles.lede}>
                Sign in with your WaveXOne email or account number.
              </Text>
            </Reveal>
          </View>

          <Gutter style={styles.content}>
            <Reveal index={2}>
              <Card style={styles.form}>
                <View style={styles.formHead}>
                  <Text variant="section">Sign in</Text>
                  <View style={styles.secure}>
                    <ShieldIcon size={14} color={colors.greenSoftText} />
                    <Text variant="micro" color={colors.greenSoftText}>
                      Secure
                    </Text>
                  </View>
                </View>

                {session.state === 'verification-required' ? (
                  <View style={styles.notice}>
                    <InfoIcon size={18} color={colors.tintAmberInk} />
                    <View style={styles.noticeText}>
                      <Text variant="strong">Verification required</Text>
                      <Text variant="caption" color={colors.textMuted}>
                        Verify your account in the client portal, then sign in again.
                      </Text>
                    </View>
                  </View>
                ) : null}

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
                  tone="brand"
                  onPress={() => void submit()}
                  disabled={!canSubmit}
                  accessibilityLabel={submitting ? 'Signing in' : 'Sign in'}
                  style={styles.cta}
                >
                  <ButtonRow>
                    <ButtonText tone="brand">{submitting ? 'Signing in…' : 'Sign in'}</ButtonText>
                    {submitting ? null : <ArrowRightIcon size={18} color={colors.white} />}
                  </ButtonRow>
                </Button>
              </Card>
            </Reveal>

            <Reveal index={3}>
              <Text variant="caption" color={colors.textSubtle} style={styles.centerText}>
                Trading involves risk. Only trade with money you can afford to lose.
              </Text>
            </Reveal>
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
    paddingBottom: spacing.xl,
  },
  hero: {
    minHeight: 380,
    paddingHorizontal: SCREEN_PADDING + 4,
    paddingBottom: 96,
    gap: spacing.xxl,
    borderBottomLeftRadius: radius.header,
    borderBottomRightRadius: radius.header,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: colors.heroDeep,
  },
  brandRow: {
    flexDirection: 'row',
  },
  logoPlate: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.glassOnInk,
    borderWidth: 1,
    borderColor: colors.glassOnInkEdge,
  },
  heading: {
    gap: spacing.sm,
    marginTop: 'auto',
  },
  eyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.glassOnInkStrong,
  },
  headline: {
    marginTop: spacing.xs,
  },
  lede: {
    maxWidth: 300,
  },
  content: {
    marginTop: -64,
    gap: spacing.xl,
  },
  form: {
    gap: spacing.lg,
    padding: spacing.xl,
    boxShadow: shadow.raised,
  },
  formHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  secure: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.greenSoft,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    backgroundColor: colors.tintAmber,
  },
  noticeText: {
    flex: 1,
    gap: 2,
  },
  cta: {
    marginTop: spacing.xs,
  },
  centerText: { textAlign: 'center' },
  centered: { justifyContent: 'center' },
  stateCard: {
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.xl,
    paddingTop: spacing.xxl,
  },
  stateDisc: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.sm,
    backgroundColor: colors.tintAmber,
    boxShadow: `0px 0px 0px 8px ${colors.tintAmber}80`,
  },
  stretch: {
    alignSelf: 'stretch',
    marginTop: spacing.sm,
  },
})
