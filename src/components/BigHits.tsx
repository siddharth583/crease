import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { BigHit } from '../engine/records.ts';
import { colors, font, radius, space, type } from '../theme.ts';
import { PlayerAvatar } from './Avatar.tsx';
import { SeamDivider } from './cricket.tsx';
import { CountUp } from './motion.tsx';
import { PressableScale, SectionLabel, Card, usePageTone } from './ui.tsx';

const SHOWN = 5;

/** A count with its label ("3 sixes"), dimmed when there are none. */
function Count({ n, label, hot }: { n: number; label: string; hot?: boolean }) {
  const tone = usePageTone();
  return (
    <View style={[styles.count, n > 0 && hot && { backgroundColor: tone?.soft ?? colors.accentDim }, n > 0 && !hot && { backgroundColor: colors.cyanDim }]}>
      <CountUp value={n} duration={700} style={[styles.countValue, n === 0 && { color: colors.faint }, n > 0 && hot && { color: tone?.ink ?? colors.accentInk }, n > 0 && !hot && { color: colors.cyan }]} />
      <Text style={styles.countLabel}>{label}</Text>
    </View>
  );
}

/**
 * Whom this batter has hit boundaries off: each bowler with the sixes and fours taken off them. Tapping a row opens the whole duel. Long lists show the top few.
 */
export function BigHits({ hits, first, limit = SHOWN }: { hits: BigHit[]; first: string; limit?: number }) {
  const [all, setAll] = useState(false);
  const tone = usePageTone();
  if (!hits.length) return null;
  const shown = all ? hits : hits.slice(0, limit);
  const sixes = hits.reduce((n, h) => n + h.sixes, 0);
  const fours = hits.reduce((n, h) => n + h.fours, 0);
  return (
    <>
      <SectionLabel right={<Text style={styles.hint}>{sixes} sixes · {fours} fours</Text>}>Big hits</SectionLabel>
      <Card style={{ padding: 0 }}>
        <View style={styles.headRow}>
          <Text style={styles.head}>Boundaries {first} has hit, by bowler</Text>
        </View>
        <View style={{ paddingHorizontal: space.lg }}>
          <SeamDivider />
        </View>
        {shown.map((h, i) => (
          <PressableScale
            key={h.bowlerKey}
            scaleTo={0.98}
            onPress={() => router.push({ pathname: '/rivalry', params: { bat: h.batterKey, bowl: h.bowlerKey } })}
            style={[styles.row, i > 0 && styles.border]}
            accessibilityLabel={`${first} hit ${h.sixes} sixes and ${h.fours} fours off ${h.bowler}`}
          >
            <PlayerAvatar name={h.bowler} size={36} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.name} numberOfLines={1}>
                {h.bowler}
              </Text>
              <Text style={styles.sub}>
                {h.balls} ball{h.balls === 1 ? '' : 's'} faced · {h.matches} match{h.matches === 1 ? '' : 'es'}
              </Text>
            </View>
            <Count n={h.sixes} label="Sixes" hot />
            <Count n={h.fours} label="Fours" />
            <Ionicons name="chevron-forward" size={16} color={colors.faint} />
          </PressableScale>
        ))}
        {hits.length > limit && (
          <PressableScale scaleTo={0.98} onPress={() => setAll(!all)} style={[styles.more, styles.border]} accessibilityLabel={all ? 'Show fewer' : `Show all ${hits.length} bowlers`}>
            <Text style={styles.moreText}>{all ? 'Show fewer' : `Show all ${hits.length} bowlers`}</Text>
            <Ionicons name={all ? 'chevron-up' : 'chevron-down'} size={14} color={colors.muted} />
          </PressableScale>
        )}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  hint: { color: colors.faint, fontSize: 12, fontFamily: font.medium },
  headRow: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.xs },
  head: { ...type.label, color: colors.muted },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  border: { borderTopWidth: 1, borderTopColor: colors.border },
  name: { color: colors.text, fontSize: 15, fontFamily: font.bold },
  track: { height: 4, borderRadius: 2, backgroundColor: colors.surfaceHi, overflow: 'hidden', marginTop: 5, marginBottom: 4 },
  fill: { height: 4, borderRadius: 2 },
  sub: { color: colors.faint, fontSize: 12, fontFamily: font.regular },
  count: { minWidth: 44, alignItems: 'center', paddingVertical: 4, paddingHorizontal: 6, borderRadius: radius.sm },
  countValue: { color: colors.text, fontSize: 18, lineHeight: 20, fontFamily: font.posterBlack, ...type.num },
  countLabel: { color: colors.muted, fontSize: 9, fontFamily: font.bold, textTransform: 'uppercase', letterSpacing: 0.5 },
  more: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, minHeight: 44 },
  moreText: { color: colors.muted, fontSize: 13, fontFamily: font.bold },
});
