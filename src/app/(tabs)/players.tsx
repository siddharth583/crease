import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { PlayerAvatar } from '../../components/Avatar.tsx';
import { useLayout, Page, widePad } from '../../components/layout.tsx';
import { Button, FadeIn, GhostWord, IconButton, inYear, matchYears, PitchStripes, PressableScale, Screen, Segmented, WideHead, YearChips } from '../../components/ui.tsx';
import { battingAverage, bestFigures, bowlingAverage, bowlingOvers, careerStats, economy, strikeRate, type Career } from '../../engine/stats.ts';
import { useMatches } from '../../store/matches.tsx';
import { useSquad } from '../../store/squad.ts';
import { colors, font, radius, space, type, edge } from '../../theme.ts';

type Board = 'batting' | 'bowling';

const fmt = (n: number | null, digits = 1) => (n === null ? '–' : n.toFixed(digits));
const MEDALS = [colors.gold, '#D4D8DE', '#E09A63'];

const BOARDS: Record<Board, { sort: (a: Career, b: Career) => number; has: (c: Career) => boolean }> = {
  batting: {
    sort: (a, b) => b.batting.runs - a.batting.runs || (strikeRate(b) ?? 0) - (strikeRate(a) ?? 0),
    has: (c) => c.batting.innings > 0,
  },
  bowling: {
    sort: (a, b) => b.bowling.wickets - a.bowling.wickets || (economy(a) ?? 99) - (economy(b) ?? 99),
    has: (c) => c.bowling.balls > 0,
  },
};

const mainOf = (c: Career, board: Board) => (board === 'batting' ? c.batting.runs : c.bowling.wickets);
const statsOf = (c: Career, board: Board): [string, string][] =>
  board === 'batting'
    ? [
        ['AVG', fmt(battingAverage(c))],
        ['SR', fmt(strikeRate(c))],
        ['HS', `${c.batting.highest}${c.batting.highestNotOut ? '*' : ''}`],
      ]
    : [
        ['OV', bowlingOvers(c)],
        ['ECON', fmt(economy(c), 2)],
        ['BEST', bestFigures(c)],
      ];

const open = (c: Career) => router.push({ pathname: '/player/[key]', params: { key: c.key } });

/** The leader gets a poster; second and third stand beside each other underneath. */
function Podium({ top, board, wide }: { top: Career[]; board: Board; wide?: boolean }) {
  const [first, ...rest] = top;
  const unit = board === 'batting' ? 'runs' : 'wickets';
  // On a tablet or laptop the three stand side by side, the leader the widest.
  return (
    <View style={wide ? { flexDirection: 'row', gap: space.md, alignItems: 'stretch' } : { gap: space.sm }}>
      <PressableScale scaleTo={0.98} onPress={() => open(first)} wrapStyle={wide && { flex: 1.5 }} style={[styles.leader, wide && { flex: 1 }]}>
        <PitchStripes opacity={0.06} />
        <GhostWord size={220} style={{ right: -10, top: -40, color: 'rgba(0,0,0,0.08)' }}>
          1
        </GhostWord>
        <View style={styles.leaderTop}>
          <View style={styles.crown}>
            <MaterialCommunityIcons name="crown" size={16} color={colors.accentInk} />
            <Text style={styles.crownText}>NO. 1</Text>
          </View>
          <Text style={styles.leaderTeam} numberOfLines={1}>
            {first.team}
          </Text>
        </View>
        <View style={styles.leaderWho}>
          <PlayerAvatar name={first.name} size={48} />
          <Text style={styles.leaderName} numberOfLines={2}>
            {first.name}
          </Text>
        </View>
        <View style={styles.leaderFoot}>
          <Text style={styles.leaderValue}>
            {mainOf(first, board)}
            <Text style={styles.leaderUnit}> {unit}</Text>
          </Text>
          <View style={{ alignItems: 'flex-end' }}>
            {statsOf(first, board).map(([k, v]) => (
              <Text key={k} style={styles.leaderStat}>
                {k} <Text style={{ fontFamily: font.posterBlack }}>{v}</Text>
              </Text>
            ))}
          </View>
        </View>
      </PressableScale>
      {rest.length > 0 && (
        <View style={{ flexDirection: 'row', gap: wide ? space.md : space.sm, flex: wide ? 2 : undefined }}>
          {rest.map((c, i) => (
            <View key={c.key} style={{ flex: 1 }}>
              <PressableScale scaleTo={0.96} onPress={() => open(c)} wrapStyle={wide && { flex: 1 }} style={[styles.runnerUp, wide && styles.runnerUpWide]}>
                <View style={styles.runnerTop}>
                  <Text style={[styles.runnerRank, { color: MEDALS[i + 1] }]}>{i + 2}</Text>
                  <PlayerAvatar name={c.name} size={32} />
                </View>
                <Text style={styles.runnerName} numberOfLines={2}>
                  {c.name}
                </Text>
                <Text style={styles.runnerTeam} numberOfLines={1}>
                  {c.team}
                </Text>
                <Text style={styles.runnerValue}>
                  {mainOf(c, board)}
                  <Text style={styles.runnerUnit}> {board === 'batting' ? 'R' : 'W'}</Text>
                </Text>
              </PressableScale>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function Row({ c, rank, board }: { c: Career; rank: number; board: Board }) {
  return (
    <PressableScale scaleTo={0.98} onPress={() => open(c)} style={styles.row}>
      <Text style={styles.rank}>{String(rank).padStart(2, '0')}</Text>
      <PlayerAvatar name={c.name} size={32} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={styles.name}>
          {c.name}
          <Text style={styles.team}>  {c.team}</Text>
        </Text>
        <View style={styles.statsLine}>
          {statsOf(c, board).map(([k, v]) => (
            <Text key={k} style={styles.stat}>
              <Text style={styles.statKey}>{k} </Text>
              {v}
            </Text>
          ))}
        </View>
      </View>
      <Text style={styles.mainValue}>{mainOf(c, board)}</Text>
    </PressableScale>
  );
}


/** A column of the wide leaderboard: what it shows, and how it ranks the table when its head is tapped. */
type Col = { key: string; label: string; value: (c: Career) => string | number; sort: (c: Career) => number; laptop?: boolean; low?: boolean };
const num = (n: number | null, none = -1) => n ?? none;
const COLS: Record<Board, Col[]> = {
  batting: [
    { key: 'm', label: 'M', value: (c) => c.matches, sort: (c) => c.matches, laptop: true },
    { key: 'inn', label: 'Inn', value: (c) => c.batting.innings, sort: (c) => c.batting.innings, laptop: true },
    { key: 'runs', label: 'Runs', value: (c) => c.batting.runs, sort: (c) => c.batting.runs },
    { key: 'avg', label: 'Avg', value: (c) => fmt(battingAverage(c)), sort: (c) => num(battingAverage(c)) },
    { key: 'sr', label: 'SR', value: (c) => fmt(strikeRate(c)), sort: (c) => num(strikeRate(c)) },
    { key: 'hs', label: 'HS', value: (c) => `${c.batting.highest}${c.batting.highestNotOut ? '*' : ''}`, sort: (c) => c.batting.highest },
    { key: '50', label: '50s', value: (c) => c.batting.fifties, sort: (c) => c.batting.fifties, laptop: true },
    { key: '4s', label: '4s', value: (c) => c.batting.fours, sort: (c) => c.batting.fours },
    { key: '6s', label: '6s', value: (c) => c.batting.sixes, sort: (c) => c.batting.sixes },
  ],
  bowling: [
    { key: 'm', label: 'M', value: (c) => c.matches, sort: (c) => c.matches, laptop: true },
    { key: 'wkts', label: 'Wkts', value: (c) => c.bowling.wickets, sort: (c) => c.bowling.wickets },
    { key: 'ov', label: 'Overs', value: (c) => bowlingOvers(c), sort: (c) => c.bowling.balls },
    { key: 'econ', label: 'Econ', value: (c) => fmt(economy(c), 2), sort: (c) => num(economy(c), 99), low: true },
    { key: 'avg', label: 'Avg', value: (c) => fmt(bowlingAverage(c)), sort: (c) => num(bowlingAverage(c), 999), low: true, laptop: true },
    { key: 'best', label: 'Best', value: (c) => bestFigures(c), sort: (c) => (c.bowling.best ? c.bowling.best.wickets * 1000 - c.bowling.best.runs : -1) },
    { key: 'md', label: 'Mdns', value: (c) => c.bowling.maidens, sort: (c) => c.bowling.maidens, laptop: true },
  ],
};

/**
 * The leaderboard as a table on a tablet or laptop: every number in its own column, more of them on a laptop, and a
 * column's head re-ranks by it (tap again to go back to the board's own order).
 */
function Table({ rows, board, desk }: { rows: { c: Career; rank: number }[]; board: Board; desk: boolean }) {
  const cols = COLS[board].filter((col) => desk || !col.laptop);
  const [by, setBy] = useState<string | null>(null);
  const col = cols.find((x) => x.key === by);
  const sorted = col ? [...rows].sort((a, b) => (col.low ? col.sort(a.c) - col.sort(b.c) : col.sort(b.c) - col.sort(a.c))) : rows;
  const main = board === 'batting' ? 'runs' : 'wkts';
  return (
    <View style={styles.table}>
      <View style={[styles.tr, styles.thead]}>
        <Text style={[styles.th, styles.cRank]}>#</Text>
        <Text style={[styles.th, { flex: 1 }]}>Player</Text>
        {cols.map((x) => {
          const on = (by ?? main) === x.key;
          return (
            <Pressable
              key={x.key}
              accessibilityRole="button"
              accessibilityLabel={`Sort by ${x.label}`}
              accessibilityState={{ selected: on }}
              onPress={() => setBy(by === x.key ? null : x.key)}
              style={styles.cNum}
            >
              <Text style={[styles.th, styles.thNum, on && { color: colors.text }]}>
                {x.label}
                {on ? (x.low ? ' ↑' : ' ↓') : ''}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {sorted.map(({ c, rank }, i) => (
        <FadeIn key={`${board}-${c.key}`} delay={Math.min(i, 12) * 25}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${c.name}, ${c.team}`}
            onPress={() => open(c)}
            style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [styles.tr, styles.trBody, (hovered || pressed) && { backgroundColor: colors.surfaceHi }]}
          >
            <Text style={[styles.rank, styles.cRank]}>{String(rank).padStart(2, '0')}</Text>
            <View style={styles.tdWho}>
              <PlayerAvatar name={c.name} size={32} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={styles.name}>
                  {c.name}
                </Text>
                <Text numberOfLines={1} style={styles.team}>
                  {c.team}
                </Text>
              </View>
            </View>
            {cols.map((x) => (
              <Text key={x.key} style={[styles.td, styles.cNum, x.key === main && styles.tdMain, x.key === by && { color: colors.text }]}>
                {x.value(c)}
              </Text>
            ))}
          </Pressable>
        </FadeIn>
      ))}
    </View>
  );
}

export default function Players() {
  const { matches } = useMatches();
  const [board, setBoard] = useState<Board>('batting');
  const [query, setQuery] = useState('');
  const { squad } = useSquad();
  const years = useMemo(() => matchYears(matches), [matches]);
  const [year, setYear] = useState<number | null>(null);
  // The squad decides who counts as one person across teams. A season counts only its own matches.
  const careers = useMemo(() => careerStats(inYear(matches, year)), [matches, squad, year]);

  const q = query.trim().toLowerCase();
  const ranked = careers.filter(BOARDS[board].has).sort(BOARDS[board].sort);
  const searching = q.length > 0;
  const list = ranked
    .map((c, i) => ({ c, rank: i + 1 }))
    .filter(({ c }) => !searching || c.name.toLowerCase().includes(q) || c.team.toLowerCase().includes(q));
  const podium = searching ? [] : ranked.slice(0, 3);
  const others = searching ? list : list.slice(3);
  const layout = useLayout();

  const search = (
    <View style={[styles.search, layout.wide && { flex: 1, minWidth: 200 }]}>
      <Ionicons name="search" size={18} color={colors.faint} />
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search players or teams"
        placeholderTextColor={colors.faint}
        style={styles.searchInput}
        autoCorrect={false}
      />
      {query.length > 0 && (
        <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityLabel="Clear search">
          <Ionicons name="close-circle" size={18} color={colors.faint} />
        </Pressable>
      )}
    </View>
  );
  const empty = list.length === 0 && (
    <View style={styles.empty}>
      <Text style={styles.emptyBig}>{careers.length ? 'Nobody' : 'No stats yet'}</Text>
      <Text style={styles.emptyBody}>
        {careers.length
          ? 'No one matches that search. Try another name or team.'
          : 'Name your players when you set up a match and their numbers will add up here.'}
      </Text>
    </View>
  );

  // A tablet or laptop: the page's title large, the filters along one line, the top three side by side, then the
  // whole board as a table with a column for every number.
  if (layout.wide)
    return (
      <Screen>
        <ScrollView contentContainerStyle={widePad(layout.gutter)} keyboardShouldPersistTaps="handled">
          <Page>
            <WideHead
              title="Players"
              sub={`${ranked.length} ${board === 'batting' ? 'batters' : 'bowlers'}${year ? ` in ${year}` : ' across every season'}`}
              right={
                <>
                  <Button variant="ghost" icon="people-outline" label="Squad" onPress={() => router.push('/squad')} style={styles.headButton} />
                  <Button variant="ghost" icon="trophy-outline" label="Record book" onPress={() => router.push('/records')} style={styles.headButton} />
                </>
              }
            />
            <View style={styles.filters}>
              <View style={{ width: 300 }}>
                <Segmented
                  value={board}
                  onChange={setBoard}
                  options={[
                    { value: 'batting', label: 'Most runs' },
                    { value: 'bowling', label: 'Most wickets' },
                  ]}
                />
              </View>
              {search}
              <View style={{ flexShrink: 1, minWidth: 0 }}>
                <YearChips years={years} value={year} onChange={setYear} />
              </View>
            </View>
            {podium.length > 0 && (
              <FadeIn key={`${board}-${year}`} style={{ marginTop: space.xl }}>
                <Podium top={podium} board={board} wide />
              </FadeIn>
            )}
            {list.length > 0 && (
              <View style={{ marginTop: space.xl }}>
                <Table key={`${board}-${year}`} rows={list} board={board} desk={layout.desk} />
              </View>
            )}
            {empty}
          </Page>
        </ScrollView>
      </Screen>
    );

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>Players</Text>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <IconButton icon="people-outline" label="The squad" onPress={() => router.push('/squad')} />
            <IconButton icon="trophy-outline" label="Record book" onPress={() => router.push('/records')} />
          </View>
        </View>
        <View style={{ gap: space.md }}>
          <Segmented
            value={board}
            onChange={setBoard}
            options={[
              { value: 'batting', label: 'Most runs' },
              { value: 'bowling', label: 'Most wickets' },
            ]}
          />
          <YearChips years={years} value={year} onChange={setYear} />
          {search}
        </View>

        {podium.length > 0 && (
          <FadeIn key={`${board}-${year}`} style={{ marginTop: space.lg }}>
            <Podium top={podium} board={board} />
          </FadeIn>
        )}

        <View style={{ gap: space.sm, marginTop: space.md }}>
          {others.map(({ c, rank }, i) => (
            <FadeIn key={`${board}-${year}-${c.key}`} delay={i * 30}>
              <Row c={c} rank={rank} board={board} />
            </FadeIn>
          ))}
        </View>

        {empty}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: 130 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.lg },
  title: { fontFamily: font.posterBlack, fontSize: 38, lineHeight: 42, color: colors.text, letterSpacing: -1.4 },
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

  leader: { backgroundColor: colors.accent, borderRadius: radius.xl, padding: space.xl, overflow: 'hidden', ...edge },
  leaderTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  crown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.onAccent,
    paddingHorizontal: 10,
    height: 26,
    borderRadius: radius.sm,
  },
  crownText: { ...type.label, color: colors.accentInk },
  leaderTeam: { color: colors.onAccent, fontFamily: font.bold, fontSize: 13, opacity: 0.65, flexShrink: 1, marginLeft: space.md },
  leaderWho: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.lg },
  leaderName: { flex: 1, fontFamily: font.posterBlack, fontSize: 40, lineHeight: 46, color: colors.onAccent, letterSpacing: -1 },
  leaderFoot: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: space.sm },
  leaderValue: { fontFamily: font.posterBlack, fontSize: 52, lineHeight: 58, color: colors.onAccent, ...type.num },
  leaderUnit: { fontFamily: font.poster, fontSize: 16 },
  leaderStat: { fontFamily: font.poster, fontSize: 17, color: colors.onAccent, ...type.num },

  runnerUp: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderHi,
    padding: space.lg,
    ...edge,
  },
  runnerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  runnerRank: { fontFamily: font.posterBlack, fontSize: 33, lineHeight: 37 },
  runnerName: { fontFamily: font.poster, fontSize: 20, lineHeight: 22, color: colors.text, marginTop: space.sm, minHeight: 48 },
  runnerTeam: { color: colors.faint, fontSize: 12, fontFamily: font.semibold },
  runnerValue: { fontFamily: font.posterBlack, fontSize: 30, lineHeight: 34, color: colors.text, marginTop: space.sm, ...type.num },
  runnerUnit: { fontFamily: font.poster, fontSize: 16, color: colors.faint },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    ...edge,
  },
  rank: { width: 30, color: colors.faint, fontSize: 18, fontFamily: font.posterBlack, ...type.num },
  name: { color: colors.text, fontSize: 16, fontFamily: font.bold },
  team: { color: colors.faint, fontSize: 13, fontFamily: font.semibold },
  statsLine: { flexDirection: 'row', gap: space.md, marginTop: 3 },
  stat: { color: colors.muted, fontSize: 12, fontFamily: font.bold, ...type.num },
  statKey: { color: colors.faint, fontSize: 10, fontFamily: font.heavy },
  mainValue: { color: colors.text, fontSize: 26, fontFamily: font.posterBlack, ...type.num },

  headButton: { height: 46 },
  filters: { flexDirection: 'row', alignItems: 'center', gap: space.md, flexWrap: 'wrap' },
  runnerUpWide: { flex: 1, justifyContent: 'space-between' },

  table: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', ...edge },
  tr: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg },
  thead: { height: 44, borderBottomWidth: 1, borderColor: colors.border },
  trBody: { minHeight: 56, borderBottomWidth: 1, borderColor: colors.border },
  th: { ...type.label, fontSize: 10.5, color: colors.faint },
  thNum: { textAlign: 'right' },
  cRank: { width: 30 },
  cNum: { width: 58, minHeight: 44, justifyContent: 'center', textAlign: 'right' },
  tdWho: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: space.md },
  td: { color: colors.muted, fontSize: 15, fontFamily: font.semibold, textAlignVertical: 'center', lineHeight: 44, ...type.num },
  tdMain: { color: colors.text, fontFamily: font.posterBlack, fontSize: 19 },

  empty: { paddingVertical: space.xxl, gap: space.sm },
  emptyBig: { fontFamily: font.posterBlack, fontSize: 46, lineHeight: 52, color: colors.surfaceHi },
  emptyBody: { color: colors.muted, fontSize: 14, fontFamily: font.regular, maxWidth: 300 },
});
