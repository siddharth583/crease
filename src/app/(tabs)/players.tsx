import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { PlayerAvatar } from '../../components/Avatar.tsx';
import { Jersey, OvalGround, SeamDivider } from '../../components/cricket.tsx';
import { useLayout, Page, widePad } from '../../components/layout.tsx';
import { CountUp, PopIn, Sheen } from '../../components/motion.tsx';
import { StatsNav } from '../../components/StatsNav.tsx';
import { crestOf, TeamCrest } from '../../components/TeamCrest.tsx';
import { PlayerPhoto } from '../../components/MomAward.tsx';
import { Button, Chip, FadeIn, PitchStripes, inYear, matchYears, PressableScale, Screen, Segmented, WideHead, YearChips } from '../../components/ui.tsx';
import { photoFor } from '../../engine/photos.ts';
import { usePhotos } from '../../store/sync.tsx';
import { battingAverage, bestFigures, bowlingAverage, bowlingOvers, careerStats, COMMON_TEAM, displayName, economy, strikeRate, type Career } from '../../engine/stats.ts';
import { useMatches } from '../../store/matches.tsx';
import { useSquad } from '../../store/squad.ts';
import { colors, edge, font, hero, radius, space, teamTheme, type } from '../../theme.ts';

type Board = 'batting' | 'bowling' | 'fielding';

const fmt = (n: number | null, digits = 1) => (n === null ? '–' : n.toFixed(digits));
// Brass, silver, bronze: the medals.
const MEDALS = [colors.gold, '#D4D8DE', '#E09A63'];
const MEDAL_NAMES = ['Gold', 'Silver', 'Bronze'];
const dismissals = (c: Career) => c.fielding.catches + c.fielding.runOuts + c.fielding.stumpings;

const BOARDS: Record<Board, { sort: (a: Career, b: Career) => number; has: (c: Career) => boolean; unit: string; short: string; noun: string }> = {
  batting: {
    sort: (a, b) => b.batting.runs - a.batting.runs || (strikeRate(b) ?? 0) - (strikeRate(a) ?? 0),
    has: (c) => c.batting.innings > 0,
    unit: 'runs',
    short: 'R',
    noun: 'batters',
  },
  bowling: {
    sort: (a, b) => b.bowling.wickets - a.bowling.wickets || (economy(a) ?? 99) - (economy(b) ?? 99),
    has: (c) => c.bowling.balls > 0,
    unit: 'wickets',
    short: 'W',
    noun: 'bowlers',
  },
  fielding: {
    sort: (a, b) => dismissals(b) - dismissals(a) || b.fielding.catches - a.fielding.catches,
    has: (c) => dismissals(c) > 0,
    unit: 'dismissals',
    short: 'D',
    noun: 'fielders',
  },
};

const mainOf = (c: Career, board: Board) => (board === 'batting' ? c.batting.runs : board === 'bowling' ? c.bowling.wickets : dismissals(c));
/** The three smaller figures under the headline, each with a word you can read. */
const statsOf = (c: Career, board: Board): [string, string][] =>
  board === 'batting'
    ? [
        ['Avg', fmt(battingAverage(c))],
        ['SR', fmt(strikeRate(c))],
        ['HS', `${c.batting.highest}${c.batting.highestNotOut ? '*' : ''}`],
      ]
    : board === 'bowling'
      ? [
          ['Overs', bowlingOvers(c)],
          ['Econ', fmt(economy(c), 2)],
          ['Best', bestFigures(c)],
        ]
      : [
          ['Catches', String(c.fielding.catches)],
          ['Run outs', String(c.fielding.runOuts)],
          ['Stumpings', String(c.fielding.stumpings)],
        ];

const open = (c: Career) => router.push({ pathname: '/player/[key]', params: { key: c.key } });

/** A rank medal: a disc in brass, silver or bronze that pops in with a little turn. */
function Medal({ place, size = 30, delay = 0 }: { place: number; size?: number; delay?: number }) {
  const col = MEDALS[place] ?? colors.faint;
  return (
    <PopIn delay={delay} turn={-20}>
      <View
        accessibilityLabel={`${MEDAL_NAMES[place] ?? 'Rank'} medal, number ${place + 1}`}
        style={[styles.medal, { width: size, height: size, borderRadius: size / 2, backgroundColor: col, boxShadow: `0px 0px 14px ${col}55` } as object]}
      >
        <View style={[styles.medalRing, { width: size - 6, height: size - 6, borderRadius: (size - 6) / 2 }]} />
        <Text style={[styles.medalText, { fontSize: size * 0.5 }]}>{place + 1}</Text>
      </View>
    </PopIn>
  );
}

/**
 * A player standing free in the scene: their cut-out photo (no disc, no border, no card), feet on the grass with a soft
 * shadow under them. Without a photo, their initials stand in their place, large, in their side's colour.
 */
function Figure({ name, team, w, h }: { name: string; team: string; w: number; h: number }) {
  const photo = photoFor(usePhotos(), name);
  const initials = displayName(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0]!.toUpperCase())
    .join('');
  return (
    <View style={{ width: w, height: h, alignItems: 'center', justifyContent: 'flex-end' }}>
      <View style={[styles.figureShadow, { width: w * 0.7, height: w * 0.12, borderRadius: w }]} />
      {photo ? (
        <PlayerPhoto uri={photo} />
      ) : (
        <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: w * 0.04, alignItems: 'center', justifyContent: 'flex-end' }}>
          <Jersey size={Math.min(w, h) * 0.95} from={crestOf(team).from} to={crestOf(team).to} initials={initials} id={`pj${initials}${team.length}`} />
        </View>
      )}
    </View>
  );
}

/**
 * The top three in one picture: a single cricket ground under the floodlights, the leader standing at the front in the
 * middle, second and third a step behind either side, each as an open cut-out. Their names and numbers sit along the
 * grass at the foot. Tap a player to open them.
 */
function Podium({ top, board, wide }: { top: Career[]; board: Board; wide?: boolean }) {
  const unit = BOARDS[board].unit;
  const [W, setW] = useState(0);
  const H = wide ? 430 : 350;
  const band = wide ? 96 : 84;
  // Where each place stands: the leader front and centre and biggest, second left and third right, further back.
  const spots = [
    { x: 0.27, w: 0.46, h: 0.74, lift: 0, z: 3 },
    { x: 0.02, w: 0.38, h: 0.6, lift: 22, z: 1 },
    { x: 0.6, w: 0.38, h: 0.6, lift: 22, z: 1 },
  ];
  return (
    <View>
      <View style={styles.podiumHead}>
        <Text style={styles.podiumKicker}>Top {top.length}</Text>
        <Text style={styles.podiumSub}>{board === 'batting' ? 'Most runs' : board === 'bowling' ? 'Most wickets' : 'Most dismissals'}</Text>
      </View>
      <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={[styles.scene, { height: H }]}>
        {/* The sky over the ground, and two banks of floodlights. */}
        <LinearGradient colors={['#05100A', '#0C2216', '#123423']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={[styles.flood, { left: -60 }]} />
        <View style={[styles.flood, { right: -60 }]} />
        {/* The outfield: one oval of mown grass, the pitch running away from us in the middle. */}
        <View style={[styles.field, { height: H * 0.62, width: (W || 400) * 1.7, left: -(W || 400) * 0.35 }]}>
          <LinearGradient colors={['#2F6B3D', '#1E4E2B', '#143A20']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
          <PitchStripes count={14} opacity={0.07} tint="255,255,255" />
        </View>
        <View style={[styles.pitch, { left: (W || 400) / 2 - 34, top: H * 0.4 }]} />
        <Sheen every={7000} strength={0.06} />
        {W > 0 &&
          [1, 2, 0]
            .filter((i) => top[i])
            .map((i) => {
              const c = top[i];
              const s = spots[i];
              return (
                <PressableScale
                  key={c.key}
                  scaleTo={0.97}
                  onPress={() => open(c)}
                  accessibilityLabel={`${c.name}, number ${i + 1} with ${mainOf(c, board)} ${unit}`}
                  wrapStyle={{ position: 'absolute', left: W * s.x, bottom: band - 6 + s.lift, zIndex: s.z }}
                >
                  <FadeIn delay={i === 0 ? 120 : 260 + i * 90}>
                    <Figure name={c.name} team={c.team} w={W * s.w} h={(H - band) * s.h} />
                  </FadeIn>
                </PressableScale>
              );
            })}
        {/* Names and numbers along the grass, under each player. */}
        <LinearGradient pointerEvents="none" colors={['rgba(5,13,9,0)', 'rgba(5,13,9,0.92)']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.55 }} style={[styles.band, { height: band + 50, zIndex: 4 }]} />
        <View pointerEvents="box-none" style={[styles.labels, { height: band, zIndex: 5 }]}>
          {[1, 0, 2].map((i) => {
            const c = top[i];
            if (!c) return <View key={i} style={{ flex: i === 0 ? 1.25 : 1 }} />;
            const first = i === 0;
            return (
              <Pressable key={c.key} onPress={() => open(c)} style={{ flex: first ? 1.25 : 1, alignItems: 'center', minWidth: 0 }}>
                <View style={styles.labelTop}>
                  <Medal place={i} size={first ? 22 : 18} delay={300 + i * 140} />
                  <Text style={[styles.podiumName, first && { fontSize: wide ? 18 : 15 }]} numberOfLines={1}>
                    {c.name.split(' ')[0]}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                  <CountUp value={mainOf(c, board)} delay={250 + i * 100} style={[styles.podiumValue, { color: MEDALS[i] }, first && { fontSize: wide ? 40 : 32, lineHeight: wide ? 44 : 36 }]} />
                  <Text style={styles.podiumUnit}>{unit}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

/** A leaderboard row on a phone: rank, face, who and for which side, the small figures labelled, the big one at right. */
function Row({ c, rank, board }: { c: Career; rank: number; board: Board }) {
  const main = mainOf(c, board);
  return (
    <PressableScale scaleTo={0.98} onPress={() => open(c)} style={styles.row} accessibilityLabel={`${c.name}, ${c.team}, number ${rank}, ${main} ${BOARDS[board].unit}`}>
      <Text style={styles.rank}>{String(rank).padStart(2, '0')}</Text>
      <PlayerAvatar name={c.name} size={40} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={styles.name}>
          {c.name}
        </Text>
        <View style={styles.teamLine}>
          {c.team !== COMMON_TEAM && <TeamCrest name={c.team} size={14} />}
          <Text numberOfLines={1} style={styles.team}>
            {c.team}
          </Text>
        </View>
        <View style={styles.statsLine}>
          {statsOf(c, board).map(([k, v]) => (
            <Text key={k} style={styles.stat}>
              <Text style={styles.statKey}>{k} </Text>
              {v}
            </Text>
          ))}
        </View>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={styles.mainValue}>{main}</Text>
        <Text style={styles.mainUnit}>{BOARDS[board].unit}</Text>
      </View>
    </PressableScale>
  );
}

/** A column of the wide leaderboard: what it shows, and how it ranks the table when its head is tapped. */
type Col = { key: string; label: string; value: (c: Career) => string | number; sort: (c: Career) => number; laptop?: boolean; low?: boolean };
const num = (n: number | null, none = -1) => n ?? none;
const COLS: Record<Board, Col[]> = {
  batting: [
    { key: 'm', label: 'Matches', value: (c) => c.matches, sort: (c) => c.matches, laptop: true },
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
    { key: 'm', label: 'Matches', value: (c) => c.matches, sort: (c) => c.matches, laptop: true },
    { key: 'wkts', label: 'Wkts', value: (c) => c.bowling.wickets, sort: (c) => c.bowling.wickets },
    { key: 'ov', label: 'Overs', value: (c) => bowlingOvers(c), sort: (c) => c.bowling.balls },
    { key: 'econ', label: 'Econ', value: (c) => fmt(economy(c), 2), sort: (c) => num(economy(c), 99), low: true },
    { key: 'avg', label: 'Avg', value: (c) => fmt(bowlingAverage(c)), sort: (c) => num(bowlingAverage(c), 999), low: true, laptop: true },
    { key: 'best', label: 'Best', value: (c) => bestFigures(c), sort: (c) => (c.bowling.best ? c.bowling.best.wickets * 1000 - c.bowling.best.runs : -1) },
    { key: 'md', label: 'Mdns', value: (c) => c.bowling.maidens, sort: (c) => c.bowling.maidens, laptop: true },
  ],
  fielding: [
    { key: 'm', label: 'Matches', value: (c) => c.matches, sort: (c) => c.matches, laptop: true },
    { key: 'tot', label: 'Total', value: (c) => dismissals(c), sort: (c) => dismissals(c) },
    { key: 'ct', label: 'Catches', value: (c) => c.fielding.catches, sort: (c) => c.fielding.catches },
    { key: 'ro', label: 'Run outs', value: (c) => c.fielding.runOuts, sort: (c) => c.fielding.runOuts },
    { key: 'st', label: 'Stumpings', value: (c) => c.fielding.stumpings, sort: (c) => c.fielding.stumpings },
  ],
};
const MAIN_COL: Record<Board, string> = { batting: 'runs', bowling: 'wkts', fielding: 'tot' };

/**
 * The leaderboard as a table on a tablet or laptop: every number in its own column, more of them on a laptop, and a
 * column's head re-ranks by it (tap again to go back to the board's own order).
 */
function Table({ rows, board, desk }: { rows: { c: Career; rank: number }[]; board: Board; desk: boolean }) {
  const cols = COLS[board].filter((col) => desk || !col.laptop);
  const [by, setBy] = useState<string | null>(null);
  const col = cols.find((x) => x.key === by);
  const sorted = col ? [...rows].sort((a, b) => (col.low ? col.sort(a.c) - col.sort(b.c) : col.sort(b.c) - col.sort(a.c))) : rows;
  const main = MAIN_COL[board];
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
              <Text style={[styles.th, styles.thNum, on && { color: colors.accentInk }]}>
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
            <View style={styles.cRank}>
              {rank <= 3 && !by ? <Medal place={rank - 1} size={24} delay={i * 60} /> : <Text style={styles.rank}>{String(rank).padStart(2, '0')}</Text>}
            </View>
            <View style={styles.tdWho}>
              <PlayerAvatar name={c.name} size={36} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={styles.name}>
                  {c.name}
                </Text>
                <View style={styles.teamLine}>
                  {c.team !== COMMON_TEAM && <TeamCrest name={c.team} size={14} />}
                  <Text numberOfLines={1} style={styles.team}>
                    {c.team}
                  </Text>
                </View>
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
  const [team, setTeam] = useState<string | null>(null);
  // The squad decides who counts as one person across teams. A season counts only its own matches.
  const careers = useMemo(() => careerStats(inYear(matches, year)), [matches, squad, year]);
  const teams = useMemo(() => [...new Set(careers.map((c) => c.team).filter((t) => t !== COMMON_TEAM))].sort(), [careers]);
  const teamNow = team && teams.includes(team) ? team : null;

  const q = query.trim().toLowerCase();
  const ranked = careers.filter((c) => BOARDS[board].has(c) && (!teamNow || c.team === teamNow)).sort(BOARDS[board].sort);
  const searching = q.length > 0;
  const list = ranked
    .map((c, i) => ({ c, rank: i + 1 }))
    .filter(({ c }) => !searching || c.name.toLowerCase().includes(q) || c.team.toLowerCase().includes(q));
  const podium = searching ? [] : ranked.slice(0, 3);
  const others = searching ? list : list.slice(3);
  const layout = useLayout();
  const key = `${board}-${year}-${teamNow}`;

  const boards = (
    <Segmented
      value={board}
      onChange={setBoard}
      options={[
        { value: 'batting', label: 'Batting' },
        { value: 'bowling', label: 'Bowling' },
        { value: 'fielding', label: 'Fielding' },
      ]}
    />
  );
  const teamChips =
    teams.length > 1 ? (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow} accessibilityLabel="Filter by team">
        <Chip label="All teams" selected={teamNow === null} onPress={() => setTeam(null)} icon="shield-outline" />
        {teams.map((t) => (
          <Chip key={t} label={t} selected={teamNow === t} onPress={() => setTeam(t)} />
        ))}
      </ScrollView>
    ) : null;
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
        accessibilityLabel="Search players or teams"
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
          ? 'No one matches that search or filter. Try another name, team or board.'
          : 'Name your players when you set up a match and their numbers will add up here.'}
      </Text>
      {!careers.length && <Button label="Start a match" icon="add" onPress={() => router.push('/new')} style={{ alignSelf: 'flex-start', marginTop: space.md }} />}
    </View>
  );
  const sub = `${ranked.length} ${BOARDS[board].noun}${teamNow ? ` for ${teamNow}` : ''}${year ? ` in ${year}` : ' across every season'}`;

  // A tablet or laptop: the nav, the page's title large, the filters along one line, the top three on the outfield,
  // then the whole board as a table with a column for every number.
  if (layout.wide)
    return (
      <Screen>
        <ScrollView contentContainerStyle={widePad(layout.gutter)} keyboardShouldPersistTaps="handled">
          <Page>
            <StatsNav />
            <View style={{ height: space.lg }} />
            <WideHead title="Players" sub={sub} right={<Button variant="ghost" icon="people-outline" label="Squad" onPress={() => router.push('/squad')} style={styles.headButton} />} />
            <View style={styles.filters}>
              <View style={{ width: 320 }}>{boards}</View>
              {search}
              <View style={{ flexShrink: 1, minWidth: 0 }}>
                <YearChips years={years} value={year} onChange={setYear} />
              </View>
            </View>
            {teamChips && <View style={{ marginTop: space.md }}>{teamChips}</View>}
            {podium.length > 0 && (
              <FadeIn key={`p-${key}`} style={{ marginTop: space.xl }}>
                <Podium top={podium} board={board} wide />
              </FadeIn>
            )}
            {list.length > 0 && (
              <View style={{ marginTop: space.xl }}>
                <Table key={`t-${key}-${searching}`} rows={list} board={board} desk={layout.desk} />
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
        <StatsNav />
        <View style={styles.header}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.title}>Players</Text>
            <Text style={styles.sub} numberOfLines={2}>
              {sub}
            </Text>
          </View>
          <PressableScale scaleTo={0.94} onPress={() => router.push('/squad')} accessibilityLabel="The squad" style={styles.squadBtn}>
            <Ionicons name="people-outline" size={17} color={colors.text} />
            <Text style={styles.squadText}>Squad</Text>
          </PressableScale>
        </View>
        <View style={{ gap: space.md }}>
          {boards}
          <YearChips years={years} value={year} onChange={setYear} />
          {teamChips}
          {search}
        </View>

        {podium.length > 0 && (
          <FadeIn key={`p-${key}`} style={{ marginTop: space.lg }}>
            <Podium top={podium} board={board} />
          </FadeIn>
        )}

        {others.length > 0 && (
          <View style={{ marginTop: space.lg, marginBottom: space.xs }}>
            <Text style={styles.listHead}>{searching ? 'Matches' : `From number 4 · ${BOARDS[board].unit}`}</Text>
            <SeamDivider />
          </View>
        )}
        <View style={{ gap: space.sm, marginTop: space.sm }}>
          {others.map(({ c, rank }, i) => (
            <FadeIn key={`${key}-${c.key}`} delay={Math.min(i, 10) * 40}>
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
  content: { padding: space.lg, paddingBottom: 130, gap: 0 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md, marginVertical: space.lg },
  title: { fontFamily: font.posterBlack, fontSize: 38, lineHeight: 42, color: colors.text, letterSpacing: -1.4 },
  sub: { color: colors.muted, fontSize: 13, fontFamily: font.medium, marginTop: 2 },
  squadBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 44, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: colors.surfaceHi, borderWidth: 1, borderColor: colors.border },
  squadText: { color: colors.text, fontSize: 13, fontFamily: font.bold },
  chipRow: { gap: space.sm, paddingRight: space.lg },
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
  listHead: { ...type.label, color: colors.muted, marginBottom: 4 },

  podiumHead: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm, paddingHorizontal: space.xs },
  podiumKicker: { ...type.label, color: colors.gold },
  podiumSub: { color: colors.muted, fontSize: 12, fontFamily: font.semibold },
  podiumRow: { flexDirection: 'row', alignItems: 'flex-end' },
  scene: { borderRadius: radius.xl, overflow: 'hidden', marginTop: space.sm, backgroundColor: '#05100A' },
  flood: { position: 'absolute', top: -80, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(240,255,220,0.05)', boxShadow: '0px 0px 90px 50px rgba(220,255,190,0.08)' } as object,
  field: { position: 'absolute', bottom: -40, borderTopLeftRadius: 9999, borderTopRightRadius: 9999, overflow: 'hidden' },
  pitch: { position: 'absolute', width: 68, height: 160, borderRadius: 6, backgroundColor: 'rgba(214,190,140,0.35)', transform: [{ perspective: 300 }, { rotateX: '62deg' }] },
  figureShadow: { position: 'absolute', bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)', boxShadow: '0px 0px 16px 6px rgba(0,0,0,0.35)' } as object,
  band: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  labels: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.sm },
  labelTop: { flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: '100%' },
  podiumCard: { borderRadius: radius.xl, overflow: 'hidden', borderWidth: 1 },
  podiumFoot: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'flex-end', gap: 2, paddingHorizontal: 6, paddingBottom: space.md },
  medalPos: { position: 'absolute', top: 8, left: 8 },
  monogram: { fontFamily: font.posterBlack, opacity: 0.55, letterSpacing: -2 },
  medal: { alignItems: 'center', justifyContent: 'center' },
  medalRing: { position: 'absolute', borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.22)' },
  medalText: { color: '#1A1405', fontFamily: font.posterBlack, ...type.num },
  podiumName: { color: hero.text, fontFamily: font.posterBlack, fontSize: 14, lineHeight: 17, textAlign: 'center', letterSpacing: -0.3 },
  podiumTeam: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '100%' },
  podiumTeamText: { color: hero.muted, fontSize: 11, fontFamily: font.semibold, flexShrink: 1 },
  podiumValue: { fontFamily: font.posterBlack, fontSize: 28, lineHeight: 32, marginTop: 2, ...type.num },
  podiumUnit: { ...type.label, fontSize: 9, color: hero.muted, marginTop: -2 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    ...edge,
  },
  rank: { width: 26, color: colors.faint, fontSize: 16, fontFamily: font.posterBlack, ...type.num },
  name: { color: colors.text, fontSize: 16, fontFamily: font.bold },
  teamLine: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 },
  team: { color: colors.faint, fontSize: 12, fontFamily: font.semibold, flexShrink: 1 },
  statsLine: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.md, marginTop: 4 },
  stat: { color: colors.muted, fontSize: 12, fontFamily: font.bold, ...type.num },
  statKey: { color: colors.faint, fontSize: 10, fontFamily: font.heavy, textTransform: 'uppercase', letterSpacing: 0.4 },
  mainValue: { color: colors.text, fontSize: 28, lineHeight: 30, fontFamily: font.posterBlack, ...type.num },
  mainUnit: { ...type.label, fontSize: 9, color: colors.faint },

  headButton: { height: 46 },
  filters: { flexDirection: 'row', alignItems: 'center', gap: space.md, flexWrap: 'wrap' },

  table: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', ...edge },
  tr: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg },
  thead: { height: 44, borderBottomWidth: 1, borderColor: colors.border },
  trBody: { minHeight: 60, borderBottomWidth: 1, borderColor: colors.border },
  th: { ...type.label, fontSize: 10.5, color: colors.faint },
  thNum: { textAlign: 'right' },
  cRank: { width: 30, alignItems: 'flex-start' },
  cNum: { width: 66, minHeight: 44, justifyContent: 'center', textAlign: 'right' },
  tdWho: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: space.md },
  td: { color: colors.muted, fontSize: 15, fontFamily: font.semibold, textAlignVertical: 'center', lineHeight: 44, ...type.num },
  tdMain: { color: colors.text, fontFamily: font.posterBlack, fontSize: 19 },

  empty: { paddingVertical: space.xxl, gap: space.sm },
  emptyBig: { fontFamily: font.posterBlack, fontSize: 46, lineHeight: 52, color: colors.surfaceHi },
  emptyBody: { color: colors.muted, fontSize: 14, fontFamily: font.regular, maxWidth: 320 },
});
