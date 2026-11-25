import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
import { oversText, playerName, type BallView, type InningsState } from '../engine/engine.ts';
import { plural } from '../engine/text.ts';
import { chaseChance, situationOf } from '../engine/winProb.ts';
import type { Match } from '../engine/types.ts';
import { colors, edge, font, gradients, hero, HERO_BG, radius, space, type } from '../theme.ts';
import { PlayerAvatar } from './Avatar.tsx';
import { OvalGround, Flip, SeamDivider } from './cricket.tsx';
import { EASE_OUT, GrowBar, Pulse, Sheen, useReducedMotion } from './motion.tsx';
import { TeamCrest } from './TeamCrest.tsx';
import { BallChip as BallChipLazy, Card, IconButton, PitchStripes, PressableScale } from './ui.tsx';

// The live screen's scoreboard, the batters and bowler, and the over strips. Presentation only.

const native = Platform.OS !== 'web';
export const rate = (runs: number, balls: number) => (balls ? ((runs * 6) / balls).toFixed(2) : '0.00');

/** A "+4" that lifts off the score and fades whenever the total goes up. */
function RunDelta({ runs }: { runs: number }) {
  const still = useReducedMotion();
  const prev = useRef(runs);
  const v = useRef(new Animated.Value(1)).current;
  const delta = useRef(0);
  useEffect(() => {
    const d = runs - prev.current;
    prev.current = runs;
    if (d <= 0 || still) return;
    delta.current = d;
    v.setValue(0);
    Animated.timing(v, { toValue: 1, duration: 1100, easing: EASE_OUT, useNativeDriver: native }).start();
  }, [runs, still, v]);
  return (
    <Animated.Text
      pointerEvents="none"
      style={[
        s.delta,
        {
          opacity: v.interpolate({ inputRange: [0, 0.15, 0.7, 1], outputRange: [0, 1, 1, 0] }),
          transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [10, -22] }) }],
        },
      ]}
    >
      {delta.current > 0 ? `+${delta.current}` : ''}
    </Animated.Text>
  );
}

function Stat({ label, value, hot, warm }: { label: string; value: string; hot?: boolean; warm?: boolean }) {
  return (
    <View style={s.stat}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={[s.statValue, hot && { color: hero.accent }, warm && { color: hero.gold }]}>{value}</Text>
    </View>
  );
}

/**
 * The scoreboard: the batting side's crest, the score on rolling digits, the run rates, how far through the innings
 * we are, and for a chase what it takes (with the win chance and a one-line takeaway). `big`: a tablet or laptop.
 */
export function Scoreboard({ match, s: inn, index, big }: { match: Match; s: InningsState; index: number; big?: boolean }) {
  const ballsLeft = inn.maxBalls - inn.legalBalls;
  const chasing = inn.target !== null && inn.status !== 'done';
  const need = chasing ? Math.max(inn.target! - inn.runs, 0) : null;
  const projected = inn.legalBalls >= 6 ? Math.round(inn.runs + (inn.runs / inn.legalBalls) * ballsLeft) : null;
  const progress = Math.min(1, inn.legalBalls / inn.maxBalls);
  const sit = chasing ? situationOf(match, inn) : null;
  const chance = sit ? chaseChance(sit) : null;
  const crr = inn.legalBalls ? (inn.runs * 6) / inn.legalBalls : 0;
  const rrr = need !== null && ballsLeft > 0 ? (need * 6) / ballsLeft : null;
  const size = big ? 104 : 66;
  const line = size + 8;
  const against = inn.bowlingTeam.name;
  const overNo = inn.legalBalls;
  const label = index >= 2 ? 'Super over' : index === 0 ? '1st innings' : '2nd innings';
  const extras = inn.extras.wide + inn.extras.noball + inn.extras.bye + inn.extras.legbye + inn.extras.penalty;
  // One line to take away: what the chase asks against what the side is doing, or where the innings is heading.
  const takeaway =
    need !== null
      ? need === 0
        ? 'Scores level: one more wins it'
        : rrr === null
          ? ''
          : rrr > crr + 0.05
            ? `Needs ${rrr.toFixed(1)} an over, scoring ${crr.toFixed(1)}`
            : `Ahead of the rate: needs ${rrr.toFixed(1)} an over, scoring ${crr.toFixed(1)}`
      : projected !== null
        ? `On course for ${projected} at ${crr.toFixed(1)} an over`
        : '';

  return (
    <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.hero, big && { padding: space.xl }]}>
      <OvalGround opacity={0.1} />
      <PitchStripes opacity={0.03} tint="255,255,255" />
      <Sheen every={7000} strength={0.07} />

      <View style={s.heroTop}>
        <View style={s.livePill}>
          <Pulse color={hero.accent} size={6} />
          <Text style={s.liveText}>{label}</Text>
        </View>
        <View style={s.oversBox} accessibilityLabel={`${oversText(overNo)} of ${match.rules.overs} overs`}>
          <Text style={s.oversNow}>{oversText(overNo)}</Text>
          <Text style={s.oversOf}> of {match.rules.overs} ov</Text>
        </View>
      </View>

      <View style={s.teamRow}>
        <TeamCrest name={inn.battingTeam.name} size={big ? 44 : 36} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={[s.heroTeam, big && { fontSize: 24 }]}>
            {inn.battingTeam.name}
          </Text>
          {big && (
            <Text numberOfLines={1} style={s.heroVs}>
              batting against {against}
            </Text>
          )}
        </View>
      </View>

      <View style={s.scoreRow}>
        <View style={s.scoreWrap} accessibilityLabel={`${inn.runs} for ${inn.wickets}`}>
          <View>
            <Flip value={inn.runs} lineHeight={line} style={[s.score, { fontSize: size, letterSpacing: -size / 26 }]} />
            <RunDelta runs={inn.runs} />
          </View>
          <Text style={[s.slash, { fontSize: size * 0.5, lineHeight: line }]}>/</Text>
          <Flip value={inn.wickets} lineHeight={line} style={[s.wickets, { fontSize: size * 0.62 }]} />
        </View>
        <View style={s.stats}>
          <Stat label="CRR" value={rate(inn.runs, inn.legalBalls)} />
          {need !== null ? (
            <Stat label="RRR" value={rrr === null ? '–' : rrr.toFixed(2)} hot={rrr !== null && rrr <= crr + 0.05} warm={rrr !== null && rrr > crr + 0.05} />
          ) : (
            <Stat label="PROJ" value={projected === null ? '–' : String(projected)} />
          )}
        </View>
      </View>

      {/* One notch per over, filling as the innings goes. */}
      <View style={s.progress} accessibilityLabel={`${oversText(inn.legalBalls)} of ${match.rules.overs} overs`}>
        <GrowBar share={progress} trackStyle={StyleSheet.absoluteFill} style={s.progressFill} />
        {match.rules.overs <= 25 &&
          Array.from({ length: match.rules.overs - 1 }, (_, i) => (
            <View key={i} style={[s.notch, { left: `${((i + 1) / match.rules.overs) * 100}%` }]} />
          ))}
      </View>

      {need !== null ? (
        <View style={s.chaseBox}>
          <View style={s.chase}>
            <Text style={s.chaseText}>
              Need <Text style={s.chaseBig}>{need}</Text> off <Text style={s.chaseBig}>{ballsLeft}</Text>
              <Text style={s.chaseSmall}> balls</Text>
            </Text>
            <Text style={s.chaseTarget}>Target {inn.target}</Text>
          </View>
          {chance !== null && (
            <View style={s.chanceRow} accessibilityLabel={`Win chance ${Math.round(chance * 100)} percent`}>
              <Text style={s.chanceLabel}>Win chance {Math.round(chance * 100)}%</Text>
              <View style={s.chanceTrack}>
                <GrowBar share={chance} trackStyle={StyleSheet.absoluteFill} style={s.chanceFill} />
              </View>
            </View>
          )}
          {takeaway ? <Text style={s.takeaway}>{takeaway}</Text> : null}
        </View>
      ) : (
        <View style={s.footRow}>
          <Text style={s.heroFoot}>
            {takeaway}
          </Text>
          <Text style={s.heroFoot}>
            Extras {extras}
            {inn.partnership.balls > 0 || inn.partnership.runs > 0 ? `  ·  Stand ${inn.partnership.runs} (${inn.partnership.balls})` : ''}
          </Text>
        </View>
      )}
    </LinearGradient>
  );
}

// ─── Crease ──────────────────────────────────────────────────────────────────

/** The batters and bowler. Without `onSwap` and `onRetire` it's to watch only. `big`: larger photos on a tablet or laptop. */
export function Crease({
  match,
  s: inn,
  onSwap,
  onRetire,
  big,
}: {
  match: Match;
  s: InningsState;
  onSwap?: () => void;
  onRetire?: (batter: string) => void;
  big?: boolean;
}) {
  const bowler = inn.bowlers.find((b) => b.id === inn.bowler);
  const batters = [inn.striker, inn.nonStriker].filter((id): id is string => id !== null);
  const av = big ? 46 : 38;
  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <View style={s.cHead}>
        <MaterialCommunityIcons name="cricket" size={13} color={colors.faint} />
        <Text style={s.cHeadText}>AT THE CREASE · BAT = ON STRIKE</Text>
        <Text style={[s.cHeadText, { marginLeft: 'auto' }]}>RUNS (BALLS)</Text>
      </View>
      {batters.map((id) => {
        const b = inn.batters.find((x) => x.id === id);
        const onStrike = id === inn.striker;
        const name = playerName(match, id);
        const strike = b && b.balls ? ((b.runs * 100) / b.balls).toFixed(0) : '–';
        return (
          <View
            key={id}
            accessibilityLabel={`${name}${onStrike ? ', on strike' : ', at the other end'}, ${b?.runs ?? 0} off ${b?.balls ?? 0}`}
            style={[s.batter, s.rowBorder, onStrike && { backgroundColor: colors.accentDim }]}
          >
            <View>
              <PlayerAvatar name={name} size={av} />
              {onStrike && (
                <View style={s.strikeBadge}>
                  <MaterialCommunityIcons name="cricket" size={12} color={colors.onAccent} />
                </View>
              )}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={s.batterName}>
                <Text numberOfLines={1} style={[s.name, onStrike && { color: colors.text }]}>
                  {name}
                </Text>
              </View>
              <View style={s.metaRow}>
                <Text style={s.meta}>
                  <Text style={{ color: colors.cyan }}>{b?.fours ?? 0}</Text>×4  <Text style={{ color: colors.accentInk }}>{b?.sixes ?? 0}</Text>×6  SR {strike}
                </Text>
                {onRetire && (
                  <PressableScale accessibilityLabel={`Retire ${name}`} hitSlop={7} onPress={() => onRetire(id)} style={s.retire}>
                    <Text style={s.retireText}>Retire</Text>
                  </PressableScale>
                )}
              </View>
            </View>
            <Text style={[s.runs, onStrike && { color: colors.text }]}>
              {b?.runs ?? 0}
              <Text style={s.balls}> ({b?.balls ?? 0})</Text>
            </Text>
          </View>
        );
      })}
      <View style={[s.bowlerRow, s.rowBorder]}>
        {inn.bowler ? (
          <View>
            <PlayerAvatar name={playerName(match, inn.bowler)} size={big ? 44 : 36} />
            <View style={s.bowlerBadge}>
              <MaterialCommunityIcons name="baseball" size={10} color={colors.danger} />
            </View>
          </View>
        ) : (
          <View style={s.bowlerIcon}>
            <MaterialCommunityIcons name="baseball" size={16} color={colors.danger} />
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={s.bowlerName}>
            {inn.bowler ? playerName(match, inn.bowler) : 'Pick a bowler'}
          </Text>
          <Text style={s.meta}>
            BOWLING{bowler ? `  ·  Econ ${rate(bowler.runs, bowler.balls)}` : ''}
          </Text>
        </View>
        {bowler && (
          <View style={{ alignItems: 'flex-end' }} accessibilityLabel={`Figures ${oversText(bowler.balls)} overs, ${bowler.maidens} maidens, ${bowler.runs} runs, ${bowler.wickets} wickets`}>
            <Text style={s.figures}>
              {bowler.wickets}
              <Text style={s.figuresRuns}>/{bowler.runs}</Text>
            </Text>
            <Text style={s.figuresSub}>
              {oversText(bowler.balls)} ov{bowler.maidens ? ` · ${bowler.maidens} md` : ''}
            </Text>
          </View>
        )}
        {inn.nonStriker && onSwap && <IconButton icon="swap-vertical" label="Swap strike" onPress={onSwap} />}
      </View>
    </Card>
  );
}

// ─── This over and the overs before it ───────────────────────────────────────

/** An empty slot in the over: a dashed ring where the ball will go. */
function Slot({ size }: { size: number }) {
  return <View style={[s.slot, { width: size, height: size, borderRadius: size / 2 }]} />;
}

/**
 * This over's six balls: tap one to fix it. Before the first ball of a new over, the last over stays on show. Empty
 * slots are dashed, the over's total sits at the end. `docked` is the slimmer form that sits on the pad.
 */
export function ThisOver({
  s: inn,
  match,
  onEdit,
  stacked,
  docked,
}: {
  s: InningsState;
  match?: Match;
  onEdit?: (b: BallView) => void;
  stacked?: boolean;
  docked?: boolean;
}) {
  const current = inn.overs[inn.overs.length - 1] ?? [];
  const showLast = current.length === 0 && inn.overs.length > 1;
  const balls = showLast ? inn.overs[inn.overs.length - 2] : current;
  const totals = inn.overTotals[inn.overTotals.length - (showLast ? 2 : 1)];
  const slots = showLast ? 0 : Math.max(0, 6 - (inn.legalBalls % 6 === 0 && current.length === 0 ? 0 : inn.legalBalls % 6));
  const overNo = Math.floor(inn.legalBalls / 6) + (showLast ? 0 : 1);
  const size = docked ? 34 : stacked ? 40 : 42;
  const bowlerId = inn.overBowlers[overNo - 1]?.[0] ?? inn.bowler;
  return (
    <View style={[s.over, docked && s.overDocked]} accessibilityLabel={`${showLast ? 'Last over' : `Over ${overNo}`}, ${totals?.runs ?? 0} runs`}>
      {!docked && (
        <View style={s.overHead}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <MaterialCommunityIcons name="baseball" size={14} color={colors.danger} />
            <Text style={s.overTitle}>{showLast ? 'LAST OVER' : `OVER ${overNo}`}</Text>
            {match && bowlerId && (
              <Text numberOfLines={1} style={s.overBowler}>
                {playerName(match, bowlerId)}
              </Text>
            )}
          </View>
          <View style={s.overTotal}>
            <Text style={s.overTotalNum}>{totals?.runs ?? 0}</Text>
            <Text style={s.overTotalLabel}> {(totals?.runs ?? 0) === 1 ? 'run' : 'runs'}</Text>
          </View>
        </View>
      )}
      <View style={s.overRow}>
        {docked && (
          <View style={s.dockLabel}>
            <Text style={s.dockOver}>{showLast ? 'LAST' : `OVER ${overNo}`}</Text>
          </View>
        )}
        <View style={s.chips}>
          {balls.map((b, i) => (
            <PressableScale
              key={`${inn.overs.length}-${i}`}
              scaleTo={0.85}
              hitSlop={4}
              accessibilityLabel={`Fix ball ${i + 1}`}
              disabled={!onEdit}
              dimWhenDisabled={false}
              onPress={() => onEdit?.(b)}
            >
              <BallChipLazy ball={b} size={size} animate={!showLast && i === balls.length - 1} />
            </PressableScale>
          ))}
          {Array.from({ length: slots }, (_, i) => (
            <Slot key={`e${i}`} size={size} />
          ))}
        </View>
        {docked && (
          <View style={s.dockTotal}>
            <Text style={s.overTotalNum}>{totals?.runs ?? 0}</Text>
            <Text style={s.dockRuns}>runs</Text>
          </View>
        )}
      </View>
      {!docked && onEdit && balls.length > 0 && <Text style={s.overHint}>Tap a ball to fix it</Text>}
    </View>
  );
}


/** The last few overs as small tiles: runs, a dot for each wicket. Tap one to fix it. */
export function RecentStrip({ s: inn, onOpen }: { s: InningsState; onOpen?: (over: number) => void }) {
  const current = inn.overs[inn.overs.length - 1] ?? [];
  const skip = current.length === 0 && inn.overs.length > 1 ? 2 : 1;
  const done = inn.overs.slice(0, Math.max(0, inn.overs.length - skip));
  if (!done.length) return null;
  const shown = done.map((_, i) => i).slice(-5);
  const peak = Math.max(6, ...shown.map((i) => inn.overTotals[i]?.runs ?? 0));
  return (
    <View style={s.recent}>
      <Text style={s.recentLabel}>EARLIER</Text>
      <View style={s.recentTiles}>
        {shown.map((i) => {
          const t = inn.overTotals[i] ?? { runs: 0, wickets: 0 };
          return (
            <PressableScale
              key={i}
              scaleTo={0.92}
              accessibilityLabel={`Over ${i + 1}: ${plural(t.runs, 'run')}${t.wickets ? `, ${plural(t.wickets, 'wicket')}` : ''}`}
              disabled={!onOpen}
              dimWhenDisabled={false}
              onPress={() => onOpen?.(i)}
              wrapStyle={{ flex: 1 }}
              style={s.tile}
            >
              <Text style={s.tileNo}>OV {i + 1}</Text>
              <Text style={[s.tileRuns, t.runs >= 10 && { color: colors.accentInk }]}>{t.runs}</Text>
              <View style={s.tileBar}>
                <View style={[s.tileFill, { width: `${Math.max(8, (t.runs / peak) * 100)}%`, backgroundColor: t.runs >= 10 ? colors.accent : colors.borderHi }]} />
              </View>
              <View style={s.tileW}>
                {Array.from({ length: Math.min(t.wickets, 3) }, (_, w) => (
                  <View key={w} style={s.wDot} />
                ))}
              </View>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

/** The overs before this one, newest first, for the scoring panel on a big screen. */
export function RecentOvers({ match, s: inn, count }: { match: Match; s: InningsState; count: number }) {
  const current = inn.overs[inn.overs.length - 1] ?? [];
  const skip = current.length === 0 && inn.overs.length > 1 ? 2 : 1;
  const done = inn.overs.slice(0, Math.max(0, inn.overs.length - skip));
  if (!done.length) return null;
  const shown = done.map((balls, i) => ({ balls, i })).slice(-count).reverse();
  return (
    <View style={{ gap: space.sm }}>
      <Text style={s.nextLabel}>EARLIER OVERS</Text>
      {shown.map(({ balls, i }) => (
        <View key={i} style={s.recentRow}>
          <Text style={s.recentNo}>{i + 1}</Text>
          <View style={s.recentBalls}>
            {balls.map((b, j) => (
              <BallChipLazy key={j} ball={b} size={26} />
            ))}
          </View>
          <Text numberOfLines={1} style={s.recentMeta}>
            {plural(inn.overTotals[i]?.runs ?? 0, 'run')} · {playerName(match, inn.overBowlers[i]?.[0] ?? null)}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Above the pad on a big screen: which ball is next, and who's bowling it to whom. */
export function NextBall({ match, s: inn }: { match: Match; s: InningsState }) {
  const ball = `${Math.floor(inn.legalBalls / 6)}.${(inn.legalBalls % 6) + 1}`;
  return (
    <View style={s.nextBall}>
      <View style={s.nextHead}>
        <SeamBallDot />
        <Text style={s.nextLabel}>NEXT BALL · {ball}</Text>
      </View>
      <View style={s.nextRow}>
        {inn.bowler && <PlayerAvatar name={playerName(match, inn.bowler)} size={28} />}
        <Text numberOfLines={1} style={s.nextText}>
          {inn.bowler ? playerName(match, inn.bowler) : 'Pick a bowler'}
          <Text style={s.nextTo}>  to  </Text>
          {playerName(match, inn.striker)}
        </Text>
        {inn.striker && <PlayerAvatar name={playerName(match, inn.striker)} size={28} />}
      </View>
      <SeamDivider />
    </View>
  );
}

function SeamBallDot() {
  return <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger }} />;
}

const s = StyleSheet.create({
  hero: { borderRadius: radius.xl, padding: space.lg, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(205,235,215,0.12)' },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.accentDim, paddingHorizontal: 10, height: 26, borderRadius: radius.pill },
  liveText: { ...type.label, fontSize: 10, color: hero.accent },
  oversBox: { flexDirection: 'row', alignItems: 'baseline' },
  oversNow: { color: hero.text, fontSize: 22, fontFamily: font.posterBlack, ...type.num },
  oversOf: { color: hero.faint, fontSize: 13, fontFamily: font.semibold },
  teamRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.sm },
  heroTeam: { ...type.poster, color: hero.text, fontSize: 20 },
  heroVs: { color: hero.faint, fontSize: 12, fontFamily: font.medium, marginTop: 1 },
  scoreRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 2 },
  scoreWrap: { flexDirection: 'row', alignItems: 'flex-end', flexShrink: 1 },
  score: { color: hero.text, fontFamily: font.posterBlack, ...type.num },
  slash: { color: hero.faint, fontFamily: font.poster, marginLeft: 2 },
  wickets: { color: hero.muted, fontFamily: font.posterBlack, ...type.num, marginTop: 'auto' as never },
  delta: { position: 'absolute', right: -6, top: 4, color: hero.accent, fontFamily: font.posterBlack, fontSize: 22 },
  stats: { flexDirection: 'row', gap: space.lg, alignItems: 'flex-end', paddingBottom: 10 },
  stat: { alignItems: 'flex-end' },
  statLabel: { ...type.label, fontSize: 10, color: hero.faint },
  statValue: { color: hero.text, fontSize: 22, fontFamily: font.posterBlack, lineHeight: 26, ...type.num },
  progress: { height: 6, backgroundColor: hero.ink(0.1), borderRadius: 3, overflow: 'hidden', marginTop: space.sm },
  progressFill: { height: '100%', backgroundColor: hero.accent, borderRadius: 3 },
  notch: { position: 'absolute', top: 0, bottom: 0, width: 2, marginLeft: -1, backgroundColor: HERO_BG },
  footRow: { marginTop: space.sm, gap: 2 },
  heroFoot: { color: hero.muted, fontSize: 13, fontFamily: font.semibold },
  chaseBox: { marginTop: space.md, gap: 8 },
  chase: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: hero.inset,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    paddingVertical: 8,
  },
  chaseText: { color: hero.text, fontSize: 15, fontFamily: font.semibold },
  chaseBig: { fontSize: 24, fontFamily: font.posterBlack, color: hero.accent },
  chaseSmall: { fontSize: 13, fontFamily: font.semibold, color: hero.muted },
  chaseTarget: { color: hero.muted, fontSize: 13, fontFamily: font.bold },
  chanceRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  chanceLabel: { color: hero.muted, fontSize: 12, fontFamily: font.bold, width: 112 },
  chanceTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: hero.ink(0.1), overflow: 'hidden' },
  chanceFill: { height: '100%', backgroundColor: hero.gold, borderRadius: 3 },
  takeaway: { color: hero.muted, fontSize: 12.5, fontFamily: font.medium },

  cHead: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space.lg, paddingTop: 10, paddingBottom: 6 },
  cHeadText: { ...type.label, fontSize: 9.5, color: colors.faint },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  batter: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, paddingHorizontal: space.lg, gap: space.md },
  strikeBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: colors.accent },
  strikeBadge: { position: 'absolute', right: -4, bottom: -3, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.surface },
  batterName: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  onStrike: { backgroundColor: colors.accent, borderRadius: radius.pill, paddingHorizontal: 7, height: 16, justifyContent: 'center' },
  onStrikeText: { color: colors.onAccent, fontSize: 8.5, fontFamily: font.heavy, letterSpacing: 0.8 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  // 30 tall and 7 of slop all round: a 44 target without crowding the name.
  retire: { paddingHorizontal: 9, height: 24, justifyContent: 'center', borderRadius: radius.sm, borderWidth: 1, borderColor: colors.borderHi },
  retireText: { color: colors.muted, fontSize: 10.5, fontFamily: font.semibold },
  name: { color: colors.muted, fontSize: 16, fontFamily: font.bold, flexShrink: 1 },
  meta: { color: colors.faint, fontSize: 11.5, fontFamily: font.semibold, ...type.num },
  runs: { color: colors.muted, fontSize: 36, lineHeight: 40, fontFamily: font.posterBlack, ...type.num },
  balls: { fontSize: 15, fontFamily: font.poster, color: colors.faint },
  bowlerRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: 9, backgroundColor: colors.dangerDim },
  bowlerIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.dangerDim, alignItems: 'center', justifyContent: 'center' },
  bowlerBadge: { position: 'absolute', right: -3, bottom: -3, width: 16, height: 16, borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  bowlerName: { color: colors.text, fontSize: 15, fontFamily: font.bold },
  figures: { color: colors.text, fontSize: 26, lineHeight: 28, fontFamily: font.posterBlack, ...type.num },
  figuresRuns: { fontSize: 17, color: colors.muted, fontFamily: font.poster },
  figuresSub: { color: colors.faint, fontSize: 10.5, fontFamily: font.semibold, ...type.num },

  over: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.md, gap: space.sm, ...edge },
  overDocked: { backgroundColor: 'transparent', borderWidth: 0, padding: 0, borderRadius: 0, boxShadow: 'none' as never, shadowOpacity: 0, elevation: 0 },
  overHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  overTitle: { color: colors.text, fontSize: 14, fontFamily: font.posterBlack, letterSpacing: 0.6 },
  overBowler: { color: colors.faint, fontSize: 12, fontFamily: font.semibold, flexShrink: 1 },
  overTotal: { flexDirection: 'row', alignItems: 'baseline', backgroundColor: colors.surfaceHi, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 3 },
  overTotalNum: { color: colors.text, fontSize: 20, fontFamily: font.posterBlack, ...type.num },
  overTotalLabel: { color: colors.faint, fontSize: 11, fontFamily: font.bold, textTransform: 'uppercase' },
  overRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  chips: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-start', alignItems: 'center' },
  slot: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.borderHi },
  overHint: { color: colors.faint, fontSize: 11, fontFamily: font.medium },
  dockLabel: { paddingRight: 8, borderRightWidth: 1, borderRightColor: colors.border },
  dockOver: { color: colors.muted, fontSize: 10, fontFamily: font.heavy, letterSpacing: 0.8 },
  dockTotal: { alignItems: 'center', minWidth: 40, paddingLeft: 8, borderLeftWidth: 1, borderLeftColor: colors.border },
  dockRuns: { color: colors.faint, fontSize: 9, fontFamily: font.bold, textTransform: 'uppercase', marginTop: -2 },

  recent: { gap: 6 },
  recentLabel: { ...type.label, fontSize: 9.5, color: colors.faint },
  recentTiles: { flexDirection: 'row', gap: 6 },
  tile: { backgroundColor: colors.surface, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, paddingVertical: 7, paddingHorizontal: 8, gap: 2, alignItems: 'center', ...edge },
  tileNo: { color: colors.faint, fontSize: 9, fontFamily: font.heavy, letterSpacing: 0.6 },
  tileRuns: { color: colors.text, fontSize: 18, lineHeight: 20, fontFamily: font.posterBlack, ...type.num },
  tileBar: { alignSelf: 'stretch', height: 3, borderRadius: 2, backgroundColor: colors.surfaceHi, overflow: 'hidden' },
  tileFill: { height: 3, borderRadius: 2 },
  tileW: { flexDirection: 'row', gap: 2, height: 6 },
  wDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.danger },

  recentRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  recentNo: { width: 20, color: colors.faint, fontSize: 14, fontFamily: font.poster, ...type.num },
  recentBalls: { flexDirection: 'row', flexWrap: 'wrap', flexShrink: 1, gap: 4 },
  recentMeta: { flex: 1, minWidth: 0, textAlign: 'right', color: colors.muted, fontSize: 12, fontFamily: font.semibold },
  nextBall: { gap: 6 },
  nextHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  nextLabel: { ...type.label, fontSize: 10, color: colors.accentInk },
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  nextText: { flex: 1, minWidth: 0, color: colors.text, fontSize: 16, fontFamily: font.bold },
  nextTo: { color: colors.faint, fontFamily: font.medium, fontSize: 13 },
});
