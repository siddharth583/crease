import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PlayerAvatar } from '../components/Avatar.tsx';
import { Card, IconButton, PressableScale, Screen, SectionLabel, WideHead } from '../components/ui.tsx';
import { Columns, Page, useLayout } from '../components/layout.tsx';
import { battingAverage, bestFigures, bowlingAverage, bowlingOvers, careerStats, economy, strikeRate, type Career } from '../engine/stats.ts';
import { useMatches } from '../store/matches.tsx';
import { useSquad } from '../store/squad.ts';
import { colors, edge, font, radius, space, teamTheme, type } from '../theme.ts';

// Two players side by side: their main numbers in one card, the better of each pair picked out. Opened from a
// player's page; the second player is picked here.

const fmt = (n: number | null, digits = 1) => (n === null ? '–' : n.toFixed(digits));

/** One line of the card: its label, each player's figure, and which is better (higher, or lower where less is better). */
type Line = { label: string; a: string; b: string; better: 'a' | 'b' | null };
function line(label: string, a: number | null, b: number | null, show: (n: number | null) => string, lowerWins = false): Line {
  const better = a === null || b === null || a === b ? null : (a > b) !== lowerWins ? 'a' : 'b';
  return { label, a: show(a), b: show(b), better };
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
        { ...line('Highest', a.batting.highest, b.batting.highest, whole), a: `${a.batting.highest}${a.batting.highestNotOut ? '*' : ''}`, b: `${b.batting.highest}${b.batting.highestNotOut ? '*' : ''}` },
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
        { ...line('Best', bestValue(a), bestValue(b), whole), a: bestFigures(a), b: bestFigures(b) },
        { ...line('Overs', a.bowling.balls, b.bowling.balls, whole), a: bowlingOvers(a), b: bowlingOvers(b), better: null },
      ],
    },
    {
      title: 'Fielding',
      rows: [line('Catches', a.fielding.catches, b.fielding.catches, whole), line('Run outs', a.fielding.runOuts, b.fielding.runOuts, whole)],
    },
  ];
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
  const table = (g: (typeof groups)[number]) => (
    <View key={g.title}>
      <SectionLabel>{g.title}</SectionLabel>
      <Card style={{ padding: 0 }}>
        {g.rows.map((r, i) => (
          <View key={r.label} style={[styles.row, i > 0 && styles.divided]}>
            <Text style={[styles.value, r.better === 'a' && styles.better]}>{r.a}</Text>
            <Text style={styles.label}>{r.label}</Text>
            <Text style={[styles.value, { textAlign: 'right' }, r.better === 'b' && styles.better]}>{r.b}</Text>
          </View>
        ))}
      </Card>
    </View>
  );

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
            <View style={styles.faces}>
              {[a, b].map((c, i) => (
                <PressableScale
                  key={c.key}
                  scaleTo={0.97}
                  onPress={() => router.push({ pathname: '/player/[key]', params: { key: c.key } })}
                  wrapStyle={{ flex: 1 }}
                  style={[styles.face, i === 1 && { alignItems: 'flex-end' }]}
                >
                  <PlayerAvatar name={c.name} size={wide ? 80 : 56} />
                  <Text style={[styles.faceName, wide && styles.faceNameWide, i === 1 && { textAlign: 'right' }]} numberOfLines={3}>
                    {c.name}
                  </Text>
                  <Text style={[styles.faceTeam, { color: teamTheme(c.team).ink }, i === 1 && { textAlign: 'right' }]} numberOfLines={2}>
                    {c.team}
                  </Text>
                </PressableScale>
              ))}
            </View>
            <PressableScale onPress={() => setPicking(true)} style={styles.change} accessibilityLabel="Pick another player to compare">
              <Ionicons name="swap-horizontal" size={16} color={colors.text} />
              <Text style={styles.changeText}>Pick another player</Text>
            </PressableScale>
            {wide ? (
              <Columns weights={[1, 1]} gap={space.lg}>
                <View>{groups.slice(0, 2).map(table)}</View>
                <View>{groups.slice(2).map(table)}</View>
              </Columns>
            ) : (
              groups.map(table)
            )}
            <Text style={[styles.pickSub, { marginTop: space.md }]}>The better of each pair is picked out; for economy and bowling average, lower is better.</Text>
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
  faces: { flexDirection: 'row', gap: space.md },
  face: { gap: space.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: space.md, ...edge },
  faceName: { color: colors.text, fontSize: 18, lineHeight: 21, fontFamily: font.posterBlack, alignSelf: 'stretch' },
  faceNameWide: { fontSize: 28, lineHeight: 32 },
  faceTeam: { fontSize: 12, fontFamily: font.bold, alignSelf: 'stretch' },
  change: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, marginTop: space.sm },
  changeText: { color: colors.text, fontSize: 13, fontFamily: font.bold },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingVertical: space.md, gap: space.sm },
  divided: { borderTopWidth: 1, borderTopColor: colors.border },
  value: { flex: 1, color: colors.muted, fontSize: 18, fontFamily: font.poster, ...type.num },
  better: { color: colors.text, fontFamily: font.posterBlack },
  label: { ...type.label, fontSize: 10, color: colors.muted, textAlign: 'center' },
});
