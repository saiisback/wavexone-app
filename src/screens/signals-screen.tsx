import { useColors, useThemeStyles } from '../design-system/theme'
import type { Palette } from '../design-system/colors'
import { StyleSheet, View } from 'react-native'

import {
  Card,
  ClockIcon,
  Gutter,
  IconChip,
  MarketsIcon,
  PageScreen,
  Reveal,
  SparkleIcon,
  Text,
  TrendUpIcon,
  radius,
  spacing,
} from '../design-system'

/**
 * No confirmed backend endpoint currently supplies trading signals, so the
 * page explains what will arrive here and shows the shape of an insight
 * card, without inventing any signal content.
 */
export function SignalsScreen() {
  const colors = useColors()
  const styles = useThemeStyles(themeStyles)

  return (
    <PageScreen back title="Trading Signals" tone="reference">
      <Reveal>
        <Gutter>
          <Card tone="ink" style={styles.hero}>
            <View style={styles.tagOnInk}>
              <SparkleIcon size={14} color={colors.onInk} />
              <Text variant="micro" weight="semibold" color={colors.onInk}>
                WaveX Insight
              </Text>
            </View>
            <Text variant="heading" color={colors.onInk}>
              Trading signals are coming soon
            </Text>
            <Text variant="body" color={colors.onInkMuted}>
              Signals will appear here as soon as they are available for your account.
            </Text>
          </Card>
        </Gutter>
      </Reveal>

      <Reveal index={1}>
        <Gutter style={styles.section}>
          <Text variant="section">What each insight shows</Text>
          <View
            style={styles.previews}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <InsightPreview tone="blue" ink={colors.tintBlueInk} Icon={MarketsIcon} />
            <InsightPreview tone="mint" ink={colors.tintMintInk} Icon={TrendUpIcon} faded />
          </View>
        </Gutter>
      </Reveal>

      <Reveal index={2}>
        <Gutter>
          <Card tone="tint" style={styles.features}>
            <Feature
              Icon={MarketsIcon}
              ink={colors.tintBlueInk}
              title="The instrument"
              caption="Which market the idea is about."
            />
            <Feature
              Icon={SparkleIcon}
              ink={colors.tintVioletInk}
              title="The idea"
              caption="A short headline from the WaveX desk."
            />
            <Feature
              Icon={ClockIcon}
              ink={colors.tintAmberInk}
              title="When it was published"
              caption="So you can judge how fresh it is."
            />
          </Card>
        </Gutter>
      </Reveal>
    </PageScreen>
  )
}

/**
 * The outline of an insight card in the reference "category card" shape —
 * icon tile, headline and date lines, the tag, and a thin bar underneath —
 * drawn as quiet placeholders rather than invented content.
 */
function InsightPreview({
  tone,
  ink,
  Icon,
  faded = false,
}: {
  tone: 'blue' | 'mint'
  ink: string
  Icon: typeof MarketsIcon
  faded?: boolean
}) {
  const colors = useColors()
  const styles = useThemeStyles(themeStyles)

  return (
    <Card style={[styles.preview, faded ? styles.faded : null]}>
      <View style={styles.previewRow}>
        <IconChip tone={tone} size={44} shape="square">
          <Icon size={20} color={ink} />
        </IconChip>
        <View style={styles.previewLines}>
          <View style={[styles.line, styles.lineWide]} />
          <View style={[styles.line, styles.lineShort]} />
        </View>
        <View style={styles.tag}>
          <SparkleIcon size={12} color={colors.brand} />
          <Text variant="micro" weight="semibold" color={colors.brand}>
            WaveX Insight
          </Text>
        </View>
      </View>
      <View style={styles.bar} />
    </Card>
  )
}

function Feature({
  Icon,
  ink,
  title,
  caption,
}: {
  Icon: typeof MarketsIcon
  ink: string
  title: string
  caption: string
}) {
  const colors = useColors()
  const styles = useThemeStyles(themeStyles)

  return (
    <View style={styles.feature}>
      <IconChip tone="surface" size={40} shape="square">
        <Icon size={20} color={ink} />
      </IconChip>
      <View style={styles.featureText}>
        <Text variant="strong">{title}</Text>
        <Text variant="caption" color={colors.textMuted}>
          {caption}
        </Text>
      </View>
    </View>
  )
}

const themeStyles = (colors: Palette) => (StyleSheet.create({
  hero: {
    padding: spacing.xl,
    gap: spacing.sm,
  },
  tagOnInk: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.glassOnInkStrong,
  },
  section: {
    gap: spacing.md,
  },
  previews: {
    gap: spacing.md,
  },
  preview: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  faded: {
    opacity: 0.55,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  previewLines: {
    flex: 1,
    gap: 8,
  },
  line: {
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.track,
  },
  lineWide: {
    width: '85%',
  },
  lineShort: {
    width: '45%',
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTint,
  },
  bar: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.track,
  },
  features: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  featureText: {
    flex: 1,
    gap: 1,
  },
}))
