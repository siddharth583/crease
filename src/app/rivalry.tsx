import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PlayerAvatar } from '../components/Avatar.tsx';
import { FaceOff } from '../components/FaceOff.tsx';
import { BallChip, Card, FadeIn, IconButton, PressableScale, Screen, SectionLabel, WideHead } from '../components/ui.tsx';
import { CountUp, Rise, Sheen, Tug } from '../components/motion.tsx';
import { OvalGround, SeamDivider } from '../components/cricket.tsx';
import { GrowStack, Tile } from '../components/HonoursBoard.tsx';
import { VsCoin } from '../components/FaceOff.tsx';
import { LinearGradient } from 'expo-linear-gradient';
import { Columns, Page, useLayout } from '../components/layout.tsx';
import { matchups, rivalry, rivalryContext, verdict } from '../engine/records.ts';
import type { WicketKind } from '../engine/types.ts';
import { useMatches } from '../store/matches.tsx';
import { useSquad } from '../store/squad.ts';
import { plural } from '../engine/text.ts';
import { colors, font, gradients, hero, radius, space, type } from '../theme.ts';

const day = (ms: number) => new Date(ms).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
const HOW: Record<WicketKind, string> = {
  bowled: 'Bowled',
  caught: 'Caught',
  lbw: 'LBW',
  runout: 'Run out',
  stumped: 'Stumped',
  hitwicket: 'Hit wicket',
  retired: 'Retired hurt',
  retiredout: 'Retired out',
};

function Stat({ label, value, sub, tone, wide }: { label: string; value: string; sub?: string; tone?: string; wide?: boolean }) {
  return (
    <View style={[styles.stat, wide && styles.statWide]}>
      <View>
        <Text style={styles.statLabel}>{label}</Text>
        <Text style={[styles.statValue, tone ? { color: tone } : null]}>{value}</Text>
      </View>
      {sub ? <Text style={[styles.statSub, wide && { flex: 1, fontSize: 12 }]}>{sub}</Text> : null}
    </View>
  );
}

/** A meeting's balls grouped by over: "Over 4  [chips]  7 runs". */
function overs(balls: { over: string; view: import('../engine/engine.ts').BallView; runs: number; out: boolean }[]) {
  const groups: { n: string; balls: typeof balls }[] = [];
  for (const b of balls) {
    const n = String((parseInt(b.over.split('.')[0] ?? '0', 10) || 0) + 1);
    const g = groups[groups.length - 1];
    if (g && g.n === n) g.balls.push(b);
    else groups.push({ n, balls: [b] });
  }
  return groups;
}

export default function RivalryScreen() {
  const insets = useSafeAreaInsets();
  const { bat, bowl } = useLocalSearchParams<{ bat: string; bowl: string }>();
  const { matches } = useMatches();
  const { squad } = useSquad();
  const r = useMemo(() => (bat && bowl ? rivalry(matches, bat, bowl) : null), [matches, bat, bowl, squad]);
  const ctx = useMemo(() => rivalryContext(matchups(matches)), [matches, squad]);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/records'));
  const layout = useLayout();
  const { wide } = layout;

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

  const v = verdict(r, ctx);
  const sr = r.balls ? (r.runs * 100) / r.balls : 0;
  const avg = r.outs ? (r.runs / r.outs).toFixed(1) : '∞';
  const perOut = r.outs ? (r.balls / r.outs).toFixed(1) : '–';
  // On the dark panel: the night violet, readable in either theme.
  const tone = v.side === 'batter' ? hero.accent : v.side === 'bowler' ? hero.violet : hero.text;
  const parts = [
    { k: 'Dots', n: r.dots, c: colors.faint },
    { k: '1s, 2s, 3s', n: r.singles, c: colors.cyan },
    { k: 'Fours', n: r.fours, c: colors.accentInk },
    { k: 'Sixes', n: r.sixes, c: colors.accent },
    { k: 'Out', n: r.outs, c: colors.danger },
  ].filter((p) => p.n > 0);
  const first = (n: string) => n.split(' ')[0];

  return (
    <Screen>
      {wide ? (
        <View style={{ paddingHorizontal: layout.gutter, paddingTop: space.lg }}>
          <Page>
            <WideHead title={`${first(r.batter)} v ${first(r.bowler)}`} sub={`Every ball ${first(r.bowler)} has bowled to ${first(r.batter)}`} onBack={back} />
          </Page>
        </View>
      ) : (
        <View style={styles.header}>
          <IconButton icon="chevron-back" label="Back" onPress={back} />
          <Text style={styles.headerTitle}>Rivalry</Text>
          <View style={{ width: 42 }} />
        </View>
      )}
      <ScrollView contentContainerStyle={{ padding: wide ? layout.gutter : space.lg, paddingTop: wide ? 0 : space.sm, paddingBottom: insets.bottom + space.xxl }}>
        <Page>
          {/* A tablet or laptop: the duel and its numbers on the left, every ball and every meeting on the right. */}
          <Columns weights={[1, 1]} gap={wide ? space.lg : 0}>
            <View>
              {wide && <SectionLabel flush>The duel</SectionLabel>}
              <FadeIn>
                <View style={styles.hero}>
                  <LinearGradient pointerEvents="none" colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
                  <OvalGround opacity={0.07} />
                  <Sheen />
                  <View style={styles.faceRow}>
                    <PressableScale scaleTo={0.97} onPress={() => router.push({ pathname: '/player/[key]', params: { key: r.batterKey } })} wrapStyle={{ flex: 1, minWidth: 0 }} style={styles.who} accessibilityLabel={`${r.batter}, the batter`}>
                      <PlayerAvatar name={r.batter} size={76} />
                      <Text style={styles.heroRole}>Bats</Text>
                      <Text style={[styles.heroName, { color: hero.accent }]} numberOfLines={3}>
                        {r.batter}
                      </Text>
                    </PressableScale>
                    <View style={{ paddingTop: 26 }}>
                      <VsCoin size={40} />
                    </View>
                    <PressableScale scaleTo={0.97} onPress={() => router.push({ pathname: '/player/[key]', params: { key: r.bowlerKey } })} wrapStyle={{ flex: 1, minWidth: 0 }} style={styles.who} accessibilityLabel={`${r.bowler}, the bowler`}>
                      <PlayerAvatar name={r.bowler} size={76} />
                      <Text style={styles.heroRole}>Bowls</Text>
                      <Text style={[styles.heroName, { color: hero.violet }]} numberOfLines={3}>
                        {r.bowler}
                      </Text>
                    </PressableScale>
                  </View>
                  <View style={styles.tugWrap}>
                    <Text style={[styles.tugEnd, { color: hero.accent }]}>BAT</Text>
                    <View style={styles.tug}>
                      <Tug edge={v.edge} style={StyleSheet.absoluteFill} leftStyle={styles.tugBat} rightStyle={styles.tugBowl} delay={300} />
                    </View>
                    <Text style={[styles.tugEnd, { color: hero.violet }]}>BALL</Text>
                  </View>
                  <Text style={[styles.verdictTitle, { color: tone }]}>{v.title}</Text>
                  <Text style={styles.verdictLine}>{v.line}</Text>
                  <SeamDivider color={hero.ink(0.18)} style={{ marginVertical: space.md }} />
                  <View style={styles.tiles}>
                    <Tile value={r.balls} label="Balls" color={hero.text} delay={200} />
                    <Tile value={r.runs} label="Runs" color={hero.text} delay={260} />
                    <Tile value={r.outs} label="Outs" color={r.outs ? colors.danger : hero.text} delay={320} />
                    <Tile value={r.dots} label="Dots" color={hero.text} delay={380} />
                  </View>
                  <View style={[styles.tiles, { marginTop: space.md }]}>
                    <Tile value={r.fours} label="Fours" color={hero.cyan} delay={440} />
                    <Tile value={r.sixes} label="Sixes" color={hero.accent} delay={500} />
                    <Tile value={Math.round(sr)} label="Strike rate" color={hero.gold} delay={560} />
                    <View style={{ flex: 1 }} />
                  </View>
                  <Text style={styles.met}>
                    Met in {r.matches} match{r.matches === 1 ? '' : 'es'}
                  </Text>
                </View>
              </FadeIn>

              <View style={styles.grid}>
                <Stat label="Dismissals" value={String(r.outs)} sub={r.outs ? `one every ${perOut} balls` : 'never out'} tone={r.outs ? colors.danger : undefined} />
                <Stat label="Average" value={avg} sub="runs a dismissal" />
                <Stat label="Dot balls" value={`${Math.round((r.dots / Math.max(1, r.balls)) * 100)}%`} sub={`${r.dots} of ${r.balls}`} />
                <Stat label="Boundaries" value={String(r.fours + r.sixes)} sub={`${plural(r.fours, 'four')} · ${plural(r.sixes, 'six', 'sixes')}`} />
              </View>
              {(v.batterUsual || v.bowlerUsual) && (
                <View style={{ gap: space.sm, marginTop: space.sm }}>
                  {v.batterUsual && (
                    <Stat
                      wide
                      label={`${first(r.batter)} v others`}
                      value={v.batterUsual.sr.toFixed(0)}
                      sub={`strike rate off everyone else${v.batterUsual.perOut ? `, out every ${v.batterUsual.perOut.toFixed(0)} balls` : ''}. Here: ${sr.toFixed(0)}.`}
                    />
                  )}
                  {v.bowlerUsual && (
                    <Stat
                      wide
                      label={`${first(r.bowler)} v others`}
                      value={v.bowlerUsual.sr.toFixed(0)}
                      sub={`strike rate batters get off them${v.bowlerUsual.perOut ? `, a wicket every ${v.bowlerUsual.perOut.toFixed(0)} balls` : ''}. Here: ${sr.toFixed(0)}.`}
                    />
                  )}
                </View>
              )}
            </View>

            <View>
              <SectionLabel flush={wide}>Every ball, added up</SectionLabel>
              <Card style={{ gap: space.md }}>
                <GrowStack parts={parts} />
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
                  <SectionLabel>How {first(r.batter)} fell</SectionLabel>
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

              <SectionLabel>Meeting by meeting, ball by ball</SectionLabel>
              <View style={{ gap: space.sm }}>
                {r.meetings.map((m, mi) => (
                  <Rise key={m.matchId} index={mi} step={70}>
                    <PressableScale scaleTo={0.98} onPress={() => router.push({ pathname: '/match/[id]/scorecard', params: { id: m.matchId } })} style={styles.meeting} accessibilityLabel={`${m.title}, ${day(m.date)}: ${m.runs} off ${m.faced}`}>
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
                      <SeamDivider />
                      {overs(m.balls).map((g) => (
                        <View key={g.n} style={styles.overLine}>
                          <Text style={styles.overLabel}>Ov {g.n}</Text>
                          <View style={[styles.chips, { flex: 1 }]}>
                            {g.balls.map((b, j) => (
                              <BallChip key={j} ball={b.view} size={28} animate />
                            ))}
                          </View>
                          <Text style={styles.overRuns}>{g.balls.reduce((n, b) => n + b.runs, 0)}</Text>
                        </View>
                      ))}
                    </PressableScale>
                  </Rise>
                ))}
              </View>

              {r.reverse && (
                <>
                  <SectionLabel>The other way round</SectionLabel>
                  <FaceOff m={r.reverse} ctx={ctx} />
                </>
              )}
            </View>
          </Columns>
        </Page>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingVertical: space.sm },
  headerTitle: { color: colors.text, fontSize: 20, fontFamily: font.poster },
  lead: { color: colors.muted, fontSize: 15, fontFamily: font.medium },
  hero: { borderRadius: radius.xl, padding: space.lg, overflow: 'hidden', gap: 2, borderWidth: 1, borderColor: hero.line },
  faceRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  who: { alignItems: 'center', gap: 2 },
  heroRole: { ...type.label, fontSize: 9, color: hero.muted, marginTop: 6 },
  heroName: { fontFamily: font.posterBlack, fontSize: 22, lineHeight: 25, textAlign: 'center' },
  tugWrap: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.lg },
  tugEnd: { fontSize: 10, fontFamily: font.heavy, letterSpacing: 1 },
  tug: { flex: 1, flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', backgroundColor: hero.ink(0.1) },
  tugBat: { backgroundColor: colors.accent, borderRadius: 5 },
  tugBowl: { backgroundColor: hero.violet, borderRadius: 5 },
  verdictTitle: { fontFamily: font.posterBlack, fontSize: 26, lineHeight: 29, marginTop: space.lg, textAlign: 'center' },
  verdictLine: { color: hero.text, fontSize: 14, fontFamily: font.medium, lineHeight: 20, textAlign: 'center' },
  tiles: { flexDirection: 'row', gap: space.sm },
  met: { color: hero.muted, fontSize: 12, fontFamily: font.medium, marginTop: space.md, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md },
  stat: {
    width: '47%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: space.md,
  },
  statWide: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: space.md },
  statLabel: { ...type.label, fontSize: 9, color: colors.muted },
  statValue: { fontFamily: font.posterBlack, fontSize: 25, lineHeight: 28, color: colors.text, ...type.num },
  statSub: { color: colors.faint, fontSize: 11, fontFamily: font.medium },
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
  overLine: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  overLabel: { width: 38, color: colors.faint, fontSize: 11, fontFamily: font.bold },
  overRuns: { width: 24, textAlign: 'right', color: colors.muted, fontSize: 14, fontFamily: font.posterBlack, ...type.num },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
});
