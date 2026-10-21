import { useColors, useThemeStyles, useTheme } from './theme'
import type { Palette } from './colors'
import { createContext, use, useRef, useState } from 'react'
import { ActionSheetIOS, Modal, Platform, Pressable, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Text } from './text'
import { fonts, radius } from './tokens'

export type ActionOption = {
  label: string
  onSelect?: () => void
  destructive?: boolean
  disabled?: boolean
}

export type ActionMenuRequest = {
  title?: string
  message?: string
  options: readonly ActionOption[]
}

type Show = (request: ActionMenuRequest) => void

const ActionMenuContext = createContext<Show | undefined>(undefined)

/**
 * One menu presenter for the whole app.
 *
 * iOS gets the real `UIAlertController` action sheet — no dependency, no
 * JS-drawn popover. Everywhere else falls back to a native `Modal` sliding
 * up from the bottom, which is the closest platform equivalent.
 */
export function ActionMenuProvider({ children }: { children: React.ReactNode }) {
  const { scheme } = useTheme()
  const colors = useColors()
  const [request, setRequest] = useState<ActionMenuRequest | undefined>(undefined)
  // Kept in a ref so dismissing never has to wait for a re-render.
  const pending = useRef<ActionMenuRequest | undefined>(undefined)

  const show: Show = (next) => {
    if (Platform.OS === 'ios') {
      const enabled = next.options.filter((option) => !option.disabled)
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: next.title,
          userInterfaceStyle: scheme,
          tintColor: colors.brand,
          message: next.message,
          options: [...enabled.map((option) => option.label), 'Cancel'],
          cancelButtonIndex: enabled.length,
          destructiveButtonIndex: enabled.findIndex((option) => option.destructive),
        },
        (index) => enabled[index]?.onSelect?.(),
      )
      return
    }

    pending.current = next
    setRequest(next)
  }

  const dismiss = () => {
    pending.current = undefined
    setRequest(undefined)
  }

  const select = (option: ActionOption) => {
    dismiss()
    option.onSelect?.()
  }

  return (
    <ActionMenuContext value={show}>
      {children}
      <FallbackSheet request={request} onDismiss={dismiss} onSelect={select} />
    </ActionMenuContext>
  )
}

export function useActionMenu() {
  const show = use(ActionMenuContext)
  if (!show) throw new Error('useActionMenu must be used inside <ActionMenuProvider>')
  return show
}

function FallbackSheet({
  request,
  onDismiss,
  onSelect,
}: {
  request: ActionMenuRequest | undefined
  onDismiss: () => void
  onSelect: (option: ActionOption) => void
}) {
  const colors = useColors()
  const styles = useThemeStyles(themeStyles)

  const insets = useSafeAreaInsets()

  return (
    <Modal
      visible={request !== undefined}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <Pressable style={styles.scrim} onPress={onDismiss} accessibilityLabel="Dismiss menu" />

      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={styles.group}>
          {/* On the card rather than the scrim, as in the iOS sheet: the
              message is often the point — "could not confirm, check before
              retrying" — and has to stay readable over any screen. */}
          {request?.title || request?.message ? (
            <View style={styles.header}>
              {request.title ? (
                <Text variant="caption" color={colors.textMuted} style={styles.headerText}>
                  {request.title}
                </Text>
              ) : null}
              {request.message ? (
                <Text variant="caption" color={colors.textMuted} style={styles.headerText}>
                  {request.message}
                </Text>
              ) : null}
            </View>
          ) : null}

          {request?.options
            .filter((option) => !option.disabled)
            .map((option, index) => (
              <Pressable
                key={option.label}
                accessibilityRole="button"
                onPress={() => onSelect(option)}
                style={[
                  styles.option,
                  index > 0 || request.title || request.message ? styles.optionDivided : null,
                ]}
              >
                <Text
                  style={[styles.optionLabel, option.destructive ? styles.destructive : null]}
                >
                  {option.label}
                </Text>
              </Pressable>
            ))}
        </View>

        <Pressable accessibilityRole="button" onPress={onDismiss} style={styles.cancel}>
          <Text style={styles.cancelLabel}>Cancel</Text>
        </Pressable>
      </View>
    </Modal>
  )
}

const themeStyles = (colors: Palette) => (StyleSheet.create({
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  sheet: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 0,
    gap: 10,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4,
  },
  headerText: {
    textAlign: 'center',
  },
  group: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  option: {
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionDivided: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  optionLabel: {
    fontFamily: fonts.medium,
    fontSize: 17,
    color: colors.text,
  },
  destructive: {
    color: colors.red,
  },
  cancel: {
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
  },
  cancelLabel: {
    fontFamily: fonts.bold,
    fontSize: 17,
    color: colors.text,
  },
}))
