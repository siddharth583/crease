import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polygon, Polyline, Text as SvgText } from 'react-native-svg';
import { oversText, playerName, type InningsState, type MatchState } from '../engine/engine.ts';
import { chaseTimeline, type ChasePoint } from '../engine/winProb.ts';
import type { Match } from '../engine/types.ts';
import { colors, font, ink, radius, space, type } from '../theme.ts';
import { BallChip, Card, PressableScale, SectionLabel } from './ui.tsx';
import { CountUp, Tug } from './motion.tsx';
import { AXIS_B, AXIS_L, AXIS_R, AXIS_T, CHART_H as H, ChartCard, DrawIn, Grow, Legend, Takeaway, niceTop, overTicks } from './ScoreCharts.tsx';

/** Both innings' runs over by over on one chart: the chase line catching the first one, or not. */
export function RunRace({ state }: { state: MatchState }) {
  // As wide as its card, whatever the phone: a fixed width spilt out of the card on a 360px screen.
  const [W, setW] = useState(0);
  const lines = state.innings.slice(0, 2).filter((s) => s.legalBalls > 0);
  if (!lines.length) return null;
  const overs = Math.max(...lines.map((s) => s.maxBalls / 6));
  const target = state.innings[1].target ?? 0;
  const top = niceTop(Math.max(10, ...lines.map((s) => s.runs), target));
  const x = (over: number) => AXIS_L + (over / overs) * (W - AXIS_L - AXIS_R);
  const y = (runs: number) => H - AXIS_B - (runs / top) * (H - AXIS_B - AXIS_T);
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

  // The takeaway: who led at the halfway mark, and how it ended.
  const at = (s: InningsState, n: number) => s.overTotals.slice(0, n).reduce((t, o) => t + o.runs, 0);
  let takeaway: string;
  if (lines.length === 2) {
    const half = Math.max(1, Math.floor(Math.min(overs, Math.ceil(lines[1].legalBalls / 6) || overs) / 2));
    const a = at(lines[0], half);
    const b = at(lines[1], half);
    const lead = a === b ? 'It was level' : `${(a > b ? lines[0] : lines[1]).battingTeam.name} led ${Math.max(a, b)} to ${Math.min(a, b)}`;
    takeaway = `After ${half} overs ${a === b ? `it was level at ${a}` : lead}. ${state.result ? `${state.result}.` : 'The match is still on.'}`;
  } else {
    const s = lines[0];
    takeaway = `${s.battingTeam.name} are ${s.runs}/${s.wickets} after ${oversText(s.legalBalls)} overs, scoring ${((s.runs * 6) / Math.max(1, s.legalBalls)).toFixed(1)} an over.`;
  }

  return (
    <ChartCard title="Run race" right={<Text style={styles.count}>runs by over</Text>} takeaway={takeaway}>
      <View onLayout={(e) => setW(Math.floor(e.nativeEvent.layout.width))} style={{ height: H }}>
        {W > 0 && (
          <DrawIn width={W} height={H}>
            <Svg width={W} height={H}>
              {[0.25, 0.5, 0.75, 1].map((f) => (
                <Line key={f} x1={AXIS_L} x2={W - AXIS_R} y1={y(top * f)} y2={y(top * f)} stroke={ink(0.08)} strokeWidth={1} />
              ))}
              <Line x1={AXIS_L} x2={W - AXIS_R} y1={y(0)} y2={y(0)} stroke={ink(0.25)} strokeWidth={1} />
              {[0, 0.5, 1].map((f) => (
                <SvgText key={f} x={AXIS_L - 6} y={y(top * f) + 3} fontSize={10} fill={colors.faint} textAnchor="end">
                  {Math.round(top * f)}
                </SvgText>
              ))}
              {overTicks(Math.round(overs)).map((o) => (
                <SvgText key={o} x={x(o)} y={H - 6} fontSize={10} fill={colors.faint} textAnchor="middle">
                  {o}
                </SvgText>
              ))}
              {target > 0 && lines.length === 2 && (
                <>
                  <Line x1={AXIS_L} x2={W - AXIS_R} y1={y(target)} y2={y(target)} stroke={colors.gold} strokeWidth={1.2} strokeDasharray="5 4" />
                  <SvgText x={W - AXIS_R - 2} y={y(target) - 4} fontSize={10} fill={colors.gold} textAnchor="end">
                    target {target}
                  </SvgText>
                </>
              )}
              {series.map(({ pts, wickets }, i) => (
                <Svg key={i}>
                  <Polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke={tints[i]} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
                  {wickets.map(([wx, wy], j) => (
                    <Circle key={j} cx={wx} cy={wy} r={4} fill={colors.danger} stroke={colors.surface} strokeWidth={1.5} />
                  ))}
                </Svg>
              ))}
            </Svg>
          </DrawIn>
        )}
      </View>
      <Text style={styles.axisCaption}>overs bowled</Text>
      <Legend
        items={[
          ...series.map(({ s }, i) => ({ color: tints[i], label: `${s.battingTeam.name} ${s.runs}/${s.wickets}` })),
          { color: colors.danger, label: 'wicket', dot: true },
        ]}
      />
    </ChartCard>
  );
}

const pct = (chance: number) => `${Math.round(chance * 100)}%`;

/** A chart as wide as its card: measured, so a fixed width never spills out on a small phone. */
function Plot({ children }: { children: (W: number) => React.ReactNode }) {
  const [W, setW] = useState(0);
  return (
    <View onLayout={(e) => setW(Math.floor(e.nativeEvent.layout.width))} style={{ height: H }}>
      {W > 0 && <DrawIn width={W} height={H}>{children(W)}</DrawIn>}
    </View>
  );
}

/** The points as an SVG `points` string, split wherever a value is missing (the required rate has gaps once it's decided). */
const runs = (pts: ChasePoint[], at: (p: ChasePoint) => [number, number] | null): string[] => {
  const out: string[] = [];
  let cur: string[] = [];
  for (const p of pts) {
    const xy = at(p);
    if (xy) cur.push(xy.join(','));
    else if (cur.length) (out.push(cur.join(' ')), (cur = []));
  }
  if (cur.length) out.push(cur.join(' '));
  return out;
};

/**
 * The chase's story in two charts: who is likely to win after every ball (the chasing side's chance, with the wickets
 * marked on it), and the rate they need against the rate they're scoring. Both are worked out by replaying the second
 * innings, so they're right after a corrected ball too. Nothing for a match with no chase yet.
 */
export function ChaseInsights({ match, state }: { match: Match; state: MatchState }) {
  const chase = state.innings[1];
  const target = chase?.target ?? null;
  const pts = useMemo(() => chaseTimeline(match, target), [match, target]);
  if (!chase || target === null || pts.length < 2) return null;
  const last = pts[pts.length - 1];
  const final = Boolean(state.result);
  const chasing = chase.battingTeam.name;
  const defending = chase.bowlingTeam.name;
  const max = Math.max(1, chase.maxBalls);
  const overs = max / 6;

  const x = (W: number, balls: number) => AXIS_L + (Math.min(balls, max) / max) * (W - AXIS_L - AXIS_R);
  const yc = (c: number) => H - AXIS_B - c * (H - AXIS_B - AXIS_T);
  // Rates: no taller than a sensible ceiling, so one desperate last ball doesn't flatten the rest.
  const crrs = pts.map((p) => (p.crr ?? 0) * 6);
  const ceiling = Math.min(24, Math.max(8, Math.ceil(Math.max(...crrs) * 1.5)));
  const yr = (r: number) => H - AXIS_B - (Math.min(r, ceiling) / ceiling) * (H - AXIS_B - AXIS_T);
  const wicketsAt = pts.filter((p, i) => i > 0 && p.wickets > pts[i - 1].wickets);
  const xTicks = (W: number) =>
    overTicks(Math.round(overs)).map((o) => (
      <SvgText key={o} x={x(W, o * 6)} y={H - 6} fontSize={10} fill={colors.faint} textAnchor="middle">
        {o}
      </SvgText>
    ));

  // One sentence each, in cricket words.
  const peak = pts.reduce((a, p) => (p.chance > a.chance ? p : a), pts[0]);
  const low = pts.reduce((a, p) => (p.chance < a.chance ? p : a), pts[0]);
  const winTakeaway = !final
    ? `${last.chance >= 0.5 ? chasing : defending} are ahead after ${oversText(last.balls)} overs, but it is an estimate, not a promise.`
    : last.chance >= 0.5
      ? low.chance < 0.4
        ? `${chasing} were down to ${pct(low.chance)} after ${oversText(low.balls)} overs, then turned it round and won.`
        : `${chasing} were in control almost all the way.`
      : peak.chance > 0.6
        ? `${chasing} were ${pct(peak.chance)} favourites after ${oversText(peak.balls)} overs before it slipped away.`
        : `${defending} held the upper hand all through the chase.`;
  const first = pts.find((p) => p.rrr !== null);
  const rateTakeaway =
    !final && last.rrr !== null
      ? `Needs ${(last.rrr * 6).toFixed(1)} an over, scoring ${((last.crr ?? 0) * 6).toFixed(1)}: ${last.rrr > (last.crr ?? 0) ? 'the chase is falling behind' : 'the chase is on track'}.`
      : first?.rrr != null
        ? `${chasing} needed ${(first.rrr * 6).toFixed(1)} an over from the start and scored at ${((last.crr ?? 0) * 6).toFixed(1)}.`
        : `${chasing} scored at ${((last.crr ?? 0) * 6).toFixed(1)} an over.`;

  return (
    <>
      <ChartCard title="Win predictor" right={<Text style={styles.count}>{final ? 'Final' : `after ${oversText(last.balls)} ov`}</Text>} takeaway={winTakeaway}>
        <View style={styles.odds}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <CountUp value={last.chance * 100} format={(n) => `${Math.round(n)}%`} style={[styles.oddsValue, { color: colors.accentInk }]} />
            <Text style={styles.oddsTeam} numberOfLines={1}>
              {chasing}
            </Text>
          </View>
          <View style={{ flex: 1, minWidth: 0, alignItems: 'flex-end' }}>
            <CountUp value={(1 - last.chance) * 100} format={(n) => `${Math.round(n)}%`} style={[styles.oddsValue, { color: colors.violet }]} />
            <Text style={styles.oddsTeam} numberOfLines={1}>
              {defending}
            </Text>
          </View>
        </View>
        <Tug
          edge={last.chance}
          style={styles.split}
          leftStyle={{ backgroundColor: colors.accent }}
          rightStyle={{ backgroundColor: colors.violet }}
        />
        <View accessibilityLabel={`${chasing} ${pct(last.chance)}, ${defending} ${pct(1 - last.chance)}`} />
        <Plot>
          {(W) => (
            <Svg width={W} height={H}>
              <Line x1={AXIS_L} x2={W - AXIS_R} y1={yc(1)} y2={yc(1)} stroke={ink(0.08)} strokeWidth={1} />
              <Line x1={AXIS_L} x2={W - AXIS_R} y1={yc(0.5)} y2={yc(0.5)} stroke={ink(0.25)} strokeWidth={1} strokeDasharray="4 4" />
              <Line x1={AXIS_L} x2={W - AXIS_R} y1={yc(0)} y2={yc(0)} stroke={ink(0.08)} strokeWidth={1} />
              {[1, 0.5, 0].map((c) => (
                <SvgText key={c} x={AXIS_L - 6} y={yc(c) + 3} fontSize={10} fill={colors.faint} textAnchor="end">
                  {Math.round(c * 100)}%
                </SvgText>
              ))}
              {xTicks(W)}
              <Polygon
                points={`${x(W, pts[0].balls)},${yc(0.5)} ${pts.map((p) => `${x(W, p.balls)},${yc(p.chance)}`).join(' ')} ${x(W, last.balls)},${yc(0.5)}`}
                fill={last.chance >= 0.5 ? colors.accent : colors.violet}
                opacity={0.14}
              />
              <Polyline points={pts.map((p) => `${x(W, p.balls)},${yc(p.chance)}`).join(' ')} fill="none" stroke={colors.accent} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
              {wicketsAt.map((p, i) => (
                <Circle key={i} cx={x(W, p.balls)} cy={yc(p.chance)} r={4} fill={colors.danger} stroke={colors.surface} strokeWidth={1.5} />
              ))}
              <Circle cx={x(W, last.balls)} cy={yc(last.chance)} r={5} fill={colors.accent} stroke={colors.surface} strokeWidth={2} />
            </Svg>
          )}
        </Plot>
        <Text style={styles.axisCaption}>{chasing}'s chance of winning, over by over</Text>
      </ChartCard>

      <ChartCard title="Required rate" right={<Text style={styles.count}>{last.rrr !== null ? `need ${(last.rrr * 6).toFixed(1)} an over` : 'runs an over'}</Text>} takeaway={rateTakeaway}>
        <Plot>
          {(W) => (
            <Svg width={W} height={H}>
              {[0.25, 0.5, 0.75, 1].map((f) => (
                <Line key={f} x1={AXIS_L} x2={W - AXIS_R} y1={yr(ceiling * f)} y2={yr(ceiling * f)} stroke={ink(0.08)} strokeWidth={1} />
              ))}
              <Line x1={AXIS_L} x2={W - AXIS_R} y1={yr(0)} y2={yr(0)} stroke={ink(0.25)} strokeWidth={1} />
              {[0, 0.5, 1].map((f) => (
                <SvgText key={f} x={AXIS_L - 6} y={yr(ceiling * f) + 3} fontSize={10} fill={colors.faint} textAnchor="end">
                  {Math.round(ceiling * f)}
                </SvgText>
              ))}
              {xTicks(W)}
              {runs(pts, (p) => (p.crr === null ? null : [x(W, p.balls), yr(p.crr * 6)])).map((points, i) => (
                <Polyline key={`c${i}`} points={points} fill="none" stroke={colors.violet} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
              ))}
              {runs(pts, (p) => (p.rrr === null ? null : [x(W, p.balls), yr(p.rrr * 6)])).map((points, i) => (
                <Polyline key={`r${i}`} points={points} fill="none" stroke={colors.accent} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
              ))}
              {wicketsAt.map((p, i) => (
                <Circle key={i} cx={x(W, p.balls)} cy={yr((p.rrr ?? p.crr ?? 0) * 6)} r={4} fill={colors.danger} stroke={colors.surface} strokeWidth={1.5} />
              ))}
            </Svg>
          )}
        </Plot>
        <Text style={styles.axisCaption}>overs bowled · runs an over</Text>
        <Legend
          items={[
            { color: colors.accent, label: `Required${last.rrr !== null ? ` ${(last.rrr * 6).toFixed(1)}` : ''}` },
            { color: colors.violet, label: `Scoring${last.crr !== null ? ` ${(last.crr * 6).toFixed(1)}` : ''}` },
            { color: colors.danger, label: 'wicket', dot: true },
          ]}
        />
      </ChartCard>
    </>
  );
}

const ordinal = (n: number) => `${n}${['th', 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : Math.min(n % 10, 4) % 4] ?? 'th'}`;

/** Each partnership as a bar, as long as it is next to the best stand; the best one wears a brass tag. */
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
  const best = list.reduce((a, p, i) => (p.runs > list[a].runs ? i : a), 0);
  const most = Math.max(1, list[best].runs);
  const bp = pairs[best];
  const takeaway =
    list[best].runs > 0
      ? `Best stand: ${bp.map((x) => playerName(match, x.id)).join(' and ')} put on ${list[best].runs} in ${list[best].balls} balls for the ${ordinal(best + 1)} wicket.`
      : undefined;
  return (
    <>
      <SectionLabel right={<Text style={styles.count}>runs added together</Text>}>Partnerships</SectionLabel>
      <Card style={{ gap: space.md }}>
        {list.map((p, i) => {
          // Each batter's share of the stand in their colour, extras in grey.
          const pair = pairs[i];
          const extras = Math.max(0, p.runs - pair.reduce((n, x) => n + x.runs, 0));
          const unbroken = i >= s.wickets;
          return (
            <View key={i}>
              <View style={styles.pRow}>
                <Text style={styles.pWicket}>{ordinal(i + 1)} wkt{unbroken ? ' · unbroken' : ''}</Text>
                {i === best && p.runs > 0 && list.length > 1 && (
                  <View style={styles.bestTag}>
                    <Ionicons name="star" size={9} color={colors.gold} />
                    <Text style={styles.bestTagText}>BEST</Text>
                  </View>
                )}
                <View style={{ flex: 1 }} />
                <Text style={styles.pRuns}>
                  {p.runs}
                  <Text style={styles.pBalls}> ({p.balls})</Text>
                </Text>
              </View>
              <View style={styles.pTrack}>
                <Grow share={p.runs / most} delay={150 + i * 90} style={styles.pSplit}>
                  {p.runs > 0 ? (
                    [...pair, { id: 'extras', runs: extras, color: ink(0.2) }]
                      .filter((x) => x.runs > 0)
                      .map((x) => <View key={x.id} style={{ flex: x.runs, backgroundColor: x.color }} />)
                  ) : (
                    <View style={{ flex: 1, backgroundColor: ink(0.08) }} />
                  )}
                </Grow>
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
                {extras > 0 && <Text style={styles.pExtras}>+{extras} extra{extras === 1 ? '' : 's'}</Text>}
              </View>
            </View>
          );
        })}
        {takeaway ? <Takeaway text={takeaway} /> : null}
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

/** Every delivery, newest first, a few overs at a time: each over as its six balls, then the words. */
export function BallByBall({ match, s, initial = 3 }: { match: Match; s: InningsState; initial?: number }) {
  const [shown, setShown] = useState(initial);
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
        {overs.slice(0, shown).map(([o, balls]) => {
          const total = balls.reduce((n, d) => n + d.total, 0);
          const wk = balls.filter((d) => d.ball.wicket && d.ball.wicket.kind !== 'retired').length;
          return (
            <View key={o} style={styles.over}>
              <View style={styles.overHead}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.overTitle}>OVER {o + 1}</Text>
                  <Text style={styles.overBowler} numberOfLines={1}>
                    {playerName(match, balls[0].bowler)}
                  </Text>
                </View>
                <View style={styles.overBalls}>
                  {(s.overs[o] ?? []).map((b, i) => (
                    <BallChip key={i} ball={b} size={24} />
                  ))}
                </View>
                <View style={styles.overTotal}>
                  <Text style={styles.overTotalNum}>{total}</Text>
                  <Text style={[styles.overTotalLabel, wk > 0 && { color: colors.danger }]}>{wk > 0 ? `${wk} wkt` : 'runs'}</Text>
                </View>
              </View>
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
          );
        })}
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
  odds: { flexDirection: 'row', gap: space.md, paddingHorizontal: space.xs },
  oddsValue: { fontFamily: font.posterBlack, fontSize: 34, lineHeight: 38, ...type.num },
  oddsTeam: { color: colors.muted, fontSize: 12, fontFamily: font.semibold },
  split: { height: 8, borderRadius: 4, overflow: 'hidden', marginVertical: space.sm },
  axisCaption: { color: colors.faint, fontSize: 10, fontFamily: font.medium, textAlign: 'center', marginTop: 4, letterSpacing: 0.4 },
  pRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: 6 },
  pWicket: { color: colors.faint, fontFamily: font.semibold, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase' },
  bestTag: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.goldDim, borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 2 },
  bestTagText: { color: colors.gold, fontSize: 9, fontFamily: font.heavy, letterSpacing: 1 },
  pTrack: { height: 10, borderRadius: 5, backgroundColor: ink(0.05), overflow: 'hidden' },
  pSplit: { flexDirection: 'row', gap: 2, height: 10, borderRadius: 5, overflow: 'hidden' },
  pPair: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.md, marginTop: 6 },
  pBatter: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6 },
  pDot: { width: 8, height: 8, borderRadius: 4 },
  pNames: { flexShrink: 1, color: colors.text, fontSize: 13, fontFamily: font.semibold },
  pOwn: { fontFamily: font.posterBlack, ...type.num },
  pExtras: { color: colors.faint, fontSize: 11, fontFamily: font.medium },
  pRuns: { fontFamily: font.posterBlack, fontSize: 18, color: colors.text, ...type.num },
  pBalls: { fontFamily: font.poster, fontSize: 13, color: colors.faint },
  count: { color: colors.faint, fontSize: 12, fontFamily: font.medium },
  over: { paddingHorizontal: space.lg, paddingVertical: space.md, borderTopWidth: 1, borderTopColor: colors.border, gap: 4 },
  overHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: 4 },
  overTitle: { ...type.label, fontSize: 10, color: colors.muted },
  overBowler: { color: colors.text, fontSize: 13, fontFamily: font.bold },
  overBalls: { flexDirection: 'row', flexWrap: 'wrap', gap: 3, flexShrink: 1, justifyContent: 'flex-end', maxWidth: 190 },
  overTotal: { alignItems: 'center', minWidth: 40 },
  overTotalNum: { color: colors.text, fontSize: 20, fontFamily: font.posterBlack, ...type.num },
  overTotalLabel: { color: colors.faint, fontSize: 9, fontFamily: font.semibold, letterSpacing: 0.8, textTransform: 'uppercase' },
  ball: { flexDirection: 'row', gap: space.md },
  ballNo: { width: 30, color: colors.faint, fontFamily: font.poster, fontSize: 15, ...type.num },
  ballText: { flex: 1, color: colors.muted, fontSize: 13, fontFamily: font.medium },
  ballOutcome: { color: colors.text, fontFamily: font.bold },
  more: { padding: space.md, alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border, borderRadius: radius.lg },
  moreText: { color: colors.accentInk, fontSize: 13, fontFamily: font.bold },
});
