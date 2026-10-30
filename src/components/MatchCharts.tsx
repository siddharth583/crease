import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { oversText, playerName, type InningsState, type MatchState } from '../engine/engine.ts';
import type { Match } from '../engine/types.ts';
import { colors, font, ink, radius, space, type } from '../theme.ts';
import { Card, PressableScale, SectionLabel } from './ui.tsx';

const W = 320;
const H = 150;

/** Both innings' runs over by over on one chart: the chase line catching the first one, or not. */
export function RunRace({ state }: { state: MatchState }) {
  const lines = state.innings.slice(0, 2).filter((s) => s.legalBalls > 0);
  if (!lines.length) return null;
  const overs = Math.max(...lines.map((s) => s.maxBalls / 6));
  const peak = Math.max(10, ...lines.map((s) => s.runs), state.innings[1].target ?? 0);
  const x = (over: number) => 24 + (over / overs) * (W - 32);
  const y = (runs: number) => H - 18 - (runs / peak) * (H - 30);
  const tints = [colors.accent, colors.violet];

  const series = lines.map((s) => {
    let total = 0;
    const pts = [[x(0), y(0)]];
    const wickets: [number, number][] = [];
    s.overTotals.forEach((o, i) => {
      total += o.runs;
      const done = i + 1 <= Math.ceil(s.legalBalls / 6);
      if (!done) return;
      const ox = i + 1 === Math.ceil(s.legalBalls / 6) && s.legalBalls % 6 ? i + (s.legalBalls % 6) / 6 : i + 1;
      pts.push([x(ox), y(total)]);
      for (let w = 0; w < o.wickets; w++) wickets.push([x(ox), y(total)]);
    });
    return { s, pts, wickets };
  });

  return (
    <>
      <SectionLabel>Run race</SectionLabel>
      <Card style={{ alignItems: 'center', paddingVertical: space.md }}>
        <Svg width={W} height={H}>
          {[0.25, 0.5, 0.75, 1].map((f) => (
            <Line key={f} x1={24} x2={W - 8} y1={y(peak * f)} y2={y(peak * f)} stroke={ink(0.08)} strokeWidth={1} />
          ))}
          <Line x1={24} x2={W - 8} y1={y(0)} y2={y(0)} stroke={ink(0.25)} strokeWidth={1} />
          {series.map(({ pts, wickets }, i) => (
            <Svg key={i}>
              <Polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke={tints[i]} strokeWidth={3} strokeLinejoin="round" />
              {wickets.map(([wx, wy], j) => (
                <Circle key={j} cx={wx} cy={wy} r={4} fill={colors.danger} stroke={colors.surface} strokeWidth={1.5} />
              ))}
            </Svg>
          ))}
        </Svg>
        <View style={styles.legend}>
          {series.map(({ s }, i) => (
            <View key={i} style={styles.legendItem}>
              <View style={[styles.swatch, { backgroundColor: tints[i] }]} />
              <Text style={styles.legendText}>
                {s.battingTeam.name} {s.runs}/{s.wickets}
              </Text>
            </View>
          ))}
          <View style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: colors.danger, borderRadius: 4 }]} />
            <Text style={styles.legendText}>wicket</Text>
          </View>
        </View>
      </Card>
    </>
  );
}

/** Each partnership as a bar, longest first in its place in the order. */
export function Partnerships({ match, s }: { match: Match; s: InningsState }) {
  const list = s.partnerships.filter((p) => p.runs || p.balls);
  if (!list.length) return null;
  // Two colours, and a batter keeps theirs from one stand to the next: the one coming in takes the other.
  const sides = [colors.accent, colors.violet];
  let held: Record<string, number> = {};
  const pairs = list.map((p) => {
    const ids = p.batters.filter((id): id is string => Boolean(id));
    const stays = ids.find((id) => held[id] !== undefined);
    const side = (id: string) => (stays === undefined ? ids.indexOf(id) : id === stays ? held[stays] : 1 - held[stays]);
    held = Object.fromEntries(ids.map((id) => [id, side(id)]));
    return ids.map((id) => ({ id, runs: p.by[id] ?? 0, side: side(id), color: sides[side(id)] })).sort((a, b) => a.side - b.side);
  });
  return (
    <>
      <SectionLabel>Partnerships</SectionLabel>
      <Card style={{ gap: space.md }}>
        {list.map((p, i) => {
          // Each batter's share of the stand in their colour, extras in grey.
          const pair = pairs[i];
          const extras = Math.max(0, p.runs - pair.reduce((n, x) => n + x.runs, 0));
          return (
            <View key={i}>
              <View style={styles.pRow}>
                <Text style={styles.pWicket}>{i + 1}</Text>
                <Text style={styles.pRuns}>
                  {p.runs}
                  <Text style={styles.pBalls}> ({p.balls})</Text>
                </Text>
                {extras > 0 && <Text style={styles.pExtras}>incl. {extras} extra{extras === 1 ? '' : 's'}</Text>}
              </View>
              <View style={styles.pSplit}>
                {p.runs > 0 ? (
                  [...pair, { id: 'extras', runs: extras, color: ink(0.2) }]
                    .filter((x) => x.runs > 0)
                    .map((x) => <View key={x.id} style={{ flex: x.runs, backgroundColor: x.color }} />)
                ) : (
                  <View style={{ flex: 1, backgroundColor: ink(0.08) }} />
                )}
              </View>
              <View style={styles.pPair}>
                {pair.map((x, k) => (
                  <View key={x.id} style={[styles.pBatter, (k === 1 || x.side === 1) && { justifyContent: 'flex-end' }]}>
                    <View style={[styles.pDot, { backgroundColor: x.color }]} />
                    <Text style={styles.pNames} numberOfLines={1}>
                      {playerName(match, x.id)} <Text style={styles.pOwn}>{x.runs}</Text>
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          );
        })}
      </Card>
    </>
  );
}

const outcome = (d: InningsState['log'][number], match: Match) => {
  const b = d.ball;
  if (b.wicket && b.wicket.kind !== 'retired') return { text: `OUT! ${playerName(match, b.wicket.playerOut)}`, hot: 'wicket' as const };
  if (!b.extra && b.runs === 6) return { text: 'SIX', hot: 'six' as const };
  if (!b.extra && b.runs === 4) return { text: 'FOUR', hot: 'four' as const };
  const runs = b.runs ? `${b.runs} run${b.runs === 1 ? '' : 's'}` : '';
  if (b.extra === 'wide') return { text: ['wide', runs].filter(Boolean).join(' + '), hot: null };
  if (b.extra === 'noball') return { text: ['no ball', runs].filter(Boolean).join(' + '), hot: null };
  if (b.extra === 'bye') return { text: `${runs} bye${b.runs === 1 ? '' : 's'}`, hot: null };
  if (b.extra === 'legbye') return { text: `${runs} leg bye${b.runs === 1 ? '' : 's'}`, hot: null };
  return { text: runs || 'dot', hot: null };
};

/** Every delivery, newest first, a few overs at a time. */
export function BallByBall({ match, s }: { match: Match; s: InningsState }) {
  const [shown, setShown] = useState(3);
  if (!s.log.length) return null;
  const byOver = new Map<number, InningsState['log']>();
  for (const d of s.log) {
    const o = Number(d.over.split('.')[0]);
    byOver.set(o, [...(byOver.get(o) ?? []), d]);
  }
  const overs = [...byOver.entries()].reverse();
  return (
    <>
      <SectionLabel right={<Text style={styles.count}>{oversText(s.legalBalls)} overs</Text>}>Ball by ball</SectionLabel>
      <Card style={{ padding: 0 }}>
        {overs.slice(0, shown).map(([o, balls]) => (
          <View key={o} style={styles.over}>
            <Text style={styles.overTitle}>
              OVER {o + 1} · {playerName(match, balls[0].bowler)} · {balls.reduce((n, d) => n + d.total, 0)} runs
            </Text>
            {[...balls].reverse().map((d, i) => {
              const out = outcome(d, match);
              return (
                <View key={i} style={styles.ball}>
                  <Text style={styles.ballNo}>{d.over}</Text>
                  <Text style={styles.ballText} numberOfLines={1}>
                    {playerName(match, d.striker)}:{' '}
                    <Text
                      style={[
                        styles.ballOutcome,
                        out.hot === 'wicket' && { color: colors.danger },
                        out.hot === 'six' && { color: colors.accentInk },
                        out.hot === 'four' && { color: colors.cyan },
                      ]}
                    >
                      {out.text}
                    </Text>
                  </Text>
                </View>
              );
            })}
          </View>
        ))}
        {overs.length > shown && (
          <PressableScale onPress={() => setShown(shown + 5)} style={styles.more}>
            <Text style={styles.moreText}>Show earlier overs</Text>
          </PressableScale>
        )}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginTop: space.sm, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 12, height: 4, borderRadius: 2 },
  legendText: { color: colors.muted, fontSize: 12, fontFamily: font.semibold },
  pRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  pWicket: { width: 16, color: colors.faint, fontFamily: font.posterBlack, fontSize: 16 },
  pNames: { flexShrink: 1, color: colors.text, fontSize: 13, fontFamily: font.semibold },
  pOwn: { fontFamily: font.posterBlack, ...type.num },
  pExtras: { color: colors.faint, fontSize: 12, fontFamily: font.medium },
  pSplit: { flexDirection: 'row', gap: 2, height: 8, borderRadius: 4, overflow: 'hidden', marginTop: 6, marginLeft: 24 },
  pPair: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md, marginTop: 6, marginLeft: 24 },
  pBatter: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6 },
  pDot: { width: 8, height: 8, borderRadius: 4 },
  pRuns: { fontFamily: font.posterBlack, fontSize: 16, color: colors.text, ...type.num },
  pBalls: { fontFamily: font.poster, fontSize: 13, color: colors.faint },
  count: { color: colors.faint, fontSize: 12, fontFamily: font.medium },
  over: { paddingHorizontal: space.lg, paddingVertical: space.md, borderTopWidth: 1, borderTopColor: colors.border, gap: 4 },
  overTitle: { ...type.label, fontSize: 10, color: colors.muted, marginBottom: 2 },
  ball: { flexDirection: 'row', gap: space.md },
  ballNo: { width: 30, color: colors.faint, fontFamily: font.poster, fontSize: 15, ...type.num },
  ballText: { flex: 1, color: colors.muted, fontSize: 13, fontFamily: font.medium },
  ballOutcome: { color: colors.text, fontFamily: font.bold },
  more: { padding: space.md, alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border, borderRadius: radius.lg },
  moreText: { color: colors.accentInk, fontSize: 13, fontFamily: font.bold },
});
