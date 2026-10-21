import { useColors, useThemeStyles } from './theme'
import type { Palette } from './colors'
import { Platform, ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { HomeAtmosphere } from './home-atmosphere'
import { CloseIcon } from './icons'
import { PressableScale } from './pressable'
import { Text } from './text'
import { useSafeBack } from './use-safe-back'
import { SCREEN_PADDING, radius, spacing } from './tokens'

/**
 * Chrome for the screens presented as native form sheets.
 *
 * The sheet itself is the navigator's (`presentation: 'formSheet'`), so
 * swipe-to-dismiss, the backdrop and keyboard avoidance all come from the
 * platform. This only draws the grabber, title and Close affordance.
 */
export function Sheet({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  /** Pinned under the scroll area — the primary action usually lives here. */
  footer?: React.ReactNode
}) {
  const colors = useColors()
  const styles = useThemeStyles(themeStyles)

  const goBack = useSafeBack()
  const insets = useSafeAreaInsets()

  return (
    <View style={styles.root}>
      <HomeAtmosphere />
      {/* iOS draws its own grabber on a form sheet. */}
      {Platform.OS === 'ios' ? null : <View style={styles.grabber} />}

      <View testID="sheet-heading" style={styles.header}>
        <View style={styles.headerText}>
          <View testID="sheet-gold-accent" style={styles.goldAccent} />
          <Text variant="heading" color={colors.brand} style={styles.title}>
            {title}
          </Text>
          {subtitle ? (
            <Text variant="caption" color={colors.referenceMuted}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        <PressableScale accessibilityLabel="Close" hitSlop={10} onPress={goBack} scaleTo={0.88}>
          <View style={styles.close}>
            <CloseIcon size={18} color={colors.brand} />
          </View>
        </PressableScale>
      </View>

      <View testID="sheet-content-surface" style={styles.contentSurface}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>

        {footer ? (
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            {footer}
          </View>
        ) : null}
      </View>
    </View>
  )
}

const themeStyles = (colors: Palette) => (StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.referenceCanvas,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.homeLine,
    marginTop: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    gap: spacing.lg,
    backgroundColor: 'transparent',
  },
  headerText: {
    flex: 1,
    gap: 3,
  },
  goldAccent: {
    width: 32,
    height: 3,
    borderRadius: radius.pill,
    marginBottom: spacing.xs,
    backgroundColor: colors.gold,
  },
  title: {
    fontSize: 22,
  },
  close: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.referenceLine,
  },
  contentSurface: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  content: {
    paddingHorizontal: SCREEN_PADDING,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  footer: {
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: spacing.md,
    backgroundColor: colors.glassStrong,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    boxShadow: '0px -8px 24px rgba(20, 24, 43, 0.05)',
  },
}))
