import { MomAward } from './MomAward.tsx';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
import { oversText, type BallView, type InningsState, type MatchState } from '../engine/engine.ts';
import { isPlaceholder, playerOfTheMatch, seriesState } from '../engine/stats.ts';
import type { Match } from '../engine/types.ts';
import { colors, edge, font, gradients, hero, HERO_BG, radius, space, type, glass } from '../theme.ts';
import { OvalGround, SeamDivider, Stumps } from './cricket.tsx';
import { Confetti, EASE_OUT, Pulse, PopIn, Sheen, Ticker, useReducedMotion } from './motion.tsx';
import { TeamCrest } from './TeamCrest.tsx';
import { BallChip, Button, FadeIn, PitchStripes, PressableScale, type Moment } from './ui.tsx';

// The moments around the scoring: a wicket's stumps, a milestone's confetti, an over's summary, the innings break and
// the result. Presentation only.

const native = Platform.OS !== 'web';

/** A wicket: the stumps fly over the red flash. */
export function WicketHit({ moment }: { moment: Moment | null }) {
  const [shown, setShown] = useState<number | null>(null);
  const [hit, setHit] = useState(false);
  useEffect(() => {
    if (!moment || moment.kind !== 'wicket') return;
    setShown(moment.key);
    setHit(false);
    const a = setTimeout(() => setHit(true), 140);
    const b = setTimeout(() => setShown(null), 1450);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [moment?.key]);
  if (shown === null) return null;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', paddingTop: '14%', zIndex: 60 }]}>
      <Stumps size={170} hit={hit} color="#FFFFFF" bail={colors.gold} />
    </View>
  );
}

/** A fifty, a hundred or a hat-trick: confetti over the flash. */
export function MilestoneBurst({ moment }: { moment: Moment | null }) {
  const [shown, setShown] = useState<number | null>(null);
  useEffect(() => {
    if (!moment || (moment.kind !== 'fifty' && moment.kind !== 'hundred' && moment.kind !== 'hattrick')) return;
    setShown(moment.key);
    const t = setTimeout(() => setShown(null), 3200);
    return () => clearTimeout(t);
  }, [moment?.key]);
  if (shown === null) return null;
  return (
    <View key={shown} pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 60 }]}>
      <Confetti count={44} height={760} />
    </View>
  );
}

export type OverDone = { key: number; over: number; balls: BallView[]; runs: number; wickets: number; bowler: string; figures: string; score: string };

/** The over that just finished, in a card that drops in from the top and leaves by itself. */
export function OverSummary({ summary, top }: { summary: OverDone | null; top: number }) {
  const still = useReducedMotion();
  const v = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState<OverDone | null>(null);
  useEffect(() => {
    if (!summary) return;
    setShown(summary);
    v.setValue(0);
    Animated.sequence([
      Animated.delay(900),
      Animated.spring(v, { toValue: 1, useNativeDriver: native, speed: 12, bounciness: 8 }),
      Animated.delay(3000),
      Animated.timing(v, { toValue: 2, duration: 320, easing: EASE_OUT, useNativeDriver: native }),
    ]).start(({ finished }) => finished && setShown(null));
  }, [summary?.key]);
  if (!shown) return null;
  const opacity = v.interpolate({ inputRange: [0, 0.4, 1, 1.5, 2], outputRange: [0, 1, 1, 1, 0] });
  const translateY = v.interpolate({ inputRange: [0, 1, 2], outputRange: [-40, 0, -30] });
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[m.overWrap, { top, opacity: still ? 1 : opacity, transform: [{ translateY: still ? 0 : translateY }] }]}
    >
      <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={m.overCard}>
        <OvalGround opacity={0.08} drift={false} />
        <View style={m.overTop}>
          <Text style={m.overEyebrow}>OVER {shown.over} COMPLETE</Text>
          <Text style={m.overScore}>{shown.score}</Text>
        </View>
        <View style={m.overBalls}>
          {shown.balls.map((b, i) => (
            <BallChip key={i} ball={b} size={30} />
          ))}
          <View style={m.overRuns}>
            <Text style={m.overRunsNum}>{shown.runs}</Text>
            <Text style={m.overRunsLabel}> runs{shown.wickets ? ` · ${shown.wickets} wkt` : ''}</Text>
          </View>
        </View>
        <Text style={m.overBowler}>
          {shown.bowler}  <Text style={{ color: hero.faint }}>{shown.figures}</Text>
          {shown.runs === 0 ? <Text style={{ color: hero.gold }}>  · maiden</Text> : null}
        </Text>
      </LinearGradient>
    </Animated.View>
  );
}

// ─── Innings break ───────────────────────────────────────────────────────────

/** The break before the chase (or a super over): the target as the hero, how it was set, what the chase asks. */
export function BreakHero({ match, state, s, wide }: { match: Match; state: MatchState; s: InningsState; wide?: boolean }) {
  const index = state.current;
  const superOver = index >= 2;
  const before = state.innings[index - 1];
  const rrr = s.target !== null && s.maxBalls ? (s.target * 6) / s.maxBalls : null;
  return (
    <FadeIn>
      <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[m.breakCard, wide && { paddingVertical: space.xxl }]}>
        <OvalGround opacity={0.11} />
        <PitchStripes tint="255,255,255" opacity={0.03} />
        <Sheen every={8000} strength={0.06} />
        <View style={m.breakPill}>
          <Pulse color={hero.gold} size={6} />
          <Text style={m.breakEyebrow}>{superOver ? 'SUPER OVER · ONE OVER, TWO WICKETS' : 'INNINGS BREAK'}</Text>
        </View>
        <View style={m.breakDone}>
          <TeamCrest name={before.battingTeam.name} size={34} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={m.breakDoneTeam}>
              {before.battingTeam.name}
            </Text>
            <Text style={m.breakDoneScore}>
              {before.runs}/{before.wickets} <Text style={{ color: hero.faint, fontSize: 14 }}>in {oversText(before.legalBalls)} overs</Text>
            </Text>
          </View>
        </View>
        <SeamDivider color="rgba(255,255,255,0.18)" style={{ marginVertical: space.md }} />
        {s.target !== null ? (
          <>
            <Text style={m.breakLabel}>{s.battingTeam.name} need</Text>
            <Ticker value={s.target} style={m.breakTarget} lineHeight={wide ? 124 : 108} />
            <Text style={m.breakTitle}>to win{match.revisedTarget ? ' (revised target)' : ''}</Text>
            <View style={m.breakChips}>
              <View style={m.breakChip}>
                <Text style={m.breakChipLabel}>BALLS</Text>
                <Text style={m.breakChipValue}>{Math.max(0, s.maxBalls)}</Text>
              </View>
              {rrr !== null && (
                <View style={m.breakChip}>
                  <Text style={m.breakChipLabel}>RATE NEEDED</Text>
                  <Text style={m.breakChipValue}>{rrr.toFixed(2)}</Text>
                </View>
              )}
              <View style={m.breakChip}>
                <Text style={m.breakChipLabel}>WICKETS</Text>
                <Text style={m.breakChipValue}>{Math.max(0, s.battingTeam.players.length - 1)}</Text>
              </View>
            </View>
          </>
        ) : (
          <>
            <Text style={[m.breakTarget, { fontSize: 72, lineHeight: 80 }]}>Tied</Text>
            <Text style={m.breakTitle}>{s.battingTeam.name} bat first</Text>
          </>
        )}
        <Text style={m.breakSub}>
          {superOver
            ? s.target !== null
              ? `${state.innings[2].battingTeam.name} made ${state.innings[2].runs}/${state.innings[2].wickets} in their over`
              : 'The side that batted second goes first. Most runs in the over wins it.'
            : 'Pick the openers below to start the chase.'}
        </Text>
      </LinearGradient>
    </FadeIn>
  );
}

// ─── The result ──────────────────────────────────────────────────────────────

export type ResultActions = {
  /** Scorer can act on a result waiting to be confirmed. */
  canConfirm: boolean;
  canScore: boolean;
  isScorer: boolean;
  celebrate: boolean;
  canChange: boolean;
  onConfirm: () => void;
  onSuperOver: () => void;
  onChange: () => void;
  onShare: () => void;
  onExport: () => void;
};

/** The full-time screen: the winner as a hero, both scores as a scoreboard, Man of the Match as a brass plaque. */
export function ResultView({ match, state, matches, a }: { match: Match; state: MatchState; matches: Match[]; a: ResultActions }) {
  const winner = state.winner ? match.teams.find((t) => t.id === state.winner) : null;
  const margin = winner && state.result ? state.result.replace(`${winner.name} won `, '') : '';
  const potm = playerOfTheMatch(match);
  const series = match.series ? seriesState(matches.filter((x) => x.series?.id === match.series!.id)) : null;
  const pending = match.confirmed === false;
  return (
    <FadeIn>
      {/* A result waits for the scorer's yes: a wrong tap on the last ball can still be undone until then. */}
      {pending &&
        (a.canConfirm ? (
          <View style={m.confirm}>
            <View style={m.confirmHead}>
              <Ionicons name="shield-checkmark-outline" size={20} color={colors.gold} />
              <Text style={m.confirmTitle}>Is that the result?</Text>
            </View>
            <Text style={m.note}>Check the last ball. Undo puts a wrong tap right; once it’s confirmed only the admin can change it.</Text>
            <Button label="Confirm result" icon="checkmark-circle" onPress={a.onConfirm} />
          </View>
        ) : (
          <View style={m.waiting}>
            <Pulse color={colors.gold} size={7} />
            <Text style={m.waitingText}>Waiting for the scorer to confirm the result.</Text>
          </View>
        ))}

      <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={m.result}>
        <OvalGround opacity={0.12} />
        <PitchStripes opacity={0.04} tint="255,255,255" />
        <Sheen every={7000} strength={0.07} />
        {winner && a.celebrate && <Confetti height={640} count={40} />}
        <PopIn delay={120} style={m.trophy}>
          <MaterialCommunityIcons name="trophy" size={30} color={colors.onAccent} />
        </PopIn>
        <Text style={m.eyebrow}>
          {series ? `${series.name.toUpperCase()} · MATCH ${match.series!.number} OF ${series.of}` : winner ? 'FULL TIME' : state.drawn ? 'NO WINNER' : 'ALL SQUARE'}
        </Text>
        {winner ? (
          <PopIn delay={260} turn={0} style={m.crestWrap}>
            <TeamCrest name={winner.name} size={84} />
          </PopIn>
        ) : (
          <View style={m.pair}>
            <TeamCrest name={match.teams[0].name} size={56} />
            <Text style={m.pairVs}>v</Text>
            <TeamCrest name={match.teams[1].name} size={56} />
          </View>
        )}
        <Text style={m.winner} numberOfLines={2}>
          {winner ? `${winner.name} win` : state.drawn ? 'Match drawn' : 'Match tied'}
        </Text>
        {winner && <Text style={m.margin}>{margin}</Text>}

        <View style={m.scores}>
          {state.innings.map((inn, i) => {
            const won = winner?.id === inn.battingTeam.id;
            return (
              <View key={i} style={[m.scoreRow, won && m.scoreWon]}>
                <TeamCrest name={inn.battingTeam.name} size={30} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={m.scoreTeam} numberOfLines={1}>
                    {inn.battingTeam.name}
                  </Text>
                  <Text style={m.scoreSub}>{i >= 2 ? 'Super over' : i === 0 ? '1st innings' : '2nd innings'}{won ? ' · winner' : ''}</Text>
                </View>
                <Text style={m.scoreRuns}>
                  {inn.runs}/{inn.wickets}
                  <Text style={m.scoreOvers}> {oversText(inn.legalBalls)} ov</Text>
                </Text>
              </View>
            );
          })}
        </View>
      </LinearGradient>

      {potm && (
        <View style={{ marginTop: space.md }}>
          <MomAward
            name={potm.name}
            team={potm.team}
            summary={potm.summary}
            disabled={isPlaceholder(potm.name)}
            onPress={() => router.push({ pathname: '/player/[key]', params: { key: potm.key } })}
          />
        </View>
      )}

      {series && (
        <PressableScale
          scaleTo={0.97}
          wrapStyle={{ marginTop: space.md }}
          onPress={() => router.push({ pathname: '/series/[id]', params: { id: series.id } })}
          style={m.seriesLine}
          accessibilityLabel={`Series: ${series.status}`}
        >
          <MaterialCommunityIcons name="trophy-outline" size={18} color={colors.gold} />
          <Text style={m.seriesText}>{series.status}</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.muted} />
        </PressableScale>
      )}

      <View style={{ gap: space.sm, marginTop: space.lg }}>
        {state.result === 'Match tied' && match.innings.length < 4 && a.canScore && <Button label="Play a super over" icon="flash" onPress={a.onSuperOver} />}
        {!a.isScorer ? null : series?.next ? (
          <Button label={`Next: match ${series.next} of ${series.of}`} icon="play-forward" onPress={() => router.push({ pathname: '/new', params: { rematch: match.id, series: 'next' } })} />
        ) : (
          <Button label="Rematch" icon="repeat" onPress={() => router.push({ pathname: '/new', params: { rematch: match.id } })} />
        )}
        <Button label="Share result picture" icon="image-outline" variant="ghost" onPress={a.onShare} />
        <Button variant="ghost" label="Full scorecard" icon="list" onPress={() => router.push({ pathname: '/match/[id]/scorecard', params: { id: match.id } })} />
        {a.canChange && <Button variant="ghost" label="Change the result" icon="create-outline" onPress={a.onChange} />}
        {series && <Button variant="ghost" label="Series table" icon="trophy-outline" onPress={() => router.push({ pathname: '/series/[id]', params: { id: series.id } })} />}
        <Button variant="ghost" label="Export match" icon="download-outline" onPress={a.onExport} />
        <Text style={m.hint}>A PDF scorecard for the group, or a match file so their player stats include it.</Text>
      </View>
    </FadeIn>
  );
}

const m = StyleSheet.create({
  overWrap: { position: 'absolute', left: space.md, right: space.md, zIndex: 40, alignItems: 'center' },
  overCard: { width: '100%', maxWidth: 480, borderRadius: radius.lg, padding: space.md, gap: 8, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(205,235,215,0.18)', boxShadow: '0px 10px 30px rgba(0,0,0,0.4)' as never },
  overTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  overEyebrow: { ...type.label, fontSize: 10, color: hero.gold },
  overScore: { color: hero.text, fontSize: 18, fontFamily: font.posterBlack, ...type.num },
  overBalls: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  overRuns: { flexDirection: 'row', alignItems: 'baseline', marginLeft: 'auto' },
  overRunsNum: { color: hero.text, fontSize: 24, fontFamily: font.posterBlack, ...type.num },
  overRunsLabel: { color: hero.muted, fontSize: 12, fontFamily: font.bold },
  overBowler: { color: hero.text, fontSize: 13, fontFamily: font.bold },

  breakCard: { borderRadius: radius.xl, padding: space.xl, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(205,235,215,0.12)' },
  breakPill: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', backgroundColor: colors.goldDim, borderRadius: radius.pill, paddingHorizontal: 12, height: 28, marginBottom: space.lg },
  breakEyebrow: { ...type.label, fontSize: 10, color: hero.gold },
  breakDone: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  breakDoneTeam: { color: hero.muted, fontSize: 13, fontFamily: font.bold },
  breakDoneScore: { color: hero.text, fontSize: 26, fontFamily: font.posterBlack, ...type.num },
  breakLabel: { ...type.poster, fontSize: 18, color: hero.muted },
  breakTarget: { fontFamily: font.posterBlack, fontSize: 104, color: hero.accent, letterSpacing: -5, ...type.num },
  breakTitle: { ...type.poster, fontSize: 20, color: hero.text },
  breakChips: { flexDirection: 'row', gap: space.sm, marginTop: space.lg },
  breakChip: { flex: 1, ...glass, borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: 12 },
  breakChipLabel: { ...type.label, fontSize: 8.5, color: hero.faint },
  breakChipValue: { color: hero.text, fontSize: 22, fontFamily: font.posterBlack, ...type.num },
  breakSub: { color: hero.muted, fontSize: 13, fontFamily: font.medium, marginTop: space.lg },

  confirm: { gap: space.sm, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.gold, padding: space.lg, marginBottom: space.md, ...edge },
  confirmHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  confirmTitle: { color: colors.text, fontSize: 18, fontFamily: font.poster },
  note: { color: colors.muted, fontSize: 13, fontFamily: font.regular, lineHeight: 19 },
  waiting: { flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: colors.goldDim, borderRadius: radius.pill, paddingHorizontal: space.lg, height: 38, marginBottom: space.md },
  waitingText: { color: colors.gold, fontSize: 13, fontFamily: font.semibold },

  result: { borderRadius: radius.xl, padding: space.xl, overflow: 'hidden', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(205,235,215,0.12)' },
  trophy: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { ...type.label, color: hero.gold, marginTop: space.md, textAlign: 'center' },
  crestWrap: { marginTop: space.md },
  pair: { flexDirection: 'row', alignItems: 'center', gap: space.lg, marginTop: space.md },
  pairVs: { color: hero.faint, fontFamily: font.poster, fontSize: 20 },
  winner: { fontFamily: font.posterBlack, fontSize: 38, lineHeight: 44, color: hero.text, letterSpacing: -1.4, textAlign: 'center', marginTop: space.md },
  margin: { fontFamily: font.poster, fontSize: 19, color: hero.gold, letterSpacing: -0.2, marginTop: 2, textAlign: 'center' },
  scores: { alignSelf: 'stretch', marginTop: space.xl, gap: 6 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, ...glass, borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: space.md },
  scoreWon: { borderWidth: 1, borderColor: colors.gold },
  scoreTeam: { color: hero.text, fontFamily: font.bold, fontSize: 15 },
  scoreSub: { color: hero.faint, fontFamily: font.semibold, fontSize: 11 },
  scoreRuns: { color: hero.text, fontFamily: font.posterBlack, fontSize: 24, ...type.num },
  scoreOvers: { fontFamily: font.medium, fontSize: 12, color: hero.faint },

  plaque: { backgroundColor: HERO_BG, borderRadius: radius.lg, borderWidth: 2, borderColor: colors.gold, padding: 5, ...edge },
  plaqueInner: { borderRadius: radius.md, borderWidth: 1, borderColor: 'rgba(221,182,110,0.45)', paddingVertical: space.md, paddingHorizontal: space.lg, alignItems: 'center', gap: 6 },
  plaqueTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  plaqueLabel: { ...type.label, fontSize: 10.5, color: colors.gold, letterSpacing: 2 },
  plaqueName: { fontFamily: font.posterBlack, fontSize: 28, color: hero.text, letterSpacing: -0.6 },
  plaqueLine: { fontFamily: font.semibold, fontSize: 14, color: hero.muted, ...type.num },
  seriesLine: { flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: colors.surface, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, paddingHorizontal: space.lg, height: 46, ...edge },
  seriesText: { flex: 1, fontFamily: font.bold, fontSize: 14, color: colors.text },
  hint: { color: colors.faint, fontSize: 12, fontFamily: font.regular, textAlign: 'center' },
});
