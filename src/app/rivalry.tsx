import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BallChip, Card, FadeIn, IconButton, PitchStripes, PressableScale, Screen, SectionLabel, WideHead } from '../components/ui.tsx';
import { Rise, useReducedMotion } from '../components/motion.tsx';
import { Jersey, SeamDivider } from '../components/cricket.tsx';
import { PlayerPhoto } from '../components/MomAward.tsx';
import { crestOf } from '../components/TeamCrest.tsx';
import { photoFor } from '../engine/photos.ts';
import { careerStats, displayName } from '../engine/stats.ts';
import { usePhotos } from '../store/sync.tsx';
import { GrowStack } from '../components/HonoursBoard.tsx';
import { VsCoin } from '../components/FaceOff.tsx';
import { LinearGradient } from 'expo-linear-gradient';
import { Columns, Page, useLayout } from '../components/layout.tsx';
import { matchups, rivalry, rivalryContext, verdict } from '../engine/records.ts';
import type { WicketKind } from '../engine/types.ts';
import { useMatches } from '../store/matches.tsx';
import { useSquad } from '../store/squad.ts';
import { plural } from '../engine/text.ts';
import { colors, font, gradients, hero, radius, space, type, glass } from '../theme.ts';

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

/** A player as an open cut-out standing on the grass (their kit with initials until a photo is added), a soft
 * glow of their side's colour at their feet. */
function Cutout({ name, team, glow }: { name: string; team?: string; glow: string }) {
  const photo = photoFor(usePhotos(), name);
  const initials = displayName(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0]!.toUpperCase())
    .join('');
  const kit = crestOf(team ?? '');
  return (
    <View style={styles.cutout}>
      <View style={[styles.cutoutGlow, { boxShadow: `0px 0px 30px 14px ${glow}` } as object]} />
      <View style={styles.cutoutShadow} />
      {photo ? (
        <PlayerPhoto uri={photo} />
      ) : (
        <View style={styles.cutoutKit}>
          <Jersey size={118} from={kit.from} to={kit.to} initials={initials} id={`rv${initials}${name.length}`} />
        </View>
      )}
    </View>
  );
}

/** One side's usual strike rate (against everyone else) and how far this duel is from it: green when the gap is good
 * for the person the row is about, red when it isn't. */
function Compare({ icon, who, note, here, usual, goodWhenUp }: { icon: 'cricket' | 'baseball'; who: string; note: string; here: number; usual: number; goodWhenUp: boolean }) {
  const gap = Math.round(here - usual);
  const good = gap === 0 ? null : (gap > 0) === goodWhenUp;
  const tint = good === null ? colors.muted : good ? colors.accentInk : colors.danger;
  return (
    <View style={[styles.cmp, styles.divided]} accessibilityLabel={`${who}: strike rate ${Math.round(usual)}. ${note}. In this duel ${Math.round(here)}, ${Math.abs(gap)} ${gap >= 0 ? 'higher' : 'lower'}.`}>
      <View style={styles.cmpIcon}>
        <MaterialCommunityIcons name={icon} size={16} color={colors.muted} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.cmpWho} numberOfLines={1}>
          {who}
        </Text>
        <Text style={styles.numSub} numberOfLines={1}>
          {note}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 3 }}>
        <Text style={styles.cmpUsual}>{Math.round(usual)}</Text>
        <View style={[styles.cmpGap, { backgroundColor: good === null ? colors.surfaceHi : good ? colors.accentDim : colors.dangerDim }]}>
          <Ionicons name={gap > 0 ? 'arrow-up' : gap < 0 ? 'arrow-down' : 'remove'} size={10} color={tint} />
          <Text style={[styles.cmpGapText, { color: tint }]}>{Math.abs(gap)} here</Text>
        </View>
      </View>
    </View>
  );
}

/**
 * The VS coin that flips the duel. So people learn it's a button, it turns over to show the swap arrows twice when
 * the page opens (held a moment each time), then settles back on VS. A tap spins it and flips the duel.
 */
function FlipCoin({ size, label, onPress }: { size: number; label: string; onPress: () => void }) {
  const still = useReducedMotion();
  const turn = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (still) return;
    const over = (to: number) => Animated.timing(turn, { toValue: to, duration: 420, easing: Easing.inOut(Easing.cubic), useNativeDriver: Platform.OS !== 'web' });
    const show = Animated.sequence([over(1), Animated.delay(1100), over(0)]);
    const hint = Animated.sequence([Animated.delay(800), show, Animated.delay(1400), show]);
    hint.start();
    return () => hint.stop();
  }, [still, turn]);
  const press = () => {
    if (!still) {
      turn.stopAnimation();
      turn.setValue(0);
      Animated.timing(turn, { toValue: 2, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }).start(() => turn.setValue(0));
    }
    onPress();
  };
  const front = turn.interpolate({ inputRange: [0, 1, 2], outputRange: ['0deg', '180deg', '360deg'] });
  const back = turn.interpolate({ inputRange: [0, 1, 2], outputRange: ['180deg', '360deg', '540deg'] });
  const face = { position: 'absolute' as const, top: 0, left: 0, width: size, height: size, backfaceVisibility: 'hidden' as const };
  return (
    <PressableScale scaleTo={0.88} hitSlop={10} onPress={press} accessibilityLabel={label} style={{ width: size, height: size }}>
      <Animated.View style={[face, { transform: [{ perspective: 400 }, { rotateY: front }] }]}>
        <VsCoin size={size} />
      </Animated.View>
      <Animated.View style={[face, styles.flipFace, { borderRadius: size / 2, transform: [{ perspective: 400 }, { rotateY: back }] }]}>
        <Ionicons name="swap-horizontal" size={size * 0.5} color={colors.onAccent} />
      </Animated.View>
    </PressableScale>
  );
}

export default function RivalryScreen() {
  const insets = useSafeAreaInsets();
  const { bat, bowl } = useLocalSearchParams<{ bat: string; bowl: string }>();
  const { matches } = useMatches();
  const { squad } = useSquad();
  const r = useMemo(() => (bat && bowl ? rivalry(matches, bat, bowl) : null), [matches, bat, bowl, squad]);
  const ctx = useMemo(() => rivalryContext(matchups(matches)), [matches, squad]);
  const teamOf = useMemo(() => new Map(careerStats(matches).map((c) => [c.key, c.team])), [matches, squad]);
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
                  <PitchStripes tint="255,255,255" />
                  <View style={styles.faceRow}>
                    <PressableScale scaleTo={0.97} onPress={() => router.push({ pathname: '/player/[key]', params: { key: r.batterKey } })} wrapStyle={{ flex: 1, minWidth: 0 }} style={styles.who} accessibilityLabel={`${r.batter}, the batter`}>
                      <Cutout name={r.batter} team={teamOf.get(r.batterKey)} glow="rgba(215,255,58,0.28)" />
                      <Text style={[styles.heroRole, { color: hero.accent }]}>Bat</Text>
                      <Text style={styles.heroName} numberOfLines={2}>
                        {r.batter}
                      </Text>
                    </PressableScale>
                    <View style={styles.vsCol}>
                      {r.reverse ? (
                        <FlipCoin key={`${r.batterKey}>${r.bowlerKey}`} size={40} label={`Flip it: ${first(r.bowler)} batting to ${first(r.batter)}`} onPress={() => router.setParams({ bat: r.bowlerKey, bowl: r.batterKey })} />
                      ) : (
                        <VsCoin size={40} />
                      )}
                    </View>
                    <PressableScale scaleTo={0.97} onPress={() => router.push({ pathname: '/player/[key]', params: { key: r.bowlerKey } })} wrapStyle={{ flex: 1, minWidth: 0 }} style={styles.who} accessibilityLabel={`${r.bowler}, the bowler`}>
                      <Cutout name={r.bowler} team={teamOf.get(r.bowlerKey)} glow="rgba(168,150,255,0.3)" />
                      <Text style={[styles.heroRole, { color: hero.violet }]}>Ball</Text>
                      <Text style={styles.heroName} numberOfLines={2}>
                        {r.bowler}
                      </Text>
                    </PressableScale>
                  </View>
                  <View style={[styles.verdict, { borderColor: tone }]}>
                    <Ionicons name={v.side === 'batter' ? 'trending-up' : v.side === 'bowler' ? 'flash' : 'git-compare-outline'} size={14} color={tone} />
                    <Text style={[styles.verdictTitle, { color: tone }]}>{v.title}</Text>
                  </View>
                  <Text style={styles.verdictLine}>{v.line}</Text>
                  <View style={styles.board}>
                    <View style={styles.boardMain} accessibilityLabel={`${r.runs} runs for ${r.outs} dismissals off ${r.balls} balls`}>
                      <Text style={styles.boardScore}>
                        {r.runs}
                        <Text style={styles.boardSlash}>/</Text>
                        <Text style={{ color: r.outs ? colors.danger : hero.text }}>{r.outs}</Text>
                      </Text>
                      <Text style={styles.boardKey}>
                        Runs / outs · off {r.balls} balls
                      </Text>
                    </View>
                    <View style={styles.boardSide}>
                      <Text style={styles.boardRate}>{Math.round(sr)}</Text>
                      <Text style={styles.boardKey}>Strike rate</Text>
                    </View>
                  </View>
                  <View style={styles.panels}>
                    {[
                      { k: 'Fours', n: r.fours, c: hero.cyan },
                      { k: 'Sixes', n: r.sixes, c: hero.accent },
                      { k: 'Dots', n: r.dots, c: hero.text },
                    ].map((t) => (
                      <View key={t.k} style={styles.panel}>
                        <Text style={[styles.panelValue, { color: t.c }]}>{t.n}</Text>
                        <Text style={styles.boardKey}>{t.k}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={styles.met}>
                    <Ionicons name="calendar-outline" size={12} color={hero.muted} />
                    <Text style={styles.metText}>
                      Met in {r.matches} match{r.matches === 1 ? '' : 'es'}
                    </Text>
                  </View>
                </View>
              </FadeIn>

              <Card style={styles.numbers}>
                {[
                  [
                    { k: 'Dismissals', v: String(r.outs), sub: r.outs ? `One every ${Number(perOut).toFixed(0)} balls` : 'Never out', c: r.outs ? colors.danger : colors.text, icon: 'close-circle' as const, bg: colors.dangerDim, ic: colors.danger },
                    { k: 'Average', v: avg, sub: 'Runs a dismissal', c: colors.text, icon: 'calculator' as const, bg: colors.goldDim, ic: colors.gold },
                  ],
                  [
                    { k: 'Dot balls', v: `${Math.round((r.dots / Math.max(1, r.balls)) * 100)}%`, sub: `${r.dots} of ${r.balls} balls`, c: colors.text, icon: 'ellipse' as const, bg: colors.surfaceHi, ic: colors.muted },
                    { k: 'Boundaries', v: String(r.fours + r.sixes), sub: `${plural(r.fours, 'four')} · ${plural(r.sixes, 'six', 'sixes')}`, c: colors.text, icon: 'flash' as const, bg: colors.accentDim, ic: colors.accentInk },
                  ],
                ].map((row, ri) => (
                  <View key={ri} style={[styles.numRow, ri > 0 && styles.numRowRule]}>
                    {row.map((n, ci) => (
                      <View key={n.k} style={[styles.num, ci > 0 && styles.numRule]}>
                        <View style={styles.numHead}>
                          <View style={[styles.numIcon, { backgroundColor: n.bg }]}>
                            <Ionicons name={n.icon} size={13} color={n.ic} />
                          </View>
                          <Text style={styles.numKey}>{n.k}</Text>
                        </View>
                        <Text style={[styles.numValue, { color: n.c }]}>{n.v}</Text>
                        <Text style={styles.numSub}>{n.sub}</Text>
                      </View>
                    ))}
                  </View>
                ))}
              </Card>
              {(v.batterUsual || v.bowlerUsual) && (
                <>
                  <SectionLabel>Against everyone else</SectionLabel>
                  <Card style={{ padding: 0 }}>
                    <View style={styles.cmpHead}>
                      <View>
                        <Text style={styles.numKey}>Strike rate in this duel</Text>
                        <Text style={styles.cmpHere}>{Math.round(sr)}</Text>
                      </View>
                      <Text style={styles.cmpHeadSub}>{r.outs ? `Out every ${Number(perOut).toFixed(0)} balls` : 'Never out'}</Text>
                    </View>
                    {v.batterUsual && (
                      <Compare
                        icon="cricket"
                        who={`${first(r.batter)} against others`}
                        note={v.batterUsual.perOut ? `Out every ${v.batterUsual.perOut.toFixed(0)} balls` : 'Never out'}
                        usual={v.batterUsual.sr}
                        here={sr}
                        goodWhenUp
                      />
                    )}
                    {v.bowlerUsual && (
                      <Compare
                        icon="baseball"
                        who={`Batters against ${first(r.bowler)}`}
                        note={v.bowlerUsual.perOut ? `A wicket every ${v.bowlerUsual.perOut.toFixed(0)} balls` : 'No wickets yet'}
                        usual={v.bowlerUsual.sr}
                        here={sr}
                        goodWhenUp={false}
                      />
                    )}
                  </Card>
                </>
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
  flipFace: { alignItems: 'center', justifyContent: 'center', backgroundColor: hero.gold },
  vsCol: { alignItems: 'center', paddingTop: 64 },
  cutout: { width: '100%', maxWidth: 150, height: 150, alignItems: 'center', justifyContent: 'flex-end' },
  cutoutGlow: { position: 'absolute', bottom: 8, width: '40%', height: 2, borderRadius: 99 },
  cutoutShadow: { position: 'absolute', bottom: 2, width: '50%', height: 6, borderRadius: 99, backgroundColor: 'rgba(0,0,0,0.35)', boxShadow: '0px 0px 14px 6px rgba(0,0,0,0.35)' } as object,
  cutoutKit: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 4, alignItems: 'center', justifyContent: 'flex-end' },
  heroRole: { ...type.label, fontSize: 10, letterSpacing: 1.4, marginTop: 10 },
  heroName: { fontFamily: font.posterBlack, fontSize: 19, lineHeight: 22, textAlign: 'center', color: hero.text },
  verdict: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space.lg, paddingHorizontal: 14, height: 34, borderRadius: radius.pill, borderWidth: 1, backgroundColor: hero.ink(0.06) },
  verdictTitle: { fontFamily: font.posterBlack, fontSize: 17, lineHeight: 21 },
  verdictLine: { color: hero.muted, fontSize: 13, fontFamily: font.medium, lineHeight: 19, textAlign: 'center', marginTop: space.sm, paddingHorizontal: space.sm },
  board: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: space.md, marginTop: space.lg, padding: space.md, borderRadius: radius.lg, ...glass },
  boardMain: { flexShrink: 1 },
  boardScore: { fontFamily: font.posterBlack, fontSize: 52, lineHeight: 56, color: hero.text, letterSpacing: -1, ...type.num },
  boardSlash: { color: hero.faint },
  boardKey: { ...type.label, fontSize: 9, color: hero.muted },
  boardSide: { alignItems: 'flex-end', paddingBottom: 2 },
  boardRate: { fontFamily: font.posterBlack, fontSize: 30, lineHeight: 34, color: hero.gold, ...type.num },
  panels: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  panel: { flex: 1, paddingVertical: space.md, paddingHorizontal: space.md, borderRadius: radius.md, ...glass },
  panelValue: { fontFamily: font.posterBlack, fontSize: 26, lineHeight: 30, ...type.num },
  met: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: space.md },
  metText: { color: hero.muted, fontSize: 12, fontFamily: font.medium },
  numbers: { padding: 0, marginTop: space.md },
  numRow: { flexDirection: 'row' },
  numRowRule: { borderTopWidth: 1, borderTopColor: colors.border },
  num: { flex: 1, padding: space.md, gap: 4 },
  numRule: { borderLeftWidth: 1, borderLeftColor: colors.border },
  numHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  numIcon: { width: 22, height: 22, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  numKey: { ...type.label, fontSize: 9, color: colors.muted },
  numValue: { fontFamily: font.posterBlack, fontSize: 30, lineHeight: 34, marginTop: 2, ...type.num },
  numSub: { color: colors.faint, fontSize: 12, fontFamily: font.medium },
  cmpHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: space.md, padding: space.md },
  cmpHere: { fontFamily: font.posterBlack, fontSize: 36, lineHeight: 40, color: colors.text, ...type.num },
  cmpHeadSub: { color: colors.muted, fontSize: 12, fontFamily: font.medium, paddingBottom: 6 },
  cmp: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md, paddingVertical: 12 },
  cmpIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceHi },
  cmpWho: { color: colors.text, fontSize: 14, fontFamily: font.bold },
  cmpUsual: { fontFamily: font.posterBlack, fontSize: 22, lineHeight: 24, color: colors.text, ...type.num },
  cmpGap: { flexDirection: 'row', alignItems: 'center', gap: 2, height: 20, paddingHorizontal: 7, borderRadius: radius.pill },
  cmpGapText: { fontSize: 11, fontFamily: font.heavy, ...type.num },
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
