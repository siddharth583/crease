import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PlayerAvatar } from '../../components/Avatar.tsx';
import { Card, IconButton, PageToneProvider, PressableScale, Screen, usePageTone, SectionLabel, tap, GhostWord, PitchStripes, useToast, inYear, matchYears, YearChips } from '../../components/ui.tsx';
import { CountUp, GrowBar, PopIn, Rise, Sheen } from '../../components/motion.tsx';
import { OvalGround, SeamDivider } from '../../components/cricket.tsx';
import { TeamCrest } from '../../components/TeamCrest.tsx';
import { Columns, Page, useLayout } from '../../components/layout.tsx';
import { PlayerPhoto } from '../../components/MomAward.tsx';
import { MatchRatings } from '../../components/Ratings.tsx';
import { BigHits } from '../../components/BigHits.tsx';
import { playerRatings } from '../../engine/ratings.ts';
import { oversText } from '../../engine/engine.ts';
import { BALLS_TO_CALL, bigHits, matchups, type Matchup } from '../../engine/records.ts';
import type { Match } from '../../engine/types.ts';
import {
  battingAverage,
  bestFigures,
  bowlingAverage,
  bowlingOvers,
  careerStats,
  COMMON_TEAM,
  economy,
  keyFor,
  strikeRate,
  type MatchLine,
} from '../../engine/stats.ts';
import { useMatches } from '../../store/matches.tsx';
import { useSquad } from '../../store/squad.ts';
import { useAccess, usePhotos, useSetPhoto } from '../../store/sync.tsx';
import { pickPhoto } from '../../store/files.ts';
import { colors, edge, gradients, radius, space, type, font, ink, hero, ownTeamTheme, teamTheme, glass } from '../../theme.ts';
import { photoFor, photoKey } from '../../engine/photos.ts';

const fmt = (n: number | null, digits = 1) => (n === null ? '–' : n.toFixed(digits));
const day = (ms: number) => new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * The side they play for most (the latest of them on a tie), not just their last. Matches as the common player count
 * for neither; someone who has only ever been the common player is "Both teams".
 */
function mainTeam(matches: Match[], key: string): string {
  const count = new Map<string, { name: string; n: number; last: number }>();
  for (const m of matches)
    for (const t of m.teams)
      for (const p of t.players) {
        if (p.common || keyFor(t, p) !== key) continue;
        const k = t.name.trim().toLowerCase();
        const was = count.get(k) ?? { name: t.name.trim(), n: 0, last: 0 };
        count.set(k, { name: t.name.trim(), n: was.n + 1, last: Math.max(was.last, m.createdAt) });
      }
  const best = [...count.values()].sort((a, b) => b.n - a.n || b.last - a.last)[0];
  return best?.name ?? COMMON_TEAM;
}

type Milestone = { title: string; line: MatchLine };

/** Their landmarks, in the match each came in: a first fifty, career runs and wickets. Oldest first. */
function milestones(history: MatchLine[]): Milestone[] {
  const out: Milestone[] = [];
  let runs = 0;
  let wickets = 0;
  let fifty = false;
  const RUNS = [100, 250, 500, 1000];
  const WICKETS = [10, 25, 50];
  for (const line of [...history].reverse()) {
    const r = line.bat?.runs ?? 0;
    if (!fifty && r >= 50) {
      fifty = true;
      out.push({ title: `First fifty: ${r}${line.bat!.notOut ? '*' : ''}`, line });
    }
    for (const n of RUNS) if (runs < n && runs + r >= n) out.push({ title: `${n} career runs`, line });
    runs += r;
    const w = line.bowl?.wickets ?? 0;
    for (const n of WICKETS) if (wickets < n && wickets + w >= n) out.push({ title: `${n} career wickets`, line });
    wickets += w;
  }
  return out;
}

/** One duel on the player's page: the other player, how often one got the other out, and the duel's page. */
function DuelRow({ m, name, first }: { m: Matchup; name: string; first: boolean }) {
  return (
    <PressableScale
      scaleTo={0.98}
      onPress={() => router.push({ pathname: '/rivalry', params: { bat: m.batterKey, bowl: m.bowlerKey } })}
      style={[styles.duel, !first && styles.matchBorder]}
      accessibilityLabel={`${name}: out ${m.outs} times in ${m.balls} balls`}
    >
      <PlayerAvatar name={name} size={32} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.matchTitle} numberOfLines={2}>
          {name}
        </Text>
        <Text style={styles.matchDate}>
          {m.runs} off {m.balls} ball{m.balls === 1 ? '' : 's'} · {m.matches} match{m.matches === 1 ? '' : 'es'}
        </Text>
      </View>
      <Text style={styles.duelOuts}>
        {m.outs}
        <Text style={styles.duelUnit}>×</Text>
      </Text>
      <Ionicons name="chevron-forward" size={16} color={colors.faint} />
    </PressableScale>
  );
}

/** A figure that counts up when it's a number ("24.5", 147); text like "3/18" or "–" just shows. */
function Figure({ value, style }: { value: string | number; style: StyleProp<TextStyle> }) {
  const text = String(value);
  if (!/^\d+(\.\d+)?$/.test(text)) return <Text style={style}>{text}</Text>;
  const decimals = text.includes('.') ? text.split('.')[1].length : 0;
  return <CountUp value={Number(text)} style={style} format={(n) => n.toFixed(decimals)} />;
}

/** Three to a row, always: a short last row keeps the columns above it rather than stretching across. */
function Tiles({ items }: { items: [string, string | number, boolean?][] }) {
  const tone = usePageTone();
  const rows: (typeof items)[] = [];
  items.forEach((item, i) => (rows[Math.floor(i / 3)] ??= []).push(item));
  return (
    <View style={styles.tiles}>
      {rows.map((row, r) => (
        <View key={r} style={styles.tileRow}>
          {[0, 1, 2].map((k) => {
            if (!row[k]) return <View key={k} style={styles.tileGap} />;
            const [label, value, hero] = row[k];
            return (
              <Rise key={label} index={r * 3 + k} step={45} style={{ flex: 1, minWidth: 0 }}>
              <View style={[styles.tile, tone && { backgroundColor: tone.card, borderColor: tone.line }, hero && (tone ? { borderColor: tone.accent, backgroundColor: tone.soft } : styles.tileHero)]}>
                <Figure value={value} style={[styles.tileValue, hero && { color: tone?.ink ?? colors.accentInk }]} />
                <Text style={styles.tileLabel}>{label}</Text>
              </View>
              </Rise>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function MatchRow({ line, index }: { line: MatchLine; index: number }) {
  const tone = usePageTone();
  const date = new Date(line.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  const label = line.won === null ? 'No result' : line.won ? 'Won' : 'Lost';
  const col = line.won === true ? tone?.ink ?? colors.accentInk : line.won === false ? colors.danger : colors.muted;
  return (
    <Rise index={index} step={35}>
      <PressableScale
        scaleTo={0.98}
        onPress={() => router.push({ pathname: '/match/[id]/scorecard', params: { id: line.matchId } })}
        accessibilityLabel={`Match against ${line.opponent}, ${label}, ${date}`}
        style={styles.ticket}
      >
        <View style={[styles.stub, line.won === true && { backgroundColor: tone?.soft ?? colors.accentDim }, line.won === false && { backgroundColor: colors.dangerDim }]}>
          <Text style={[styles.stubBig, { color: col }]}>{line.won === null ? '–' : line.won ? 'W' : 'L'}</Text>
          <Text style={[styles.stubSmall, { color: col }]}>{label}</Text>
        </View>
        <View style={styles.perf} />
        <View style={{ flex: 1, minWidth: 0, paddingVertical: space.md, paddingHorizontal: space.md, gap: 3 }}>
          <Text numberOfLines={1} style={styles.matchTitle}>
            vs {line.opponent}
          </Text>
          <Text style={styles.matchDate}>{date}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginTop: 2 }}>
            {line.bat && (
              <Text style={styles.fig}>
                <Text style={styles.figKey}>BAT </Text>
                {line.bat.runs}
                {line.bat.notOut ? '*' : ''} ({line.bat.balls} balls)
              </Text>
            )}
            {line.bowl && (
              <Text style={styles.fig}>
                <Text style={styles.figKey}>BOWL </Text>
                {line.bowl.wickets}/{line.bowl.runs} ({oversText(line.bowl.balls)} ov)
              </Text>
            )}
            {!line.bat && !line.bowl && <Text style={styles.matchDate}>Did not bat or bowl</Text>}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.faint} style={{ marginRight: space.md }} />
      </PressableScale>
    </Rise>
  );
}

type Tab = 'overview' | 'batting' | 'bowling' | 'matches';
const TABS: { value: Tab; label: string }[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'batting', label: 'Batting' },
  { value: 'bowling', label: 'Bowling' },
  { value: 'matches', label: 'Matches' },
];

/** The sticky tabs: a brass-and-jade underline glides to the one picked. */
function TabBar({ value, onChange }: { value: Tab; onChange: (t: Tab) => void }) {
  const [w, setW] = useState(0);
  const x = useRef(new Animated.Value(0)).current;
  const i = TABS.findIndex((t) => t.value === value);
  useEffect(() => {
    if (w) Animated.spring(x, { toValue: (w / TABS.length) * i, useNativeDriver: false, speed: 16, bounciness: 6 }).start();
  }, [i, w, x]);
  return (
    <View style={styles.tabs} onLayout={(e) => setW(e.nativeEvent.layout.width)} accessibilityRole="tablist">
      {TABS.map((t) => (
        <PressableScale key={t.value} scaleTo={0.96} wrapStyle={{ flex: 1 }} style={styles.tab} accessibilityRole="tab" accessibilityLabel={t.label} accessibilityState={{ selected: t.value === value }} onPress={() => onChange(t.value)}>
          <Text style={[styles.tabText, t.value === value && { color: colors.text, fontFamily: font.heavy }]}>{t.label}</Text>
        </PressableScale>
      ))}
      {w > 0 && <Animated.View style={[styles.tabLine, { width: w / TABS.length - 16, transform: [{ translateX: Animated.add(x, 8) }] }]} />}
    </View>
  );
}

/** Where the runs (or runs conceded) came from: one tile per source with its runs and its share, no bars. */
function Breakdown({ title, rows, note }: { title: string; rows: { label: string; value: number; color: string }[]; note: string }) {
  const total = rows.reduce((n, r) => n + r.value, 0);
  if (!total) return null;
  return (
    <>
      <SectionLabel right={<Text style={styles.formHint}>{total} runs</Text>}>{title}</SectionLabel>
      <Card style={{ gap: space.md }}>
        <View style={styles.brGrid}>
          {rows.map((r, i) => (
            <PopIn key={r.label} delay={120 + i * 90} turn={0} style={styles.brTile}>
              <View accessibilityLabel={`${r.label}: ${r.value} runs, ${Math.round((r.value / total) * 100)} percent`}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={[styles.brDot, { backgroundColor: r.color }]} />
                  <Text style={styles.brLabel} numberOfLines={1}>
                    {r.label}
                  </Text>
                </View>
                <CountUp value={r.value} style={styles.brValue} />
                <Text style={styles.brShare}>{Math.round((r.value / total) * 100)}% of runs</Text>
              </View>
            </PopIn>
          ))}
        </View>
        <SeamDivider />
        <Text style={styles.formHint}>{note}</Text>
      </Card>
    </>
  );
}

export default function PlayerProfile() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const { matches, ready } = useMatches();
  const insets = useSafeAreaInsets();
  const { squad } = useSquad();
  const photos = usePhotos();
  const setPhoto = useSetPhoto();
  const { admin } = useAccess();
  const toast = useToast();
  const layout = useLayout();
  const { wide, desk } = layout;
  const [year, setYear] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const whole = useMemo(() => careerStats(matches).find((x) => x.key === key), [matches, key, squad]);
  // A season: only the years they played in, and every figure below from that year's matches alone.
  const years = useMemo(() => matchYears((whole?.history ?? []).map((h) => ({ createdAt: h.date }))), [whole]);
  const seasonMatches = useMemo(() => inYear(matches, year), [matches, year]);
  const c = useMemo(() => (year === null ? whole : careerStats(seasonMatches).find((x) => x.key === key) ?? whole), [whole, year, seasonMatches, key, squad]);
  const team = useMemo(() => (whole ? mainTeam(matches, whole.key) : COMMON_TEAM), [matches, whole, squad]);
  const duels = useMemo(() => matchups(seasonMatches), [seasonMatches, squad]);
  const photo = c ? photoFor(photos, c.name) : undefined;
  // The page wears the colours of the side they play for most.
  const side = teamTheme(team);
  // Their side's theme over the whole page: the haze, the cards, the highlights.
  const tone = ownTeamTheme(team) ?? null;
  // Their match ratings out of 10 and their form, as on the squad list.
  const rated = useMemo(() => playerRatings(matches, key), [matches, key]);

  // The admin can set a squad player's photo from here.
  const regular = c ? squad.find((p) => photoKey(p.name) === photoKey(c.name)) : undefined;
  const choosePhoto = async () => {
    if (!regular) return;
    try {
      const picked = await pickPhoto();
      if (picked) await setPhoto(regular, picked);
    } catch {
      toast.show('Couldn’t save the photo. Try again.', 'error');
    }
  };
  const bar = (
    <View style={[styles.header, wide && { paddingHorizontal: 0, paddingTop: space.lg, paddingBottom: space.md }]}>
      <IconButton icon="chevron-back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/players'))} />
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        {c && (
          <PressableScale
            scaleTo={0.94}
            accessibilityLabel={`Compare ${c.name} with another player`}
            onPress={() => router.push({ pathname: '/compare', params: { a: c.key } })}
            style={styles.compare}
          >
            <Ionicons name="git-compare-outline" size={17} color={colors.text} />
            <Text style={styles.compareText}>Compare</Text>
          </PressableScale>
        )}
        {admin && regular && <IconButton icon="camera-outline" label={photo ? 'Change photo' : 'Add photo'} onPress={() => void choosePhoto()} />}
      </View>
    </View>
  );
  // A tablet or laptop: the bar lines up with the page under it.
  const back = wide ? (
    <View style={{ paddingHorizontal: layout.gutter }}>
      <Page>{bar}</Page>
    </View>
  ) : (
    bar
  );
  if (!c) {
    return (
      <Screen>
        {back}
        <Text style={styles.missing}>{ready ? 'Player not found' : 'Loading…'}</Text>
      </Screen>
    );
  }

  const wins = c.history.filter((h) => h.won === true).length;
  // Landmarks count the whole career (a season's 100 runs isn't one); a season shows the ones that came in it.
  const marks = milestones((whole ?? c).history).filter((m) => year === null || new Date(m.line.date).getFullYear() === year);
  // Who gets them out most, and whom they get out most: every duel with a wicket in it, most wickets first.
  const byOuts = (a: Matchup, b: Matchup) => b.outs - a.outs || a.balls - b.balls;
  const nemeses = duels.filter((d) => d.batterKey === c.key && d.outs > 0).sort(byOuts).slice(0, 3);
  const hits = bigHits(duels, c.key);
  const bunnies = duels.filter((d) => d.bowlerKey === c.key && d.outs > 0).sort(byOuts).slice(0, 3);
  // Oldest first, so the chart reads left to right like a season.
  const form = c.history.filter((h) => h.bat).slice(0, 10).reverse();
  const peak = Math.max(20, ...form.map((h) => h.bat!.runs));

  const recent = form.slice(-6);
  const thirty = recent.filter((h) => h.bat!.runs >= 30).length;
  const fifties = form.filter((h) => h.bat!.runs >= 50).length;
  const takeaway =
    form.length === 0
      ? ''
      : thirty > 0
        ? `Scored 30+ in ${thirty} of last ${recent.length}${fifties ? `, with ${fifties} fifty${fifties === 1 ? '' : ' or more'}` : ''}`
        : `No 30+ score in the last ${recent.length} innings yet`;
  const role = c.batting.innings && c.bowling.balls ? (c.batting.runs >= 50 && c.bowling.wickets >= 3 ? 'All-rounder' : c.bowling.wickets * 12 > c.batting.runs ? 'Bowler' : 'Batter') : c.bowling.balls ? 'Bowler' : c.batting.innings ? 'Batter' : 'Fielder';
  /** The role as a scorer would write it on the card: AR, BAT, BOW (FLD if they've only fielded). */
  const roleShort = ({ 'All-rounder': 'AR', Batter: 'BAT', Bowler: 'BOW', Fielder: 'FLD' } as const)[role];
  const boundaryRuns = c.batting.fours * 4 + c.batting.sixes * 6;
  const running = Math.max(0, c.batting.runs - boundaryRuns);
  const concededBound = c.bowling.fours * 4 + c.bowling.sixes * 6;
  const concededOther = Math.max(0, c.bowling.runs - concededBound);
  const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

  const sections = {
    ratings: rated.history.length > 0 && (
      <>
        <SectionLabel right={<Text style={styles.formHint}>Out of 10</Text>}>Match ratings</SectionLabel>
        <Card>
          <MatchRatings history={rated.history} />
        </Card>
      </>
    ),
    form: form.length > 0 && (
      <>
        <SectionLabel right={<Text style={styles.formHint}>Last {form.length} innings, runs</Text>}>Recent form</SectionLabel>
        <Card style={{ gap: space.md }}>
          <View style={styles.formCard} accessibilityLabel={`Runs in the last ${form.length} innings: ${form.map((h) => h.bat!.runs).join(', ')}`}>
            {form.map((h, i) => {
              const runs = h.bat!.runs;
              const duck = runs === 0 && !h.bat!.notOut;
              const col = runs >= 50 ? colors.gold : duck ? colors.danger : runs >= 30 ? side.accent : ink(0.25);
              return (
                <View key={h.matchId} style={styles.formCol}>
                  <Text style={[styles.formText, runs >= 50 && { color: colors.gold }, duck && { color: colors.danger }]}>
                    {runs}
                    {h.bat!.notOut ? '*' : ''}
                  </Text>
                  <GrowBar vertical share={Math.max(4 / 90, runs / peak)} delay={150 + i * 70} trackStyle={styles.formTrack} style={[styles.formBar, { backgroundColor: col }]} />
                  <Text style={styles.formVs} numberOfLines={1}>
                    {new Date(h.date).getDate()}/{new Date(h.date).getMonth() + 1}
                  </Text>
                </View>
              );
            })}
          </View>
          <SeamDivider />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
            <Ionicons name="trending-up" size={16} color={side.ink} />
            <Text style={[styles.takeaway, { flex: 1 }]}>{takeaway}</Text>
          </View>
          <View style={styles.legend}>
            {[
              [colors.gold, '50+'],
              [side.accent, '30 to 49'],
              [ink(0.25), 'Under 30'],
              [colors.danger, 'Duck'],
            ].map(([col, l]) => (
              <View key={l} style={styles.legendItem}>
                <View style={[styles.dot, { backgroundColor: col }]} />
                <Text style={styles.formHint}>{l}</Text>
              </View>
            ))}
          </View>
        </Card>
      </>
    ),
    bat: (
      <>
        <SectionLabel>Batting</SectionLabel>
        {c.batting.innings ? (
          <Tiles
            items={[
              ['Runs', c.batting.runs, true],
              ['Average', fmt(battingAverage(c))],
              ['Strike rate', fmt(strikeRate(c))],
              ['Innings', c.batting.innings],
              ['Highest score', `${c.batting.highest}${c.batting.highestNotOut ? '*' : ''}`],
              ['Not outs', c.batting.notOuts],
              ['Fours', c.batting.fours],
              ['Sixes', c.batting.sixes],
              ['Fifties', c.batting.fifties],
              ['Ducks', c.batting.ducks],
            ]}
          />
        ) : (
          <Card>
            <Text style={styles.none}>Hasn’t batted yet. Their innings will show here once they bat.</Text>
          </Card>
        )}
      </>
    ),
    batBreak: c.batting.runs > 0 && (
      <Breakdown
        title="Where the runs came from"
        rows={[
          { label: 'Sixes', value: c.batting.sixes * 6, color: colors.accent },
          { label: 'Fours', value: c.batting.fours * 4, color: colors.cyan },
          { label: 'Running', value: running, color: ink(0.3) },
        ]}
        note={`${pct(boundaryRuns, c.batting.runs)}% of ${c.name.split(' ')[0]}’s runs came in boundaries.`}
      />
    ),
    bigHits: <BigHits hits={hits} first={c.name.split(' ')[0]} />,
    bowl: (
      <>
        <SectionLabel>Bowling</SectionLabel>
        {c.bowling.balls ? (
          <Tiles
            items={[
              ['Wickets', c.bowling.wickets, true],
              ['Economy', fmt(economy(c), 2)],
              ['Best figures', bestFigures(c)],
              ['Overs', bowlingOvers(c)],
              ['Average', fmt(bowlingAverage(c))],
              ['Maidens', c.bowling.maidens],
              ['Fours conceded', c.bowling.fours],
              ['Sixes conceded', c.bowling.sixes],
            ]}
          />
        ) : (
          <Card>
            <Text style={styles.none}>Hasn’t bowled yet. Their overs will show here once they bowl.</Text>
          </Card>
        )}
      </>
    ),
    bowlBreak: c.bowling.runs > 0 && (
      <Breakdown
        title="Where the runs went"
        rows={[
          { label: 'Sixes', value: c.bowling.sixes * 6, color: colors.accent },
          { label: 'Fours', value: c.bowling.fours * 4, color: colors.cyan },
          { label: 'Others', value: concededOther, color: ink(0.3) },
        ]}
        note={`${pct(concededBound, c.bowling.runs)}% of the runs scored off ${c.name.split(' ')[0]} came in boundaries.`}
      />
    ),
    fielding: (
      <>
        <SectionLabel>Fielding</SectionLabel>
        <Tiles items={[['Catches', c.fielding.catches], ['Run outs', c.fielding.runOuts], ['Stumpings', c.fielding.stumpings]]} />
      </>
    ),
    marks: marks.length > 0 && (
      <>
        <SectionLabel right={<Text style={styles.formHint}>{marks.length} honour{marks.length === 1 ? '' : 's'}</Text>}>Milestones</SectionLabel>
        <View style={{ gap: space.sm }}>
          {marks.map((m, i) => (
            <Rise key={`${m.title}-${m.line.matchId}`} index={i} step={60}>
              <PressableScale
                scaleTo={0.98}
                onPress={() => router.push({ pathname: '/match/[id]/scorecard', params: { id: m.line.matchId } })}
                accessibilityLabel={`${m.title}, against ${m.line.opponent}, ${day(m.line.date)}`}
                style={styles.plaque}
              >
                <LinearGradient pointerEvents="none" colors={[colors.goldDim, 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
                <PopIn delay={150 + i * 60} turn={-18}>
                  <View style={styles.plaqueIcon}>
                    <Ionicons name="ribbon" size={18} color={colors.gold} />
                  </View>
                </PopIn>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.plaqueTitle}>{m.title}</Text>
                  <Text style={styles.matchDate} numberOfLines={1}>
                    vs {m.line.opponent} · {day(m.line.date)}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.faint} />
              </PressableScale>
            </Rise>
          ))}
        </View>
      </>
    ),
    rivals:
      nemeses.length > 0 || bunnies.length > 0 ? (
        <>
          <SectionLabel>Rivalries</SectionLabel>
          <View style={{ gap: space.md }}>
            {nemeses.length > 0 && (
              <Card style={{ padding: 0 }}>
                <Text style={styles.duelHead}>Who gets {c.name.split(' ')[0]} out</Text>
                {nemeses.map((d, i) => (
                  <DuelRow key={d.id} m={d} name={d.bowler} first={i === 0} />
                ))}
              </Card>
            )}
            {bunnies.length > 0 && (
              <Card style={{ padding: 0 }}>
                <Text style={styles.duelHead}>Whom {c.name.split(' ')[0]} gets out most</Text>
                {bunnies.map((d, i) => (
                  <DuelRow key={d.id} m={d} name={d.batter} first={i === 0} />
                ))}
              </Card>
            )}
            <Text style={styles.formHint}>Tap one for the whole duel. A duel gets a verdict once they’ve met for {BALLS_TO_CALL} balls.</Text>
          </View>
        </>
      ) : null,
    matches: (
      <>
        <SectionLabel right={<Text style={styles.formHint}>{wins} won of {c.history.length}</Text>}>Matches</SectionLabel>
        <View style={{ gap: space.sm }}>
          {c.history.map((h, i) => (
            <MatchRow key={h.matchId} line={h} index={i} />
          ))}
        </View>
      </>
    ),
  };

  const pane = (kids: ReactNode[]) => (
    <View key={tab} style={{ gap: 0 }}>
      {kids.filter(Boolean).map((k, i) => (
        <Rise key={i} index={i} step={70}>
          {k}
        </Rise>
      ))}
    </View>
  );
  const two = (l: ReactNode[], r: ReactNode[]) => (
    <Columns weights={[1, 1]} gap={space.lg} key={tab}>
      <View>{l.filter(Boolean)}</View>
      <View>{r.filter(Boolean)}</View>
    </Columns>
  );
  const content =
    tab === 'overview'
      ? wide
        ? two([sections.form, sections.ratings, sections.bigHits], [sections.marks, sections.rivals, sections.fielding])
        : pane([sections.form, sections.ratings, sections.marks, sections.rivals, sections.bigHits, sections.fielding])
      : tab === 'batting'
        ? wide
          ? two([sections.bat], [sections.batBreak])
          : pane([sections.bat, sections.batBreak])
        : tab === 'bowling'
          ? wide
            ? two([sections.bowl], [sections.bowlBreak])
            : pane([sections.bowl, sections.bowlBreak])
          : pane([sections.matches]);
  const pad = wide ? layout.gutter : space.lg;

  return (
    <PageToneProvider value={tone}>
      <Screen>
        {back}
        <ScrollView stickyHeaderIndices={[1]} contentContainerStyle={{ paddingBottom: insets.bottom + space.xxl }} showsVerticalScrollIndicator={false}>
          <View style={{ paddingHorizontal: pad }}>
            <Page>
              <LinearGradient colors={side.hero} start={{ x: 0, y: 0 }} end={{ x: wide ? 1 : 0, y: 1 }} style={[styles.hero, wide && styles.heroWide]}>
                <OvalGround opacity={0.09} />
                <PitchStripes tint="255,255,255" />
                <Sheen />
                <View style={photo ? [styles.stage, wide && styles.stageWide] : styles.plain}>
                  {photo && (
                    // Their photo set into the corner, the shoulders and the left edge fading into the card.
                    <View pointerEvents="none" style={[styles.portrait, wide && styles.portraitWide]}>
                      <PlayerPhoto uri={photo} />
                    </View>
                  )}
                  <View style={styles.heroTop}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {team !== COMMON_TEAM && <TeamCrest name={team} size={24} />}
                      {team === COMMON_TEAM ? (
                        // The common player has no one side: a label, not a link to an empty page.
                        <View style={[styles.teamTag, { backgroundColor: side.accent }]}>
                          <Text style={[styles.teamTagText, { color: side.onAccent }]}>{team}</Text>
                        </View>
                      ) : (
                        <PressableScale
                          scaleTo={0.95}
                          hitSlop={10}
                          onPress={() => router.push({ pathname: '/team/[name]', params: { name: team } })}
                          accessibilityLabel={`${team} team page`}
                          style={[styles.teamTag, { backgroundColor: side.accent }]}
                        >
                          <Text style={[styles.teamTagText, { color: side.onAccent }]}>{team} ›</Text>
                        </PressableScale>
                      )}
                    </View>
                    <View style={{ flexDirection: 'row', gap: 5 }}>
                      <View style={styles.formPill} accessibilityLabel={role}>
                        <Text style={styles.formPillText}>{roleShort}</Text>
                      </View>
                      {rated.form !== null && (
                        <View style={[styles.formPill, rated.form >= 8 && { backgroundColor: side.accent }]} accessibilityLabel={`Form ${rated.form.toFixed(1)} out of 10`}>
                          <Text style={[styles.formPillText, rated.form >= 8 && { color: side.onAccent }]}>
                            Form <Text style={styles.formPillValue}>{rated.form.toFixed(1)}</Text>
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <Text
                    style={[
                      styles.name,
                      photo ? [styles.nameOnPhoto, longestWord(c.name) > 10 && styles.nameOnPhotoLong] : longestWord(c.name) > 10 && styles.nameLong,
                      wide && styles.nameWide,
                      wide && photo && { maxWidth: '62%' },
                    ]}
                    numberOfLines={2}
                  >
                    {c.name}
                  </Text>
                </View>
                <View style={[styles.heroStats, photo && { marginTop: space.md }, wide && styles.heroStatsWide]}>
                  {[
                    ['Matches', c.matches, colors.gold],
                    ['Wins', wins, hero.text],
                    ['Runs', c.batting.runs, hero.text],
                    ['Wickets', c.bowling.wickets, hero.text],
                  ].map(([label, value, col], i) => (
                    <View key={label as string} style={[styles.heroStat, i > 0 && styles.heroStatLine]}>
                      <CountUp value={Number(value)} delay={i * 120} style={[styles.heroValue, { color: col as string }, wide && { fontSize: 34, lineHeight: 38 }]} />
                      <Text style={styles.heroLabel}>{label as string}</Text>
                    </View>
                  ))}
                </View>
              </LinearGradient>
              {years.length > 1 && (
                <View style={{ marginTop: space.md }}>
                  <YearChips years={years} value={year} onChange={setYear} />
                </View>
              )}
            </Page>
          </View>
          <View style={styles.tabWrap}>
            <View style={{ paddingHorizontal: pad }}>
              <Page>
                <TabBar value={tab} onChange={setTab} />
              </Page>
            </View>
          </View>
          <View style={{ paddingHorizontal: pad, paddingTop: space.sm }}>
            <Page>{content}</Page>
          </View>
        </ScrollView>
      </Screen>
    </PageToneProvider>
  );
}

/** A long word (a surname like Bhattacharjee) gets smaller type, so it fits on its line rather than being cut. */
const longestWord = (name: string) => Math.max(...name.split(/\s+/).map((w) => w.length));

/** Fades the portrait's shoulders and its left edge into the card (the browser's mask; elsewhere it shows as is). */
const PORTRAIT_FADE = (Platform.OS === 'web'
  ? {
      maskImage: 'linear-gradient(to bottom, #000 62%, transparent 100%), linear-gradient(to right, transparent 0%, #000 22%)',
      maskComposite: 'intersect',
      WebkitMaskImage: 'linear-gradient(to bottom, #000 62%, transparent 100%), linear-gradient(to right, transparent 0%, #000 22%)',
      WebkitMaskComposite: 'source-in',
    }
  : {}) as object;

const styles = StyleSheet.create({
  brGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  brTile: { flexGrow: 1, flexBasis: '30%', minWidth: 96, padding: space.md, borderRadius: radius.md, backgroundColor: colors.surfaceHi, borderWidth: 1, borderColor: colors.border },
  brDot: { width: 8, height: 8, borderRadius: 4 },
  brLabel: { color: colors.muted, fontSize: 12, fontFamily: font.semibold, flexShrink: 1 },
  brValue: { color: colors.text, fontFamily: font.posterBlack, fontSize: 26, lineHeight: 30, marginTop: 4, ...type.num },
  brShare: { color: colors.faint, fontSize: 11, fontFamily: font.medium },
  plain: { alignSelf: 'stretch' },
  heroWide: { padding: space.xxl, minHeight: 300 },
  stageWide: { height: 220 },
  portraitWide: { top: -space.xxl, right: 0, width: 300, height: 252 },
  nameWide: { fontSize: 64, lineHeight: 70, letterSpacing: -2 },
  tabWrap: { backgroundColor: colors.bg, paddingTop: space.sm },
  tabs: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, height: 48, marginBottom: space.sm, ...edge },
  tab: { height: 46, alignItems: 'center', justifyContent: 'center' },
  tabText: { color: colors.muted, fontSize: 13, fontFamily: font.semibold },
  tabLine: { position: 'absolute', bottom: 0, left: 0, height: 3, borderRadius: 2, backgroundColor: colors.accent },
  takeaway: { color: colors.text, fontSize: 14, fontFamily: font.bold },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  brTrack: { height: 8, borderRadius: 4, backgroundColor: colors.surfaceHi, overflow: 'hidden' },
  brFill: { height: 8, borderRadius: 4 },
  plaque: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.gold, backgroundColor: colors.surface, overflow: 'hidden', ...edge },
  plaqueIcon: { width: 38, height: 38, borderRadius: 19, borderWidth: 1.5, borderColor: colors.gold, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.goldDim },
  plaqueTitle: { color: colors.gold, fontSize: 15, fontFamily: font.posterBlack, letterSpacing: -0.2 },
  ticket: { flexDirection: 'row', alignItems: 'stretch', backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', ...edge },
  stub: { width: 64, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceHi, gap: 1 },
  stubBig: { fontFamily: font.posterBlack, fontSize: 24, lineHeight: 26 },
  stubSmall: { ...type.label, fontSize: 9 },
  perf: { width: 0, borderLeftWidth: 1.5, borderStyle: 'dashed', borderColor: colors.borderHi, marginVertical: 6 },
  fig: { color: colors.muted, fontSize: 13, fontFamily: font.bold, ...type.num },
  figKey: { color: colors.faint, fontSize: 10, fontFamily: font.heavy, letterSpacing: 0.5 },
  heroStatLine: { borderLeftWidth: 1, borderLeftColor: hero.ink(0.1) },
  heroStatsWide: { alignSelf: 'flex-start', width: '100%', maxWidth: 560, paddingHorizontal: space.md, zIndex: 1 },
  wideCols: { flexDirection: 'row', gap: space.lg, alignItems: 'flex-start' },
  wideCol: { flex: 1, minWidth: 0 },
  // With a photo: a fixed stage the photo fills on the right; the tags at the top, the name at the foot over the faded shoulders.
  stage: { alignSelf: 'stretch', height: 168, justifyContent: 'space-between' },
  portrait: { position: 'absolute', top: -space.xl, right: 0, width: 190, height: 192 },
  nameOnPhoto: { fontSize: 36, lineHeight: 40, letterSpacing: -1, marginTop: 0, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 14, textShadowOffset: { width: 0, height: 2 } },
  nameOnPhotoLong: { fontSize: 30, lineHeight: 34 },
  nameLong: { fontSize: 38, lineHeight: 44 },
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingVertical: space.sm },
  missing: { color: colors.muted, textAlign: 'center', marginTop: space.xxl },
  hero: {
    borderRadius: radius.xl,
    padding: space.xl,
    alignItems: 'flex-start',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: hero.line,
  },
  name: { fontFamily: font.posterBlack, fontSize: 49, lineHeight: 55, color: hero.text, letterSpacing: -1.5, marginTop: space.lg, alignSelf: 'stretch' },
  // The team, and their form under it, the same size.
  heroTop: { alignSelf: 'flex-start', alignItems: 'flex-start', gap: 6 },
  formPill: { flexDirection: 'row', alignItems: 'center', height: 20, paddingHorizontal: 7, borderRadius: 7, backgroundColor: hero.ink(0.12) },
  formPillText: { ...type.label, fontSize: 10, letterSpacing: 0.6, color: hero.text },
  formPillValue: { fontFamily: font.heavy, letterSpacing: 0, ...type.num },
  teamTag: { alignSelf: 'flex-start', backgroundColor: colors.accent, paddingHorizontal: 7, height: 20, borderRadius: 7, justifyContent: 'center', transform: [{ skewX: '-8deg' }] },
  teamTagText: { ...type.label, fontSize: 10, letterSpacing: 0.6, color: colors.onAccent },
  // On the dark panel in either theme: a darker strip and the night greys, so it reads in Day mode too.
  heroStats: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    marginTop: space.xl,
    ...glass,
    borderRadius: radius.md,
    paddingVertical: space.md,
  },
  heroStat: { flex: 1, alignItems: 'center' },
  heroValue: { color: hero.text, fontSize: 28, lineHeight: 31, fontFamily: font.posterBlack, ...type.num },
  heroLabel: { ...type.label, fontSize: 9, color: hero.muted, marginTop: 2 },
  compare: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 44, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: colors.surfaceHi, borderWidth: 1, borderColor: colors.border },
  compareText: { color: colors.text, fontSize: 13, fontFamily: font.bold },
  duel: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  duelHead: { ...type.label, color: colors.muted, paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.xs },
  duelOuts: { color: colors.danger, fontSize: 22, fontFamily: font.posterBlack, ...type.num },
  duelUnit: { fontSize: 14, fontFamily: font.poster },
  form: { flexDirection: 'row', gap: space.sm },
  formChip: {
    minWidth: 52,
    height: 44,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formHot: { borderColor: colors.gold, backgroundColor: colors.goldDim },
  formHint: { color: colors.faint, fontSize: 12, fontFamily: font.medium },
  formCard: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 160, paddingBottom: space.md },
  formCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  formTrack: { height: 90, width: '100%', maxWidth: 24, marginTop: 4, justifyContent: 'flex-end' },
  formBar: { width: '100%', borderRadius: 6, backgroundColor: ink(0.25) },
  formVs: { color: colors.faint, fontSize: 9, fontFamily: font.bold, marginTop: 4 },
  formText: { color: colors.text, fontSize: 16, fontFamily: font.posterBlack, ...type.num },
  tiles: { gap: space.sm },
  tileRow: { flexDirection: 'row', gap: space.sm },
  tileGap: { flex: 1 },
  tile: {
    flex: 1,
    minWidth: 0,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
  },
  tileHero: { borderColor: colors.accent, backgroundColor: colors.accentDim },
  tileValue: { color: colors.text, fontSize: 28, lineHeight: 31, fontFamily: font.posterBlack, ...type.num },
  tileLabel: { color: colors.muted, fontSize: 12, fontFamily: font.semibold, marginTop: 2 },
  none: { color: colors.muted, fontSize: 14 , fontFamily: font.regular},
  matchRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  matchBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  result: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.surfaceHi,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultText: { color: colors.muted, fontFamily: font.heavy, fontSize: 13 },
  matchTitle: { color: colors.text, fontSize: 15, fontFamily: font.bold },
  matchDate: { color: colors.faint, fontSize: 12, fontFamily: font.regular, marginTop: 1 },
  matchFigures: { color: colors.muted, fontSize: 13, fontFamily: font.bold, ...type.num },
});
