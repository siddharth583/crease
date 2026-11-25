import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo, useState, type ComponentProps, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PlayerAvatar } from '../../components/Avatar.tsx';
import { BallChip, Card, Chip, FadeIn, IconButton, inYear, matchYears, PressableScale, Screen, Sheet, useToast, YearChips } from '../../components/ui.tsx';
import { CountUp, Rise, Sheen, Tug } from '../../components/motion.tsx';
import { OvalGround, SeamDivider } from '../../components/cricket.tsx';
import { FaceOff } from '../../components/FaceOff.tsx';
import { BrassIcon, CategoryTabs, Figure, Medal, Plaque, ShareBar } from '../../components/HonoursBoard.tsx';
import { StatsNav } from '../../components/StatsNav.tsx';
import { TeamCrest } from '../../components/TeamCrest.tsx';
import { Columns, useLayout } from '../../components/layout.tsx';
import { BALLS_TO_CALL, headToHead, matchups, records, rivalryContext, teamNames, verdict } from '../../engine/records.ts';
import { useMatches } from '../../store/matches.tsx';
import { useMatchFiles } from '../../store/useMatchFiles.ts';
import { useSquad } from '../../store/squad.ts';
import { plural } from '../../engine/text.ts';
import { colors, edge, font, gradients, hero, isDay, ownTeamTheme, radius, space, type } from '../../theme.ts';

const day = (ms: number) => new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const openPlayer = (key: string) => () => router.push({ pathname: '/player/[key]', params: { key } });
/** A side's short tag: its last word, first three letters (Copan Royals: ROY). */
const short = (n: string) => (n.trim().split(/\s+/).pop() ?? n).slice(0, 3).toUpperCase();
const openMatch = (id: string) => () => router.push({ pathname: '/match/[id]/scorecard', params: { id } });

type Tab = 'bat' | 'bowl' | 'team' | 'rivals';
/** `avatar`: the player's name, for their photo beside the row. */
type Item = { title: string; sub: string; value: number; display: string; unit?: string; avatar?: string; onPress?: () => void };

/** Standard competition ranks: equal values share a place and the next one skips (1, 2, 2, 4). */
const ranksOf = (items: Item[]) => items.map((x, i) => items.findIndex((y) => y.value === x.value) + 1 || i + 1);
type IconName = ComponentProps<typeof Ionicons>['name'];

/** One record as a brass plaque: the holder large with a medal, the chasers ranked under with a bar against the top mark. */
function Board({ label, icon, items, empty }: { label: string; icon: IconName; items: Item[]; empty?: string }) {
  const [first, ...rest] = items;
  const ranks = ranksOf(items);
  // In the grid every board in a row is as tall as the tallest, so the row ends on one line.
  const { wide } = useLayout();
  // Bars only make sense where the best is the biggest (not lowest totals or economy).
  const bars = !!first && first.value > 0 && items.every((x) => x.value <= first.value);
  return (
    <Plaque style={wide ? { flex: 1 } : undefined} glow={!!first}>
      <View style={styles.plaqueHead} accessibilityRole="header">
        <BrassIcon name={icon} size={30} />
        <Text style={styles.plaqueTitle} numberOfLines={2}>
          {label}
        </Text>
      </View>
      {!first ? (
        <Text style={styles.empty}>{empty ?? 'Nothing yet. Play a few more matches.'}</Text>
      ) : (
        <>
          <PressableScale disabled={!first.onPress} dimWhenDisabled={false} scaleTo={0.98} onPress={first.onPress} style={styles.champ} accessibilityLabel={`${label}: ${first.title}, ${first.display}${first.unit ?? ''}`}>
            <View>
              {first.avatar ? <PlayerAvatar name={first.avatar} size={56} /> : <BrassIcon name={icon} size={56} tone="brass" />}
              <View style={styles.champMedal}>
                <Medal rank={1} size={24} delay={450} />
              </View>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.champLabel}>{ranks[1] === 1 ? 'Joint record holder' : 'Record holder'}</Text>
              <Text style={styles.champName} numberOfLines={2}>
                {first.title}
              </Text>
              <Text style={styles.champSub} numberOfLines={2}>
                {first.sub}
              </Text>
            </View>
            <Figure display={first.display} unit={first.unit} delay={250} style={styles.champValue} unitStyle={styles.champUnit} />
          </PressableScale>
          {rest.length > 0 && <SeamDivider style={{ marginHorizontal: space.lg }} />}
          {rest.map((x, i) => (
            <PressableScale key={i} disabled={!x.onPress} dimWhenDisabled={false} scaleTo={0.98} onPress={x.onPress} style={styles.row} accessibilityLabel={`${ranks[i + 1]}. ${x.title}, ${x.display}${x.unit ?? ''}`}>
              {ranks[i + 1]! <= 3 ? <Medal rank={ranks[i + 1]!} size={22} delay={600 + i * 90} /> : <Text style={styles.rank}>{ranks[i + 1]}</Text>}
              {x.avatar ? <PlayerAvatar name={x.avatar} size={28} /> : null}
              <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                <Text style={styles.title} numberOfLines={1}>
                  {x.title}
                </Text>
                <Text style={styles.sub} numberOfLines={1}>
                  {x.sub}
                </Text>
              </View>
              <Text style={styles.value}>
                {x.display}
                {x.unit ? <Text style={styles.unit}>{x.unit}</Text> : null}
              </Text>
            </PressableScale>
          ))}
          <View style={{ height: space.sm }} />
        </>
      )}
    </Plaque>
  );
}

/** The boards of a tab: rising in one after another, a grid on a tablet or laptop. */
function Boards({ children }: { children: ReactNode[] }) {
  const { wide } = useLayout();
  const items = children.map((c, i) => (
    <Rise key={i} index={i} step={60} style={wide ? { flex: 1 } : undefined}>
      {c}
    </Rise>
  ));
  return wide ? (
    <Columns tablet={2} laptop={3} gap={space.lg}>
      {items}
    </Columns>
  ) : (
    <View style={{ gap: space.lg }}>{items}</View>
  );
}

/** The season as a scoreboard on the outfield. */
function Season({ s, year, wide }: { s: ReturnType<typeof records>['summary']; year: number | null; wide?: boolean }) {
  const big = [
    { k: 'Matches', v: s.matches },
    { k: 'Runs', v: s.runs },
    { k: 'Wickets', v: s.wickets },
    { k: 'Sixes', v: s.sixes },
  ];
  const small = [
    { k: 'Fours', v: s.fours, icon: 'arrow-forward-circle' as IconName },
    { k: 'Fifties', v: s.fifties, icon: 'ribbon' as IconName },
    { k: 'Ducks', v: s.ducks, icon: 'egg-outline' as IconName },
  ];
  return (
    <View style={[styles.season, wide && styles.seasonWide]} accessibilityLabel={`Season totals: ${s.matches} matches, ${s.runs} runs, ${s.wickets} wickets, ${s.sixes} sixes`}>
      <LinearGradient pointerEvents="none" colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <OvalGround opacity={0.07} />
      <Sheen />
      <View style={styles.seasonTop}>
        <Ionicons name="trophy" size={14} color={hero.gold} />
        <Text style={styles.seasonLabel}>{year === null ? 'The season so far' : `${year} season`}</Text>
      </View>
      <View style={styles.seasonRow}>
        {big.map((c, i) => (
          <View key={c.k} style={{ flex: c.k === 'Runs' ? 1.5 : 1 }}>
            <CountUp value={c.v} delay={i * 90} style={[styles.seasonValue, wide && { fontSize: 46, lineHeight: 50 }]} />
            <Text style={styles.seasonKey}>{c.k}</Text>
          </View>
        ))}
      </View>
      <SeamDivider color={hero.ink(0.18)} style={{ marginVertical: space.md }} />
      <View style={styles.seasonRow}>
        {small.map((c, i) => (
          <View key={c.k} style={styles.seasonSmall}>
            <Ionicons name={c.icon} size={16} color={hero.muted} />
            <CountUp value={c.v} delay={400 + i * 90} style={styles.seasonSmallValue} />
            <Text style={styles.seasonSmallKey}>{c.k}</Text>
          </View>
        ))}
        <View style={styles.seasonSmall}>
          <Ionicons name="timer-outline" size={16} color={hero.muted} />
          <CountUp value={Math.round(s.balls / 6)} delay={700} style={styles.seasonSmallValue} />
          <Text style={styles.seasonSmallKey}>Overs</Text>
        </View>
      </View>
    </View>
  );
}

const TABS: { value: Tab; label: string; icon: IconName; mci?: 'cricket' | 'baseball' | 'sword-cross' }[] = [
  // The cricket bat for batting, the ball for bowling, a crest for teams, crossed swords for a duel.
  { value: 'bat', label: 'Batting', icon: 'baseball-outline', mci: 'cricket' },
  { value: 'bowl', label: 'Bowling', icon: 'disc-outline', mci: 'baseball' },
  { value: 'team', label: 'Teams', icon: 'shield-outline' },
  { value: 'rivals', label: 'Rivalries', icon: 'flash-outline', mci: 'sword-cross' },
];

export default function Records() {
  const insets = useSafeAreaInsets();
  const { matches: everyMatch } = useMatches();
  const { squad } = useSquad();
  const years = useMemo(() => matchYears(everyMatch), [everyMatch]);
  const [year, setYear] = useState<number | null>(null);
  // A season's record book: only its matches count, for every record below.
  const matches = useMemo(() => inYear(everyMatch, year), [everyMatch, year]);
  const r = useMemo(() => records(matches), [matches, squad]);
  const teams = useMemo(() => teamNames(matches), [matches]);
  const [tab, setTab] = useState<Tab>('bat');
  const [a, setA] = useState<string | null>(null);
  const [b, setB] = useState<string | null>(null);
  const ta = a ?? teams[0];
  const tb = b ?? teams.find((t) => t !== ta);
  const h2h = useMemo(() => (ta && tb ? headToHead(matches, ta, tb) : null), [matches, ta, tb]);
  const allDuels = useMemo(() => matchups(matches), [matches, squad]);
  const ctx = useMemo(() => rivalryContext(allDuels), [allDuels]);
  const duels = useMemo(() => allDuels.filter((d) => d.balls >= BALLS_TO_CALL).sort((x, y) => y.balls - x.balls), [allDuels]);
  const [lean, setLean] = useState<'all' | 'batter' | 'bowler' | 'even'>('all');
  const [shown, setShown] = useState(8);
  const leaning = duels.filter((d) => lean === 'all' || verdict(d, ctx).side === lean);
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const { exportRecordBook, importFile } = useMatchFiles(toast.show);
  const layout = useLayout();
  const { wide } = layout;
  // A tablet or laptop: the page at its reading width (the scroller's children stay direct, for the sticky tabs).
  const side = wide ? Math.max(layout.gutter, (layout.width - layout.maxWidth) / 2) : space.lg;
  const exportBook = async (format: 'pdf' | 'image' | 'file') => {
    if (saving) return;
    setExporting(false);
    setSaving(true);
    await exportRecordBook(format);
    setSaving(false);
  };
  const colA = ownTeamTheme(ta)?.accent ?? colors.accent;
  const colB = ownTeamTheme(tb)?.accent ?? colors.violet;
  const lead = h2h ? (h2h.winsA === h2h.winsB ? 'All square' : h2h.winsA > h2h.winsB ? `${ta} lead ${h2h.winsA}-${h2h.winsB}` : `${tb} lead ${h2h.winsB}-${h2h.winsA}`) : '';

  return (
    <Screen>
      <View style={[styles.header, wide && { paddingHorizontal: side, paddingTop: space.lg, gap: space.lg }]}>
        {!wide && <View style={{ flex: 1 }} />}
        {wide && (
          <Text style={[styles.pageTitle, styles.pageTitleWide]} numberOfLines={1}>
            Record book
          </Text>
        )}
        <View style={styles.headerActions}>
          <PressableScale accessibilityLabel="Import a record book or match file" onPress={() => importFile('The record book is up to date.')} style={styles.importPill}>
            <Ionicons name="download-outline" size={17} color={colors.text} />
            <Text style={styles.importText}>Import</Text>
          </PressableScale>
          <PressableScale accessibilityLabel="Export the record book" disabled={!matches.length || saving} onPress={() => setExporting(true)} style={styles.export}>
            <Ionicons name="share-outline" size={17} color={colors.onAccent} />
            <Text style={styles.exportText}>{saving ? 'Exporting…' : 'Export'}</Text>
          </PressableScale>
        </View>
      </View>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: side, paddingTop: wide ? space.md : 0, paddingBottom: insets.bottom + 130 }}
        // Five slots, always: stats nav, title, years, season, tabs. The tabs stick.
        stickyHeaderIndices={[4]}
      >
        <View style={wide ? { maxWidth: 420 } : null}>
          <StatsNav />
        </View>
        <View>
          {!wide && (
            <View style={{ paddingTop: space.md }}>
              <Text style={styles.pageTitle}>Record book</Text>
              <Text style={styles.pageSub}>The honours board of every match played</Text>
            </View>
          )}
        </View>
        {/* Always a view, so the tabs below stay the sticky child whether or not there are years to pick. */}
        <View style={{ paddingTop: space.md }}>
          <YearChips years={years} value={year} onChange={setYear} />
        </View>
        <FadeIn>
          <Season s={r.summary} year={year} wide={wide} />
        </FadeIn>
        <View style={[styles.tabs, wide && { paddingTop: space.xl, paddingBottom: space.md }]}>
          <View style={wide ? { maxWidth: 560 } : null}>
            <CategoryTabs<Tab> value={tab} onChange={setTab} options={TABS} />
          </View>
        </View>

        {tab === 'bat' && (
          <Boards key="bat">
            {[
              <Board key="runs" label="Most runs" icon="trending-up" items={r.mostRuns.map((x) => ({ title: x.name, sub: `${x.team} · ${x.sub}`, value: x.count, display: String(x.count), avatar: x.name, onPress: openPlayer(x.key) }))} />,
              <Board
                key="hs"
                label="Highest scores"
                icon="flame"
                items={r.highScores.map((x) => ({ title: x.name, sub: `${plural(x.balls, 'ball')} v ${x.vs} · ${day(x.date)}`, value: x.runs, display: `${x.runs}${x.notOut ? '*' : ''}`, avatar: x.name, onPress: openPlayer(x.key) }))}
              />,
              <Board
                key="avg"
                label="Best average (3+ innings)"
                icon="analytics"
                items={r.bestAverage.map((x) => ({ title: x.name, sub: `${x.team} · ${x.sub}`, value: x.rate, display: x.rate.toFixed(1), avatar: x.name, onPress: openPlayer(x.key) }))}
              />,
              <Board
                key="sr"
                label="Best strike rate (30+ balls)"
                icon="speedometer"
                items={r.bestStrikeRate.map((x) => ({ title: x.name, sub: x.sub, value: x.rate, display: x.rate.toFixed(0), unit: ' SR', avatar: x.name, onPress: openPlayer(x.key) }))}
              />,
              <Board
                key="fast"
                label="Fastest innings (15+ balls)"
                icon="flash"
                items={r.fastest.map((x) => ({ title: x.name, sub: `${x.runs} off ${x.balls} v ${x.vs} · ${day(x.date)}`, value: (x.runs * 100) / x.balls, display: ((x.runs * 100) / x.balls).toFixed(0), unit: ' SR', avatar: x.name, onPress: openPlayer(x.key) }))}
              />,
              <Board
                key="part"
                label="Biggest partnerships"
                icon="people"
                items={r.partnerships.map((x) => ({ title: x.names, sub: `${plural(x.balls, 'ball')} · ${x.team} v ${x.vs} · ${day(x.date)}`, value: x.runs, display: String(x.runs), onPress: openMatch(x.matchId) }))}
              />,
              <Board key="6s" label="Most sixes" icon="rocket" items={r.mostSixes.map((x) => ({ title: x.name, sub: `${x.team} · ${x.sub ?? ''}`, value: x.count, display: String(x.count), avatar: x.name, onPress: openPlayer(x.key) }))} />,
              <Board key="4s" label="Most fours" icon="arrow-forward-circle" items={r.mostFours.map((x) => ({ title: x.name, sub: `${x.team} · ${x.sub ?? ''}`, value: x.count, display: String(x.count), avatar: x.name, onPress: openPlayer(x.key) }))} />,
              <Board key="mom" label="Most Man of the Match awards" icon="star" items={r.mostMoM.map((x) => ({ title: x.name, sub: x.team, value: x.count, display: String(x.count), unit: '×', avatar: x.name, onPress: openPlayer(x.key) }))} />,
            ]}
          </Boards>
        )}

        {tab === 'bowl' && (
          <Boards key="bowl">
            {[
              <Board key="wk" label="Most wickets" icon="trending-up" items={r.mostWickets.map((x) => ({ title: x.name, sub: `${x.team} · ${x.sub}`, value: x.count, display: String(x.count), avatar: x.name, onPress: openPlayer(x.key) }))} />,
              <Board
                key="bb"
                label="Best bowling"
                icon="flame"
                items={r.bestBowling.map((x) => ({ title: x.name, sub: `${x.overs} overs v ${x.vs} · ${day(x.date)}`, value: x.wickets * 100 - x.runs, display: `${x.wickets}/${x.runs}`, avatar: x.name, onPress: openPlayer(x.key) }))}
              />,
              <Board
                key="eco"
                label="Best economy (6+ overs)"
                icon="lock-closed"
                items={r.bestEconomy.map((x) => ({ title: x.name, sub: x.sub, value: x.rate, display: x.rate.toFixed(2), unit: ' an over', avatar: x.name, onPress: openPlayer(x.key) }))}
              />,
              <Board key="dots" label="Most dot balls" icon="ellipse-outline" items={r.mostDots.map((x) => ({ title: x.name, sub: `${x.team} · ${x.sub ?? ''}`, value: x.count, display: String(x.count), avatar: x.name, onPress: openPlayer(x.key) }))} />,
              <Board
                key="4c"
                label="Most fours conceded"
                icon="arrow-forward-circle"
                items={r.mostFoursConceded.map((x) => ({ title: x.name, sub: `${x.team} · ${x.sub ?? ''}`, value: x.count, display: String(x.count), avatar: x.name, onPress: openPlayer(x.key) }))}
              />,
              <Board
                key="6c"
                label="Most sixes conceded"
                icon="rocket"
                items={r.mostSixesConceded.map((x) => ({ title: x.name, sub: `${x.team} · ${x.sub ?? ''}`, value: x.count, display: String(x.count), avatar: x.name, onPress: openPlayer(x.key) }))}
              />,
              <Board
                key="ext"
                label="Most wides & no-balls"
                icon="warning"
                empty="Not a wide or no-ball yet."
                items={r.mostExtras.map((x) => ({ title: x.name, sub: `${x.team} · ${x.sub ?? ''}`, value: x.count, display: String(x.count), avatar: x.name, onPress: openPlayer(x.key) }))}
              />,
              <Board
                key="field"
                label="Most catches, run-outs & stumpings"
                icon="hand-left"
                items={r.mostDismissals.map((x) => ({ title: x.name, sub: `${x.team} · ${x.sub ?? ''}`, value: x.count, display: String(x.count), avatar: x.name, onPress: openPlayer(x.key) }))}
              />,
              <Plaque key="overs" style={wide ? { flex: 1 } : undefined}>
                <View style={styles.plaqueHead} accessibilityRole="header">
                  <BrassIcon name="cash-outline" size={30} />
                  <Text style={styles.plaqueTitle}>Most expensive overs</Text>
                </View>
                {r.dearestOvers.length === 0 && <Text style={styles.empty}>Nothing yet. Play a few more matches.</Text>}
                {r.dearestOvers.map((o, i) => (
                  <PressableScale key={i} scaleTo={0.98} onPress={openMatch(o.matchId)} style={[styles.overRow, i > 0 && styles.divided]}>
                    <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
                      <Text style={styles.title} numberOfLines={1}>
                        {o.bowler} <Text style={styles.sub}>· over {o.over} to {o.batting} · {day(o.date)}</Text>
                      </Text>
                      <View style={styles.chips}>
                        {o.balls.map((ball, j) => (
                          <BallChip key={j} ball={ball} size={26} animate />
                        ))}
                      </View>
                    </View>
                    <Text style={[styles.overTotal, i === 0 && { color: colors.danger }]}>{o.runs}</Text>
                  </PressableScale>
                ))}
              </Plaque>,
            ]}
          </Boards>
        )}

        {tab === 'team' && (
          <View key="team" style={{ gap: space.lg }}>
            {h2h && ta && tb && (
              <Rise index={0}>
                <View style={styles.sectionHead} accessibilityRole="header">
                  <BrassIcon name="git-compare-outline" size={30} />
                  <Text style={styles.plaqueTitle}>Head to head</Text>
                </View>
                <Card style={{ gap: space.sm, marginBottom: space.md }}>
                  <Text style={styles.pickLabel}>Pick two sides</Text>
                  <View style={styles.pickRow}>
                    {teams.map((t) => (
                      <Chip key={`a-${t}`} label={t} selected={t === ta} onPress={() => setA(t)} />
                    ))}
                  </View>
                  <SeamDivider />
                  <View style={styles.pickRow}>
                    {teams
                      .filter((t) => t !== ta)
                      .map((t) => (
                        <Chip key={`b-${t}`} label={t} tone="violet" selected={t === tb} onPress={() => setB(t)} />
                      ))}
                  </View>
                </Card>
                <View style={styles.h2hHero}>
                  <LinearGradient pointerEvents="none" colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
                  <OvalGround opacity={0.07} />
                  <Sheen />
                  <View style={styles.h2h}>
                    <View style={styles.h2hSide}>
                      <TeamCrest name={ta} size={56} />
                      <CountUp value={h2h.winsA} style={[styles.h2hWins, { color: colA }]} />
                      <Text style={styles.h2hName} numberOfLines={2}>
                        {ta}
                      </Text>
                      <Text style={styles.h2hBest}>Best {h2h.bestA}</Text>
                    </View>
                    <View style={styles.h2hMid}>
                      <Text style={styles.h2hPlayed}>{h2h.played}</Text>
                      <Text style={styles.h2hBest}>played</Text>
                    </View>
                    <View style={styles.h2hSide}>
                      <TeamCrest name={tb} size={56} />
                      <CountUp value={h2h.winsB} style={[styles.h2hWins, { color: colB }]} />
                      <Text style={styles.h2hName} numberOfLines={2}>
                        {tb}
                      </Text>
                      <Text style={styles.h2hBest}>Best {h2h.bestB}</Text>
                    </View>
                  </View>
                  {h2h.played > 0 && (
                    <View style={styles.tug}>
                      <Tug edge={(h2h.winsA + 0.001) / (h2h.winsA + h2h.winsB + 0.002)} style={StyleSheet.absoluteFill} leftStyle={[styles.tugBat, { backgroundColor: colA }]} rightStyle={[styles.tugBowl, { backgroundColor: colB }]} />
                    </View>
                  )}
                  <Text style={styles.h2hLead}>
                    {h2h.played ? lead : 'No meetings yet'}
                    {h2h.ties ? ` · ${h2h.ties} drawn or tied` : ''}
                  </Text>
                  {h2h.recent.length > 0 && <SeamDivider color={hero.ink(0.18)} style={{ marginTop: space.sm }} />}
                  {h2h.recent.map((g) => (
                    <PressableScale key={g.matchId} scaleTo={0.98} onPress={openMatch(g.matchId)} style={styles.recent} accessibilityLabel={`${day(g.date)}: ${g.result}`}>
                      <View style={[styles.resultChip, { backgroundColor: g.winner === 'a' ? colA : g.winner === 'b' ? colB : hero.ink(0.2) }]}>
                        <Text style={[styles.resultChipText, g.winner === 'a' || (g.winner === 'b' && !isDay) ? { color: colors.onAccent } : null]}>{g.winner === 'a' ? short(ta) : g.winner === 'b' ? short(tb) : 'TIE'}</Text>
                      </View>
                      <Text style={styles.recentText} numberOfLines={1}>
                        {day(g.date)} · {g.result}
                      </Text>
                      <Ionicons name="chevron-forward" size={14} color={hero.faint} />
                    </PressableScale>
                  ))}
                </View>
              </Rise>
            )}
            <Boards>
              {[
                <Board
                  key="wr"
                  label="Biggest wins by runs"
                  icon="trophy"
                  items={r.biggestWinsByRuns.map((x) => ({ title: x.winner, sub: `beat ${x.loser} · ${day(x.date)}`, value: x.margin, display: String(x.margin), unit: ' runs', onPress: openMatch(x.matchId) }))}
                />,
                <Board
                  key="ww"
                  label="Biggest wins by wickets"
                  icon="trophy-outline"
                  items={r.biggestWinsByWickets.map((x) => ({ title: x.winner, sub: `beat ${x.loser} · ${day(x.date)}`, value: x.margin, display: String(x.margin), unit: ' wkts', onPress: openMatch(x.matchId) }))}
                />,
                <Board
                  key="ht"
                  label="Highest totals"
                  icon="stats-chart"
                  items={r.highestTotals.map((x) => ({ title: x.team, sub: `${x.overs} overs v ${x.vs} · ${day(x.date)}`, value: x.runs, display: `${x.runs}/${x.wickets}`, onPress: openMatch(x.matchId) }))}
                />,
                <Board
                  key="lt"
                  label="Lowest totals"
                  icon="thermometer-outline"
                  items={r.lowestTotals.map((x) => ({ title: x.team, sub: `${x.overs} overs v ${x.vs} · ${day(x.date)}`, value: x.runs, display: `${x.runs}/${x.wickets}`, onPress: openMatch(x.matchId) }))}
                />,
                <Board
                  key="duck"
                  label="Hall of shame: most ducks"
                  icon="egg-outline"
                  empty="No ducks yet. Everyone’s got off the mark."
                  items={r.mostDucks.map((x) => ({ title: x.name, sub: `${x.team} · ${x.sub ?? ''}`, value: x.count, display: String(x.count), unit: '×', avatar: x.name, onPress: openPlayer(x.key) }))}
                />,
                <Board
                  key="spell"
                  label="Hall of shame: most expensive spells"
                  icon="cash-outline"
                  items={r.dearestSpells.map((x) => ({ title: x.name, sub: `${x.wickets}/${x.runs} off ${x.overs} overs v ${x.vs} · ${day(x.date)}`, value: x.runs, display: String(x.runs), unit: ' runs', avatar: x.name, onPress: openPlayer(x.key) }))}
                />,
              ]}
            </Boards>
          </View>
        )}

        {tab === 'rivals' && (
          <View key="rivals">
            {duels[0] ? (
              <>
                <Rise index={0}>
                  <View style={styles.sectionHead} accessibilityRole="header">
                    <BrassIcon name="flash" size={30} />
                    <Text style={styles.plaqueTitle}>Rivalry of the season</Text>
                  </View>
                  <Text style={styles.intro}>The batter and bowler who have met the most. Tap a duel to see every ball.</Text>
                  <FaceOff m={duels[0]} big ctx={ctx} />
                </Rise>
                <Rise index={1}>
                  <View style={[styles.sectionHead, { marginTop: space.xl }]} accessibilityRole="header">
                    <BrassIcon name="people" size={30} />
                    <Text style={styles.plaqueTitle}>Every rivalry ({BALLS_TO_CALL}+ balls)</Text>
                    <Text style={styles.count}>{leaning.length}</Text>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingBottom: space.md }}>
                    {(
                      [
                        ['all', 'All'],
                        ['batter', 'Bat on top'],
                        ['bowler', 'Ball on top'],
                        ['even', 'Even'],
                      ] as const
                    ).map(([k, l]) => (
                      <Chip key={k} label={l} selected={lean === k} tone={k === 'bowler' ? 'violet' : 'accent'} onPress={() => setLean(k)} />
                    ))}
                  </ScrollView>
                </Rise>
                {/* A tablet or laptop: the rivalries two to a row (three would cut the names). */}
                <Columns tablet={2} gap={wide ? space.md : space.sm}>
                  {leaning.slice(0, shown).map((d, i) => (
                    <Rise key={d.id} index={Math.min(i, 8) + 2} step={50}>
                      <FaceOff m={d} ctx={ctx} />
                    </Rise>
                  ))}
                </Columns>
                {leaning.length > shown && (
                  <PressableScale onPress={() => setShown(shown + 10)} style={styles.more}>
                    <Text style={styles.moreText}>Show {Math.min(10, leaning.length - shown)} more</Text>
                  </PressableScale>
                )}
              </>
            ) : (
              <Card style={{ marginTop: space.lg }}>
                <Text style={styles.empty}>Rivalries appear once a batter has faced a bowler for {BALLS_TO_CALL} balls or more.</Text>
              </Card>
            )}
          </View>
        )}
      </ScrollView>
      <Sheet visible={exporting} onClose={() => setExporting(false)} title="Export record book">
        <View style={{ gap: space.sm }}>
          {(
            [
              { format: 'pdf', icon: 'document-text', title: 'PDF', body: 'Every record, to read, print or send to anyone' },
              { format: 'image', icon: 'image', title: 'Image', body: 'The whole record book as one picture, to post in the group' },
              { format: 'file', icon: 'swap-horizontal', title: 'Record book file', body: `All ${plural(matches.length, 'match', 'matches')}, to import into Crease on another phone` },
            ] as { format: 'pdf' | 'image' | 'file'; icon: IconName; title: string; body: string }[]
          ).map((o) => (
            <PressableScale key={o.format} scaleTo={0.98} onPress={() => exportBook(o.format)} style={styles.option}>
              <View style={styles.optionIcon}>
                <Ionicons name={o.icon} size={20} color={colors.accentInk} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.optionTitle}>{o.title}</Text>
                <Text style={styles.optionBody}>{o.body}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.faint} />
            </PressableScale>
          ))}
          <Text style={styles.optionNote}>
            Importing a record book file adds its matches to yours; matches you already have are kept, and every record is
            worked out again.
          </Text>
        </View>
      </Sheet>
      {toast.element}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingVertical: space.sm },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  importPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surfaceHi,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    height: 44,
  },
  importText: { color: colors.text, fontSize: 13, fontFamily: font.heavy },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.surfaceHi,
    borderWidth: 1,
    borderColor: colors.borderHi,
    borderRadius: radius.lg,
    padding: space.md,
  },
  optionIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentDim },
  optionTitle: { fontFamily: font.poster, fontSize: 17, color: colors.text },
  optionBody: { color: colors.muted, fontSize: 12, fontFamily: font.medium, marginTop: 2 },
  optionNote: { color: colors.muted, fontSize: 12, fontFamily: font.medium, lineHeight: 18 },
  export: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.accent, borderRadius: radius.pill, paddingHorizontal: space.md, height: 44, ...edge },
  exportText: { color: colors.onAccent, fontSize: 13, fontFamily: font.heavy },
  pageTitle: { fontFamily: font.posterBlack, fontSize: 36, lineHeight: 40, color: colors.text, letterSpacing: -1.3 },
  pageTitleWide: { flex: 1, minWidth: 0, fontSize: 40, lineHeight: 46, letterSpacing: -1.2 },
  pageSub: { color: colors.muted, fontSize: 13, fontFamily: font.medium, marginTop: 2 },
  seasonWide: { padding: space.xl },
  season: { borderRadius: radius.xl, padding: space.lg, marginTop: space.md, overflow: 'hidden', borderWidth: 1, borderColor: hero.line },
  seasonTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  seasonLabel: { ...type.label, color: hero.gold },
  seasonRow: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  seasonValue: { fontFamily: font.posterBlack, fontSize: 28, lineHeight: 32, color: hero.text, ...type.num },
  seasonKey: { ...type.label, fontSize: 9, color: hero.muted },
  seasonSmall: { flex: 1, gap: 1 },
  seasonSmallValue: { fontFamily: font.posterBlack, fontSize: 22, lineHeight: 26, color: hero.text, ...type.num },
  seasonSmallKey: { ...type.label, fontSize: 9, color: hero.muted },
  // Room above as padding, not margin: stuck to the top, a margin would leave a strip the boards scroll through.
  tabs: { backgroundColor: colors.bg, paddingTop: space.md, paddingBottom: space.md },
  empty: { color: colors.muted, fontSize: 13, fontFamily: font.medium, lineHeight: 19, padding: space.lg, paddingTop: space.sm },
  plaqueHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.sm },
  plaqueTitle: { flex: 1, color: colors.text, fontSize: 17, lineHeight: 21, fontFamily: font.posterBlack, letterSpacing: -0.3 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.md, paddingHorizontal: 2 },
  intro: { color: colors.muted, fontSize: 13, fontFamily: font.medium, marginBottom: space.md, paddingHorizontal: 2 },
  champ: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  champMedal: { position: 'absolute', right: -6, bottom: -6 },
  champLabel: { ...type.label, fontSize: 9, color: colors.gold },
  champName: { fontFamily: font.posterBlack, fontSize: 20, lineHeight: 23, color: colors.text },
  champSub: { color: colors.muted, fontSize: 12, fontFamily: font.medium, marginTop: 1 },
  champValue: { fontFamily: font.posterBlack, fontSize: 34, lineHeight: 38, color: colors.gold, ...type.num },
  champUnit: { fontFamily: font.poster, fontSize: 13, color: colors.muted },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.sm },
  rank: { width: 22, textAlign: 'center', fontFamily: font.posterBlack, fontSize: 14, color: colors.faint },
  title: { color: colors.text, fontSize: 14, fontFamily: font.bold },
  sub: { color: colors.muted, fontSize: 12, fontFamily: font.regular },
  value: { fontFamily: font.posterBlack, fontSize: 18, color: colors.text, ...type.num },
  unit: { fontFamily: font.poster, fontSize: 12, color: colors.faint },
  overRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  divided: { borderTopWidth: 1, borderTopColor: colors.border },
  overTotal: { fontFamily: font.posterBlack, fontSize: 26, color: colors.text, ...type.num },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  tug: { height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: hero.ink(0.1), marginTop: space.md },
  tugBat: { borderRadius: 4 },
  tugBowl: { borderRadius: 4 },
  count: { color: colors.faint, fontSize: 13, fontFamily: font.bold },
  more: { padding: space.md, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  moreText: { color: colors.accentInk, fontSize: 13, fontFamily: font.bold },
  pickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  pickLabel: { ...type.label, color: colors.faint },
  h2hHero: { borderRadius: radius.xl, padding: space.lg, overflow: 'hidden', borderWidth: 1, borderColor: hero.line },
  h2h: { flexDirection: 'row', alignItems: 'flex-start' },
  h2hSide: { flex: 1, alignItems: 'center', gap: 2 },
  h2hMid: { alignItems: 'center', paddingTop: 22, width: 56 },
  h2hWins: { fontFamily: font.posterBlack, fontSize: 56, lineHeight: 62, ...type.num },
  h2hName: { fontFamily: font.poster, fontSize: 16, lineHeight: 19, color: hero.text, textAlign: 'center' },
  h2hBest: { ...type.label, fontSize: 9, color: hero.muted },
  h2hPlayed: { fontFamily: font.posterBlack, fontSize: 28, color: hero.gold },
  h2hLead: { fontFamily: font.posterBlack, fontSize: 16, color: hero.text, textAlign: 'center', marginTop: space.md },
  recent: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 40, paddingVertical: 4 },
  resultChip: { minWidth: 44, height: 22, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  resultChipText: { color: '#FFFFFF', fontSize: 10, fontFamily: font.heavy, letterSpacing: 0.6 },
  recentText: { flex: 1, color: hero.muted, fontSize: 13, fontFamily: font.semibold },
});
