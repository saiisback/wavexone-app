import { Platform, ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Aurora } from './aurora'
import { colors } from './colors'
import { CloseIcon } from './icons'
import { PressableScale } from './pressable'
import { Text } from './text'
import { useSafeBack } from './use-safe-back'
import { SCREEN_PADDING, radius } from './tokens'

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
  const goBack = useSafeBack()
  const insets = useSafeAreaInsets()

  return (
    <View style={styles.root}>
      <Aurora />
      {/* iOS draws its own grabber on a form sheet. */}
      {Platform.OS === 'ios' ? null : <View style={styles.grabber} />}

      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text variant="heading" style={styles.title}>
            {title}
          </Text>
          {subtitle ? (
            <Text variant="caption" color={colors.textMuted}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        <PressableScale accessibilityLabel="Close" hitSlop={10} onPress={goBack} scaleTo={0.88}>
          <View style={styles.close}>
            <CloseIcon size={18} color={colors.text} />
          </View>
        </PressableScale>
      </View>

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
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    marginTop: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 20,
    paddingBottom: 16,
    gap: 16,
  },
  headerText: {
    flex: 1,
    gap: 3,
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
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  content: {
    paddingHorizontal: SCREEN_PADDING,
    paddingBottom: 20,
    gap: 14,
  },
  footer: {
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 14,
    backgroundColor: colors.glassStrong,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    boxShadow: '0px -8px 24px rgba(20, 24, 43, 0.05)',
  },
})
