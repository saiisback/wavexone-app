import { NavigationContainer } from '@react-navigation/native'
import { StyleSheet, View } from 'react-native'
import renderer, { act } from 'react-test-renderer'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { colors } from '../../src/design-system/colors'
import { HomeAtmosphere } from '../../src/design-system/home-atmosphere'
import { ArrowLeftIcon } from '../../src/design-system/icons'
import { PageScreen } from '../../src/design-system/page-layout'
import { Text } from '../../src/design-system/text'

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
}

it('gives a reference page an atmospheric header and a distinct readable content surface', () => {
  let tree!: renderer.ReactTestRenderer
  act(() => {
    tree = renderer.create(
      <SafeAreaProvider initialMetrics={metrics}>
        <NavigationContainer>
          <PageScreen
            back
            tone="reference"
            title="Markets"
            subtitle="Live prices"
            trailing={<View accessibilityRole="button" accessibilityLabel="Filter markets" />}
          >
            <Text>Market list</Text>
          </PageScreen>
        </NavigationContainer>
      </SafeAreaProvider>,
    )
  })

  expect(tree.root.findAllByType(HomeAtmosphere)).toHaveLength(1)
  const heading = tree.root.findByProps({ accessibilityRole: 'header' })
  expect(heading.props.children).toBe('Markets')
  expect(heading.props.color).toBe(colors.brand)
  expect(tree.root.find((node) => node.props.children === 'Live prices').props.color).toBe(colors.referenceMuted)
  expect(tree.root.findByType(ArrowLeftIcon).props.color).toBe(colors.brand)
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Filter markets' }).length).toBeGreaterThan(0)

  const content = tree.root.findByProps({ testID: 'reference-page-content' })
  expect(StyleSheet.flatten(content.props.style).backgroundColor).toBe(colors.surface)
  expect(StyleSheet.flatten(tree.root.findByType(HomeAtmosphere).parent!.props.style).backgroundColor)
    .toBe(colors.referenceCanvas)

  act(() => { tree.unmount() })
})
