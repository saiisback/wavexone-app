import { Text, type TextProps } from './text'

/**
 * A money figure with its minor units set back — "$24,860" at full strength,
 * ".40" quieter — so the eye lands on the part that matters.
 */
export function Amount({
  children,
  color,
  fadedColor,
  ...rest
}: Omit<TextProps, 'children'> & {
  /** Pre-formatted, e.g. "$24,860.40" or "+$182.70". */
  children: string
  /** Colour of the minor units; defaults to the main colour at lower opacity. */
  fadedColor?: string
}) {
  const match = /^(.*?)(\.\d+)$/.exec(children)
  if (!match) return <Text {...rest} color={color}>{children}</Text>
  return (
    <Text {...rest} color={color}>
      {match[1]}
      <Text {...rest} color={fadedColor ?? color} style={[rest.style, fadedColor ? null : { opacity: 0.55 }]}>
        {match[2]}
      </Text>
    </Text>
  )
}
