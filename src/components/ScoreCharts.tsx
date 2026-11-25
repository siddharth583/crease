import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Platform, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { playerName, type InningsState, type MatchState } from '../engine/engine.ts';
import type { Match } from '../engine/types.ts';
import { colors, font, ink, radius, space, type } from '../theme.ts';
import { SeamDivider } from './cricket.tsx';
import { EASE_OUT, GrowBar, PopIn, useArrived, useReducedMotion, webTransition } from './motion.tsx';
import { Card, SectionLabel } from './ui.tsx';

// The scorecard's charts and their shared pieces: a draw-in reveal, a one-line takeaway, cricket-word axes.

/** Every chart's height, and the room kept for the axes. */
export const CHART_H = 172;
export const AXIS_L = 32;
export const AXIS_B = 22;
export const AXIS_T = 10;
export const AXIS_R = 10;

/** The overs worth a label along the bottom: a handful, whatever the length of the match. */
export const overTicks = (overs: number) => {
  const step = overs <= 6 ? 1 : overs <= 12 ? 2 : overs <= 25 ? 5 : 10;
  const out: number[] = [];
  for (let o = 0; o <= overs; o += step) out.push(o);
  return out;
};

/** A round number at or above the peak, so the runs axis reads 0, 50, 100 and not 0, 47, 94. */
export const niceTop = (peak: number) => {
  const step = peak <= 30 ? 10 : peak <= 100 ? 20 : peak <= 250 ? 50 : 100;
  return Math.max(step, Math.ceil(peak / step) * step);
};

/** A chart's drawing area. It used to be revealed from the left; now it's drawn straight away. */
export function DrawIn({ children, width, height }: { children: ReactNode; width: number; height: number; delay?: number; duration?: number }) {
  return <View style={{ width, height }}>{children}</View>;
}

/** A box at its share of its parent's width (or height), with its children inside. */
export function Grow({ share, vertical, style, children }: { share: number; vertical?: boolean; delay?: number; duration?: number; style?: StyleProp<ViewStyle>; children?: ReactNode }) {
  const pct = `${Math.max(0, Math.min(1, share)) * 100}%` as const;
  return <View style={[style, vertical ? { height: pct } : { width: pct }]}>{children}</View>;
}

/** The one plain-English sentence under a chart: what it says. */
export function Takeaway({ text }: { text: string }) {
  return (
    <View style={styles.takeWrap}>
      <SeamDivider color={ink(0.14)} style={{ marginBottom: space.sm }} />
      <View style={styles.take}>
        <Ionicons name="sparkles" size={14} color={colors.gold} style={{ marginTop: 2 }} />
        <Text style={styles.takeText}>{text}</Text>
      </View>
    </View>
  );
}

/** A chart's title, its card and its takeaway. */
export function ChartCard({ title, right, children, takeaway, flush }: { title: string; right?: ReactNode; children: ReactNode; takeaway?: string; flush?: boolean }) {
  return (
    <>
      <SectionLabel flush={flush} right={right}>
        {title}
      </SectionLabel>
      <Card style={{ paddingVertical: space.md }}>
        {children}
        {takeaway ? <Takeaway text={takeaway} /> : null}
      </Card>
    </>
  );
}

export const Legend = ({ items }: { items: { color: string; label: string; dot?: boolean }[] }) => (
  <View style={styles.legend}>
    {items.map((l) => (
      <View key={l.label} style={styles.legendItem}>
        <View style={[styles.swatch, { backgroundColor: l.color }, l.dot && { width: 9, height: 9, borderRadius: 5 }]} />
        <Text style={styles.legendText}>{l.label}</Text>
      </View>
    ))}
  </View>
);

/** Runs of an innings' log sorted into what each ball was: dot, 1s, 2s (and 3s), 4s, 6s, or an extra. */
export function runMix(s: InningsState) {
  const mix = { dots: 0, ones: 0, twos: 0, fours: 0, sixes: 0, extras: 0 };
  for (const d of s.log) {
    const b = d.ball;
    if (b.wicket?.kind === 'retired') continue;
    if (b.extra) mix.extras++;
    else if (b.runs === 0) mix.dots++;
    else if (b.runs === 1) mix.ones++;
    else if (b.runs === 4) mix.fours++;
    else if (b.runs >= 6) mix.sixes++;
    else mix.twos++;
  }
  const total = mix.dots + mix.ones + mix.twos + mix.fours + mix.sixes + mix.extras;
  const boundaryRuns = mix.fours * 4 + mix.sixes * 6;
  return { ...mix, total, boundaryShare: s.runs ? boundaryRuns / s.runs : 0 };
}

const side = (s: InningsState) => s.battingTeam.name;

/** Runs per over as bars, both innings side by side in each over, the overs a wicket fell marked underneath. */
export function Manhattan({ state }: { state: MatchState }) {
  const lines = state.innings.slice(0, 2).filter((s) => s.legalBalls > 0);
  if (!lines.length) return null;
  const overs = Math.max(...lines.map((s) => Math.ceil(s.maxBalls / 6)));
  const peak = Math.max(6, ...lines.flatMap((s) => s.overTotals.map((o) => o.runs)));
  const top = niceTop(peak);
  const BH = 120;
  const tints = [colors.accent, colors.violet];
  const ticks = overTicks(overs);
  const step = ticks[1] ?? 1;

  let big = { runs: -1, over: 0, team: '' };
  lines.forEach((s) => s.overTotals.forEach((o, i) => o.runs > big.runs && s.overs[i]?.length && (big = { runs: o.runs, over: i + 1, team: side(s) })));
  const takeaway = big.runs >= 0 ? `The biggest over was over ${big.over}: ${big.runs} runs for ${big.team}.` : undefined;

  return (
    <ChartCard title="Runs per over" right={<Text style={styles.count}>Manhattan</Text>} takeaway={takeaway}>
      <View style={{ flexDirection: 'row' }}>
        <View style={{ width: AXIS_L - 6, height: BH }}>
          {[0, 0.5, 1].map((f) => (
            <Text key={f} style={[styles.axis, { position: 'absolute', right: 4, top: BH - f * BH - 7 }]}>
              {Math.round(top * f)}
            </Text>
          ))}
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ height: BH }}>
            {[0, 0.5, 1].map((f) => (
              <View key={f} style={{ position: 'absolute', left: 0, right: 0, top: BH - f * BH, height: 1, backgroundColor: ink(f === 0 ? 0.25 : 0.08) }} />
            ))}
            <View style={{ flexDirection: 'row', height: BH }}>
              {Array.from({ length: overs }, (_, i) => (
                <View key={i} style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 1, paddingHorizontal: 1 }}>
                  {lines.map((s, k) => {
                    const runs = s.overs[i]?.length ? s.overTotals[i]?.runs ?? 0 : 0;
                    return (
                      <View key={k} style={{ flex: 1 }}>
                        <GrowBar
                          vertical
                          share={runs / top}
                          delay={200 + i * 28}
                          trackStyle={{ height: BH }}
                          style={{ backgroundColor: tints[k], borderTopLeftRadius: 2, borderTopRightRadius: 2, opacity: runs === 0 ? 0.3 : 1 }}
                        />
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
          </View>
          {/* Where the wickets fell: a red dot under the bar of the innings it fell in. */}
          <View style={{ flexDirection: 'row', height: 16, alignItems: 'center' }}>
            {Array.from({ length: overs }, (_, i) => (
              <View key={i} style={{ flex: 1, flexDirection: 'row', paddingHorizontal: 1 }}>
                {lines.map((s, k) => (
                  <View key={k} style={{ flex: 1, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 1 }}>
                    {Array.from({ length: Math.min(3, s.overTotals[i]?.wickets ?? 0) }, (_, w) => (
                      <PopIn key={w} delay={700 + i * 28} turn={0}>
                        <View style={styles.wk} />
                      </PopIn>
                    ))}
                  </View>
                ))}
              </View>
            ))}
          </View>
          <View style={{ flexDirection: 'row' }}>
            {Array.from({ length: overs }, (_, i) => (
              <Text key={i} style={[styles.axis, { flex: 1, textAlign: 'center' }]} numberOfLines={1}>
                {(i + 1) % step === 0 ? i + 1 : ''}
              </Text>
            ))}
          </View>
        </View>
      </View>
      <Text style={styles.axisCaption}>overs bowled · runs in each over</Text>
      <Legend
        items={[
          ...lines.map((s, k) => ({ color: tints[k], label: side(s) })),
          { color: colors.danger, label: 'wicket', dot: true },
        ]}
      />
    </ChartCard>
  );
}

/** How each side's balls went: dots, singles, twos, fours, sixes, extras, as one strip per innings. */
export function RunMix({ state }: { state: MatchState }) {
  const lines = state.innings.slice(0, 2).filter((s) => s.log.length > 0);
  if (!lines.length) return null;
  const kinds = [
    { key: 'dots', label: 'dots', color: ink(0.16) },
    { key: 'ones', label: 'ones', color: ink(0.38) },
    { key: 'twos', label: 'twos+', color: ink(0.62) },
    { key: 'fours', label: 'fours', color: colors.cyan },
    { key: 'sixes', label: 'sixes', color: colors.accent },
    { key: 'extras', label: 'extras', color: colors.violet },
  ] as const;
  const mixes = lines.map((s) => ({ s, m: runMix(s) }));
  const pc = (n: number) => `${Math.round(n * 100)}%`;
  let takeaway: string | undefined;
  if (mixes.length === 1) {
    const { s, m } = mixes[0];
    takeaway = `${side(s)} played ${pc(m.dots / Math.max(1, m.total))} of their balls as dots and made ${pc(m.boundaryShare)} of their runs in boundaries.`;
  } else {
    const hard = mixes[0].m.boundaryShare >= mixes[1].m.boundaryShare ? mixes[0] : mixes[1];
    const dotty = mixes[0].m.dots / Math.max(1, mixes[0].m.total) >= mixes[1].m.dots / Math.max(1, mixes[1].m.total) ? mixes[0] : mixes[1];
    takeaway = `${side(hard.s)} found the rope for ${pc(hard.m.boundaryShare)} of their runs. ${side(dotty.s)} left ${pc(dotty.m.dots / Math.max(1, dotty.m.total))} of their balls as dots.`;
  }
  return (
    <ChartCard title="Where the runs came from" right={<Text style={styles.count}>balls</Text>} takeaway={takeaway}>
      <View style={{ gap: space.md }}>
        {mixes.map(({ s, m }, r) => (
          <View key={r} style={{ gap: 6 }}>
            <Text style={styles.mixTeam} numberOfLines={1}>
              {side(s)} <Text style={styles.mixSub}>· {m.total} balls</Text>
            </Text>
            <View style={styles.mixCounts}>
              {kinds.map((k) => (
                <View key={k.key} style={styles.mixCount}>
                  <View style={[styles.swatch, { backgroundColor: k.color, width: 8, height: 8, borderRadius: 4 }]} />
                  <Text style={styles.mixNum}>{m[k.key]}</Text>
                  <Text style={styles.mixLabel}>{k.label}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}
      </View>
    </ChartCard>
  );
}

/** The wickets as a timeline along the innings, then each one in words. */
export function FallOfWickets({ match, s }: { match: Match; s: InningsState }) {
  if (!s.fallOfWickets.length) return null;
  const at = (over: string) => {
    const [o, b] = over.split('.').map(Number);
    return Math.min(1, (o * 6 + (b || 0)) / Math.max(1, s.maxBalls));
  };
  return (
    <>
      <SectionLabel>Fall of wickets</SectionLabel>
      <Card style={{ gap: space.md }}>
        <View>
          <View style={styles.fowTrack}>
            <View style={styles.fowLine} />
            {s.fallOfWickets.map((f, i) => (
              <PopIn key={i} delay={250 + i * 90} turn={0} style={{ position: 'absolute', left: `${at(f.over) * 100}%`, marginLeft: -10, top: i % 2 ? 22 : 0 }}>
                <View accessibilityLabel={`Wicket ${f.wicket}: ${playerName(match, f.player)}, ${f.runs} runs, over ${f.over}`} style={styles.fowDot}>
                  <Text style={styles.fowDotText}>{f.wicket}</Text>
                </View>
              </PopIn>
            ))}
          </View>
          <View style={styles.fowAxis}>
            <Text style={styles.axis}>start</Text>
            <Text style={styles.axis}>{Math.round(s.maxBalls / 12)} ov</Text>
            <Text style={styles.axis}>{Math.round(s.maxBalls / 6)} ov</Text>
          </View>
        </View>
        <View style={{ gap: 6 }}>
          {s.fallOfWickets.map((f, i) => (
            <View key={i} style={styles.fowRow}>
              <Text style={styles.fowScore}>
                {f.runs}-{f.wicket}
              </Text>
              <Text style={styles.fowName} numberOfLines={1}>
                {playerName(match, f.player)}
              </Text>
              <Text style={styles.fowOver}>{f.over} ov</Text>
            </View>
          ))}
        </View>
      </Card>
    </>
  );
}

export const styles = StyleSheet.create({
  takeWrap: { marginTop: space.md },
  take: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  takeText: { flex: 1, color: colors.text, fontSize: 13.5, lineHeight: 20, fontFamily: font.medium },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginTop: space.sm, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 12, height: 4, borderRadius: 2 },
  legendText: { color: colors.muted, fontSize: 12, fontFamily: font.semibold },
  count: { color: colors.faint, fontSize: 12, fontFamily: font.medium },
  axis: { color: colors.faint, fontSize: 10, fontFamily: font.medium, ...type.num },
  axisCaption: { color: colors.faint, fontSize: 10, fontFamily: font.medium, textAlign: 'center', marginTop: 4, letterSpacing: 0.4 },
  wk: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.danger },
  mixTeam: { color: colors.text, fontSize: 14, fontFamily: font.bold },
  mixSub: { color: colors.faint, fontFamily: font.medium, fontSize: 12 },
  mixBar: { flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden', gap: 2 },
  mixCounts: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.md, rowGap: 4 },
  mixCount: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  mixNum: { color: colors.text, fontSize: 12, fontFamily: font.poster, ...type.num },
  mixLabel: { color: colors.faint, fontSize: 11, fontFamily: font.medium },
  fowTrack: { height: 44, justifyContent: 'center' },
  fowLine: { height: 3, borderRadius: 2, backgroundColor: ink(0.14) },
  fowDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.surface },
  fowDotText: { color: '#FFFFFF', fontSize: 9, fontFamily: font.posterBlack },
  fowAxis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  fowRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  fowScore: { width: 56, color: colors.text, fontSize: 14, fontFamily: font.posterBlack, ...type.num },
  fowName: { flex: 1, color: colors.muted, fontSize: 13, fontFamily: font.medium },
  fowOver: { color: colors.faint, fontSize: 12, fontFamily: font.medium, ...type.num, borderRadius: radius.sm },
});
