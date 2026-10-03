import { Image } from 'expo-image'
import { StyleSheet } from 'react-native'

import { colors } from './colors'

/** Blurred stand-in shown while the portrait decodes. */
const PLACEHOLDER = { blurhash: 'L6H2EC=PM+yV0g-mq.wG9c010J}I' }

/** A round portrait with a hairline edge, so pale photos hold their shape on white. */
export function Avatar({ uri, size = 48 }: { uri: string; size?: number }) {
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

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.brandTint,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(20, 24, 43, 0.08)',
  },
})
