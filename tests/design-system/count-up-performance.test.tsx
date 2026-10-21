import renderer, { act } from 'react-test-renderer'
import { Text } from 'react-native'
import 'react-native-reanimated'

// Load the hook with its real app behavior: the old implementation bypassed
// its animation entirely in tests, hiding its frame-by-frame JS updates.
const originalEnvironment = process.env.NODE_ENV
process.env.NODE_ENV = 'production'
const { useCountUp } = require('../../src/design-system/motion') as typeof import('../../src/design-system/motion')
process.env.NODE_ENV = originalEnvironment

it('shows accurate live amounts immediately without scheduling JS animation frames', () => {
  jest.useFakeTimers()
  const frames = jest.spyOn(globalThis, 'requestAnimationFrame')
  let renders = 0
  function Amount({ value }: { value: number }) {
    const shown = useCountUp(value)
    renders++
    return <Text>{shown}</Text>
  }
  let tree!: renderer.ReactTestRenderer
  try {
    act(() => { tree = renderer.create(<Amount value={1250} />) })
    expect(tree.root.findByType(Text).props.children).toBe(1250)
    act(() => { tree.update(<Amount value={1285.5} />) })
    expect(tree.root.findByType(Text).props.children).toBe(1285.5)
    act(() => jest.advanceTimersByTime(1500))
    expect(renders).toBe(2)
    expect(frames).not.toHaveBeenCalled()
  } finally {
    act(() => tree?.unmount())
    frames.mockRestore()
    jest.useRealTimers()
  }
})
