import { useThemeStyles } from './theme'
import type { Palette } from './colors'
import { Image } from 'expo-image'
import { StyleSheet } from 'react-native'


/** Blurred stand-in shown while the portrait decodes. */
const PLACEHOLDER = { blurhash: 'L6H2EC=PM+yV0g-mq.wG9c010J}I' }

/** A round portrait with a hairline edge, so pale photos hold their shape on white. */
export function Avatar({ uri, size = 48 }: { uri: string; size?: number }) {
  const styles = useThemeStyles(themeStyles)

  return (
    <Image
      source={{ uri }}
      placeholder={PLACEHOLDER}
      contentFit="cover"
      transition={180}
      cachePolicy="memory-disk"
      style={[styles.base, { width: size, height: size, borderRadius: size / 2 }]}
    />
  )
}

const themeStyles = (colors: Palette) => (StyleSheet.create({
  base: {
    backgroundColor: colors.brandTint,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(20, 24, 43, 0.08)',
  },
}))
