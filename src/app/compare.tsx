import { PlayerPhoto } from '../components/MomAward.tsx';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PlayerAvatar } from '../components/Avatar.tsx';
import { Card, FadeIn, IconButton, PressableScale, Screen, SectionLabel, WideHead } from '../components/ui.tsx';
import { OvalGround, SeamDivider } from '../components/cricket.tsx';
import { CountUp, GrowBar, Rise, Sheen } from '../components/motion.tsx';
import { TeamCrest } from '../components/TeamCrest.tsx';
import { photoFor } from '../engine/photos.ts';
import { usePhotos } from '../store/sync.tsx';
import { LinearGradient } from 'expo-linear-gradient';
import { Columns, Page, useLayout } from '../components/layout.tsx';
import { COMMON_TEAM, displayName, battingAverage, bestFigures, bowlingAverage, bowlingOvers, careerStats, economy, strikeRate, type Career } from '../engine/stats.ts';
import { useMatches } from '../store/matches.tsx';
import { useSquad } from '../store/squad.ts';
import { colors, edge, font, HERO_BG, hero, ink, radius, space, teamTheme, type, glass } from '../theme.ts';

// Two players side by side: their main numbers in one card, the better of each pair picked out. Opened from a
// player's page; the second player is picked here.

const fmt = (n: number | null, digits = 1) => (n === null ? '–' : n.toFixed(digits));

/** One line of the card: its label, each player's figure, and which is better (higher, or lower where less is better). */
type Line = { label: string; a: string; b: string; better: 'a' | 'b' | null; na: number; nb: number; unit?: string };
function line(label: string, a: number | null, b: number | null, show: (n: number | null) => string, lowerWins = false): Line {
  const better = a === null || b === null || a === b ? null : (a > b) !== lowerWins ? 'a' : 'b';
  return { label, a: show(a), b: show(b), better, na: a ?? 0, nb: b ?? 0 };
}
const whole = (n: number | null) => (n === null ? '–' : String(n));
const bestValue = (c: Career) => (c.bowling.best ? c.bowling.best.wickets * 1000 - c.bowling.best.runs : null);

function lines(a: Career, b: Career): { title: string; rows: Line[] }[] {
  return [
    { title: 'Overall', rows: [line('Matches', a.matches, b.matches, whole)] },
    {
      title: 'Batting',
      rows: [
        line('Runs', a.batting.runs, b.batting.runs, whole),
        line('Average', battingAverage(a), battingAverage(b), (n) => fmt(n)),
        line('Strike rate', strikeRate(a), strikeRate(b), (n) => fmt(n)),
        { ...line('Highest score', a.batting.highest, b.batting.highest, whole), a: `${a.batting.highest}${a.batting.highestNotOut ? '*' : ''}`, b: `${b.batting.highest}${b.batting.highestNotOut ? '*' : ''}` },
        line('50s', a.batting.fifties, b.batting.fifties, whole),
        line('Sixes', a.batting.sixes, b.batting.sixes, whole),
      ],
    },
    {
      title: 'Bowling',
      rows: [
        line('Wickets', a.bowling.wickets, b.bowling.wickets, whole),
        line('Economy', economy(a), economy(b), (n) => fmt(n, 2), true),
        line('Average', bowlingAverage(a), bowlingAverage(b), (n) => fmt(n), true),
        { ...line('Best figures', bestValue(a), bestValue(b), whole), a: bestFigures(a), b: bestFigures(b) },
        { ...line('Overs bowled', a.bowling.balls, b.bowling.balls, whole), a: bowlingOvers(a), b: bowlingOvers(b), better: null },
      ],
    },
    {
      title: 'Fielding',
      rows: [line('Catches', a.fielding.catches, b.fielding.catches, whole), line('Run outs', a.fielding.runOuts, b.fielding.runOuts, whole)],
    },
  ];
}

/** One side of the head-to-head: the player standing out of the panel as an open cut-out, their badge and name. */
function Face({ c, side, wide }: { c: Career; side: 'a' | 'b'; wide: boolean }) {
  const photo = photoFor(usePhotos(), c.name);
  const t = teamTheme(c.team);
  const right = side === 'b';
  const h = wide ? 230 : 170;
  return (
    <PressableScale scaleTo={0.97} wrapStyle={{ flex: 1 }} onPress={() => router.push({ pathname: '/player/[key]', params: { key: c.key } })} accessibilityLabel={`${c.name}, open profile`}>
      <View style={{ height: h, alignItems: right ? 'flex-end' : 'flex-start' }}>
        <LinearGradient pointerEvents="none" colors={[t.soft, 'transparent']} start={{ x: right ? 1 : 0, y: 0 }} end={{ x: right ? 0 : 1, y: 1 }} style={StyleSheet.absoluteFill} />
        {photo ? (
          <View pointerEvents="none" style={{ position: 'absolute', bottom: 0, [right ? 'right' : 'left']: 0, width: '90%', height: h }}>
            <PlayerPhoto uri={photo} />
          </View>
        ) : (
          <Text style={[styles.mono, { color: t.accent, fontSize: h * 0.5, lineHeight: h * 0.55 }]}>
            {displayName(c.name).split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('')}
          </Text>
        )}
        {c.team !== COMMON_TEAM && (
          <View style={{ position: 'absolute', top: 0, [right ? 'right' : 'left']: 0 }}>
            <TeamCrest name={c.team} size={wide ? 40 : 30} />
          </View>
        )}
      </View>
      <Text style={[styles.faceName, wide && styles.faceNameWide, right && { textAlign: 'right' }]} numberOfLines={2}>
        {c.name}
      </Text>
      <Text style={[styles.faceTeam, { color: t.ink }, right && { textAlign: 'right' }]} numberOfLines={1}>
        {c.team} · {c.matches} match{c.matches === 1 ? '' : 'es'}
      </Text>
    </PressableScale>
  );
}

/** Everyone but the first player, to pick the second: a search and the list, most matches first. */
function Picker({ careers, not, onPick }: { careers: Career[]; not: string; onPick: (key: string) => void }) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const list = careers
    .filter((c) => c.key !== not && (!q || c.name.toLowerCase().includes(q) || c.team.toLowerCase().includes(q)))
    .sort((x, y) => y.matches - x.matches || x.name.localeCompare(y.name));
  return (
    <View style={{ gap: space.sm }}>
      <View style={styles.search}>
        <Ionicons name="search" size={18} color={colors.faint} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search players"
          placeholderTextColor={colors.faint}
          style={styles.searchInput}
          autoCorrect={false}
          accessibilityLabel="Search players"
        />
      </View>
      {/* A tablet or laptop: the players as a grid to pick from. */}
      <Columns tablet={2} laptop={3} gap={space.sm}>
      {list.map((c) => (
        <PressableScale key={c.key} scaleTo={0.98} onPress={() => onPick(c.key)} style={styles.pick} accessibilityLabel={`Compare with ${c.name}`}>
          <PlayerAvatar name={c.name} size={36} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.pickName} numberOfLines={2}>
              {c.name}
            </Text>
            <Text style={styles.pickSub} numberOfLines={1}>
              {c.team} · {c.matches} match{c.matches === 1 ? '' : 'es'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.faint} />
        </PressableScale>
      ))}
      </Columns>
      {list.length === 0 && <Text style={styles.pickSub}>No one else matches that search.</Text>}
    </View>
  );
}

export default function Compare() {
  const insets = useSafeAreaInsets();
  const { a: aKey, b: bKey } = useLocalSearchParams<{ a: string; b?: string }>();
  const { matches } = useMatches();
  const { squad } = useSquad();
  const careers = useMemo(() => careerStats(matches), [matches, squad]);
  const [picked, setPicked] = useState<string | null>(bKey ?? null);
  const [picking, setPicking] = useState(!bKey);
  const a = careers.find((c) => c.key === aKey);
  const b = picked ? careers.find((c) => c.key === picked) : undefined;
  const back = () => (router.canGoBack() ? router.back() : router.replace('/players'));
  const layout = useLayout();
  const { wide } = layout;
  const groups = a && b ? lines(a, b) : [];
  // Side by side on a tablet or laptop: overall over batting beside bowling over fielding, the two columns the same
  // number of lines, so they end level.
  const table = (g: (typeof groups)[number], gi: number) => (
    <View key={g.title}>
      <SectionLabel>{g.title}</SectionLabel>
      <Card style={{ padding: 0 }}>
        {g.rows.map((r, i) => {
          // Bars grow outwards from the middle; the lower-is-better rows still show the raw size, the better figure is lit.
          const total = r.na + r.nb;
          const sa = total ? r.na / total : 0;
          const sb = total ? r.nb / total : 0;
          return (
            <Rise key={r.label} index={gi * 3 + i} step={40}>
              <View style={[styles.crow, i > 0 && styles.divided]} accessibilityLabel={`${r.label}: ${a?.name} ${r.a}, ${b?.name} ${r.b}${r.better ? `. ${r.better === 'a' ? a?.name : b?.name} is better` : ''}`}>
                <Text style={styles.clabel}>{r.label}</Text>
                <View style={styles.cline}>
                  <Text style={[styles.value, r.better === 'a' && styles.better]}>{r.a}</Text>
                  <View style={styles.bars}>
                    <GrowBar share={sa} delay={150 + i * 70} trackStyle={[styles.track, { alignItems: 'flex-end' }]} style={[styles.bar, { backgroundColor: r.better === 'a' ? colors.accent : ink(0.2) }]} />
                    <GrowBar share={sb} delay={150 + i * 70} trackStyle={[styles.track, { alignItems: 'flex-start' }]} style={[styles.bar, { backgroundColor: r.better === 'b' ? colors.accent : ink(0.2) }]} />
                  </View>
                  <Text style={[styles.value, { textAlign: 'right' }, r.better === 'b' && styles.better]}>{r.b}</Text>
                </View>
              </View>
            </Rise>
          );
        })}
      </Card>
    </View>
  );
  const edgeA = groups.flatMap((g) => g.rows).filter((r) => r.better === 'a').length;
  const edgeB = groups.flatMap((g) => g.rows).filter((r) => r.better === 'b').length;

  return (
    <Screen>
      {wide ? (
        <View style={{ paddingHorizontal: layout.gutter, paddingTop: space.lg }}>
          <Page max={980}>
            <WideHead title="Compare" sub={a && b ? `${a.name} and ${b.name}, number for number` : a ? `${a.name} with another player` : undefined} onBack={back} />
          </Page>
        </View>
      ) : (
        <View style={styles.header}>
          <IconButton icon="chevron-back" label="Back" onPress={back} />
          <Text style={styles.headerTitle}>Compare</Text>
          <View style={{ width: 42 }} />
        </View>
      )}
      <ScrollView contentContainerStyle={{ padding: wide ? layout.gutter : space.lg, paddingTop: wide ? 0 : space.sm, paddingBottom: insets.bottom + space.xxl }} keyboardShouldPersistTaps="handled">
        <Page max={980}>
        {!a ? (
          <Text style={styles.pickSub}>Player not found.</Text>
        ) : picking || !b ? (
          <>
            <Text style={styles.lead}>Compare {a.name} with</Text>
            <Picker
              careers={careers}
              not={a.key}
              onPick={(key) => {
                setPicked(key);
                setPicking(false);
              }}
            />
          </>
        ) : (
          <>
            <FadeIn>
              <View style={styles.versus}>
                <OvalGround opacity={0.09} />
                <Sheen />
                <View style={styles.faces}>
                  <Face c={a} side="a" wide={wide} />
                  <View style={styles.vs}>
                    <Text style={styles.vsText}>VS</Text>
                  </View>
                  <Face c={b} side="b" wide={wide} />
                </View>
                <View style={styles.score}>
                  <CountUp value={edgeA} style={[styles.scoreNum, edgeA > edgeB && { color: colors.accent }]} />
                  <View style={{ alignItems: 'center', flex: 1 }}>
                    <Text style={styles.scoreLabel}>Categories led</Text>
                    <Text style={styles.scoreSub}>of {edgeA + edgeB} decided</Text>
                  </View>
                  <CountUp value={edgeB} style={[styles.scoreNum, edgeB > edgeA && { color: colors.accent }]} />
                </View>
              </View>
            </FadeIn>
            <PressableScale onPress={() => setPicking(true)} style={styles.change} accessibilityLabel="Pick another player to compare">
              <Ionicons name="swap-horizontal" size={16} color={colors.text} />
              <Text style={styles.changeText}>Pick another player</Text>
            </PressableScale>
            {wide ? (
              <Columns weights={[1, 1]} gap={space.lg}>
                <View>{groups.slice(0, 2).map((g, i) => table(g, i))}</View>
                <View>{groups.slice(2).map((g, i) => table(g, i + 2))}</View>
              </Columns>
            ) : (
              groups.map((g, i) => table(g, i))
            )}
            <Text style={[styles.pickSub, { marginTop: space.md }]}>The better figure in each pair is lit green. For economy and bowling average, lower is better.</Text>
          </>
        )}
        </Page>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingVertical: space.sm },
  headerTitle: { color: colors.text, fontSize: 20, fontFamily: font.poster },
  lead: { ...type.label, color: colors.muted, marginBottom: space.md, marginTop: space.sm },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    height: 46,
    ...edge,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 15, fontFamily: font.regular, height: '100%' },
  pick: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: space.md, ...edge },
  pickName: { color: colors.text, fontSize: 15, fontFamily: font.bold },
  pickSub: { color: colors.muted, fontSize: 12, fontFamily: font.medium },
  versus: { borderRadius: radius.xl, overflow: 'hidden', padding: space.lg, backgroundColor: HERO_BG, borderWidth: 1, borderColor: hero.line, gap: space.md },
  faces: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  vs: { position: 'absolute', left: 0, right: 0, top: 50, alignItems: 'center', zIndex: 2 },
  vsText: { fontFamily: font.posterBlack, fontSize: 22, color: colors.gold, letterSpacing: 2, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 8, textShadowOffset: { width: 0, height: 1 } },
  mono: { fontFamily: font.posterBlack, opacity: 0.5, letterSpacing: -3, alignSelf: 'center' },
  faceName: { color: hero.text, fontSize: 19, lineHeight: 22, fontFamily: font.posterBlack, letterSpacing: -0.5, marginTop: space.sm },
  faceNameWide: { fontSize: 30, lineHeight: 34 },
  faceTeam: { fontSize: 12, fontFamily: font.bold, marginTop: 2 },
  score: { flexDirection: 'row', alignItems: 'center', gap: space.md, ...glass, borderRadius: radius.md, paddingVertical: space.sm, paddingHorizontal: space.lg },
  scoreNum: { color: hero.text, fontFamily: font.posterBlack, fontSize: 38, lineHeight: 42, ...type.num },
  scoreLabel: { ...type.label, color: hero.muted },
  scoreSub: { color: hero.faint, fontSize: 11, fontFamily: font.medium },
  crow: { paddingHorizontal: space.lg, paddingVertical: space.md, gap: 6 },
  clabel: { ...type.label, fontSize: 10, color: colors.muted, textAlign: 'center' },
  cline: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  bars: { flex: 1, flexDirection: 'row', gap: 3 },
  track: { flex: 1, height: 10, borderRadius: 5, backgroundColor: ink(0.06), overflow: 'hidden' },
  bar: { height: 10, borderRadius: 5 },
  change: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, marginTop: space.sm },
  changeText: { color: colors.text, fontSize: 13, fontFamily: font.bold },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingVertical: space.md, gap: space.sm },
  divided: { borderTopWidth: 1, borderTopColor: colors.border },
  value: { width: 64, color: colors.muted, fontSize: 18, fontFamily: font.poster, ...type.num },
  better: { color: colors.text, fontFamily: font.posterBlack },
  label: { ...type.label, fontSize: 10, color: colors.muted, textAlign: 'center' },
});
