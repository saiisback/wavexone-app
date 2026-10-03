import { StyleSheet, TextInput, View } from 'react-native'
import renderer, { act } from 'react-test-renderer'

import { Field } from '../../src/design-system/field'
import { colors } from '../../src/design-system/colors'

it('highlights keyboard focus without swallowing caller events and keeps errors visible', () => {
  const focus = jest.fn()
  const blur = jest.fn()
  let tree!: renderer.ReactTestRenderer
  act(() => { tree = renderer.create(<Field label="Amount" onFocus={focus} onBlur={blur} />) })
  const boxColor = () => tree.root.findAllByType(View)
    .map((node) => StyleSheet.flatten(node.props.style)?.borderColor).filter(Boolean).pop()
  const focusEvent = { nativeEvent: {} }
  act(() => { tree.root.findByType(TextInput).props.onFocus(focusEvent) })
  expect(boxColor()).toBe(colors.navy)
  expect(focus).toHaveBeenCalledWith(focusEvent)
  act(() => { tree.update(<Field label="Amount" invalid onFocus={focus} onBlur={blur} />) })
  expect(boxColor()).toBe(colors.red)
  act(() => { tree.root.findByType(TextInput).props.onBlur(focusEvent) })
  expect(blur).toHaveBeenCalledWith(focusEvent)
  act(() => { tree.update(<Field label="Amount" />) })
  expect(boxColor()).toBe(colors.divider)
  act(() => { tree.unmount() })
})
