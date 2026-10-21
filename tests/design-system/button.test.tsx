import { ActivityIndicator } from 'react-native'
import renderer, { act } from 'react-test-renderer'

import { Button, ButtonText } from '../../src/design-system/button'

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'))

const mounted: renderer.ReactTestRenderer[] = []
afterEach(() => act(() => { while (mounted.length) mounted.pop()!.unmount() }))

function renderButton(onPress: () => void | Promise<void>, loading = false) {
  let tree!: renderer.ReactTestRenderer
  act(() => {
    tree = renderer.create(<Button onPress={onPress} loading={loading}><ButtonText>Saving…</ButtonText></Button>)
  })
  mounted.push(tree)
  return tree
}

it('suppresses two presses in one turn until the async action settles', async () => {
  let complete!: () => void
  let attempts = 0
  const tree = renderButton(() => { attempts += 1; return new Promise<void>((resolve) => { complete = resolve }) })
  const press = tree.root.findAllByProps({ accessibilityRole: 'button' })[0].props.onPress
  act(() => { press(); press() })
  expect(attempts).toBe(1)
  expect(tree.root.findAllByProps({ accessibilityRole: 'button' })[0].props.accessibilityState).toMatchObject({ busy: true, disabled: true })
  expect(tree.root.findAllByType(ActivityIndicator)).toHaveLength(1)
  await act(async () => complete())
  act(() => tree.root.findAllByProps({ accessibilityRole: 'button' })[0].props.onPress())
  expect(attempts).toBe(2)
})

it('exposes explicit pending state without replacing compound children', () => {
  const tree = renderButton(() => {}, true)
  expect(tree.root.findAllByProps({ accessibilityRole: 'button' })[0].props.disabled).toBe(true)
  expect(tree.root.findAllByProps({ accessibilityRole: 'button' })[0].props.accessibilityState).toMatchObject({ busy: true, disabled: true })
  expect(tree.root.findByType(ButtonText).props.children).toBe('Saving…')
})

it('does not leave synchronous navigation or confirmation handlers busy', () => {
  let attempts = 0
  const tree = renderButton(() => { attempts += 1 })
  act(() => { tree.root.findAllByProps({ accessibilityRole: 'button' })[0].props.onPress(); tree.root.findAllByProps({ accessibilityRole: 'button' })[0].props.onPress() })
  expect(attempts).toBe(2)
  expect(tree.root.findAllByProps({ accessibilityRole: 'button' })[0].props.accessibilityState.busy).toBe(false)
})
