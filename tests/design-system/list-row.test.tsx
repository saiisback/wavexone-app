import renderer, { act } from 'react-test-renderer'

import { ListRow } from '../../src/design-system/list-row'

it.each([
  { label: 'From', value: 'Live · 12345678901234567890', detail: undefined },
  { label: 'To', value: 'Demo · 9876543210', detail: undefined },
  { label: 'Payment method', value: 'Bank transfer', detail: 'Saved destination' },
])('announces the selected $label value in full', ({ label, value, detail }) => {
  let tree!: renderer.ReactTestRenderer
  act(() => { tree = renderer.create(<ListRow label={label} value={value} detail={detail} onPress={() => {}} />) })
  const announced = tree.root.findAllByProps({ accessibilityRole: 'button' })[0].props.accessibilityLabel
  expect(announced).toContain(label)
  expect(announced).toContain(value)
  if (detail) expect(announced).toContain(detail)
  act(() => { tree.unmount() })
})
