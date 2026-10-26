import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FaceOff } from '../components/FaceOff.tsx';
import { BallChip, Card, FadeIn, GhostWord, IconButton, PitchStripes, PressableScale, Screen, SectionLabel } from '../components/ui.tsx';
import { Tug } from '../components/motion.tsx';
import { rivalry, verdict } from '../engine/records.ts';
import type { WicketKind } from '../engine/types.ts';
import { useMatches } from '../store/matches.tsx';
import { useSquad } from '../store/squad.ts';
import { plural } from '../engine/text.ts';
import { colors, font, hero, radius, space, type, HERO_BG } from '../theme.ts';

const day = (ms: number) => new Date(ms).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
const HOW: Record<WicketKind, string> = {
  bowled: 'Bowled',
  caught: 'Caught',
  lbw: 'LBW',
  runout: 'Run out',
  stumped: 'Stumped',
  hitwicket: 'Hit wicket',
  retired: 'Retired',
};

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, tone ? { color: tone } : null]}>{value}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </View>
  );
}

export default function RivalryScreen() {
  const insets = useSafeAreaInsets();
  const { bat, bowl } = useLocalSearchParams<{ bat: string; bowl: string }>();
  const { matches } = useMatches();
  const { squad } = useSquad();
  const r = useMemo(() => (bat && bowl ? rivalry(matches, bat, bowl) : null), [matches, bat, bowl, squad]);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/records'));

  if (!r) {
    return (
      <Screen>
        <View style={styles.header}>
          <IconButton icon="chevron-back" label="Back" onPress={back} />
        </View>
        <Text style={[styles.lead, { padding: space.lg }]}>These two haven’t met yet.</Text>
      </Screen>
    );
  }

  const v = verdict(r);
  const sr = r.balls ? (r.runs * 100) / r.balls : 0;
  const avg = r.outs ? (r.runs / r.outs).toFixed(1) : '∞';
  const perOut = r.outs ? (r.balls / r.outs).toFixed(1) : '–';
  const tone = v.side === 'batter' ? hero.accent : v.side === 'bowler' ? colors.violet : hero.text;
  const parts = [
    { k: 'Dots', n: r.dots, c: colors.faint },
    { k: '1s, 2s, 3s', n: r.singles, c: colors.cyan },
    { k: 'Fours', n: r.fours, c: colors.accentInk },
    { k: 'Sixes', n: r.sixes, c: colors.accent },
    { k: 'Out', n: r.outs, c: colors.danger },
  ].filter((p) => p.n > 0);
  const total = parts.reduce((n, p) => n + p.n, 0) || 1;

  return (
    <Screen>
      <View style={styles.header}>
        <IconButton icon="chevron-back" label="Back" onPress={back} />
        <Text style={styles.headerTitle}>Rivalry</Text>
        <View style={{ width: 42 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: space.sm, paddingBottom: insets.bottom + space.xxl }}>
        <FadeIn>
          <View style={styles.hero}>
            <PitchStripes opacity={0.06} tint="255,255,255" />
            <GhostWord size={140} style={{ color: hero.ink(0.04) }}>
              VS
            </GhostWord>
            <PressableScale scaleTo={0.98} onPress={() => router.push({ pathname: '/player/[key]', params: { key: r.batterKey } })}>
              <Text style={styles.heroRole}>Bats</Text>
              <Text style={[styles.heroName, { color: hero.accent }]} numberOfLines={1}>
                {r.batter}
              </Text>
            </PressableScale>
            <Text style={styles.heroVs}>versus</Text>
            <PressableScale scaleTo={0.98} onPress={() => router.push({ pathname: '/player/[key]', params: { key: r.bowlerKey } })} style={{ alignItems: 'flex-end' }}>
              <Text style={styles.heroRole}>Bowls</Text>
              <Text style={[styles.heroName, { color: colors.violet }]} numberOfLines={1}>
                {r.bowler}
              </Text>
            </PressableScale>
            <View style={styles.tugWrap}>
              <Text style={[styles.tugEnd, { color: hero.accent }]}>BAT</Text>
              <View style={styles.tug}>
                <Tug edge={v.edge} style={StyleSheet.absoluteFill} leftStyle={styles.tugBat} rightStyle={styles.tugBowl} delay={300} />
              </View>
              <Text style={[styles.tugEnd, { color: colors.violet }]}>BALL</Text>
            </View>
            <Text style={[styles.verdictTitle, { color: tone }]}>{v.title}</Text>
            <Text style={styles.verdictLine}>{v.line}</Text>
            <Text style={styles.met}>
              Met in {r.matches} match{r.matches === 1 ? '' : 'es'}
            </Text>
          </View>
        </FadeIn>

        <View style={styles.grid}>
          <Stat label="Runs" value={String(r.runs)} sub={`off ${plural(r.balls, 'ball')}`} />
          <Stat label="Strike rate" value={sr.toFixed(0)} sub="runs per 100 balls" tone={sr >= 130 ? colors.accentInk : undefined} />
          <Stat label="Dismissals" value={String(r.outs)} sub={r.outs ? `one every ${perOut} balls` : 'never out'} tone={r.outs ? colors.danger : undefined} />
          <Stat label="Average" value={avg} sub="runs a dismissal" />
          <Stat label="Dot balls" value={`${Math.round((r.dots / Math.max(1, r.balls)) * 100)}%`} sub={`${r.dots} of ${r.balls}`} />
          <Stat label="Boundaries" value={String(r.fours + r.sixes)} sub={`${plural(r.fours, 'four')} · ${plural(r.sixes, 'six', 'sixes')}`} />
        </View>

        <SectionLabel>Every ball, added up</SectionLabel>
        <Card style={{ gap: space.md }}>
          <View style={styles.stack}>
            {parts.map((p) => (
              <View key={p.k} style={{ flex: p.n / total, backgroundColor: p.c }} />
            ))}
          </View>
          <View style={styles.legend}>
            {parts.map((p) => (
              <View key={p.k} style={styles.legendItem}>
                <View style={[styles.swatch, { backgroundColor: p.c }]} />
                <Text style={styles.legendText}>
                  {p.k} <Text style={styles.legendStrong}>{p.n}</Text>
                </Text>
              </View>
            ))}
          </View>
          {r.noBalls > 0 && <Text style={styles.note}>Includes {r.noBalls} no-ball{r.noBalls === 1 ? '' : 's'}; wides aren’t counted as balls faced.</Text>}
        </Card>

        {r.dismissals.length > 0 && (
          <>
            <SectionLabel>How {r.batter.split(' ')[0]} fell</SectionLabel>
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              {r.dismissals.map((d, i) => (
                <PressableScale key={i} scaleTo={0.98} onPress={() => router.push({ pathname: '/match/[id]/scorecard', params: { id: d.matchId } })} style={[styles.out, i > 0 && styles.divided]}>
                  <View style={styles.outIcon}>
                    <Ionicons name="close" size={16} color="#FFFFFF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.outTitle}>
                      {HOW[d.kind]}
                      {d.fielder ? ` by ${d.fielder}` : ''}
                    </Text>
                    <Text style={styles.outSub}>
                      {day(d.date)} · ball {d.over}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.faint} />
                </PressableScale>
              ))}
            </Card>
          </>
        )}

        <SectionLabel>Meeting by meeting</SectionLabel>
        <View style={{ gap: space.sm }}>
          {r.meetings.map((m) => (
            <PressableScale key={m.matchId} scaleTo={0.98} onPress={() => router.push({ pathname: '/match/[id]/scorecard', params: { id: m.matchId } })} style={styles.meeting}>
              <View style={styles.meetingTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.meetingDate}>{day(m.date)}</Text>
                  <Text style={styles.meetingTitle} numberOfLines={1}>
                    {m.title}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.meetingScore}>
                    {m.runs}
                    <Text style={styles.meetingBalls}> ({m.faced})</Text>
                  </Text>
                  <Text style={[styles.meetingOut, m.out && { color: colors.danger }]}>{m.out ? HOW[m.out] : 'not out'}</Text>
                </View>
              </View>
              <View style={styles.chips}>
                {m.balls.map((b, j) => (
                  <BallChip key={j} ball={b.view} size={28} />
                ))}
              </View>
            </PressableScale>
          ))}
        </View>

        {r.reverse && (
          <>
            <SectionLabel>The other way round</SectionLabel>
            <FaceOff m={r.reverse} />
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingVertical: space.sm },
  headerTitle: { color: colors.text, fontSize: 20, fontFamily: font.poster },
  lead: { color: colors.muted, fontSize: 15, fontFamily: font.medium },
  hero: { backgroundColor: HERO_BG, borderRadius: radius.xl, padding: space.xl, overflow: 'hidden', gap: 2 },
  heroRole: { ...type.label, fontSize: 9, color: hero.muted },
  heroName: { fontFamily: font.posterBlack, fontSize: 31, lineHeight: 35 },
  heroVs: { fontFamily: font.poster, fontSize: 15, color: hero.faint, textAlign: 'center', marginVertical: 2 },
  tugWrap: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.lg },
  tugEnd: { fontSize: 10, fontFamily: font.heavy, letterSpacing: 1 },
  tug: { flex: 1, flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', gap: 2, backgroundColor: hero.ink(0.1) },
  tugBat: { backgroundColor: colors.accent, borderRadius: 5 },
  tugBowl: { backgroundColor: colors.violet, borderRadius: 5 },
  verdictTitle: { fontFamily: font.posterBlack, fontSize: 26, lineHeight: 29, marginTop: space.lg },
  verdictLine: { color: hero.text, fontSize: 14, fontFamily: font.medium, lineHeight: 20 },
  met: { color: hero.muted, fontSize: 12, fontFamily: font.medium, marginTop: space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md },
  stat: {
    width: '31.5%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: space.md,
  },
  statLabel: { ...type.label, fontSize: 9, color: colors.muted },
  statValue: { fontFamily: font.posterBlack, fontSize: 25, lineHeight: 28, color: colors.text, ...type.num },
  statSub: { color: colors.faint, fontSize: 11, fontFamily: font.medium },
  stack: { flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden', gap: 2 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  legendText: { color: colors.muted, fontSize: 12, fontFamily: font.medium },
  legendStrong: { color: colors.text, fontFamily: font.heavy },
  note: { color: colors.faint, fontSize: 12, fontFamily: font.regular },
  out: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
  divided: { borderTopWidth: 1, borderTopColor: colors.border },
  outIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
  outTitle: { color: colors.text, fontSize: 15, fontFamily: font.bold },
  outSub: { color: colors.muted, fontSize: 12, fontFamily: font.medium },
  meeting: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: space.md, gap: space.sm },
  meetingTop: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  meetingDate: { ...type.label, fontSize: 9, color: colors.muted },
  meetingTitle: { color: colors.text, fontSize: 15, fontFamily: font.bold, marginTop: 2 },
  meetingScore: { fontFamily: font.posterBlack, fontSize: 21, lineHeight: 24, color: colors.text, ...type.num },
  meetingBalls: { fontFamily: font.poster, fontSize: 14, color: colors.faint },
  meetingOut: { color: colors.muted, fontSize: 11, fontFamily: font.bold, textTransform: 'uppercase' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
});
