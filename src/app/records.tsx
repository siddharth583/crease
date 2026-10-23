import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card, Chip, FadeIn, IconButton, PressableScale, Screen, SectionLabel } from '../components/ui.tsx';
import { headToHead, matchups, records, teamNames } from '../engine/records.ts';
import { useMatches } from '../store/matches.tsx';
import { colors, font, radius, space, type } from '../theme.ts';

const day = (ms: number) => new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

/** One ranked row: a big figure on the right, who and where on the left. */
function Row({ rank, title, sub, value, unit, onPress }: { rank: number; title: string; sub: string; value: string; unit?: string; onPress?: () => void }) {
  return (
    <PressableScale disabled={!onPress} dimWhenDisabled={false} scaleTo={0.98} onPress={onPress} style={styles.row}>
      <Text style={[styles.rank, rank === 1 && { color: colors.accentInk }]}>{rank}</Text>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {sub}
        </Text>
      </View>
      <Text style={styles.value}>
        {value}
        {unit ? <Text style={styles.unit}>{unit}</Text> : null}
      </Text>
    </PressableScale>
  );
}

function Board({ label, children, empty }: { label: string; children: React.ReactNode[]; empty?: string }) {
  return (
    <>
      <SectionLabel>{label}</SectionLabel>
      <Card style={{ padding: 0 }}>
        {children.length ? children : <Text style={[styles.sub, { padding: space.lg }]}>{empty ?? 'Nothing yet'}</Text>}
      </Card>
    </>
  );
}

const open = (key: string) => () => router.push({ pathname: '/player/[key]', params: { key } });
const scorecard = (id: string) => () => router.push({ pathname: '/match/[id]/scorecard', params: { id } });

export default function Records() {
  const insets = useSafeAreaInsets();
  const { matches } = useMatches();
  const r = useMemo(() => records(matches), [matches]);
  const teams = useMemo(() => teamNames(matches), [matches]);
  const [a, setA] = useState<string | null>(null);
  const [b, setB] = useState<string | null>(null);
  const ta = a ?? teams[0];
  const tb = b ?? teams.find((t) => t !== ta);
  const h2h = useMemo(() => (ta && tb ? headToHead(matches, ta, tb) : null), [matches, ta, tb]);
  const duels = useMemo(() => [...matchups(matches)].filter((d) => d.balls >= 6).sort((x, y) => y.balls - x.balls).slice(0, 6), [matches]);

  return (
    <Screen>
      <View style={styles.header}>
        <IconButton icon="chevron-back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/players'))} />
      </View>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: 0, paddingBottom: insets.bottom + space.xxl }}>
        <Text style={styles.pageTitle}>
          RECORD <Text style={{ color: colors.accentInk }}>BOOK</Text>
        </Text>
        <Text style={styles.lead}>The best of every match you’ve scored.</Text>

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
                  <Text style={[styles.h2hWins, h2h.winsA >= h2h.winsB && { color: colors.accentInk }]}>{h2h.winsA}</Text>
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
                  <Text style={[styles.h2hWins, h2h.winsB >= h2h.winsA && { color: colors.text }]}>{h2h.winsB}</Text>
                  <Text style={styles.h2hName} numberOfLines={1}>
                    {tb}
                  </Text>
                  <Text style={styles.sub}>Best {h2h.bestB}</Text>
                </View>
              </View>
              {h2h.recent.map((g) => (
                <PressableScale key={g.matchId} scaleTo={0.98} onPress={scorecard(g.matchId)} style={styles.recent}>
                  <View style={[styles.dot, { backgroundColor: g.winner === 'a' ? colors.accent : g.winner === 'b' ? colors.violet : colors.faint }]} />
                  <Text style={styles.recentText} numberOfLines={1}>
                    {day(g.date)} · {g.result}
                  </Text>
                </PressableScale>
              ))}
            </Card>
          </FadeIn>
        )}

        <Board label="Highest scores">
          {r.highScores.map((x, i) => (
            <Row key={i} rank={i + 1} title={x.name} sub={`${x.team} v ${x.vs} · ${day(x.date)} · ${x.balls} balls`} value={`${x.runs}${x.notOut ? '*' : ''}`} onPress={open(x.key)} />
          ))}
        </Board>
        <Board label="Best bowling">
          {r.bestBowling.map((x, i) => (
            <Row key={i} rank={i + 1} title={x.name} sub={`${x.team} v ${x.vs} · ${day(x.date)} · ${x.overs} overs`} value={`${x.wickets}/${x.runs}`} onPress={open(x.key)} />
          ))}
        </Board>
        <Board label="Fastest innings (15+ balls)">
          {r.fastest.map((x, i) => (
            <Row key={i} rank={i + 1} title={x.name} sub={`${x.runs} off ${x.balls} v ${x.vs} · ${day(x.date)}`} value={((x.runs * 100) / x.balls).toFixed(0)} unit=" SR" onPress={open(x.key)} />
          ))}
        </Board>
        <Board label="Biggest partnerships">
          {r.partnerships.map((x, i) => (
            <Row key={i} rank={i + 1} title={x.names} sub={`${x.team} v ${x.vs} · ${day(x.date)} · ${x.balls} balls`} value={String(x.runs)} onPress={scorecard(x.matchId)} />
          ))}
        </Board>
        <Board label="Highest totals">
          {r.highestTotals.map((x, i) => (
            <Row key={i} rank={i + 1} title={x.team} sub={`v ${x.vs} · ${day(x.date)} · ${x.overs} overs`} value={`${x.runs}/${x.wickets}`} onPress={scorecard(x.matchId)} />
          ))}
        </Board>
        <Board label="Lowest totals">
          {r.lowestTotals.map((x, i) => (
            <Row key={i} rank={i + 1} title={x.team} sub={`v ${x.vs} · ${day(x.date)} · ${x.overs} overs`} value={`${x.runs}/${x.wickets}`} onPress={scorecard(x.matchId)} />
          ))}
        </Board>
        <Board label="Most Man of the Match awards">
          {r.mostMoM.map((x, i) => (
            <Row key={i} rank={i + 1} title={x.name} sub={x.team} value={String(x.count)} unit="×" onPress={open(x.key)} />
          ))}
        </Board>
        <Board label="Most sixes">
          {r.mostSixes.map((x, i) => (
            <Row key={i} rank={i + 1} title={x.name} sub={x.team} value={String(x.count)} onPress={open(x.key)} />
          ))}
        </Board>
        <Board label="Most catches, run-outs & stumpings">
          {r.mostDismissals.map((x, i) => (
            <Row key={i} rank={i + 1} title={x.name} sub={x.team} value={String(x.count)} onPress={open(x.key)} />
          ))}
        </Board>
        <Board label="Rivalries: batter v bowler" empty="Play a few more matches">
          {duels.map((d, i) => (
            <Row
              key={i}
              rank={i + 1}
              title={`${d.batter} v ${d.bowler}`}
              sub={`${d.runs} runs off ${d.balls} balls${d.outs ? ` · out ${d.outs}×` : ' · never out'}`}
              value={d.balls ? ((d.runs * 100) / d.balls).toFixed(0) : '–'}
              unit=" SR"
            />
          ))}
        </Board>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', paddingHorizontal: space.lg, paddingVertical: space.sm },
  pageTitle: { fontFamily: font.posterBlack, fontSize: 52, lineHeight: 52, color: colors.text, letterSpacing: -1 },
  lead: { color: colors.muted, fontSize: 15, fontFamily: font.medium, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md, borderTopWidth: 1, borderTopColor: colors.border },
  rank: { width: 18, fontFamily: font.posterBlack, fontSize: 20, color: colors.faint },
  title: { color: colors.text, fontSize: 15, fontFamily: font.bold },
  sub: { color: colors.muted, fontSize: 12, fontFamily: font.regular, marginTop: 1 },
  value: { fontFamily: font.posterBlack, fontSize: 28, color: colors.text, ...type.num },
  unit: { fontFamily: font.poster, fontSize: 14, color: colors.faint },
  pickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  vs: { ...type.label, color: colors.faint, textAlign: 'center' },
  h2h: { flexDirection: 'row', alignItems: 'center', marginTop: space.sm },
  h2hSide: { flex: 1 },
  h2hWins: { fontFamily: font.posterBlack, fontSize: 64, lineHeight: 64, color: colors.muted },
  h2hName: { fontFamily: font.poster, fontSize: 18, color: colors.text, textTransform: 'uppercase' },
  h2hPlayed: { fontFamily: font.posterBlack, fontSize: 32, color: colors.faint },
  recent: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 4 },
  dot: { width: 8, height: 8, borderRadius: 2, transform: [{ skewX: '-12deg' }] },
  recentText: { flex: 1, color: colors.muted, fontSize: 13, fontFamily: font.semibold },
  card: { borderRadius: radius.lg },
});
