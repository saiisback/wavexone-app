import { useColors } from '../../design-system/theme'
import { StyleSheet, View } from 'react-native'

import { ArrowLeftIcon, CircleButton, Gutter, Text, useSafeBack } from '../../design-system'

export type ScreenHeaderProps = {
  title: string
  subtitle?: string
  /** Right-hand affordance — a filter icon, a "Mark all read" button. */
  action?: React.ReactNode
}

/** Back button plus title, for the screens pushed onto a tab's stack. */
export function ScreenHeader({ title, subtitle, action }: ScreenHeaderProps) {
  const colors = useColors()

  const goBack = useSafeBack()

  return (
    <Gutter style={styles.row}>
      <CircleButton onPress={goBack} accessibilityLabel="Go back" size={44}>
        <ArrowLeftIcon size={21} color={colors.text} />
      </CircleButton>

      <View style={styles.text}>
        <Text variant="heading" style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" color={colors.textMuted} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {action ?? <View style={styles.spacer} />}
    </Gutter>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingTop: 8,
    paddingBottom: 16,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 22,
  },
  spacer: {
    width: 44,
  },
})
