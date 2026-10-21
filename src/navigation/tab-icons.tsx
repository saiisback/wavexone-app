import { useColors } from '../design-system/theme'
import Svg, { Circle, Path, Rect } from 'react-native-svg'


type TabIconProps = { size?: number; color: string; active: boolean }

const STROKE = 1.7

/**
 * One family for the four tab glyphs: the same 24pt box, stroke weight and
 * corner radius, drawn as outlines at rest and filled (with an ice cut-out
 * for detail) when selected.
 */
export function TabHomeIcon({ size = 24, color, active }: TabIconProps) {
  const colors = useColors()

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M4 10.2 11.2 4.3a1.3 1.3 0 0 1 1.6 0L20 10.2c.3.25.5.62.5 1V19a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-7.8c0-.38.17-.75.5-1Z"
        fill={active ? color : 'none'}
        stroke={color}
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
      <Path
        d="M9.5 21v-4.5a2.5 2.5 0 0 1 5 0V21"
        fill="none"
        stroke={active ? colors.white : color}
        strokeWidth={STROKE}
        strokeLinecap="round"
      />
    </Svg>
  )
}

export function TabMarketsIcon({ size = 24, color, active }: TabIconProps) {
  const fill = active ? color : 'none'
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x="3.5" y="13" width="4.4" height="7.5" rx="1.6" fill={fill} stroke={color} strokeWidth={STROKE} />
      <Rect x="9.8" y="8.5" width="4.4" height="12" rx="1.6" fill={fill} stroke={color} strokeWidth={STROKE} />
      <Rect x="16.1" y="3.5" width="4.4" height="17" rx="1.6" fill={fill} stroke={color} strokeWidth={STROKE} />
    </Svg>
  )
}

export function TabPositionsIcon({ size = 24, color, active }: TabIconProps) {
  const colors = useColors()

  const line = active ? colors.white : color
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x="4" y="3" width="16" height="18" rx="3.4" fill={active ? color : 'none'} stroke={color} strokeWidth={STROKE} />
      <Path d="M8 8.5h8M8 12h8M8 15.5h4.5" stroke={line} strokeWidth={STROKE} strokeLinecap="round" />
    </Svg>
  )
}

export function TabMoreIcon({ size = 24, color, active }: TabIconProps) {
  const fill = active ? color : 'none'
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x="3.5" y="3.5" width="7" height="7" rx="2.2" fill={fill} stroke={color} strokeWidth={STROKE} />
      <Rect x="13.5" y="3.5" width="7" height="7" rx="2.2" fill={fill} stroke={color} strokeWidth={STROKE} />
      <Rect x="3.5" y="13.5" width="7" height="7" rx="2.2" fill={fill} stroke={color} strokeWidth={STROKE} />
      <Circle cx="17" cy="17" r="3.6" fill={fill} stroke={color} strokeWidth={STROKE} />
    </Svg>
  )
}
