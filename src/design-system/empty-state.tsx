import { StyleSheet, View } from 'react-native'

import { Button, ButtonText } from './button'
import { colors } from './colors'
import { Text } from './text'
import { shadow, spacing } from './tokens'

/**
 * Empty, unavailable and failed states: an icon, what is going on, and the
 * one thing to do next. Sits on the page rather than in a card, so it reads
 * as a moment in the flow rather than as another block of content.
 */
export function EmptyState({
  icon,
  title,
  message,
  action,
  onAction,
}: {
  icon?: React.ReactNode
  title: string
  message?: string
  action?: string
  onAction?: () => void
}) {
  return (
    <View style={styles.wrap}>
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <View style={styles.copy}>
        <Text variant="strong" style={styles.center}>
          {title}
        </Text>
        {message ? (
          <Text variant="caption" color={colors.textMuted} style={[styles.center, styles.message]}>
            {message}
          </Text>
        ) : null}
      </View>
      {action && onAction ? (
        <Button tone="ink" onPress={onAction} accessibilityLabel={action} style={styles.action}>
          <ButtonText tone="ink">{action}</ButtonText>
        </Button>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  icon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    boxShadow: shadow.raised,
  },
  copy: {
    gap: 4,
    maxWidth: 300,
  },
  center: {
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
  },
  action: {
    minWidth: 180,
    marginTop: spacing.xs,
  },
})
