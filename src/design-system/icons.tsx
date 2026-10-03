import Svg, { Circle, Path, Rect, G } from 'react-native-svg'

import { colors } from './colors'

export type IconProps = {
  size?: number
  color?: string
}

const DEFAULT = 24

/* ------------------------------------------------------------------ */
/* Tab bar                                                             */
/* ------------------------------------------------------------------ */

/** Solid house. The mockups draw Home filled in every state. */
export function HomeIcon({ size = DEFAULT, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M11.24 2.6a1.2 1.2 0 0 1 1.52 0l8.1 6.63c.28.23.44.57.44.93V20a1.4 1.4 0 0 1-1.4 1.4h-4.6a.9.9 0 0 1-.9-.9v-4.3a2.4 2.4 0 0 0-4.8 0v4.3a.9.9 0 0 1-.9.9H4.1A1.4 1.4 0 0 1 2.7 20v-9.84c0-.36.16-.7.44-.93Z"
        fill={color}
      />
    </Svg>
  )
}

/** Ascending bars with a rounded cap on the tallest — the Markets glyph. */
export function MarketsIcon({ size = DEFAULT, color = colors.text, filled = false }: IconProps & { filled?: boolean }) {
  const stroke = filled ? 'none' : color
  const fill = filled ? color : 'none'
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x="2.8" y="14" width="4.6" height="7" rx="1.2" fill={fill} stroke={stroke} strokeWidth={1.8} />
      <Rect x="9.7" y="9.5" width="4.6" height="11.5" rx="1.2" fill={fill} stroke={stroke} strokeWidth={1.8} />
      <Path
        d="M16.6 21V8.2c0-2.6 1.3-4.3 3.4-5.1.7-.3 1.2.3 1.2 1V21"
        fill={fill}
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </Svg>
  )
}

/** Three candlesticks — used gold-on-black inside the centre Trade button. */
export function CandlesIcon({ size = DEFAULT, color = colors.gold }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <G fill={color}>
        <Rect x="3.6" y="6.5" width="3.2" height="9" rx="1.4" />
        <Rect x="4.7" y="3" width="1" height="18" rx="0.5" />
        <Rect x="10.4" y="4.5" width="3.2" height="11" rx="1.4" />
        <Rect x="11.5" y="2" width="1" height="19" rx="0.5" />
        <Rect x="17.2" y="7.5" width="3.2" height="8" rx="1.4" />
        <Rect x="18.3" y="4" width="1" height="16" rx="0.5" />
      </G>
    </Svg>
  )
}

/** Document with ruled lines — the Positions glyph. */
export function PositionsIcon({ size = DEFAULT, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x="3.6" y="2.8" width="16.8" height="18.4" rx="3" fill="none" stroke={color} strokeWidth={1.8} />
      <Path
        d="M7.8 8.2h8.4M7.8 12h8.4M7.8 15.8h4.8"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </Svg>
  )
}

/** Active Positions glyph: the document inverts into a filled badge. */
export function PositionsIconFilled({ size = DEFAULT }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x="2.4" y="2.4" width="19.2" height="19.2" rx="5" fill={colors.brand} />
      <Path
        d="M7 8.4h10M7 12h10M7 15.6h5.6"
        stroke={colors.white}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  )
}

/** Three horizontal dots — the More glyph. */
export function MoreIcon({ size = DEFAULT, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <G fill={color}>
        <Circle cx="4.6" cy="12" r="2.1" />
        <Circle cx="12" cy="12" r="2.1" />
        <Circle cx="19.4" cy="12" r="2.1" />
      </G>
    </Svg>
  )
}

/* ------------------------------------------------------------------ */
/* Navigation & chrome                                                 */
/* ------------------------------------------------------------------ */

export function ArrowLeftIcon({ size = DEFAULT, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M19 12H5m0 0 6.2-6.2M5 12l6.2 6.2"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  )
}

export function ChevronRightIcon({ size = DEFAULT, color = colors.textSubtle }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="m9 4.8 7 7.2-7 7.2"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  )
}

export function ChevronDownIcon({ size = DEFAULT, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="m4.8 9 7.2 7 7.2-7"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  )
}

export function SearchIcon({ size = DEFAULT, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="10.6" cy="10.6" r="7" fill="none" stroke={color} strokeWidth={2} />
      <Path d="m15.8 15.8 4.6 4.6" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  )
}

export function StarIcon({ size = DEFAULT, color = colors.text, filled = false }: IconProps & { filled?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 2.9c.3 0 .6.17.74.45l2.4 4.86 5.37.78a.83.83 0 0 1 .46 1.41l-3.89 3.79.92 5.35a.83.83 0 0 1-1.2.87L12 17.88l-4.8 2.53a.83.83 0 0 1-1.2-.88l.92-5.35-3.89-3.79a.83.83 0 0 1 .46-1.41l5.37-.78 2.4-4.86A.83.83 0 0 1 12 2.9Z"
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
    </Svg>
  )
}

export function BellIcon({ size = DEFAULT, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M5.6 17.2c1.1-1.1 1.7-2.6 1.7-4.2v-2.4a4.7 4.7 0 0 1 9.4 0V13c0 1.6.6 3.1 1.7 4.2.28.28.08.76-.32.76H5.92c-.4 0-.6-.48-.32-.76Z"
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <Path
        d="M9.8 18.6a2.3 2.3 0 0 0 4.4 0"
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </Svg>
  )
}

export function FilterIcon({ size = DEFAULT, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M3.4 5.2h17.2L14 12.9v6.5l-4 1.8v-8.3L3.4 5.2Z"
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
    </Svg>
  )
}

/** Vertical ellipsis used on position and activity rows. */
export function MoreVerticalIcon({ size = DEFAULT, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <G fill={color}>
        <Circle cx="12" cy="5" r="1.9" />
        <Circle cx="12" cy="12" r="1.9" />
        <Circle cx="12" cy="19" r="1.9" />
      </G>
    </Svg>
  )
}

/* ------------------------------------------------------------------ */
/* Data indicators                                                     */
/* ------------------------------------------------------------------ */

/** Solid triangle used beside every percentage change. */
export function DeltaTriangle({
  size = 12,
  color = colors.green,
  direction = 'up',
}: IconProps & { direction?: 'up' | 'down' }) {
  return (
    <Svg width={size} height={size * 0.88} viewBox="0 0 12 11">
      <Path
        d={direction === 'up' ? 'M6 0.6 11.4 10.4H0.6Z' : 'M6 10.4 0.6 0.6h10.8Z'}
        fill={color}
      />
    </Svg>
  )
}

/** Rising zig-zag with an arrowhead — the "Bullish" mark. */
export function TrendUpIcon({ size = DEFAULT, color = colors.green }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M3 17.4 8.9 11l3.7 3.6 6.1-7.4"
        fill="none"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M14.2 6.2h6v6" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}

/** Filled bolt — the "Execution" mark. */
export function BoltIcon({ size = DEFAULT, color = colors.gold }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M13.9 2 4.6 13.4h5.3L9.1 22l9.5-11.6h-5.4L13.9 2Z" fill={color} />
    </Svg>
  )
}

/* ------------------------------------------------------------------ */
/* Funding                                                             */
/* ------------------------------------------------------------------ */

/** Card with a plus — used for funding method choices. */
export function CardPlusIcon({ size = DEFAULT, color = colors.white }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M2.6 8.2A2.6 2.6 0 0 1 5.2 5.6h9.9v11.2a2.6 2.6 0 0 1-2.6 2.6H5.2a2.6 2.6 0 0 1-2.6-2.6V8.2Z"
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <Path d="M2.6 10.4h12.5" stroke={color} strokeWidth={1.8} />
      <Path d="M5.6 15.1h3.1" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M18.9 2.8v5.6M16.1 5.6h5.6" stroke={color} strokeWidth={1.9} strokeLinecap="round" />
    </Svg>
  )
}

/** Tray with a down arrow — a completed deposit. */
export function DepositIcon({ size = DEFAULT, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 3v11m0 0 4.4-4.4M12 14l-4.4-4.4"
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M3.8 16.4v2.4a2.2 2.2 0 0 0 2.2 2.2h12a2.2 2.2 0 0 0 2.2-2.2v-2.4"
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  )
}

/** Tray with an up arrow — a completed withdrawal. */
export function WithdrawIcon({ size = DEFAULT, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 14.4V3.4m0 0 4.4 4.4M12 3.4 7.6 7.8"
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M3.8 16.4v2.4a2.2 2.2 0 0 0 2.2 2.2h12a2.2 2.2 0 0 0 2.2-2.2v-2.4"
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  )
}

/* ------------------------------------------------------------------ */
/* Account menu                                                        */
/* ------------------------------------------------------------------ */

export function WalletIcon({ size = DEFAULT, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x="2.6" y="5" width="18.8" height="14.6" rx="3.4" fill="none" stroke={color} strokeWidth={1.8} />
      <Path
        d="M21.4 9.6h-4.1a2.4 2.4 0 0 0 0 4.8h4.1"
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
    </Svg>
  )
}

export function UserIcon({ size = DEFAULT, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="12" cy="7.4" r="4.2" fill="none" stroke={color} strokeWidth={1.8} />
      <Path
        d="M4.2 21c0-3.9 3.5-6.6 7.8-6.6s7.8 2.7 7.8 6.6"
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </Svg>
  )
}

export function ExternalLinkIcon({ size = DEFAULT, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M13.4 3.4h7.2v7.2M20.6 3.4 11.2 12.8"
        fill="none"
        stroke={color}
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M18.4 14.6v4a2.6 2.6 0 0 1-2.6 2.6H5.4a2.6 2.6 0 0 1-2.6-2.6V8.2a2.6 2.6 0 0 1 2.6-2.6h4"
        fill="none"
        stroke={color}
        strokeWidth={1.9}
        strokeLinecap="round"
      />
    </Svg>
  )
}

export function CodeIcon({ size = DEFAULT, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M7.6 6.6 2.4 12l5.2 5.4M16.4 6.6 21.6 12l-5.2 5.4M13.9 3.6l-3.8 16.8"
        fill="none"
        stroke={color}
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

export function HeadsetIcon({ size = DEFAULT, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M3.6 14.4v-2.2a8.4 8.4 0 0 1 16.8 0v2.2"
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
      <Rect x="1.8" y="12.6" width="4.6" height="6.4" rx="2.3" fill="none" stroke={color} strokeWidth={1.8} />
      <Rect x="17.6" y="12.6" width="4.6" height="6.4" rx="2.3" fill="none" stroke={color} strokeWidth={1.8} />
      <Path
        d="M20 19v.6a2.6 2.6 0 0 1-2.6 2.6H13"
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </Svg>
  )
}

export function SettingsIcon({ size = DEFAULT, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="12" cy="12" r="3.3" fill="none" stroke={color} strokeWidth={1.8} />
      <Path
        d="M19.3 14.6a1.5 1.5 0 0 0 .3 1.65l.05.05a1.8 1.8 0 1 1-2.55 2.55l-.05-.05a1.5 1.5 0 0 0-1.65-.3 1.5 1.5 0 0 0-.9 1.37v.13a1.8 1.8 0 1 1-3.6 0v-.07a1.5 1.5 0 0 0-.98-1.37 1.5 1.5 0 0 0-1.65.3l-.05.05a1.8 1.8 0 1 1-2.55-2.55l.05-.05a1.5 1.5 0 0 0 .3-1.65 1.5 1.5 0 0 0-1.37-.9h-.13a1.8 1.8 0 1 1 0-3.6h.07a1.5 1.5 0 0 0 1.37-.98 1.5 1.5 0 0 0-.3-1.65l-.05-.05A1.8 1.8 0 1 1 8.14 3.1l.05.05a1.5 1.5 0 0 0 1.65.3h.07a1.5 1.5 0 0 0 .9-1.37v-.13a1.8 1.8 0 1 1 3.6 0v.07a1.5 1.5 0 0 0 .9 1.37 1.5 1.5 0 0 0 1.65-.3l.05-.05a1.8 1.8 0 1 1 2.55 2.55l-.05.05a1.5 1.5 0 0 0-.3 1.65v.07a1.5 1.5 0 0 0 1.37.9h.13a1.8 1.8 0 1 1 0 3.6h-.07a1.5 1.5 0 0 0-1.37.9Z"
        fill="none"
        stroke={color}
        strokeWidth={1.7}
        strokeLinejoin="round"
      />
    </Svg>
  )
}

export function SwapIcon({ size = DEFAULT, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M3.4 8.4h15.4m0 0-4-4m4 4-4 4"
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M20.6 15.6H5.2m0 0 4 4m-4-4 4-4"
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

export function LogoutIcon({ size = DEFAULT, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12.6 3.4H6.2a2.4 2.4 0 0 0-2.4 2.4v12.4a2.4 2.4 0 0 0 2.4 2.4h6.4"
        fill="none"
        stroke={color}
        strokeWidth={1.9}
        strokeLinecap="round"
      />
      <Path
        d="M16 8.2 19.8 12 16 15.8M19.8 12H9.4"
        fill="none"
        stroke={color}
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

/** Scalloped gold disc with a white tick — the verified marker. */
export function VerifiedIcon({ size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 1.4l2.3 1.9 3-.28 1 2.85 2.6 1.53-.9 2.88.9 2.88-2.6 1.53-1 2.85-3-.28L12 22.6l-2.3-1.9-3 .28-1-2.85-2.6-1.53.9-2.88-.9-2.88 2.6-1.53 1-2.85 3 .28Z"
        fill={colors.goldDeep}
      />
      <Path
        d="m7.8 12.2 2.8 2.8 5.6-5.8"
        fill="none"
        stroke={colors.surface}
        strokeWidth={2.3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

/** Outlined shield with a tick: risk controls (stop loss, take profit). */
export function ShieldIcon({ size = DEFAULT, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 2.8 4.6 5.6v5.6c0 4.6 3.1 8.6 7.4 10 4.3-1.4 7.4-5.4 7.4-10V5.6Z"
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <Path
        d="m8.8 12.2 2.3 2.3 4.2-4.6"
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

/* ------------------------------------------------------------------ */
/* Redesign additions                                                  */
/* ------------------------------------------------------------------ */

/** A cross — closes sheets and dismisses banners. */
export function CloseIcon({ size = DEFAULT, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M6 6l12 12M18 6 6 18" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  )
}

/** A plus. */
export function PlusIcon({ size = DEFAULT, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 5v14M5 12h14" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  )
}

/** A four-point sparkle with a small companion — insights and signals. */
export function SparkleIcon({ size = DEFAULT, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M10 3.5c.5 3.6 2.4 5.5 6 6-3.6.5-5.5 2.4-6 6-.5-3.6-2.4-5.5-6-6 3.6-.5 5.5-2.4 6-6Z"
        fill={color}
      />
      <Path d="M18 14.5c.25 1.8 1.2 2.75 3 3-1.8.25-2.75 1.2-3 3-.25-1.8-1.2-2.75-3-3 1.8-.25 2.75-1.2 3-3Z" fill={color} />
    </Svg>
  )
}

/** Circled "i". */
export function InfoIcon({ size = DEFAULT, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="12" cy="12" r="8.6" fill="none" stroke={color} strokeWidth={1.6} />
      <Path d="M12 11v5" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Circle cx="12" cy="7.9" r="1.1" fill={color} />
    </Svg>
  )
}

/** Diagonal arrow — "open elsewhere", "expand". */
export function ArrowUpRightIcon({ size = DEFAULT, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M7 17 17 7M9 7h8v8" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}

/** A right arrow, for primary call-to-action pills. */
export function ArrowRightIcon({ size = DEFAULT, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M4.5 12h15m0 0-6-6m6 6-6 6" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}

/** A clock face — history, pending orders. */
export function ClockIcon({ size = DEFAULT, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="12" cy="12" r="8.6" fill="none" stroke={color} strokeWidth={1.8} />
      <Path d="M12 7.5V12l3 2" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}

/** A check mark. */
export function CheckIcon({ size = DEFAULT, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}
