import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ExportSheet } from '../../components/ExportSheet.tsx';
import { FadeIn, GhostWord, IconButton, PitchStripes, PressableScale, Screen, Segmented, useToast } from '../../components/ui.tsx';
import { battingAverage, bestFigures, bowlingOvers, careerStats, economy, strikeRate, type Career } from '../../engine/stats.ts';
import type { Match } from '../../engine/types.ts';
import { useMatches } from '../../store/matches.tsx';
import { useMatchFiles } from '../../store/useMatchFiles.ts';
import { colors, font, radius, space, type } from '../../theme.ts';

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
function Podium({ top, board }: { top: Career[]; board: Board }) {
  const [first, ...rest] = top;
  const unit = board === 'batting' ? 'RUNS' : 'WICKETS';
  return (
    <View style={{ gap: space.sm }}>
      <PressableScale scaleTo={0.98} onPress={() => open(first)} style={styles.leader}>
        <PitchStripes opacity={0.06} />
        <GhostWord size={220} style={{ right: -10, top: -40, color: 'rgba(0,0,0,0.08)' }}>
          1
        </GhostWord>
        <View style={styles.leaderTop}>
          <View style={styles.crown}>
            <MaterialCommunityIcons name="crown" size={16} color={colors.accent} />
            <Text style={styles.crownText}>NO. 1</Text>
          </View>
          <Text style={styles.leaderTeam} numberOfLines={1}>
            {first.team}
          </Text>
        </View>
        <Text style={styles.leaderName} numberOfLines={2}>
          {first.name}
        </Text>
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
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          {rest.map((c, i) => (
            <View key={c.key} style={{ flex: 1 }}>
              <PressableScale scaleTo={0.96} onPress={() => open(c)} style={styles.runnerUp}>
                <Text style={[styles.runnerRank, { color: MEDALS[i + 1] }]}>{i + 2}</Text>
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

export default function Players() {
  const { matches } = useMatches();
  const [board, setBoard] = useState<Board>('batting');
  const [query, setQuery] = useState('');
  const careers = useMemo(() => careerStats(matches), [matches]);
  const toast = useToast();
  const { exportMatches, exportPdf } = useMatchFiles(toast.show);
  const [exporting, setExporting] = useState<Match[] | null>(null);

  const q = query.trim().toLowerCase();
  const ranked = careers.filter(BOARDS[board].has).sort(BOARDS[board].sort);
  const searching = q.length > 0;
  const list = ranked
    .map((c, i) => ({ c, rank: i + 1 }))
    .filter(({ c }) => !searching || c.name.toLowerCase().includes(q) || c.team.toLowerCase().includes(q));
  const podium = searching ? [] : ranked.slice(0, 3);
  const others = searching ? list : list.slice(3);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>PLAYERS</Text>
          <IconButton icon="download-outline" label="Export matches" disabled={!matches.length} onPress={() => setExporting(matches)} />
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
          <View style={styles.search}>
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
        </View>

        {podium.length > 0 && (
          <FadeIn key={board} style={{ marginTop: space.lg }}>
            <Podium top={podium} board={board} />
          </FadeIn>
        )}

        <View style={{ gap: space.sm, marginTop: space.md }}>
          {others.map(({ c, rank }, i) => (
            <FadeIn key={`${board}-${c.key}`} delay={i * 30}>
              <Row c={c} rank={rank} board={board} />
            </FadeIn>
          ))}
        </View>

        {list.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyBig}>{careers.length ? 'NOBODY' : 'NO STATS YET'}</Text>
            <Text style={styles.emptyBody}>
              {careers.length
                ? 'No one matches that search. Try another name or team.'
                : 'Name your players when you set up a match and their numbers will add up here.'}
            </Text>
          </View>
        )}
      </ScrollView>
      <ExportSheet
        visible={exporting !== null}
        matches={exporting ?? []}
        onClose={() => setExporting(null)}
        onExport={(format, chosen) => {
          setExporting(null);
          if (format === 'pdf') exportPdf(chosen);
          else exportMatches(chosen);
        }}
      />
      {toast.element}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: 130 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.lg },
  title: { fontFamily: font.posterBlack, fontSize: 54, lineHeight: 54, color: colors.text, letterSpacing: -1 },
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
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 15, fontFamily: font.regular, height: '100%' },

  leader: { backgroundColor: colors.accent, borderRadius: radius.xl, padding: space.xl, overflow: 'hidden' },
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
  crownText: { ...type.label, color: colors.accent },
  leaderTeam: { color: colors.onAccent, fontFamily: font.bold, fontSize: 13, opacity: 0.65, flexShrink: 1, marginLeft: space.md },
  leaderName: { fontFamily: font.posterBlack, fontSize: 56, lineHeight: 54, color: colors.onAccent, textTransform: 'uppercase', marginTop: space.lg, letterSpacing: -1 },
  leaderFoot: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: space.sm },
  leaderValue: { fontFamily: font.posterBlack, fontSize: 64, lineHeight: 64, color: colors.onAccent, ...type.num },
  leaderUnit: { fontFamily: font.poster, fontSize: 20 },
  leaderStat: { fontFamily: font.poster, fontSize: 17, color: colors.onAccent, ...type.num },

  runnerUp: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderHi,
    padding: space.lg,
  },
  runnerRank: { fontFamily: font.posterBlack, fontSize: 40, lineHeight: 40 },
  runnerName: { fontFamily: font.poster, fontSize: 24, lineHeight: 24, color: colors.text, textTransform: 'uppercase', marginTop: space.sm, minHeight: 48 },
  runnerTeam: { color: colors.faint, fontSize: 12, fontFamily: font.semibold },
  runnerValue: { fontFamily: font.posterBlack, fontSize: 36, lineHeight: 38, color: colors.text, marginTop: space.sm, ...type.num },
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
  },
  rank: { width: 30, color: colors.faint, fontSize: 22, fontFamily: font.posterBlack, ...type.num },
  name: { color: colors.text, fontSize: 16, fontFamily: font.bold },
  team: { color: colors.faint, fontSize: 13, fontFamily: font.semibold },
  statsLine: { flexDirection: 'row', gap: space.md, marginTop: 3 },
  stat: { color: colors.muted, fontSize: 12, fontFamily: font.bold, ...type.num },
  statKey: { color: colors.faint, fontSize: 10, fontFamily: font.heavy },
  mainValue: { color: colors.text, fontSize: 32, fontFamily: font.posterBlack, ...type.num },

  empty: { paddingVertical: space.xxl, gap: space.sm },
  emptyBig: { fontFamily: font.posterBlack, fontSize: 56, lineHeight: 56, color: colors.surfaceHi },
  emptyBody: { color: colors.muted, fontSize: 14, fontFamily: font.regular, maxWidth: 300 },
});
