import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState, type ComponentProps } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BallChip, Card, Chip, FadeIn, GhostWord, IconButton, PitchStripes, PressableScale, Screen, SectionLabel, Segmented, Sheet, useToast } from '../components/ui.tsx';
import { CountUp, GrowBar, Tug } from '../components/motion.tsx';
import { FaceOff } from '../components/FaceOff.tsx';
import { headToHead, matchups, records, teamNames, verdict } from '../engine/records.ts';
import { useMatches } from '../store/matches.tsx';
import { useMatchFiles } from '../store/useMatchFiles.ts';
import { useSquad } from '../store/squad.ts';
import { plural } from '../engine/text.ts';
import { colors, edge, font, hero, radius, space, type, HERO_BG } from '../theme.ts';

const day = (ms: number) => new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const openPlayer = (key: string) => () => router.push({ pathname: '/player/[key]', params: { key } });
const openMatch = (id: string) => () => router.push({ pathname: '/match/[id]/scorecard', params: { id } });

type Tab = 'bat' | 'bowl' | 'team' | 'rivals';
type Item = { title: string; sub: string; value: number; display: string; unit?: string; onPress?: () => void };
type IconName = ComponentProps<typeof Ionicons>['name'];

/** One record: the holder on a card of their own, the chasers under it with a bar against the top mark. */
function Board({ label, icon, items, empty, lowIsBest }: { label: string; icon: IconName; items: Item[]; empty?: string; lowIsBest?: boolean }) {
  const [first, ...rest] = items;
  const best = first?.value ?? 1;
  const share = (v: number) => Math.max(0.06, Math.min(1, lowIsBest ? best / Math.max(v, 0.01) : v / Math.max(best, 0.01)));
  return (
    <FadeIn>
      <SectionLabel>{label}</SectionLabel>
      {!first ? (
        <Card>
          <Text style={styles.empty}>{empty ?? 'Nothing yet. Play a few more matches.'}</Text>
        </Card>
      ) : (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <PressableScale disabled={!first.onPress} dimWhenDisabled={false} scaleTo={0.98} onPress={first.onPress} style={styles.champ}>
            <View style={styles.champIcon}>
              <Ionicons name={icon} size={20} color={colors.onAccent} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.champLabel}>Record holder</Text>
              <Text style={styles.champName} numberOfLines={1}>
                {first.title}
              </Text>
              <Text style={styles.champSub} numberOfLines={1}>
                {first.sub}
              </Text>
            </View>
            <Text style={styles.champValue}>
              {first.display}
              {first.unit ? <Text style={styles.champUnit}>{first.unit}</Text> : null}
            </Text>
          </PressableScale>
          {rest.map((x, i) => (
            <PressableScale key={i} disabled={!x.onPress} dimWhenDisabled={false} scaleTo={0.98} onPress={x.onPress} style={styles.row}>
              <Text style={styles.rank}>{i + 2}</Text>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={styles.rowTop}>
                  <Text style={styles.title} numberOfLines={1}>
                    {x.title}
                  </Text>
                  <Text style={styles.value}>
                    {x.display}
                    {x.unit ? <Text style={styles.unit}>{x.unit}</Text> : null}
                  </Text>
                </View>
                <GrowBar share={share(x.value)} delay={120 + i * 70} trackStyle={styles.track} style={styles.fill} />
                <Text style={styles.sub} numberOfLines={1}>
                  {x.sub}
                </Text>
              </View>
            </PressableScale>
          ))}
        </Card>
      )}
    </FadeIn>
  );
}

function Season({ s }: { s: ReturnType<typeof records>['summary'] }) {
  const cells = [
    { k: 'Matches', v: s.matches },
    { k: 'Runs', v: s.runs },
    { k: 'Wickets', v: s.wickets },
    { k: 'Sixes', v: s.sixes },
  ];
  return (
    <View style={styles.season}>
      <PitchStripes opacity={0.06} tint="255,255,255" />
      <GhostWord size={120} style={{ color: hero.ink(0.04) }}>
        SEASON
      </GhostWord>
      <Text style={styles.seasonLabel}>The season so far</Text>
      <View style={styles.seasonRow}>
        {cells.map((c) => (
          <View key={c.k} style={{ flex: 1 }}>
            <CountUp value={c.v} style={styles.seasonValue} />
            <Text style={styles.seasonKey}>{c.k}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.seasonLine}>
        {s.fours} fours · {s.fifties} fifties · {s.ducks} ducks · {(s.balls / 6).toFixed(0)} overs bowled
      </Text>
    </View>
  );
}

export default function Records() {
  const insets = useSafeAreaInsets();
  const { matches } = useMatches();
  const { squad } = useSquad();
  const r = useMemo(() => records(matches), [matches, squad]);
  const teams = useMemo(() => teamNames(matches), [matches]);
  const [tab, setTab] = useState<Tab>('bat');
  const [a, setA] = useState<string | null>(null);
  const [b, setB] = useState<string | null>(null);
  const ta = a ?? teams[0];
  const tb = b ?? teams.find((t) => t !== ta);
  const h2h = useMemo(() => (ta && tb ? headToHead(matches, ta, tb) : null), [matches, ta, tb]);
  const duels = useMemo(() => [...matchups(matches)].filter((d) => d.balls >= 6).sort((x, y) => y.balls - x.balls), [matches, squad]);
  const [lean, setLean] = useState<'all' | 'batter' | 'bowler' | 'even'>('all');
  const [shown, setShown] = useState(8);
  const leaning = duels.filter((d) => lean === 'all' || verdict(d).side === lean);
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const { exportRecordBook, importFile } = useMatchFiles(toast.show);
  const exportBook = async (format: 'pdf' | 'file') => {
    if (saving) return;
    setExporting(false);
    setSaving(true);
    await exportRecordBook(format);
    setSaving(false);
  };

  return (
    <Screen>
      <View style={styles.header}>
        <IconButton icon="chevron-back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/players'))} />
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
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: 0, paddingBottom: insets.bottom + space.xxl }} stickyHeaderIndices={[2]}>
        <Text style={styles.pageTitle}>
          Record book
        </Text>
        <Season s={r.summary} />
        <View style={styles.tabs}>
          <Segmented<Tab>
            value={tab}
            onChange={setTab}
            options={[
              { value: 'bat', label: 'Batting' },
              { value: 'bowl', label: 'Bowling' },
              { value: 'team', label: 'Teams' },
              { value: 'rivals', label: 'Rivalries' },
            ]}
          />
        </View>

        {tab === 'bat' && (
          <>
            <Board label="Most runs" icon="trending-up" items={r.mostRuns.map((x) => ({ title: x.name, sub: `${x.team} · ${x.sub}`, value: x.count, display: String(x.count), onPress: openPlayer(x.key) }))} />
            <Board
              label="Highest scores"
              icon="flame"
              items={r.highScores.map((x) => ({ title: x.name, sub: `${plural(x.balls, 'ball')} v ${x.vs} · ${day(x.date)}`, value: x.runs, display: `${x.runs}${x.notOut ? '*' : ''}`, onPress: openPlayer(x.key) }))}
            />
            <Board
              label="Fastest innings (15+ balls)"
              icon="flash"
              items={r.fastest.map((x) => ({ title: x.name, sub: `${x.runs} off ${x.balls} v ${x.vs} · ${day(x.date)}`, value: (x.runs * 100) / x.balls, display: ((x.runs * 100) / x.balls).toFixed(0), unit: ' SR', onPress: openPlayer(x.key) }))}
            />
            <Board
              label="Best strike rate (30+ balls)"
              icon="speedometer"
              items={r.bestStrikeRate.map((x) => ({ title: x.name, sub: x.sub, value: x.rate, display: x.rate.toFixed(0), unit: ' SR', onPress: openPlayer(x.key) }))}
            />
            <Board label="Most sixes" icon="rocket" items={r.mostSixes.map((x) => ({ title: x.name, sub: `${x.team} · ${x.sub ?? ''}`, value: x.count, display: String(x.count), onPress: openPlayer(x.key) }))} />
            <Board label="Most fours" icon="arrow-forward-circle" items={r.mostFours.map((x) => ({ title: x.name, sub: `${x.team} · ${x.sub ?? ''}`, value: x.count, display: String(x.count), onPress: openPlayer(x.key) }))} />
            <Board
              label="Biggest partnerships"
              icon="people"
              items={r.partnerships.map((x) => ({ title: x.names, sub: `${plural(x.balls, 'ball')} · ${x.team} v ${x.vs} · ${day(x.date)}`, value: x.runs, display: String(x.runs), onPress: openMatch(x.matchId) }))}
            />
            <Board label="Most Man of the Match awards" icon="star" items={r.mostMoM.map((x) => ({ title: x.name, sub: x.team, value: x.count, display: String(x.count), unit: '×', onPress: openPlayer(x.key) }))} />
          </>
        )}

        {tab === 'bowl' && (
          <>
            <Board label="Most wickets" icon="trending-up" items={r.mostWickets.map((x) => ({ title: x.name, sub: `${x.team} · ${x.sub}`, value: x.count, display: String(x.count), onPress: openPlayer(x.key) }))} />
            <Board
              label="Best bowling"
              icon="flame"
              items={r.bestBowling.map((x) => ({ title: x.name, sub: `${x.overs} overs v ${x.vs} · ${day(x.date)}`, value: x.wickets * 100 - x.runs, display: `${x.wickets}/${x.runs}`, onPress: openPlayer(x.key) }))}
            />
            <Board
              label="Best economy (6+ overs)"
              icon="lock-closed"
              lowIsBest
              items={r.bestEconomy.map((x) => ({ title: x.name, sub: x.sub, value: x.rate, display: x.rate.toFixed(2), unit: ' a over', onPress: openPlayer(x.key) }))}
            />
            <Board
              label="Most catches, run-outs & stumpings"
              icon="hand-left"
              items={r.mostDismissals.map((x) => ({ title: x.name, sub: `${x.team} · ${x.sub ?? ''}`, value: x.count, display: String(x.count), onPress: openPlayer(x.key) }))}
            />
            <SectionLabel>Most expensive overs</SectionLabel>
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              {r.dearestOvers.map((o, i) => (
                <PressableScale key={i} scaleTo={0.98} onPress={openMatch(o.matchId)} style={[styles.overRow, i === 0 && { borderTopWidth: 0 }]}>
                  <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
                    <Text style={styles.title} numberOfLines={1}>
                      {o.bowler} <Text style={styles.sub}>· over {o.over} to {o.batting} · {day(o.date)}</Text>
                    </Text>
                    <View style={styles.chips}>
                      {o.balls.map((ball, j) => (
                        <BallChip key={j} ball={ball} size={26} />
                      ))}
                    </View>
                  </View>
                  <Text style={[styles.value, i === 0 && { color: colors.danger }]}>{o.runs}</Text>
                </PressableScale>
              ))}
            </Card>
          </>
        )}

        {tab === 'team' && (
          <>
            {h2h && ta && tb && (
              <FadeIn>
                <SectionLabel>Head to head</SectionLabel>
                <Card style={{ gap: space.md }}>
                  <View style={styles.pickRow}>
                    {teams.map((t) => (
                      <Chip key={`a-${t}`} label={t} selected={t === ta} onPress={() => setA(t)} />
                    ))}
                  </View>
                  <Text style={styles.vs}>vs</Text>
                  <View style={styles.pickRow}>
                    {teams
                      .filter((t) => t !== ta)
                      .map((t) => (
                        <Chip key={`b-${t}`} label={t} tone="violet" selected={t === tb} onPress={() => setB(t)} />
                      ))}
                  </View>
                  <View style={styles.h2h}>
                    <View style={styles.h2hSide}>
                      <Text style={[styles.h2hWins, { color: colors.accentInk }]}>{h2h.winsA}</Text>
                      <Text style={styles.h2hName} numberOfLines={1}>
                        {ta}
                      </Text>
                      <Text style={styles.sub}>Best {h2h.bestA}</Text>
                    </View>
                    <View style={{ alignItems: 'center' }}>
                      <Text style={styles.h2hPlayed}>{h2h.played}</Text>
                      <Text style={styles.sub}>played{h2h.ties ? ` · ${h2h.ties} tied` : ''}</Text>
                    </View>
                    <View style={[styles.h2hSide, { alignItems: 'flex-end' }]}>
                      <Text style={[styles.h2hWins, { color: colors.violet }]}>{h2h.winsB}</Text>
                      <Text style={styles.h2hName} numberOfLines={1}>
                        {tb}
                      </Text>
                      <Text style={styles.sub}>Best {h2h.bestB}</Text>
                    </View>
                  </View>
                  {h2h.played > 0 && (
                    <View style={styles.tug}>
                      <Tug
                        edge={(h2h.winsA + 0.001) / (h2h.winsA + h2h.winsB + 0.002)}
                        style={StyleSheet.absoluteFill}
                        leftStyle={styles.tugBat}
                        rightStyle={styles.tugBowl}
                      />
                    </View>
                  )}
                  {h2h.recent.map((g) => (
                    <PressableScale key={g.matchId} scaleTo={0.98} onPress={openMatch(g.matchId)} style={styles.recent}>
                      <View style={[styles.dot, { backgroundColor: g.winner === 'a' ? colors.accent : g.winner === 'b' ? colors.violet : colors.faint }]} />
                      <Text style={styles.recentText} numberOfLines={1}>
                        {day(g.date)} · {g.result}
                      </Text>
                    </PressableScale>
                  ))}
                </Card>
              </FadeIn>
            )}
            <Board
              label="Biggest wins by runs"
              icon="trophy"
              items={r.biggestWinsByRuns.map((x) => ({ title: x.winner, sub: `beat ${x.loser} · ${day(x.date)}`, value: x.margin, display: String(x.margin), unit: ' runs', onPress: openMatch(x.matchId) }))}
            />
            <Board
              label="Biggest wins by wickets"
              icon="trophy-outline"
              items={r.biggestWinsByWickets.map((x) => ({ title: x.winner, sub: `beat ${x.loser} · ${day(x.date)}`, value: x.margin, display: String(x.margin), unit: ' wkts', onPress: openMatch(x.matchId) }))}
            />
            <Board
              label="Highest totals"
              icon="stats-chart"
              items={r.highestTotals.map((x) => ({ title: x.team, sub: `${x.overs} overs v ${x.vs} · ${day(x.date)}`, value: x.runs, display: `${x.runs}/${x.wickets}`, onPress: openMatch(x.matchId) }))}
            />
            <Board
              label="Lowest totals"
              icon="thermometer-outline"
              lowIsBest
              items={r.lowestTotals.map((x) => ({ title: x.team, sub: `${x.overs} overs v ${x.vs} · ${day(x.date)}`, value: x.runs, display: `${x.runs}/${x.wickets}`, onPress: openMatch(x.matchId) }))}
            />
            <Board
              label="Hall of shame: most ducks"
              icon="egg-outline"
              empty="No ducks yet. Everyone’s got off the mark."
              items={r.mostDucks.map((x) => ({ title: x.name, sub: `${x.team} · ${x.sub ?? ''}`, value: x.count, display: String(x.count), unit: '×', onPress: openPlayer(x.key) }))}
            />
          </>
        )}

        {tab === 'rivals' && (
          <>
            {duels[0] ? (
              <FadeIn>
                <SectionLabel>Rivalry of the season</SectionLabel>
                <FaceOff m={duels[0]} big />
                <SectionLabel right={<Text style={styles.count}>{leaning.length}</Text>}>Every rivalry (6+ balls)</SectionLabel>
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
                <View style={{ gap: space.sm }}>
                  {leaning.slice(0, shown).map((d) => (
                    <FaceOff key={d.id} m={d} />
                  ))}
                </View>
                {leaning.length > shown && (
                  <PressableScale onPress={() => setShown(shown + 10)} style={styles.more}>
                    <Text style={styles.moreText}>Show {Math.min(10, leaning.length - shown)} more</Text>
                  </PressableScale>
                )}
              </FadeIn>
            ) : (
              <Card style={{ marginTop: space.lg }}>
                <Text style={styles.empty}>Rivalries appear once a batter has faced a bowler for 6 balls or more.</Text>
              </Card>
            )}
          </>
        )}
      </ScrollView>
      <Sheet visible={exporting} onClose={() => setExporting(false)} title="Export record book">
        <View style={{ gap: space.sm }}>
          {(
            [
              { format: 'pdf', icon: 'document-text', title: 'PDF', body: 'Every record, to read, print or send to anyone' },
              { format: 'file', icon: 'swap-horizontal', title: 'Record book file', body: `All ${plural(matches.length, 'match', 'matches')}, to import into Crease on another phone` },
            ] as { format: 'pdf' | 'file'; icon: IconName; title: string; body: string }[]
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
    height: 38,
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
  export: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.accent, borderRadius: radius.pill, paddingHorizontal: space.md, height: 38, ...edge },
  exportText: { color: colors.onAccent, fontSize: 13, fontFamily: font.heavy },
  pageTitle: { fontFamily: font.posterBlack, fontSize: 38, lineHeight: 42, color: colors.text, letterSpacing: -1.4 },
  season: { backgroundColor: HERO_BG, borderRadius: radius.xl, padding: space.lg, marginTop: space.md, overflow: 'hidden' },
  seasonLabel: { ...type.label, color: hero.accent },
  seasonRow: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  seasonValue: { fontFamily: font.posterBlack, fontSize: 23, lineHeight: 26, color: hero.text, ...type.num },
  seasonKey: { ...type.label, fontSize: 9, color: hero.muted },
  seasonLine: { color: hero.muted, fontSize: 12, fontFamily: font.medium, marginTop: space.md },
  tabs: { backgroundColor: colors.bg, paddingVertical: space.sm, marginTop: space.md },
  empty: { color: colors.muted, fontSize: 13, fontFamily: font.medium, lineHeight: 19 },
  champ: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, backgroundColor: colors.accentDim },
  champIcon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  champLabel: { ...type.label, fontSize: 9, color: colors.accentInk },
  champName: { fontFamily: font.posterBlack, fontSize: 20, lineHeight: 22, color: colors.text },
  champSub: { color: colors.muted, fontSize: 12, fontFamily: font.medium },
  champValue: { fontFamily: font.posterBlack, fontSize: 33, lineHeight: 37, color: colors.text, ...type.num },
  champUnit: { fontFamily: font.poster, fontSize: 14, color: colors.muted },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md, borderTopWidth: 1, borderTopColor: colors.border },
  rowTop: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  rank: { width: 18, fontFamily: font.posterBlack, fontSize: 16, color: colors.faint },
  title: { flex: 1, color: colors.text, fontSize: 15, fontFamily: font.bold },
  sub: { color: colors.muted, fontSize: 12, fontFamily: font.regular, marginTop: 3 },
  value: { fontFamily: font.posterBlack, fontSize: 20, color: colors.text, ...type.num },
  unit: { fontFamily: font.poster, fontSize: 13, color: colors.faint },
  track: { height: 4, borderRadius: 2, backgroundColor: colors.border, marginTop: 5, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 2, backgroundColor: colors.accentInk, opacity: 0.7 },
  overRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md, borderTopWidth: 1, borderTopColor: colors.border },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  tug: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', gap: 2, backgroundColor: colors.border },
  tugBat: { backgroundColor: colors.accent, borderRadius: 4 },
  tugBowl: { backgroundColor: colors.violet, borderRadius: 4 },
  count: { color: colors.faint, fontSize: 12, fontFamily: font.medium },
  more: { padding: space.md, alignItems: 'center' },
  moreText: { color: colors.accentInk, fontSize: 13, fontFamily: font.bold },
  pickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  vs: { ...type.label, color: colors.faint, textAlign: 'center' },
  h2h: { flexDirection: 'row', alignItems: 'center', marginTop: space.sm },
  h2hSide: { flex: 1 },
  h2hWins: { fontFamily: font.posterBlack, fontSize: 52, lineHeight: 58, color: colors.muted },
  h2hName: { fontFamily: font.poster, fontSize: 18, color: colors.text },
  h2hPlayed: { fontFamily: font.posterBlack, fontSize: 26, color: colors.faint },
  recent: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 4 },
  dot: { width: 8, height: 8, borderRadius: 2, transform: [{ skewX: '-12deg' }] },
  recentText: { flex: 1, color: colors.muted, fontSize: 13, fontFamily: font.semibold },
});
