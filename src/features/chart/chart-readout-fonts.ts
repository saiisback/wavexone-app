import { colors, type as textStyles } from '../../design-system'

export const readoutFonts = {
  price: { ...textStyles.hero, fontSize: 42, lineHeight: 50, letterSpacing: -1.6, color: colors.onInk },
  caption: { ...textStyles.caption, fontSize: 14, lineHeight: 18, color: colors.onInkMuted },
} as const
