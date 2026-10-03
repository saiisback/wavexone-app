import { StyleSheet, Text as RNText } from 'react-native'
import renderer, { act } from 'react-test-renderer'

import { Delta } from '../../src/design-system/delta'
import { colors } from '../../src/design-system/colors'

function luminance(hex: string) {
  const rgb = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722
}

it.each(['up', 'down'] as const)('keeps %s percentages readable on navy panels', (direction) => {
  let tree!: renderer.ReactTestRenderer
  act(() => { tree = renderer.create(<Delta label={direction === 'up' ? '+1%' : '-1%'} direction={direction} onInk />) })
  const foreground = StyleSheet.flatten(tree.root.findByType(RNText).props.style).color
  const contrast = (luminance(foreground) + 0.05) / (luminance(colors.ink) + 0.05)
  expect(contrast).toBeGreaterThanOrEqual(4.5)
  act(() => { tree.unmount() })
})
