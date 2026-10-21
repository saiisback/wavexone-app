import renderer, { act } from 'react-test-renderer'
import { ActivityIndicator } from 'react-native'
import { Button, Text } from '../../src/design-system'
import { QueryStateView } from '../../src/features/shared/query-state'

it('keeps rendered results visible while refreshing and offers explicit retry after failure', () => {
  let tree!: renderer.ReactTestRenderer
  let retries = 0
  const render = (value: string) => <Text>{value}</Text>
  act(() => { tree = renderer.create(<QueryStateView state={{ status: 'ready', data: 'balance', refreshing: true }} render={render} />) })
  expect(tree.root.findAllByType(Text).some((node) => node.props.children === 'balance')).toBe(true)
  expect(tree.root.findAllByType(ActivityIndicator)).toHaveLength(1)
  act(() => tree.update(<QueryStateView state={{ status: 'ready', data: 'balance', refreshError: 'Connection unavailable', retry: () => { retries += 1 } }} render={render} />))
  expect(tree.root.findAllByType(Text).some((node) => node.props.children === 'balance')).toBe(true)
  act(() => tree.root.findByType(Button).props.onPress())
  expect(retries).toBe(1)
  act(() => tree.unmount())
})
