import Svg, { Stop } from 'react-native-svg'
import renderer, { act } from 'react-test-renderer'

import { colors } from '../../src/design-system/colors'
import { HomeAtmosphere } from '../../src/design-system/home-atmosphere'

it('uses the warm ivory-gold reference gradient for the atmospheric background', () => {
  let tree!: renderer.ReactTestRenderer
  act(() => {
    tree = renderer.create(<HomeAtmosphere />)
  })

  const canvasStops = tree.root.findAllByType(Stop).slice(0, 4).map((stop) => stop.props.stopColor)
  expect(canvasStops).toEqual([
    colors.referenceCanvasTop,
    colors.referenceCanvas,
    colors.referenceCanvasWarm,
    colors.referenceCanvas,
  ])
  expect(colors.referenceCanvas).toBe('#FFF0BF')
  expect(colors.referenceCanvasWarm).toBe('#F4CE68')
  expect(tree.root.findByType(Svg).props.preserveAspectRatio).toBe('none')

  act(() => { tree.unmount() })
})
