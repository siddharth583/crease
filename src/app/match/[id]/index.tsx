import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState, type ComponentProps } from 'react';

/** Keep the screen on while scoring. Best effort: some browsers refuse a wake lock, and that's fine. */
function useScreenAwake() {
  useEffect(() => {
    const tag = 'crease-scoring';
    activateKeepAwakeAsync(tag).catch(() => {});
    return () => {
      Promise.resolve()
        .then(() => deactivateKeepAwake(tag))
        .catch(() => {});
    };
  }, []);
}
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BallEditSheet, fixBall } from '../../../components/BallEditSheet.tsx';
import { ExportSheet } from '../../../components/ExportSheet.tsx';
import { ShareCardSheet } from '../../../components/ShareCard.tsx';
import {
  BallChip,
  Button,
  Card,
  Chip,
  FadeIn,
  IconButton,
  MomentFlash,
  PitchStripes,
  PressableScale,
  Screen,
  Segmented,
  Sheet,
  Stepper,
  tap,
  useToast,
  type Moment,
} from '../../../components/ui.tsx';
import {
  addEvent,
  addPlayer,
  canUndo,
  movePlayer,
  chaseTargetInfo,
  describeEvent,
  highlights,
  matchState,
  oversLeft,
  oversText,
  playerName,
  setOvers,
  startSuperOver,
  undo,
  type BallView,
  type InningsState,
} from '../../../engine/engine.ts';
import { plural } from '../../../engine/text.ts';
import { Confetti, GrowBar, PopIn, Pulse, Sheen, Ticker } from '../../../components/motion.tsx';
import { isPlaceholder, playerOfTheMatch, seriesState } from '../../../engine/stats.ts';
import type { BallEvent, Extra, InningsEvent, Match, WicketKind } from '../../../engine/types.ts';
import { newId, useMatch, useMatches } from '../../../store/matches.tsx';
import { useMatchFiles } from '../../../store/useMatchFiles.ts';
import { colors, font, gradients, radius, space, type, ink, hero, edge, HERO_BG } from '../../../theme.ts';


const rate = (runs: number, balls: number) => (balls ? ((runs * 6) / balls).toFixed(2) : '0.00');

// ─── Scoreboard ──────────────────────────────────────────────────────────────

function Scoreboard({ match, s, index }: { match: Match; s: InningsState; index: number }) {
  const ballsLeft = s.maxBalls - s.legalBalls;
  const chasing = s.target !== null && s.status !== 'done';
  const need = chasing ? Math.max(s.target! - s.runs, 0) : null;
  const projected = s.legalBalls >= 6 ? Math.round(s.runs + (s.runs / s.legalBalls) * ballsLeft) : null;
  const progress = Math.min(1, s.legalBalls / s.maxBalls);

  return (
    <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
      <PitchStripes opacity={0.03} tint="255,255,255" />
      <Sheen every={7000} strength={0.07} />

      <View style={styles.heroTop}>
        <View style={styles.livePill}>
          <Pulse color={hero.accent} size={6} />
          <Text style={styles.liveText}>{index >= 2 ? 'Super over' : index === 0 ? '1st innings' : '2nd innings'}</Text>
        </View>
        <Text style={styles.heroOvers}>
          <Text style={{ color: hero.text }}>{oversText(s.legalBalls)}</Text>
          <Text style={{ color: hero.faint }}> / {match.rules.overs} ov</Text>
        </Text>
      </View>

      <Text numberOfLines={1} style={styles.heroTeam}>
        {s.battingTeam.name}
      </Text>
      <View style={styles.heroScoreRow}>
        <View style={styles.scoreWrap}>
          <Ticker value={s.runs} style={styles.heroScore} lineHeight={114} />
          <Text style={styles.heroWickets}>/{s.wickets}</Text>
        </View>
        <View style={styles.heroStats}>
          <Stat label="CRR" value={rate(s.runs, s.legalBalls)} />
          {need !== null ? (
            <Stat label="RRR" value={ballsLeft ? rate(need, ballsLeft) : '–'} hot />
          ) : (
            <Stat label="PROJ" value={projected === null ? '–' : String(projected)} />
          )}
        </View>
      </View>

      {/* One notch per over, filling as the innings goes. */}
      <View style={styles.progress} accessibilityLabel={`${oversText(s.legalBalls)} of ${match.rules.overs} overs`}>
        <GrowBar share={progress} trackStyle={StyleSheet.absoluteFill} style={styles.progressFill} />
        {match.rules.overs <= 25 &&
          Array.from({ length: match.rules.overs - 1 }, (_, i) => (
            <View key={i} style={[styles.notch, { left: `${((i + 1) / match.rules.overs) * 100}%` }]} />
          ))}
      </View>

      {need !== null ? (
        <View style={styles.chase}>
          <Text style={styles.chaseText}>
            Need <Text style={styles.chaseBig}>{need}</Text> off <Text style={styles.chaseBig}>{ballsLeft}</Text>
          </Text>
          <Text style={styles.chaseTarget}>Target {s.target}</Text>
        </View>
      ) : (
        <Text style={styles.heroFoot}>
          Extras {s.extras.wide + s.extras.noball + s.extras.bye + s.extras.legbye + s.extras.penalty}
          {s.partnership.balls > 0 || s.partnership.runs > 0
            ? `   ·   Partnership ${s.partnership.runs} (${s.partnership.balls})`
            : ''}
        </Text>
      )}
    </LinearGradient>
  );
}

function Stat({ label, value, hot }: { label: string; value: string; hot?: boolean }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, hot && { color: hero.accent }]}>{value}</Text>
    </View>
  );
}

// ─── Crease ──────────────────────────────────────────────────────────────────

function Crease({ match, s, onSwap, onRetire }: { match: Match; s: InningsState; onSwap: () => void; onRetire: (batter: string) => void }) {
  const bowler = s.bowlers.find((b) => b.id === s.bowler);
  const batters = [s.striker, s.nonStriker].filter((id): id is string => id !== null);

  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      {batters.map((id, i) => {
        const b = s.batters.find((x) => x.id === id);
        const onStrike = id === s.striker;
        return (
          <View key={id} style={[styles.batter, i > 0 && styles.rowBorder]}>
            <View style={[styles.strikeBar, onStrike && { backgroundColor: colors.accent }]} />
            <View style={{ flex: 1 }}>
              <View style={styles.batterName}>
                <Text numberOfLines={1} style={[styles.name, onStrike && { color: colors.text }]}>
                  {playerName(match, id)}
                </Text>
                {onStrike && <MaterialCommunityIcons name="cricket" size={15} color={colors.accentInk} />}
                <PressableScale accessibilityLabel={`Retire ${playerName(match, id)}`} hitSlop={8} onPress={() => onRetire(id)} style={styles.retire}>
                  <Text style={styles.retireText}>Retire</Text>
                </PressableScale>
              </View>
              <Text style={styles.batterMeta}>
                {b?.fours ?? 0}×4   {b?.sixes ?? 0}×6   SR {b && b.balls ? ((b.runs * 100) / b.balls).toFixed(0) : '–'}
              </Text>
            </View>
            <Text style={[styles.batterRuns, onStrike && { color: colors.text }]}>
              {b?.runs ?? 0}
              <Text style={styles.batterBalls}> {b?.balls ?? 0}</Text>
            </Text>
          </View>
        );
      })}
      <View style={[styles.bowlerRow, styles.rowBorder]}>
        <View style={styles.bowlerIcon}>
          <MaterialCommunityIcons name="baseball" size={16} color={colors.danger} />
        </View>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={styles.bowlerName}>
            {s.bowler ? playerName(match, s.bowler) : 'Pick a bowler'}
          </Text>
          {bowler && <Text style={styles.batterMeta}>Econ {rate(bowler.runs, bowler.balls)}</Text>}
        </View>
        {bowler && (
          <Text style={styles.figures}>
            {oversText(bowler.balls)}-{bowler.maidens}-{bowler.runs}-{bowler.wickets}
          </Text>
        )}
        {s.nonStriker && <IconButton icon="swap-vertical" label="Swap strike" onPress={onSwap} />}
      </View>
    </Card>
  );
}

// ─── This over and over-by-over ──────────────────────────────────────────────

/** This over's balls; tap one to fix it. Before the first ball of a new over, the last over stays editable. */
function ThisOver({ s, onEdit }: { s: InningsState; onEdit: (b: BallView) => void }) {
  const current = s.overs[s.overs.length - 1] ?? [];
  const showLast = current.length === 0 && s.overs.length > 1;
  const balls = showLast ? s.overs[s.overs.length - 2] : current;
  const totals = s.overTotals[s.overTotals.length - (showLast ? 2 : 1)];
  const slots = showLast ? 0 : 6 - (s.legalBalls % 6);
  const overNo = Math.floor(s.legalBalls / 6) + (showLast ? 0 : 1);
  return (
    <View style={styles.scorebug}>
      <View style={styles.scorebugLabel}>
        <Text style={styles.scorebugTitle}>{showLast ? 'LAST OVER' : `OVER ${overNo}`}</Text>
        <Text style={styles.scorebugRuns}>{totals?.runs ?? 0} runs · tap to fix</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.overBalls}>
        {balls.map((b, i) => (
          <PressableScale key={`${s.overs.length}-${i}`} scaleTo={0.85} accessibilityLabel={`Fix ball ${i + 1}`} onPress={() => onEdit(b)}>
            <BallChip ball={b} animate={!showLast && i === balls.length - 1} />
          </PressableScale>
        ))}
        {Array.from({ length: slots }, (_, i) => (
          <BallChip key={`e${i}`} />
        ))}
      </ScrollView>
    </View>
  );
}

/** Things that happen to the match rather than to a ball: rain, a declaration, a late arrival, a switch of sides. */
function MatchMenu({
  visible,
  match,
  s,
  firstInningsRuns,
  onClose,
  onOvers,
  onTarget,
  onAddPlayer,
  onDeadBall,
  onEndInnings,
  onDelete,
  onBowlerChange,
  onMovePlayer,
  inningsLabel,
  dlsG,
  superOver,
}: {
  visible: boolean;
  match: Match;
  s: InningsState;
  /** Known once the first innings is over. */
  firstInningsRuns: number | null;
  onClose: () => void;
  onOvers: (overs: number) => void;
  onTarget: (target: number | undefined) => void;
  onAddPlayer: (teamId: string, name: string) => void;
  onDeadBall: () => void;
  onEndInnings: () => void;
  /** The match is called off: it goes, without a result. */
  onDelete: () => void;
  /** A new bowler finishes the over (the one bowling it is hurt or taken off). */
  onBowlerChange: (bowler: string) => void;
  /** A player switches to the other side. */
  onMovePlayer: (playerId: string) => void;
  inningsLabel: string;
  /** Average first-innings score at this length, for DLS. */
  dlsG?: number;
  /** In a super over the overs and target are fixed: those parts of the menu go. */
  superOver: boolean;
}) {
  const [overs, setOversDraft] = useState(match.rules.overs);
  const [target, setTargetDraft] = useState(0);
  const [arming, setArming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [lateTeam, setLateTeam] = useState(match.teams[0].id);
  const [lateName, setLateName] = useState('');
  const original = match.originalOvers ?? match.rules.overs;
  const midOver = s.status === 'live' && s.bowler !== null && (s.overs[s.overs.length - 1]?.length ?? 0) > 0;
  // What DLS would set if the overs changed to the draft value, and what stands now.
  const preview = overs !== match.rules.overs ? setOvers(match, overs, dlsG) : match;
  const firstRuns = matchState(preview).innings[0];
  const willAffectTarget = firstRuns.status === 'done' || matchState(match).current === 0;
  const dls = firstInningsRuns !== null || willAffectTarget ? chaseTargetInfo(preview, firstRuns.runs) : null;
  const now = firstInningsRuns !== null ? chaseTargetInfo(match, firstInningsRuns) : null;
  useEffect(() => {
    if (visible) {
      setOversDraft(match.rules.overs);
      setTargetDraft(firstInningsRuns !== null ? chaseTargetInfo(match, firstInningsRuns).target : 1);
      setArming(false);
      setDeleting(false);
      setLateName('');
    }
  }, [visible, match.rules.overs, match.revisedTarget, firstInningsRuns]);

  return (
    <Sheet visible={visible} onClose={onClose} title="Match">
      <ScrollView contentContainerStyle={{ gap: space.md, paddingBottom: space.md }}>
        {midOver && (
          <>
            <Text style={styles.sheetLabel}>Bowler can’t finish the over</Text>
            <Card style={{ gap: space.sm }}>
              <Text style={styles.editNote}>
                {playerName(match, s.bowler)} has bowled {plural(s.legalBalls % 6, 'ball')} of this over. Who bowls the rest?
              </Text>
              <View style={styles.wrap}>
                {s.bowlingTeam.players
                  .filter((p) => p.id !== s.bowler)
                  .map((p) => (
                    <Chip key={p.id} label={p.name} disabled={s.barred.includes(p.id)} onPress={() => onBowlerChange(p.id)} />
                  ))}
              </View>
              {s.barred.length > 0 && (
                <Text style={styles.editNote}>{s.barred.map((id) => playerName(match, id)).join(' and ')} bowled the last over, so can’t.</Text>
              )}
            </Card>
          </>
        )}
        {!superOver && (
          <>
            <Text style={styles.sheetLabel}>Rain or bad light</Text>
        <Card style={{ paddingVertical: space.sm }}>
          <Stepper label="Overs per innings" hint={`Started at ${original}`} value={overs} min={1} max={50} onChange={setOversDraft} />
        </Card>
        <Button
          variant="ghost"
          label={`Set ${overs} over${overs === 1 ? '' : 's'}`}
          icon="rainy-outline"
          disabled={overs === match.rules.overs}
          onPress={() => onOvers(overs)}
        />
        {overs !== match.rules.overs && dls && firstInningsRuns !== null && (
          <Text style={styles.editNote}>
            DLS: the chase target becomes <Text style={styles.dlsStrong}>{dls.target}</Text> in {overs} overs.
          </Text>
        )}
        {overs !== match.rules.overs && firstInningsRuns === null && (
          <Text style={styles.editNote}>DLS will set a fair target for the chase once this innings ends.</Text>
        )}
        {firstInningsRuns !== null && now && (
          <Card style={{ gap: space.sm }}>
            <Text style={styles.dlsNow}>
              Target <Text style={styles.dlsStrong}>{now.target}</Text>
              {now.method === 'dls' ? '  ·  set by DLS' : now.method === 'agreed' ? '  ·  agreed by hand' : ''}
            </Text>
            <Stepper label="Agree a different target" hint="Only if both captains agree" value={target} min={1} max={999} onChange={setTargetDraft} />
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              {match.revisedTarget !== undefined && <Chip label={match.interruptions?.length ? 'Back to DLS' : 'Back to normal'} onPress={() => onTarget(undefined)} />}
            </View>
            <Button
              variant="ghost"
              label={`Set the target to ${target}`}
              icon="flag-outline"
              disabled={target === now.target}
              onPress={() => onTarget(target)}
            />
          </Card>
        )}

          </>
        )}

        <Text style={styles.sheetLabel}>Switch sides</Text>
        <Card style={{ gap: space.sm }}>
          <Text style={styles.editNote}>Tap a player to move them to the other side. Anyone who has batted or bowled stays where they are.</Text>
          {match.teams.map((t) => (
            <View key={t.id} style={{ gap: 6 }}>
              <Text style={styles.switchTeam}>
                {t.name} <Text style={{ color: colors.faint }}>· {t.players.length}</Text>
              </Text>
              <View style={styles.wrap}>
                {t.players
                  .filter((p) => !p.common)
                  .map((p) => (
                    <Chip key={p.id} label={p.name} icon="swap-horizontal" disabled={typeof movePlayer(match, p.id) === 'string'} onPress={() => onMovePlayer(p.id)} />
                  ))}
              </View>
            </View>
          ))}
        </Card>

        <Text style={styles.sheetLabel}>Late arrival</Text>
        <Card style={{ gap: space.sm }}>
          <Segmented value={lateTeam} onChange={setLateTeam} options={match.teams.map((t) => ({ value: t.id, label: t.name }))} />
          <TextInput
            value={lateName}
            onChangeText={setLateName}
            placeholder="Their name"
            placeholderTextColor={colors.faint}
            style={styles.input}
            autoCapitalize="words"
            maxLength={24}
          />
          <Button variant="ghost" label="Add to the side" icon="person-add-outline" disabled={!lateName.trim()} onPress={() => onAddPlayer(lateTeam, lateName.trim())} />
        </Card>

        <Text style={styles.sheetLabel}>Umpire’s call</Text>
        <Button variant="ghost" label="Dead ball" icon="hand-left-outline" onPress={onDeadBall} />

        <Button
          variant="danger"
          label={arming ? 'Tap again to end it' : `End ${inningsLabel} now`}
          icon="flag-outline"
          onPress={() => (arming ? onEndInnings() : setArming(true))}
          style={{ marginTop: space.sm }}
        />

        <Text style={styles.sheetLabel}>Called off</Text>
        <Text style={styles.editNote}>Rained off, or just a test? Delete the match. It won’t count in anyone’s numbers.</Text>
        <Button
          variant="ghost"
          label={deleting ? 'Tap again to delete it' : 'Delete this match'}
          icon="trash-outline"
          onPress={() => (deleting ? onDelete() : setDeleting(true))}
        />
      </ScrollView>
    </Sheet>
  );
}

function OverChart({ s }: { s: InningsState }) {
  const totals = s.overTotals.slice(-12);
  if (totals.length < 2 && !totals[0]?.runs) return null;
  const peak = Math.max(8, ...totals.map((t) => t.runs));
  const first = s.overTotals.length - totals.length;
  return (
    <Card style={styles.chartCard}>
      <View style={styles.chartHead}>
        <Text style={styles.chartTitle}>RUNS PER OVER</Text>
        <View style={styles.legend}>
          <View style={[styles.legendDot, { backgroundColor: colors.danger }]} />
          <Text style={styles.legendText}>wicket</Text>
        </View>
      </View>
      <View style={styles.chart}>
        {totals.map((t, i) => {
          const current = first + i === s.overTotals.length - 1 && s.status !== 'done';
          return (
            <View key={first + i} style={styles.barCol}>
              <Text style={styles.barValue}>{t.runs}</Text>
              <GrowBar
                vertical
                share={Math.max(3 / 70, t.runs / peak)}
                delay={i * 40}
                trackStyle={styles.barTrack}
                style={[styles.bar, t.runs >= 10 && { backgroundColor: colors.accent }, current && styles.barCurrent]}
              />
              <View style={styles.barWickets}>
                {Array.from({ length: Math.min(t.wickets, 3) }, (_, w) => (
                  <View key={w} style={styles.wicketDot} />
                ))}
              </View>
              <Text style={styles.barLabel}>{first + i + 1}</Text>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

// ─── Picking players ─────────────────────────────────────────────────────────

function PlayerPicker({
  title,
  subtitle,
  match,
  ids,
  disabled = [],
  note,
  onPick,
}: {
  title: string;
  subtitle?: string;
  match: Match;
  ids: string[];
  disabled?: string[];
  note?: (id: string) => string | undefined;
  onPick: (id: string) => void;
}) {
  return (
    <FadeIn>
      <Text style={styles.pickerTitle}>{title}</Text>
      {subtitle && <Text style={styles.pickerSub}>{subtitle}</Text>}
      <View style={{ gap: space.sm, marginTop: space.md }}>
        {ids.map((id, i) => {
          const off = disabled.includes(id);
          const extra = note?.(id);
          return (
            <FadeIn key={id} delay={i * 35}>
              <PressableScale disabled={off} haptic="medium" scaleTo={0.97} onPress={() => onPick(id)} style={styles.pickRow}>
                <Text style={styles.pickNum}>{String(i + 1).padStart(2, '0')}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.pickName}>{playerName(match, id)}</Text>
                  {extra && <Text style={styles.pickNote}>{extra}</Text>}
                </View>
                <Ionicons name={off ? 'lock-closed' : 'arrow-forward'} size={18} color={off ? colors.faint : colors.accent} />
              </PressableScale>
            </FadeIn>
          );
        })}
      </View>
    </FadeIn>
  );
}

// ─── Scoring pad ─────────────────────────────────────────────────────────────

type PadMode = Extra | 'bouncer';

const EXTRAS: { value: PadMode; label: string }[] = [
  { value: 'wide', label: 'Wide' },
  { value: 'noball', label: 'No ball' },
  { value: 'bouncer', label: 'Bounce' },
];

const MODE_HINT: Record<Extra, string> = {
  wide: 'WIDE · tap the runs they ran',
  noball: 'NO BALL · tap the runs off the bat',
  bye: 'BYE · tap the runs they ran',
  legbye: 'LEG BYE · tap the runs they ran',
};

/** How the next bounce counts: the umpire's call (fair or wide) while the over's allowance lasts, then called. */
const ordinal = (n: number) => `${n}${[, 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] ?? 'th'}`;

function bounceInfo(match: Match, s: InningsState): { choice: boolean; hint: string } {
  const rule = match.rules.bouncer ?? { fair: 1, calledAs: 'noball' as const };
  const left = rule.fair - s.bouncersThisOver;
  return left > 0
    ? { choice: true, hint: `BOUNCE · umpire’s call: fair or wide · ${left === 1 ? 'the next one is' : `${left} left, then`} a ${rule.calledAs === 'wide' ? 'wide' : 'no ball'}` }
    : { choice: false, hint: `BOUNCE · ${ordinal(s.bouncersThisOver + 1)} this over: a ${rule.calledAs === 'wide' ? 'wide' : 'no ball'} · tap the runs` };
}

function Key({
  label,
  sub,
  onPress,
  disabled,
  variant = 'plain',
  height = 66,
  icon,
}: {
  label: string;
  sub?: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'plain' | 'four' | 'six' | 'out' | 'mode' | 'undo';
  height?: number;
  /** Shown instead of the label (the label still names it for screen readers). */
  icon?: ComponentProps<typeof Ionicons>['name'];
}) {
  const v = {
    plain: [styles.key, colors.text],
    four: [[styles.key, styles.keyFour], colors.cyan],
    six: [[styles.key, styles.keySix], colors.onAccent],
    out: [[styles.key, styles.keyOut], '#FFFFFF'],
    mode: [[styles.key, styles.keyMode], colors.violet],
    undo: [[styles.key, styles.keyUndo], colors.muted],
  }[variant] as [object, string];
  return (
    <View style={{ flex: 1 }}>
      <PressableScale
        accessibilityLabel={sub ? `${label} ${sub}` : label}
        disabled={disabled}
        haptic={null}
        scaleTo={0.9}
        onPress={onPress}
        style={[v[0], { height }]}
      >
        {icon ? <Ionicons name={icon} size={26} color={v[1]} /> : <Text style={[styles.keyText, { color: v[1] }, label.length > 2 && { fontSize: 26 }]}>{label}</Text>}
        {sub && <Text style={[styles.keySub, { color: v[1] }]}>{sub}</Text>}
      </PressableScale>
    </View>
  );
}

function Banner({ tone, title, body }: { tone: 'volt' | 'red'; title: string; body: string }) {
  return (
    <FadeIn>
      <View style={[styles.banner, tone === 'red' && { backgroundColor: colors.danger }]}>
        <Text style={[styles.bannerTitle, tone === 'red' && { color: '#FFFFFF' }]}>{title}</Text>
        <Text style={[styles.bannerBody, tone === 'red' && { color: '#FFFFFF' }]}>{body}</Text>
      </View>
    </FadeIn>
  );
}

function Pad({
  onBall,
  onWicket,
  onUndo,
  canUndo: undoable,
  bounce,
}: {
  onBall: (b: BallEvent) => void;
  onWicket: (mode: Extra | null) => void;
  /** Takes back the last ball, right where it was scored. */
  onUndo: () => void;
  canUndo: boolean;
  /** How a bounce would count right now. */
  bounce: { choice: boolean; hint: string };
}) {
  const [mode, setMode] = useState<PadMode | null>(null);
  const [call, setCall] = useState<'fair' | 'wide'>('fair');
  const score = (r: number) => {
    tap(r >= 4 ? 'heavy' : 'light');
    onBall(mode === 'bouncer' ? { type: 'ball', runs: r, bouncer: bounce.choice ? call : 'fair' } : { type: 'ball', runs: r, extra: mode ?? undefined });
    setMode(null);
    setCall('fair');
  };
  const byes = mode === 'bye' || mode === 'legbye';
  const runKey = (r: number) => {
    const big = !mode && (r === 4 || r === 6);
    return (
      <Key
        key={r}
        label={String(r)}
        sub={!mode ? (r === 0 ? 'DOT' : r === 4 ? 'FOUR' : r === 6 ? 'SIX' : undefined) : undefined}
        variant={mode ? 'mode' : big ? (r === 4 ? 'four' : 'six') : 'plain'}
        disabled={byes && r === 0}
        onPress={() => score(r)}
      />
    );
  };

  return (
    <View style={styles.pad}>
      <View style={styles.extrasRow}>
        {EXTRAS.map((e) => {
          const on = mode === e.value;
          return (
            <PressableScale
              key={e.value}
              accessibilityState={{ selected: on }}
              scaleTo={0.92}
              wrapStyle={{ flex: 1 }}
              onPress={() => setMode(on ? null : e.value)}
              style={[styles.extraKey, on && styles.extraKeyOn]}
            >
              <Text numberOfLines={1} style={[styles.extraText, on && { color: colors.onAccent }]}>
                {e.label}
              </Text>
            </PressableScale>
          );
        })}
      </View>
      <Text style={[styles.modeHint, mode && { color: colors.violet }]}>
        {mode === 'bouncer' ? bounce.hint : mode ? MODE_HINT[mode] : 'TAP THE RUNS OFF THIS BALL'}
      </Text>
      {mode === 'bouncer' && bounce.choice && (
        <Segmented
          value={call}
          onChange={setCall}
          options={[
            { value: 'fair', label: 'Fair ball' },
            { value: 'wide', label: 'Wide' },
          ]}
        />
      )}
      <View style={styles.grid}>{[0, 1, 2, 3].map(runKey)}</View>
      <View style={styles.grid}>
        {([4, 6, 'undo', 'out'] as const).map((k) =>
          k === 'undo' ? (
            <Key key="undo" label="Undo" sub="LAST BALL" icon="arrow-undo" variant="undo" disabled={!undoable} onPress={onUndo} />
          ) : k === 'out' ? (
            <Key
              key="out"
              label={'OUT'}
              variant="out"
                    onPress={() => {
                tap('warning');
                onWicket(mode === 'bouncer' ? null : mode);
                setMode(null);
              }}
            />
          ) : (
            runKey(k)
          ),
        )}
      </View>
    </View>
  );
}

// ─── Wicket sheet ────────────────────────────────────────────────────────────

const KINDS: { value: WicketKind; label: string }[] = [
  { value: 'bowled', label: 'Bowled' },
  { value: 'caught', label: 'Caught' },
  { value: 'lbw', label: 'LBW' },
  { value: 'runout', label: 'Run out' },
  { value: 'stumped', label: 'Stumped' },
  { value: 'hitwicket', label: 'Hit wicket' },
  { value: 'retired', label: 'Retired' },
];

const RETIRE_HOW = [
  { value: 'hurt', label: 'Retired hurt' },
  { value: 'out', label: 'Retired out' },
] as const;

function WicketSheet({
  visible,
  match,
  s,
  preset,
  retiring,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  match: Match;
  s: InningsState;
  preset: Extra | null;
  /** Opened from a batter's Retire: straight to retiring them. */
  retiring?: string | null;
  onClose: () => void;
  onConfirm: (e: InningsEvent) => void;
}) {
  const [kind, setKind] = useState<WicketKind>('bowled');
  const [who, setWho] = useState<'striker' | 'nonStriker'>('striker');
  const [fielder, setFielder] = useState<string | undefined>();
  const [runs, setRuns] = useState('0');
  const [delivery, setDelivery] = useState<'legal' | 'wide' | 'noball'>('legal');
  const [retireHow, setRetireHow] = useState<'hurt' | 'out'>('hurt');

  useEffect(() => {
    if (!visible) return;
    setKind(retiring ? 'retired' : s.freeHit || preset === 'noball' ? 'runout' : preset === 'wide' ? 'stumped' : 'bowled');
    setWho(retiring && retiring === s.nonStriker ? 'nonStriker' : 'striker');
    setRetireHow('hurt');
    setFielder(undefined);
    setRuns('0');
    setDelivery(preset === 'wide' || preset === 'noball' ? preset : 'legal');
  }, [visible, preset, retiring]);

  const keeper = match.keepers?.[s.bowlingTeam.id];
  useEffect(() => {
    if (kind === 'stumped' && keeper) setFielder(keeper);
  }, [kind, keeper]);
  const chooseWho = kind === 'runout' || kind === 'retired';
  const needsFielder = kind === 'caught' || kind === 'runout' || kind === 'stumped';
  const deliveries =
    kind === 'runout' ? (['legal', 'wide', 'noball'] as const) : kind === 'stumped' ? (['legal', 'wide'] as const) : null;
  const outId = chooseWho && who === 'nonStriker' ? s.nonStriker : s.striker;

  const confirm = () => {
    if (!outId) return;
    if (kind === 'retired') {
      // Retiring happens between balls, so it isn't a delivery.
      onConfirm(retireHow === 'out' ? { type: 'retire', batter: outId, out: true } : { type: 'retire', batter: outId });
      return;
    }
    const extra = deliveries && delivery !== 'legal' ? delivery : undefined;
    onConfirm({
      type: 'ball',
      runs: kind === 'runout' ? Number(runs) : 0,
      extra,
      wicket: { kind, playerOut: outId, fielder: needsFielder ? fielder : undefined },
    });
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={kind === 'retired' ? 'Retire a batter' : 'Wicket'}>
      <ScrollView contentContainerStyle={{ gap: space.md, paddingBottom: space.md }}>
        <View style={styles.wrap}>
          {KINDS.map((k) => (
            <Chip
              key={k.value}
              tone="danger"
              label={k.label}
              selected={kind === k.value}
              disabled={s.freeHit && k.value !== 'runout' && k.value !== 'retired'}
              onPress={() => setKind(k.value)}
            />
          ))}
        </View>
        {s.freeHit && <Text style={styles.editNote}>Free hit: only a run out counts on this ball.</Text>}

        {chooseWho && s.nonStriker && (
          <>
            <Text style={styles.sheetLabel}>Who’s {kind === 'retired' ? 'retiring' : 'out'}?</Text>
            <Segmented
              value={who}
              onChange={setWho}
              options={[
                { value: 'striker', label: playerName(match, s.striker) },
                { value: 'nonStriker', label: playerName(match, s.nonStriker) },
              ]}
            />
          </>
        )}

        {kind === 'retired' && (
          <>
            <Text style={styles.sheetLabel}>How</Text>
            <Segmented value={retireHow} onChange={setRetireHow} options={[...RETIRE_HOW]} />
            <Text style={styles.editNote}>
              {retireHow === 'hurt'
                ? `Not a wicket. ${playerName(match, outId)} keeps their runs and can come back in later, when a wicket falls.`
                : `Counts as a wicket, but not to any bowler. ${playerName(match, outId)} can’t bat again this innings.`}
            </Text>
          </>
        )}

        {kind === 'runout' && (
          <>
            <Text style={styles.sheetLabel}>Runs completed</Text>
            <Segmented value={runs} onChange={setRuns} options={['0', '1', '2', '3'].map((v) => ({ value: v, label: v }))} />
          </>
        )}

        {deliveries && (
          <>
            <Text style={styles.sheetLabel}>Delivery</Text>
            <Segmented
              value={delivery}
              onChange={setDelivery}
              options={deliveries.map((d) => ({ value: d, label: d === 'legal' ? 'Legal' : d === 'wide' ? 'Wide' : 'No ball' }))}
            />
          </>
        )}

        {needsFielder && (
          <>
            <Text style={styles.sheetLabel}>{kind === 'stumped' ? 'Keeper' : 'Fielder'} (optional)</Text>
            <View style={styles.wrap}>
              {s.bowlingTeam.players.map((p) => (
                <Chip
                  key={p.id}
                  label={p.id === s.bowler && kind === 'caught' ? `${p.name} (bowler)` : p.id === keeper ? `${p.name} †` : p.name}
                  selected={fielder === p.id}
                  onPress={() => setFielder(fielder === p.id ? undefined : p.id)}
                />
              ))}
            </View>
          </>
        )}

        <Button
          variant="danger"
          icon={kind === 'retired' ? 'walk' : 'close-circle'}
          label={kind === 'retired' ? `Retire ${playerName(match, outId)}${retireHow === 'out' ? ' out' : ' hurt'}` : `${playerName(match, outId)} is out`}
          onPress={confirm}
          style={{ marginTop: space.sm }}
        />
      </ScrollView>
    </Sheet>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

function momentFor(match: Match, s: InningsState, e: InningsEvent): Omit<Moment, 'key'> | null {
  if (e.type !== 'ball') return null;
  if (e.wicket && e.wicket.kind !== 'retired') return { kind: 'wicket', caption: playerName(match, e.wicket.playerOut) };
  // A bounce that's called a wide is runs to extras, not a boundary off the bat.
  const pastAllowance = s.bouncersThisOver >= (match.rules.bouncer?.fair ?? 1);
  const wideBounce = Boolean(e.bouncer) && (pastAllowance ? match.rules.bouncer?.calledAs === 'wide' : e.bouncer === 'wide');
  if ((!e.extra || e.extra === 'noball') && !wideBounce) {
    if (e.runs === 6) return { kind: 'six', caption: playerName(match, s.striker) };
    if (e.runs === 4) return { kind: 'four', caption: playerName(match, s.striker) };
  }
  return null;
}

export default function LiveMatch() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { match, saveMatch, ready } = useMatch(id);
  const { matches, deleteMatch } = useMatches();
  const insets = useSafeAreaInsets();
  const [openers, setOpeners] = useState<string[]>([]);
  const [wicketFor, setWicketFor] = useState<Extra | null | undefined>(undefined);
  const [retiring, setRetiring] = useState<string | null>(null);
  const [moment, setMoment] = useState<Moment | null>(null);
  const [editing, setEditing] = useState<BallView | null>(null);
  const [menu, setMenu] = useState(false);
  // At the top here: the bottom of this screen is the scoring pad.
  const toast = useToast('top');
  const { exportAs } = useMatchFiles(toast.show);
  const [exporting, setExporting] = useState<Match[] | null>(null);
  const [sharing, setSharing] = useState(false);
  // Nobody wants the screen going dark between balls.
  useScreenAwake();

  if (!match) {
    return (
      <Screen style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.muted, fontFamily: font.medium }}>{ready ? 'Match not found' : 'Loading…'}</Text>
      </Screen>
    );
  }

  const state = matchState(match);
  const index = state.current;
  const s = state.innings[index];
  // `flashAfter` lets a sheet slide away first, so the moment isn't hidden behind it.
  const push = (e: InningsEvent, flashAfter = 0) => {
    const next = addEvent(match, e);
    const found = highlights(s, matchState(next).innings[index]);
    // A milestone outranks the boundary or wicket that brought it.
    const big = found.find((h) => h.kind === 'hattrick') ?? found.find((h) => h.kind === 'hundred') ?? found.find((h) => h.kind === 'fifty');
    const m: Omit<Moment, 'key'> | null = big
      ? { kind: big.kind as Moment['kind'], caption: playerName(match, big.player) + ('runs' in big ? ` · ${big.runs}*` : '') }
      : momentFor(match, s, e);
    if (m) setTimeout(() => setMoment({ ...m, key: Date.now() }), flashAfter);
    const maiden = found.find((h) => h.kind === 'maiden');
    if (maiden) toast.show(`Maiden over · ${playerName(match, maiden.player)}`, 'info');
    saveMatch(next);
  };

  const undoLast = () => {
    const at = [...match.innings.keys()].reverse().find((i) => match.innings[i].events.length > 0);
    if (at === undefined) return;
    const event = match.innings[at].events[match.innings[at].events.length - 1];
    const prev = undo(match);
    tap('medium');
    toast.show(`Undid ${describeEvent(match, event, matchState(prev).innings[at].striker)}`, 'info');
    setOpeners([]);
    saveMatch(prev);
  };
  // The start of the chase or of a super over: show the break screen before picking openers.
  const freshChase = index >= 1 && match.innings[index].events.length === 0;
  const superOver = index >= 2;
  const inningsLabel = superOver ? 'the super over' : index === 0 ? 'the 1st innings' : 'the 2nd innings';
  const firstDone = state.innings[0].status === 'done';
  // DLS needs a typical full first innings at this length: from your own matches when there are enough.
  const dlsG = (() => {
    const length = match.originalOvers ?? match.rules.overs;
    const firsts = matches
      .filter((m) => m.id !== match.id && (m.originalOvers ?? m.rules.overs) === length && !m.interruptions?.length)
      .map((m) => matchState(m).innings[0])
      .filter((s) => s.status === 'done');
    return firsts.length >= 3 ? Math.round(firsts.reduce((n, s) => n + s.runs, 0) / firsts.length) : undefined;
  })();
  const live = !state.result && s.status === 'live';

  let body = null;
  if (state.result) {
    const winner = state.winner ? match.teams.find((t) => t.id === state.winner) : null;
    const margin = winner ? state.result.replace(`${winner.name} won `, '') : '';
    const potm = playerOfTheMatch(match);
    const series = match.series ? seriesState(matches.filter((m) => m.series?.id === match.series!.id)) : null;
    body = (
      <FadeIn>
        <View style={styles.result}>
          <PitchStripes opacity={0.07} />
          {winner && <Confetti height={640} />}
          <PopIn delay={150}>
            <MaterialCommunityIcons name="trophy" size={34} color={colors.onAccent} />
          </PopIn>
          <Text style={styles.resultEyebrow}>
            {series ? `${series.name.toUpperCase()} · MATCH ${match.series!.number} OF ${series.of}` : winner ? 'RESULT' : 'ALL SQUARE'}
          </Text>
          <Text style={styles.resultWinner} numberOfLines={2}>
            {winner ? `${winner.name} win` : 'Match tied'}
          </Text>
          {winner && <Text style={styles.resultMargin}>{margin}</Text>}
          {potm && (
            <PressableScale
              disabled={isPlaceholder(potm.name)}
              dimWhenDisabled={false}
              wrapStyle={{ alignSelf: 'stretch' }}
              scaleTo={0.97}
              onPress={() => router.push({ pathname: '/player/[key]', params: { key: potm.key } })}
              style={styles.potm}
              accessibilityLabel={`Man of the Match: ${potm.name}, ${potm.summary}`}
            >
              <MaterialCommunityIcons name="star-four-points" size={18} color={hero.accent} />
              <View style={{ flex: 1 }}>
                <Text style={styles.potmLabel}>MAN OF THE MATCH</Text>
                <Text style={styles.potmName} numberOfLines={1}>
                  {potm.name}
                </Text>
              </View>
              <Text style={styles.potmLine}>{potm.summary}</Text>
            </PressableScale>
          )}
          {series && (
            <PressableScale
              scaleTo={0.97}
              wrapStyle={{ alignSelf: 'stretch' }}
              onPress={() => router.push({ pathname: '/series/[id]', params: { id: series.id } })}
              style={styles.seriesLine}
            >
              <Text style={styles.seriesLineText}>{series.status}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.onAccent} />
            </PressableScale>
          )}
          <View style={styles.resultScores}>
            {state.innings.map((inn, i) => (
              <View key={i} style={styles.resultScore}>
                <Text style={styles.resultTeam} numberOfLines={1}>
                  {inn.battingTeam.name}
                  {i >= 2 ? ' · super over' : ''}
                </Text>
                <Text style={styles.resultRuns}>
                  {inn.runs}/{inn.wickets}
                  <Text style={styles.resultOvers}> {oversText(inn.legalBalls)}</Text>
                </Text>
              </View>
            ))}
          </View>
        </View>
        <View style={{ gap: space.md, marginTop: space.lg }}>
          {state.result === 'Match tied' && match.innings.length < 4 && (
            <Button label={'Play a super over'} icon="flash" onPress={() => saveMatch(startSuperOver(match))} />
          )}
          <Button label="Share result picture" icon="image-outline" onPress={() => setSharing(true)} />
          <Button
            variant="ghost"
            label={'Full scorecard'}
            icon="list"
            onPress={() => router.push({ pathname: '/match/[id]/scorecard', params: { id: match.id } })}
          />
          {series?.next ? (
            <Button
              label={`Next: match ${series.next} of ${series.of}`}
              icon="play-forward"
              onPress={() => router.push({ pathname: '/new', params: { rematch: match.id, series: 'next' } })}
            />
          ) : (
            <Button
              variant="ghost"
              label="Rematch"
              icon="repeat"
              onPress={() => router.push({ pathname: '/new', params: { rematch: match.id } })}
            />
          )}
          {series && (
            <Button
              variant="ghost"
              label="Series table"
              icon="trophy-outline"
              onPress={() => router.push({ pathname: '/series/[id]', params: { id: series.id } })}
            />
          )}
          <Button variant="ghost" label="Export match" icon="download-outline" onPress={() => setExporting([match])} />
          <Text style={styles.exportHint}>A PDF scorecard for the group, or a match file so their player stats include it.</Text>
        </View>
      </FadeIn>
    );
  } else if (s.status === 'openers') {
    const pool = s.battingTeam.players.map((p) => p.id).filter((p) => !openers.includes(p));
    body = (
      <>
        {freshChase && (
          <FadeIn>
            <View style={styles.breakCard}>
              <PitchStripes tint="255,255,255" />
              <Text style={styles.breakEyebrow}>{superOver ? 'SUPER OVER · ONE OVER, TWO WICKETS' : 'INNINGS BREAK'}</Text>
              {s.target !== null ? (
                <>
                  <Text style={styles.breakTarget}>{s.target}</Text>
                  <Text style={styles.breakTitle}>{s.battingTeam.name} need this to win</Text>
                </>
              ) : (
                <>
                  <Text style={[styles.breakTarget, { fontSize: 72, lineHeight: 76 }]}>Tied</Text>
                  <Text style={styles.breakTitle}>{s.battingTeam.name} bat first</Text>
                </>
              )}
              <Text style={styles.breakSub}>
                {superOver
                  ? s.target !== null
                    ? `${state.innings[2].battingTeam.name} made ${state.innings[2].runs}/${state.innings[2].wickets} in their over`
                    : 'The side that batted second goes first. Most runs in the over wins it.'
                  : `${state.innings[0].battingTeam.name} made ${state.innings[0].runs}/${state.innings[0].wickets} in ${oversText(state.innings[0].legalBalls)} overs · ${Math.max(0, s.maxBalls)} balls to get them${match.revisedTarget ? ' (revised target)' : ''}`}
              </Text>
            </View>
          </FadeIn>
        )}
        {openers.length > 0 && (
          <View style={styles.openersPicked}>
            <Chip icon="close" label={`Striker: ${playerName(match, openers[0])}`} selected onPress={() => setOpeners([])} />
          </View>
        )}
        <PlayerPicker
          key={openers.length}
          title={openers.length === 0 ? 'Who’s on strike?' : 'And at the other end?'}
          subtitle={`${s.battingTeam.name} · opening pair`}
          match={match}
          ids={pool}
          onPick={(pid) => {
            if (openers.length === 0) setOpeners([pid]);
            else {
              push({ type: 'openers', striker: openers[0], nonStriker: pid });
              setOpeners([]);
            }
          }}
        />
      </>
    );
  } else if (s.status === 'batter') {
    body = (
      <PlayerPicker
        title="Next batter in"
        subtitle={`${s.wickets} down · ${s.available.length} to come`}
        match={match}
        ids={s.available}
        note={(pid) => (s.batters.find((b) => b.id === pid)?.retired ? 'Retired · can come back' : undefined)}
        onPick={(batter) => push({ type: 'batter', batter })}
      />
    );
  } else if (s.status === 'bowler') {
    // Bowlers usually swap ends: whoever bowled the over before last is the natural pick, so they go first.
    // Whoever bowled any of the last over (two of them if it was split) sits this one out.
    const fromThisEnd = s.overBowlers[s.overBowlers.length - 3]?.[0] ?? null;
    const withinLimit = (id: string) => !s.barred.includes(id) && oversLeft(match, s, id) !== 0;
    // Everyone has bowled their overs (a short side, a long innings): the limit gives way rather than stop the game.
    const limitOff = !s.bowlingTeam.players.some((p) => withinLimit(p.id));
    const usable = (id: string) => (limitOff ? !s.barred.includes(id) : withinLimit(id));
    const rank = (id: string) => (id === fromThisEnd && usable(id) ? 0 : !usable(id) ? 3 : s.bowlers.some((b) => b.id === id && b.balls) ? 1 : 2);
    const ids = s.bowlingTeam.players.map((p) => p.id).sort((a, b) => rank(a) - rank(b));
    const limit = match.rules.maxOversPerBowler;
    const extra = match.rules.extraOverBowlers ?? 0;
    const limitText = limit ? (extra ? ` · ${extra} can bowl ${limit + 1}, the rest ${limit}` : ` · ${limit} over${limit === 1 ? '' : 's'} each`) : '';
    body = (
      <PlayerPicker
        title={s.legalBalls === 0 ? 'Opening bowler' : `Over ${Math.floor(s.legalBalls / 6) + 1}`}
        subtitle={
          s.legalBalls === 0
            ? `${s.bowlingTeam.name} with the new ball${limitText}`
            : limitOff
              ? 'Everyone has bowled their overs, so anyone can bowl this one.'
              : `Who’s bowling it?${limitText}`
        }
        match={match}
        ids={ids}
        disabled={ids.filter((id) => !usable(id))}
        note={(pid) => {
          if (s.barred.includes(pid)) return s.barred.length > 1 ? 'Bowled part of the last over' : 'Bowled the last over';
          const left = oversLeft(match, s, pid);
          if (left === 0 && !limitOff) return `Bowled their ${plural(Number(oversText(s.bowlers.find((x) => x.id === pid)?.balls ?? 0).split('.')[0]), 'over')}`;
          const b = s.bowlers.find((x) => x.id === pid);
          const figures = b && b.balls ? `${oversText(b.balls)}-${b.maidens}-${b.runs}-${b.wickets}` : '';
          const parts = [pid === fromThisEnd ? 'From this end' : '', figures, left !== null ? `${left} left` : ''].filter(Boolean);
          return parts.length ? parts.join(' · ') : undefined;
        }}
        onPick={(bowler) => push({ type: 'bowler', bowler })}
      />
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <IconButton icon="chevron-back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        {/* Both names in full, one above the other, so neither is cut short. */}
        <View style={styles.headerTitle}>
          <Text numberOfLines={1} style={styles.headerTeam}>
            {match.teams[0].name}
          </Text>
          <Text numberOfLines={1} style={styles.headerTeam}>
            <Text style={styles.headerVs}>vs </Text>
            {match.teams[1].name}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          {/* While scoring, Undo sits on the pad; between balls' screens (openers, bowler, result) it's up here. */}
          {!live && <IconButton icon="arrow-undo" label="Undo" disabled={!canUndo(match)} onPress={undoLast} />}
          <IconButton
            icon="stats-chart"
            label="Scorecard"
            onPress={() => router.push({ pathname: '/match/[id]/scorecard', params: { id: match.id } })}
          />
          {!state.result && <IconButton icon="ellipsis-horizontal" label="Match options" onPress={() => setMenu(true)} />}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: space.sm, gap: space.md, paddingBottom: space.xl }}>
        {!(freshChase && s.status === 'openers') && !state.result && <Scoreboard match={match} s={s} index={index} />}
        {s.striker && !state.result && <Crease
            match={match}
            s={s}
            onSwap={() => push({ type: 'swap' })}
            onRetire={(id) => {
              setRetiring(id);
              setWicketFor(null);
            }}
          />}
        {live && <ThisOver s={s} onEdit={setEditing} />}
        {!state.result && s.status !== 'openers' && <OverChart s={s} />}
        {body}
      </ScrollView>

      {live && (
        <View style={[styles.padWrap, { paddingBottom: insets.bottom + space.sm }]}>
          {s.freeHit && <Banner tone="volt" title={'FREE HIT'} body={'Only a run out counts on this ball'} />}
          {s.bowler && s.streaks[s.bowler] === 2 && (
            <Banner tone="red" title={'HAT-TRICK BALL'} body={`${playerName(match, s.bowler)} has two in a row`} />
          )}
          <Pad onBall={push} onWicket={(mode) => setWicketFor(mode)} onUndo={undoLast} canUndo={canUndo(match)} bounce={bounceInfo(match, s)} />
        </View>
      )}

      <BallEditSheet
        ball={editing}
        event={editing?.event !== undefined ? (match.innings[index].events[editing.event] as BallEvent) : null}
        match={match}
        s={s}
        onClose={() => setEditing(null)}
        onSave={(next, bowler) => {
          if (editing?.event === undefined) return;
          const fixed = fixBall(match, index, editing.event, next, bowler);
          if (typeof fixed === 'string') return fixed;
          saveMatch(fixed);
          toast.show(next ? 'Ball fixed. Everything after it is updated.' : 'Ball deleted', 'success');
          setEditing(null);
        }}
      />
      <MatchMenu
        visible={menu}
        match={match}
        s={s}
        firstInningsRuns={firstDone && !superOver ? state.innings[0].runs : null}
        inningsLabel={inningsLabel}
        superOver={superOver}
        onClose={() => setMenu(false)}
        dlsG={dlsG}
        onOvers={(o) => {
          const next = setOvers(match, o, dlsG);
          if (next === match) return;
          saveMatch(next);
          const st = matchState(next);
          // The overs actually set: never fewer than have been bowled.
          const now = next.rules.overs;
          const set = now === o ? '' : ` (${plural(Math.ceil(state.innings[index].legalBalls / 6), 'over')} already bowled)`;
          const how = chaseTargetInfo(next, st.innings[0].runs).method === 'dls' ? 'DLS target' : 'Target';
          toast.show(
            st.innings[0].status === 'done' ? `Now ${plural(now, 'over')}${set} · ${how} ${st.innings[1].target}` : `Now ${plural(now, 'over')} an innings${set}`,
            'success',
          );
        }}
        onTarget={(t) => {
          saveMatch({ ...match, revisedTarget: t });
          toast.show(t ? `Chase target is now ${t}` : 'Target back to normal', 'success');
          setMenu(false);
        }}
        onAddPlayer={(teamId, name) => {
          saveMatch(addPlayer(match, teamId, { id: newId(), name }));
          toast.show(`${name} added`, 'success');
          setMenu(false);
        }}
        onDeadBall={() => {
          push({ type: 'deadBall' });
          toast.show('Dead ball. Nothing counts.', 'info');
          setMenu(false);
        }}
        onEndInnings={() => {
          setMenu(false);
          push({ type: 'endInnings' });
        }}
        onDelete={() => {
          setMenu(false);
          deleteMatch(match.id);
          router.replace('/');
        }}
        onMovePlayer={(playerId) => {
          const moved = movePlayer(match, playerId);
          if (typeof moved === 'string') {
            toast.show(moved, 'error');
            return;
          }
          const to = moved.teams.find((t) => t.players.some((p) => p.id === playerId))!;
          saveMatch(moved);
          toast.show(`${playerName(match, playerId)} now plays for ${to.name}`, 'success');
        }}
        onBowlerChange={(bowler) => {
          toast.show(`${playerName(match, bowler)} takes over from ${playerName(match, s.bowler)}`, 'info');
          setMenu(false);
          push({ type: 'bowler', bowler });
        }}
      />
      <ExportSheet
        visible={exporting !== null}
        matches={exporting ?? []}
        onClose={() => setExporting(null)}
        onExport={(format, chosen) => {
          setExporting(null);
          exportAs(format, chosen);
        }}
      />
      {state.result && <ShareCardSheet match={match} all={matches} visible={sharing} onClose={() => setSharing(false)} notify={toast.show} />}
      <MomentFlash moment={moment} />
      {toast.element}
      <WicketSheet
        visible={wicketFor !== undefined}
        match={match}
        s={s}
        preset={wicketFor ?? null}
        retiring={retiring}
        onClose={() => {
          setWicketFor(undefined);
          setRetiring(null);
        }}
        onConfirm={(e) => {
          setWicketFor(undefined);
          setRetiring(null);
          push(e, 320);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.sm },
  headerTitle: { flex: 1, minWidth: 0, paddingHorizontal: space.sm },
  headerTeam: { color: colors.text, fontSize: 16, lineHeight: 20, fontFamily: font.poster },
  headerVs: { color: colors.accentInk, fontFamily: font.semibold, fontSize: 13 },

  hero: { borderRadius: radius.xl, padding: space.xl, overflow: 'hidden' },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(215,255,58,0.14)',
    paddingHorizontal: 10,
    height: 26,
    borderRadius: radius.pill,
  },
  liveText: { ...type.label, fontSize: 10, color: hero.accent },
  heroOvers: { color: hero.muted, fontSize: 16, fontFamily: font.poster, ...type.num },
  heroTeam: { ...type.poster, color: hero.text, fontSize: 22, marginTop: space.lg },
  heroScoreRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  scoreWrap: { flexDirection: 'row', alignItems: 'flex-end', flexShrink: 1 },
  heroScore: { ...type.display, color: hero.text },
  heroWickets: { fontFamily: font.poster, fontSize: 48, lineHeight: 72, color: hero.faint, marginLeft: 2, letterSpacing: -1 },
  heroStats: { gap: space.sm, alignItems: 'flex-end', paddingBottom: 14 },
  stat: { alignItems: 'flex-end' },
  statLabel: { ...type.label, fontSize: 10, color: hero.faint },
  statValue: { color: hero.text, fontSize: 24, fontFamily: font.posterBlack, lineHeight: 28, ...type.num },
  progress: {
    height: 6,
    backgroundColor: hero.ink(0.1),
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: space.md,
  },
  progressFill: { height: '100%', backgroundColor: hero.accent, borderRadius: 3 },
  notch: { position: 'absolute', top: 0, bottom: 0, width: 2, marginLeft: -1, backgroundColor: HERO_BG },
  heroFoot: { color: hero.muted, fontSize: 13, fontFamily: font.semibold, marginTop: space.md },
  chase: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: hero.accent,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    paddingVertical: 8,
    marginTop: space.md,
  },
  chaseText: { color: colors.onAccent, fontSize: 15, fontFamily: font.semibold },
  chaseBig: { fontSize: 22, fontFamily: font.posterBlack },
  chaseTarget: { color: colors.onAccent, fontSize: 13, fontFamily: font.semibold, opacity: 0.65 },

  rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  batter: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.md, paddingRight: space.lg, gap: space.md },
  strikeBar: { width: 4, alignSelf: 'stretch', backgroundColor: 'transparent', borderTopRightRadius: 2, borderBottomRightRadius: 2 },
  batterName: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  retire: { marginLeft: space.xs, paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.borderHi },
  retireText: { color: colors.muted, fontSize: 11, fontFamily: font.semibold },
  name: { color: colors.muted, fontSize: 17, fontFamily: font.bold, flexShrink: 1 },
  batterMeta: { color: colors.faint, fontSize: 12, fontFamily: font.semibold, marginTop: 2, ...type.num },
  batterRuns: { color: colors.muted, fontSize: 40, lineHeight: 44, fontFamily: font.posterBlack, ...type.num },
  batterBalls: { fontSize: 18, fontFamily: font.poster, color: colors.faint },
  bowlerRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  bowlerIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.dangerDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bowlerName: { color: colors.text, fontSize: 15, fontFamily: font.bold },
  figures: { color: colors.text, fontSize: 24, fontFamily: font.posterBlack, ...type.num },

  scorebug: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.md,
    ...edge,
  },
  scorebugLabel: { borderRightWidth: 1, borderRightColor: colors.border, paddingRight: space.md },
  scorebugTitle: { color: colors.text, fontSize: 16, fontFamily: font.poster },
  scorebugRuns: { color: colors.faint, fontSize: 11, fontFamily: font.bold, textTransform: 'uppercase' },
  overBalls: { gap: 6, alignItems: 'center' },

  chartCard: { paddingBottom: space.md },
  chartHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.md },
  chartTitle: { ...type.label, color: colors.muted },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 6, height: 6, borderRadius: 3 },
  legendText: { color: colors.faint, fontSize: 11, fontFamily: font.semibold },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 118 },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  barValue: { color: colors.muted, fontSize: 13, fontFamily: font.poster, marginBottom: 3, ...type.num },
  barTrack: { height: 70, width: '100%', maxWidth: 20, justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 6, backgroundColor: ink(0.18) },
  barCurrent: { borderWidth: 1.5, borderColor: colors.accent, backgroundColor: colors.accentDim },
  barWickets: { flexDirection: 'row', gap: 2, height: 8, marginTop: 3 },
  wicketDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.danger },
  barLabel: { color: colors.faint, fontSize: 10, fontFamily: font.bold, ...type.num },

  pickerTitle: { ...type.title, fontSize: 32, lineHeight: 36, color: colors.text, marginTop: space.md },
  pickerSub: { color: colors.muted, fontSize: 14, fontFamily: font.medium, marginTop: 2 },
  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    height: 62,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...edge,
  },
  pickNum: { color: colors.faint, fontSize: 18, fontFamily: font.poster, width: 28, ...type.num },
  pickName: { color: colors.text, fontSize: 16, fontFamily: font.bold },
  pickNote: { color: colors.muted, fontSize: 12, fontFamily: font.medium, marginTop: 1 },
  openersPicked: { flexDirection: 'row', marginTop: space.sm },

  padWrap: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl + 4,
    borderTopRightRadius: radius.xl + 4,
    borderTopWidth: 1,
    borderColor: colors.borderHi,
    paddingHorizontal: space.md,
    paddingTop: space.md,
    ...edge,
  },
  pad: { gap: space.sm },
  extrasRow: { flexDirection: 'row', gap: 6 },
  extraKey: {
    height: 38,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceHi,
    alignItems: 'center',
    justifyContent: 'center',
    ...edge,
  },
  extraKeyOn: { backgroundColor: colors.violet, borderColor: colors.violet },
  extraText: { color: colors.muted, fontSize: 13, fontFamily: font.semibold },
  modeHint: { ...type.label, fontSize: 10, color: colors.faint, textAlign: 'center', marginVertical: 2 },
  grid: { flexDirection: 'row', gap: space.sm },
  key: {
    height: 64,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceHi,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...edge,
  },
  keyFour: { backgroundColor: colors.cyanDim, borderColor: 'transparent' },
  keySix: { backgroundColor: colors.accent, borderColor: colors.accent },
  keyMode: { backgroundColor: colors.violetDim, borderColor: colors.violet },
  keyUndo: { backgroundColor: colors.surfaceHi, borderColor: colors.borderHi },
  keyOut: { backgroundColor: colors.danger, borderColor: colors.danger },
  keyText: { color: colors.text, fontSize: 30, lineHeight: 34, fontFamily: font.posterBlack, ...type.num },
  keySub: { fontSize: 9, fontFamily: font.semibold, letterSpacing: 1, marginTop: -1, opacity: 0.75 },

  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  editNow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  editNowText: { color: colors.text, fontSize: 16, fontFamily: font.bold },
  dlsStrong: { color: colors.accentInk, fontFamily: font.heavy },
  dlsNow: { color: colors.text, fontSize: 16, fontFamily: font.bold },
  editNote: { color: colors.muted, fontSize: 13, fontFamily: font.regular, lineHeight: 19 },
  editRuns: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  input: {
    color: colors.text,
    fontSize: 15,
    fontFamily: font.medium,
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: space.md,
    height: 44,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    paddingVertical: 8,
    marginBottom: space.sm,
  },
  bannerTitle: { fontFamily: font.posterBlack, fontSize: 17, color: colors.onAccent },
  bannerBody: { flex: 1, fontFamily: font.semibold, fontSize: 12, color: colors.onAccent },
  sheetLabel: { ...type.label, color: colors.muted, marginTop: space.xs },
  switchTeam: { fontFamily: font.bold, fontSize: 14, color: colors.text },

  result: {
    backgroundColor: colors.accent,
    borderRadius: radius.xl,
    padding: space.xl,
    paddingTop: space.xxl,
    overflow: 'hidden',
    alignItems: 'flex-start',
  },
  resultEyebrow: { ...type.label, color: colors.onAccent, opacity: 0.6, marginTop: space.md },
  resultWinner: { fontFamily: font.posterBlack, fontSize: 40, lineHeight: 46, color: colors.onAccent, letterSpacing: -1.6 },
  resultMargin: { fontFamily: font.poster, fontSize: 20, color: colors.onAccent, letterSpacing: -0.3, opacity: 0.75 },
  resultScores: { alignSelf: 'stretch', marginTop: space.xl, borderTopWidth: 1, borderTopColor: 'rgba(10,13,6,0.18)', paddingTop: space.md, gap: 6 },
  resultScore: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  resultTeam: { color: colors.onAccent, fontFamily: font.bold, fontSize: 15, flex: 1 },
  resultRuns: { color: colors.onAccent, fontFamily: font.posterBlack, fontSize: 24, ...type.num },
  resultOvers: { fontFamily: font.medium, fontSize: 13, opacity: 0.55 },
  potm: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: HERO_BG,
    borderRadius: radius.lg,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    marginTop: space.lg,
  },
  seriesLine: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(10,13,6,0.25)',
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 8,
    marginTop: space.sm,
  },
  seriesLineText: { fontFamily: font.poster, fontSize: 16, color: colors.onAccent },
  potmLabel: { ...type.label, fontSize: 9, color: hero.accent },
  potmName: { fontFamily: font.poster, fontSize: 20, color: hero.text, letterSpacing: -0.3 },
  potmLine: { fontFamily: font.semibold, fontSize: 14, color: hero.muted, ...type.num },
  exportHint: { color: colors.faint, fontSize: 12, fontFamily: font.regular, textAlign: 'center', marginTop: -4 },

  breakCard: {
    backgroundColor: HERO_BG,
    borderRadius: radius.xl,
    padding: space.xl,
    overflow: 'hidden',
  },
  breakEyebrow: { ...type.label, color: hero.accent },
  breakTarget: { fontFamily: font.posterBlack, fontSize: 104, lineHeight: 114, color: hero.text, letterSpacing: -5, ...type.num },
  breakTitle: { ...type.poster, fontSize: 22, color: hero.text },
  breakSub: { color: hero.muted, fontSize: 13, fontFamily: font.medium, marginTop: space.sm },
});
