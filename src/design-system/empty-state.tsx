import { useColors, useThemeStyles } from './theme'
import type { Palette } from './colors'
import { StyleSheet, View } from 'react-native'

import { Button, ButtonText } from './button'
import { PopIn } from './motion'
import { Text } from './text'
import { spacing } from './tokens'

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
  const colors = useColors()
  const styles = useThemeStyles(themeStyles)

  return (
    <View style={styles.wrap}>
      {icon ? (
        <PopIn delay={120}>
          <View style={styles.icon}>{icon}</View>
        </PopIn>
      ) : null}
      <View style={styles.copy}>
        <Text variant="section" style={[styles.center, styles.title]}>
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

const themeStyles = (colors: Palette) => (StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  icon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginBottom: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandTint,
    boxShadow: '0px 0px 0px 8px rgba(18, 19, 24, 0.03), 0px 0px 0px 16px rgba(18, 19, 24, 0.015)',
  },
  copy: {
    gap: 4,
    maxWidth: 300,
  },
  center: {
    textAlign: 'center',
  },
  title: {
    fontSize: 17,
    lineHeight: 22,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
  },
  action: {
    minWidth: 180,
    marginTop: spacing.xs,
  },
}))
