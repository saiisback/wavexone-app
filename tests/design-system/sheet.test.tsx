import { NavigationContainer } from '@react-navigation/native'
import { StyleSheet } from 'react-native'
import renderer, { act } from 'react-test-renderer'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { colors } from '../../src/design-system/colors'
import { Sheet } from '../../src/design-system/sheet'
import { Text } from '../../src/design-system/text'

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 20, left: 0, right: 0, bottom: 34 },
}

it('keeps sheet content readable beneath a warm heading with restrained gold emphasis', () => {
  let tree!: renderer.ReactTestRenderer
  act(() => {
    tree = renderer.create(
      <SafeAreaProvider initialMetrics={metrics}>
        <NavigationContainer>
          <Sheet title="Deposit" subtitle="Fund your trading account">
            <Text>Funding form</Text>
          </Sheet>
        </NavigationContainer>
      </SafeAreaProvider>,
    )
  })

  const heading = tree.root.findByProps({ testID: 'sheet-heading' })
  const content = tree.root.findByProps({ testID: 'sheet-content-surface' })
  const accent = tree.root.findByProps({ testID: 'sheet-gold-accent' })

  expect(StyleSheet.flatten(heading.props.style).backgroundColor).toBe('transparent')
  expect(StyleSheet.flatten(content.props.style).backgroundColor).toBe(colors.surface)
  expect(StyleSheet.flatten(accent.props.style).backgroundColor).toBe(colors.gold)
  expect(tree.root.findByProps({ accessibilityLabel: 'Close' })).toBeTruthy()
  expect(tree.root.findAllByType(Text).some((node) => node.props.children === 'Funding form')).toBe(true)

  act(() => { tree.unmount() })
})
