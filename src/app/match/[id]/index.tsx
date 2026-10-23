import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

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
import { ExportSheet } from '../../../components/ExportSheet.tsx';
import {
  BallChip,
  Button,
  Card,
  Chip,
  FadeIn,
  GhostWord,
  IconButton,
  MomentFlash,
  PitchStripes,
  PopText,
  PressableScale,
  Screen,
  SectionLabel,
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
  describeEvent,
  highlights,
  matchState,
  oversLeft,
  oversText,
  parTarget,
  playerName,
  replaceBall,
  setOvers,
  startSuperOver,
  undo,
  type BallView,
  type InningsState,
} from '../../../engine/engine.ts';
import { isPlaceholder, playerOfTheMatch, seriesState } from '../../../engine/stats.ts';
import type { BallEvent, Extra, InningsEvent, Match, WicketKind } from '../../../engine/types.ts';
import { newId, useMatch, useMatches } from '../../../store/matches.tsx';
import { useMatchFiles } from '../../../store/useMatchFiles.ts';
import { colors, font, gradients, radius, space, type } from '../../../theme.ts';

const rate = (runs: number, balls: number) => (balls ? ((runs * 6) / balls).toFixed(2) : '0.00');

// ─── Scoreboard ──────────────────────────────────────────────────────────────

function Scoreboard({ match, s, index }: { match: Match; s: InningsState; index: number }) {
  const ballsLeft = s.maxBalls - s.legalBalls;
  const chasing = s.target !== null && s.status !== 'done';
  const need = chasing ? Math.max(s.target! - s.runs, 0) : null;
  const projected = s.legalBalls >= 6 ? Math.round(s.runs + (s.runs / s.legalBalls) * ballsLeft) : null;
  const progress = Math.min(1, s.legalBalls / s.maxBalls);

  return (
    <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.hero}>
      <PitchStripes />
      <GhostWord size={150} style={styles.heroGhost}>
        {s.battingTeam.name}
      </GhostWord>

      <View style={styles.heroTop}>
        <View style={styles.livePill}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>{index >= 2 ? 'Super over' : index === 0 ? '1st innings' : '2nd innings'}</Text>
        </View>
        <Text style={styles.heroOvers}>
          OV <Text style={{ color: colors.text }}>{oversText(s.legalBalls)}</Text>
          <Text style={{ color: colors.faint }}> / {match.rules.overs}</Text>
        </Text>
      </View>

      <Text numberOfLines={1} style={styles.heroTeam}>
        {s.battingTeam.name}
      </Text>
      <View style={styles.heroScoreRow}>
        <View style={styles.scoreWrap}>
          <PopText value={s.runs} style={styles.heroScore} />
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
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        {match.rules.overs <= 25 &&
          Array.from({ length: match.rules.overs - 1 }, (_, i) => (
            <View key={i} style={[styles.notch, { left: `${((i + 1) / match.rules.overs) * 100}%` }]} />
          ))}
      </View>

      {need !== null ? (
        <View style={styles.chase}>
          <Text style={styles.chaseText}>
            NEED <Text style={styles.chaseBig}>{need}</Text> OFF <Text style={styles.chaseBig}>{ballsLeft}</Text>
          </Text>
          <Text style={styles.chaseTarget}>TARGET {s.target}</Text>
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
      <Text style={[styles.statValue, hot && { color: colors.accent }]}>{value}</Text>
    </View>
  );
}

// ─── Crease ──────────────────────────────────────────────────────────────────

function Crease({ match, s, onSwap }: { match: Match; s: InningsState; onSwap: () => void }) {
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
                {onStrike && <MaterialCommunityIcons name="cricket" size={15} color={colors.accent} />}
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

const EDIT_KINDS: { value: 'none' | Extra; label: string }[] = [
  { value: 'none', label: 'Runs' },
  { value: 'wide', label: 'Wide' },
  { value: 'noball', label: 'No ball' },
  { value: 'bye', label: 'Bye' },
  { value: 'legbye', label: 'LB' },
];

const WICKET_EDIT_KINDS: { value: WicketKind; label: string }[] = [
  { value: 'bowled', label: 'Bowled' },
  { value: 'caught', label: 'Caught' },
  { value: 'lbw', label: 'LBW' },
  { value: 'runout', label: 'Run out' },
  { value: 'stumped', label: 'Stumped' },
  { value: 'hitwicket', label: 'Hit wicket' },
];

/** Fix a ball scored wrongly. Runs and extras can change, or the ball can go; a wicket can be corrected in place. */
function BallEditSheet({
  ball,
  event,
  match,
  s,
  onClose,
  onSave,
}: {
  ball: BallView | null;
  event: BallEvent | null;
  match: Match;
  s: InningsState;
  onClose: () => void;
  onSave: (next: BallEvent | null) => void;
}) {
  const [kind, setKind] = useState<'none' | Extra>('none');
  const [runs, setRuns] = useState(0);
  const [how, setHow] = useState<WicketKind>('bowled');
  const [fielder, setFielder] = useState<string | undefined>();
  useEffect(() => {
    if (!event) return;
    setKind(event.extra ?? 'none');
    setRuns(event.runs);
    if (event.wicket) {
      setHow(event.wicket.kind);
      setFielder(event.wicket.fielder);
    }
  }, [event]);
  if (!ball || !event) return null;
  const byes = kind === 'bye' || kind === 'legbye';
  const keeper = match.keepers?.[s.bowlingTeam.id];

  return (
    <Sheet visible onClose={onClose} title="Fix this ball">
      <ScrollView contentContainerStyle={{ gap: space.md, paddingBottom: space.md }}>
        <View style={styles.editNow}>
          <BallChip ball={ball} size={44} />
          <Text style={styles.editNowText}>Scored as {ball.label === '•' ? 'a dot ball' : ball.label}</Text>
        </View>
        {event.wicket ? (
          <>
            <Text style={styles.editNote}>
              {playerName(match, event.wicket.playerOut)} stays out (everything after was scored without them). Fix how,
              or who took it. To take the wicket away, undo back to it.
            </Text>
            <View style={styles.wrap}>
              {WICKET_EDIT_KINDS.map((k) => (
                <Chip key={k.value} tone="danger" label={k.label} selected={how === k.value} onPress={() => setHow(k.value)} />
              ))}
            </View>
            {(how === 'caught' || how === 'runout' || how === 'stumped') && (
              <View style={styles.wrap}>
                {s.bowlingTeam.players.map((p) => (
                  <Chip
                    key={p.id}
                    label={p.id === keeper ? `${p.name} †` : p.name}
                    selected={fielder === p.id}
                    onPress={() => setFielder(fielder === p.id ? undefined : p.id)}
                  />
                ))}
              </View>
            )}
            {how === 'runout' && (
              <Segmented value={String(runs)} onChange={(v) => setRuns(Number(v))} options={['0', '1', '2', '3'].map((v) => ({ value: v, label: `${v} run${v === '1' ? '' : 's'}` }))} />
            )}
            <Button
              label="Save wicket"
              icon="checkmark"
              onPress={() =>
                onSave({
                  ...event,
                  runs: how === 'runout' ? runs : 0,
                  wicket: { kind: how, playerOut: event.wicket!.playerOut, fielder: how === 'caught' || how === 'runout' || how === 'stumped' ? fielder : undefined },
                })
              }
            />
          </>
        ) : (
          <>
            <Segmented value={kind} onChange={setKind} options={EDIT_KINDS} />
            <View style={styles.editRuns}>
              {[0, 1, 2, 3, 4, 5, 6].map((r) => (
                <Chip key={r} label={String(r)} selected={runs === r} disabled={byes && r === 0} onPress={() => setRuns(r)} />
              ))}
            </View>
            <Button
              label="Save ball"
              icon="checkmark"
              disabled={byes && runs === 0}
              onPress={() => onSave({ type: 'ball', runs, extra: kind === 'none' ? undefined : kind })}
            />
            <Button variant="ghost" label="Delete this ball" icon="trash-outline" onPress={() => onSave(null)} />
          </>
        )}
      </ScrollView>
    </Sheet>
  );
}

/** Things that happen to the match rather than to a ball: rain, a declaration, a late arrival, penalties. */
function MatchMenu({
  visible,
  match,
  s,
  firstInningsRuns,
  onClose,
  onOvers,
  onTarget,
  onAddPlayer,
  onPenalty,
  onDeadBall,
  onEndInnings,
  inningsLabel,
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
  onPenalty: (runs: number) => void;
  onDeadBall: () => void;
  onEndInnings: () => void;
  inningsLabel: string;
}) {
  const [overs, setOversDraft] = useState(match.rules.overs);
  const [target, setTargetDraft] = useState(0);
  const [arming, setArming] = useState(false);
  const [lateTeam, setLateTeam] = useState(match.teams[0].id);
  const [lateName, setLateName] = useState('');
  const original = match.originalOvers ?? match.rules.overs;
  const fair = firstInningsRuns !== null ? parTarget(firstInningsRuns, original, overs) : null;
  useEffect(() => {
    if (visible) {
      setOversDraft(match.rules.overs);
      setTargetDraft(match.revisedTarget ?? (firstInningsRuns ?? 0) + 1);
      setArming(false);
      setLateName('');
    }
  }, [visible, match.rules.overs, match.revisedTarget, firstInningsRuns]);

  return (
    <Sheet visible={visible} onClose={onClose} title="Match">
      <ScrollView contentContainerStyle={{ gap: space.md, paddingBottom: space.md }}>
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
        {firstInningsRuns !== null && (
          <Card style={{ gap: space.sm }}>
            <Stepper
              label="Chase target"
              hint={fair !== null && overs !== original ? `Fair target for ${overs} overs: ${fair}` : `${firstInningsRuns} + 1 as it stands`}
              value={target}
              min={1}
              max={999}
              onChange={setTargetDraft}
            />
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              {fair !== null && overs !== original && <Chip label={`Use ${fair}`} onPress={() => setTargetDraft(fair)} />}
              <Chip label="Back to normal" onPress={() => setTargetDraft(firstInningsRuns + 1)} />
            </View>
            <Button
              variant="ghost"
              label={`Set the target to ${target}`}
              icon="flag-outline"
              disabled={target === (match.revisedTarget ?? firstInningsRuns + 1)}
              onPress={() => onTarget(target === firstInningsRuns + 1 ? undefined : target)}
            />
          </Card>
        )}

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
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <View style={{ flex: 1 }}>
            <Button variant="ghost" label={`+5 to ${s.battingTeam.name}`} icon="alert-circle-outline" onPress={() => onPenalty(5)} />
          </View>
          <View style={{ flex: 1 }}>
            <Button variant="ghost" label="Dead ball" icon="hand-left-outline" onPress={onDeadBall} />
          </View>
        </View>

        <Button
          variant="danger"
          label={arming ? 'Tap again to end it' : `End ${inningsLabel} now`}
          icon="flag-outline"
          onPress={() => (arming ? onEndInnings() : setArming(true))}
          style={{ marginTop: space.sm }}
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
              <View
                style={[
                  styles.bar,
                  { height: Math.max(3, (t.runs / peak) * 70) },
                  t.runs >= 10 && { backgroundColor: colors.accent },
                  current && styles.barCurrent,
                ]}
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
  { value: 'bye', label: 'Bye' },
  { value: 'legbye', label: 'LB' },
];

const MODE_HINT: Record<Extra, string> = {
  wide: 'WIDE · tap the runs they ran',
  noball: 'NO BALL · tap the runs off the bat',
  bye: 'BYE · tap the runs they ran',
  legbye: 'LEG BYE · tap the runs they ran',
};

/** How the next bouncer counts: fair while the over's allowance lasts, then a wide or no-ball. */
function bounceHint(match: Match, s: InningsState) {
  const rule = match.rules.bouncer ?? { fair: 0, calledAs: 'wide' as const };
  const left = rule.fair - s.bouncersThisOver;
  return left > 0
    ? `BOUNCE · fair ball (${left} more allowed this over)`
    : `BOUNCE · called as a ${rule.calledAs === 'wide' ? 'wide' : 'no ball'} · tap the runs`;
}

function Key({
  label,
  sub,
  onPress,
  disabled,
  variant = 'plain',
}: {
  label: string;
  sub?: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'plain' | 'four' | 'six' | 'out' | 'mode';
}) {
  const v = {
    plain: [styles.key, colors.text],
    four: [[styles.key, styles.keyFour], colors.cyan],
    six: [[styles.key, styles.keySix], colors.onAccent],
    out: [[styles.key, styles.keyOut], '#FFFFFF'],
    mode: [[styles.key, styles.keyMode], colors.violet],
  }[variant] as [object, string];
  return (
    <View style={{ flex: 1 }}>
      <PressableScale
        accessibilityLabel={sub ? `${label} ${sub}` : label}
        disabled={disabled}
        haptic={null}
        scaleTo={0.9}
        onPress={onPress}
        style={v[0]}
      >
        <Text style={[styles.keyText, { color: v[1] }, label.length > 2 && { fontSize: 26 }]}>{label}</Text>
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
  bounce,
}: {
  onBall: (b: BallEvent) => void;
  onWicket: (mode: Extra | null) => void;
  /** What the hint says when Bounce is on. */
  bounce: string;
}) {
  const [mode, setMode] = useState<PadMode | null>(null);
  const score = (r: number) => {
    tap(r >= 4 ? 'heavy' : 'light');
    onBall(mode === 'bouncer' ? { type: 'ball', runs: r, bouncer: true } : { type: 'ball', runs: r, extra: mode ?? undefined });
    setMode(null);
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
        {mode === 'bouncer' ? bounce : mode ? MODE_HINT[mode] : 'TAP THE RUNS OFF THIS BALL'}
      </Text>
      <View style={styles.grid}>{[0, 1, 2, 3].map(runKey)}</View>
      <View style={styles.grid}>
        {[4, 6, 5].map(runKey)}
        <Key
          label="OUT"
          variant="out"
          onPress={() => {
            tap('warning');
            onWicket(mode === 'bouncer' ? null : mode);
            setMode(null);
          }}
        />
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

function WicketSheet({
  visible,
  match,
  s,
  preset,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  match: Match;
  s: InningsState;
  preset: Extra | null;
  onClose: () => void;
  onConfirm: (e: InningsEvent) => void;
}) {
  const [kind, setKind] = useState<WicketKind>('bowled');
  const [who, setWho] = useState<'striker' | 'nonStriker'>('striker');
  const [fielder, setFielder] = useState<string | undefined>();
  const [runs, setRuns] = useState('0');
  const [delivery, setDelivery] = useState<'legal' | 'wide' | 'noball'>('legal');

  useEffect(() => {
    if (!visible) return;
    setKind(s.freeHit || preset === 'noball' ? 'runout' : preset === 'wide' ? 'stumped' : 'bowled');
    setWho('striker');
    setFielder(undefined);
    setRuns('0');
    setDelivery(preset === 'wide' || preset === 'noball' ? preset : 'legal');
  }, [visible, preset]);

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
      onConfirm({ type: 'retire', batter: outId });
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
    <Sheet visible={visible} onClose={onClose} title="Wicket">
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
          label={kind === 'retired' ? `Retire ${playerName(match, outId)}` : `${playerName(match, outId)} is out`}
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
  const wideBounce = e.bouncer && match.rules.bouncer?.calledAs !== 'noball' && s.bouncersThisOver >= (match.rules.bouncer?.fair ?? 0);
  if ((!e.extra || e.extra === 'noball') && !wideBounce) {
    if (e.runs === 6) return { kind: 'six', caption: playerName(match, s.striker) };
    if (e.runs === 4) return { kind: 'four', caption: playerName(match, s.striker) };
  }
  return null;
}

export default function LiveMatch() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { match, saveMatch, ready } = useMatch(id);
  const { matches } = useMatches();
  const insets = useSafeAreaInsets();
  const [openers, setOpeners] = useState<string[]>([]);
  const [wicketFor, setWicketFor] = useState<Extra | null | undefined>(undefined);
  const [moment, setMoment] = useState<Moment | null>(null);
  const [editing, setEditing] = useState<BallView | null>(null);
  const [menu, setMenu] = useState(false);
  // At the top here: the bottom of this screen is the scoring pad.
  const toast = useToast('top');
  const { exportMatches, exportPdf } = useMatchFiles(toast.show);
  const [exporting, setExporting] = useState<Match[] | null>(null);
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
          <MaterialCommunityIcons name="trophy" size={34} color={colors.onAccent} />
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
            >
              <MaterialCommunityIcons name="star-four-points" size={18} color={colors.accent} />
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
            {state.innings.map((inn) => (
              <View key={inn.battingTeam.id} style={styles.resultScore}>
                <Text style={styles.resultTeam} numberOfLines={1}>
                  {inn.battingTeam.name}
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
            <Button label="Play a super over" icon="flash" onPress={() => saveMatch(startSuperOver(match))} />
          )}
          <Button
            label="Full scorecard"
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
              <PitchStripes />
              <Text style={styles.breakEyebrow}>{superOver ? 'SUPER OVER · ONE OVER, TWO WICKETS' : 'INNINGS BREAK'}</Text>
              {s.target !== null ? (
                <>
                  <Text style={styles.breakTarget}>{s.target}</Text>
                  <Text style={styles.breakTitle}>{s.battingTeam.name} need this to win</Text>
                </>
              ) : (
                <>
                  <Text style={[styles.breakTarget, { fontSize: 72, lineHeight: 72 }]}>TIED</Text>
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
    const history = match.innings[index].events.flatMap((e) => (e.type === 'bowler' ? [e.bowler] : []));
    const fromThisEnd = history.length >= 2 ? history[history.length - 2] : null;
    const usable = (id: string) => id !== s.lastOverBowler && oversLeft(match, s, id) !== 0;
    const rank = (id: string) => (id === fromThisEnd && usable(id) ? 0 : !usable(id) ? 3 : s.bowlers.some((b) => b.id === id && b.balls) ? 1 : 2);
    const ids = s.bowlingTeam.players.map((p) => p.id).sort((a, b) => rank(a) - rank(b));
    const limit = match.rules.maxOversPerBowler;
    const extra = match.rules.extraOverBowlers ?? 0;
    const limitText = limit ? (extra ? ` · ${extra} can bowl ${limit + 1}, the rest ${limit}` : ` · ${limit} overs each`) : '';
    body = (
      <PlayerPicker
        title={s.legalBalls === 0 ? 'Opening bowler' : `Over ${Math.floor(s.legalBalls / 6) + 1}`}
        subtitle={
          s.legalBalls === 0
            ? `${s.bowlingTeam.name} with the new ball${limitText}`
            : `Who’s bowling it?${limitText}`
        }
        match={match}
        ids={ids}
        disabled={ids.filter((id) => !usable(id))}
        note={(pid) => {
          if (pid === s.lastOverBowler) return 'Bowled the last over';
          const left = oversLeft(match, s, pid);
          if (left === 0) return `Bowled their ${oversText(s.bowlers.find((x) => x.id === pid)?.balls ?? 0).split('.')[0]} overs`;
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
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.headerTitle}>
          {match.teams[0].name} <Text style={{ color: colors.accent }}>×</Text> {match.teams[1].name}
        </Text>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <IconButton icon="arrow-undo" label="Undo" disabled={!canUndo(match)} onPress={undoLast} />
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
        {s.striker && !state.result && <Crease match={match} s={s} onSwap={() => push({ type: 'swap' })} />}
        {live && <ThisOver s={s} onEdit={setEditing} />}
        {!state.result && s.status !== 'openers' && <OverChart s={s} />}
        {body}
      </ScrollView>

      {live && (
        <View style={[styles.padWrap, { paddingBottom: insets.bottom + space.sm }]}>
          {s.freeHit && <Banner tone="volt" title="FREE HIT" body="Only a run out counts on this ball" />}
          {s.bowler && s.streaks[s.bowler] === 2 && (
            <Banner tone="red" title="HAT-TRICK BALL" body={`${playerName(match, s.bowler)} has two in a row`} />
          )}
          <Pad onBall={push} onWicket={(mode) => setWicketFor(mode)} bounce={bounceHint(match, s)} />
        </View>
      )}

      <BallEditSheet
        ball={editing}
        event={editing?.event !== undefined ? (match.innings[index].events[editing.event] as BallEvent) : null}
        match={match}
        s={s}
        onClose={() => setEditing(null)}
        onSave={(next) => {
          if (editing?.event === undefined) return;
          saveMatch(replaceBall(match, index, editing.event, next));
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
        onClose={() => setMenu(false)}
        onOvers={(o) => {
          saveMatch(setOvers(match, o));
          toast.show(`Now ${o} overs an innings`, 'success');
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
        onPenalty={(runs) => {
          push({ type: 'penalty', runs });
          toast.show(`${runs} penalty runs to ${s.battingTeam.name}`, 'info');
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
      />
      <ExportSheet
        visible={exporting !== null}
        matches={exporting ?? []}
        onClose={() => setExporting(null)}
        onExport={(format, chosen) => {
          setExporting(null);
          if (format === 'pdf') exportPdf(chosen);
          else exportMatches(chosen);
        }}
      />
      <MomentFlash moment={moment} />
      {toast.element}
      <WicketSheet
        visible={wicketFor !== undefined}
        match={match}
        s={s}
        preset={wicketFor ?? null}
        onClose={() => setWicketFor(undefined)}
        onConfirm={(e) => {
          setWicketFor(undefined);
          push(e, 320);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.sm },
  headerTitle: { flex: 1, color: colors.text, fontSize: 20, fontFamily: font.poster, textAlign: 'center', textTransform: 'uppercase' },

  hero: { borderRadius: radius.xl, padding: space.xl, overflow: 'hidden', borderWidth: 1, borderColor: colors.borderHi },
  heroGhost: { right: -30, bottom: -26 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.accent,
    paddingHorizontal: 10,
    height: 24,
    borderRadius: radius.sm,
    transform: [{ skewX: '-8deg' }],
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.danger },
  liveText: { ...type.label, fontSize: 11, color: colors.onAccent },
  heroOvers: { color: colors.muted, fontSize: 18, fontFamily: font.poster, ...type.num },
  heroTeam: { ...type.poster, color: colors.muted, fontSize: 22, marginTop: space.lg },
  heroScoreRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  scoreWrap: { flexDirection: 'row', alignItems: 'flex-end', flexShrink: 1 },
  heroScore: { ...type.display, color: colors.text },
  heroWickets: { fontFamily: font.posterBlack, fontSize: 56, lineHeight: 74, color: colors.faint, marginLeft: 2 },
  heroStats: { gap: space.sm, alignItems: 'flex-end', paddingBottom: 14 },
  stat: { alignItems: 'flex-end' },
  statLabel: { ...type.label, fontSize: 10, color: colors.faint },
  statValue: { color: colors.text, fontSize: 26, fontFamily: font.posterBlack, lineHeight: 28, ...type.num },
  progress: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: space.md,
  },
  progressFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: colors.accent },
  notch: { position: 'absolute', top: 0, bottom: 0, width: 2, marginLeft: -1, backgroundColor: colors.bg },
  heroFoot: { color: colors.muted, fontSize: 13, fontFamily: font.semibold, marginTop: space.md },
  chase: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: 8,
    marginTop: space.md,
  },
  chaseText: { color: colors.onAccent, fontSize: 18, fontFamily: font.poster },
  chaseBig: { fontSize: 26, fontFamily: font.posterBlack },
  chaseTarget: { color: colors.onAccent, fontSize: 14, fontFamily: font.poster, opacity: 0.7 },

  rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  batter: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.md, paddingRight: space.lg, gap: space.md },
  strikeBar: { width: 4, alignSelf: 'stretch', backgroundColor: 'transparent', borderTopRightRadius: 2, borderBottomRightRadius: 2 },
  batterName: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { color: colors.muted, fontSize: 17, fontFamily: font.bold, flexShrink: 1 },
  batterMeta: { color: colors.faint, fontSize: 12, fontFamily: font.semibold, marginTop: 2, ...type.num },
  batterRuns: { color: colors.muted, fontSize: 40, lineHeight: 42, fontFamily: font.posterBlack, ...type.num },
  batterBalls: { fontSize: 18, fontFamily: font.poster, color: colors.faint },
  bowlerRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  bowlerIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
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
  },
  scorebugLabel: { borderRightWidth: 1, borderRightColor: colors.border, paddingRight: space.md },
  scorebugTitle: { color: colors.text, fontSize: 18, fontFamily: font.poster },
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
  bar: { width: '100%', maxWidth: 22, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.22)' },
  barCurrent: { borderWidth: 1.5, borderColor: colors.accent, backgroundColor: colors.accentDim },
  barWickets: { flexDirection: 'row', gap: 2, height: 8, marginTop: 3 },
  wicketDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.danger },
  barLabel: { color: colors.faint, fontSize: 10, fontFamily: font.bold, ...type.num },

  pickerTitle: { ...type.title, fontSize: 40, lineHeight: 42, color: colors.text, marginTop: space.md },
  pickerSub: { color: colors.muted, fontSize: 14, fontFamily: font.medium, marginTop: 2 },
  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    height: 62,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pickNum: { color: colors.accent, fontSize: 24, fontFamily: font.posterBlack, width: 32, ...type.num },
  pickName: { color: colors.text, fontSize: 16, fontFamily: font.bold },
  pickNote: { color: colors.muted, fontSize: 12, fontFamily: font.medium, marginTop: 1 },
  openersPicked: { flexDirection: 'row', marginTop: space.sm },

  padWrap: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: 2,
    borderColor: colors.accent,
    paddingHorizontal: space.md,
    paddingTop: space.md,
  },
  pad: { gap: space.sm },
  extrasRow: { flexDirection: 'row', gap: 6 },
  extraKey: {
    height: 38,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderHi,
    backgroundColor: colors.surfaceHi,
    alignItems: 'center',
    justifyContent: 'center',
  },
  extraKeyOn: { backgroundColor: colors.violet, borderColor: colors.violet },
  extraText: { color: colors.muted, fontSize: 13, fontFamily: font.bold },
  modeHint: { ...type.label, fontSize: 10, color: colors.faint, textAlign: 'center', marginVertical: 2 },
  grid: { flexDirection: 'row', gap: space.sm },
  key: {
    height: 66,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceHi,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyFour: { backgroundColor: 'rgba(127,230,255,0.1)', borderColor: colors.cyan, borderWidth: 1.5 },
  keySix: { backgroundColor: colors.accent, borderColor: colors.accent },
  keyMode: { backgroundColor: colors.violetDim, borderColor: 'rgba(185,166,255,0.4)' },
  keyOut: { backgroundColor: colors.danger, borderColor: colors.danger },
  keyText: { color: colors.text, fontSize: 36, lineHeight: 38, fontFamily: font.posterBlack, ...type.num },
  keySub: { fontSize: 9, fontFamily: font.heavy, letterSpacing: 1.2, marginTop: -2, opacity: 0.8 },

  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  editNow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  editNowText: { color: colors.text, fontSize: 16, fontFamily: font.bold },
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
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: 8,
    marginBottom: space.sm,
  },
  bannerTitle: { fontFamily: font.posterBlack, fontSize: 22, color: colors.onAccent },
  bannerBody: { flex: 1, fontFamily: font.bold, fontSize: 12, color: colors.onAccent },
  sheetLabel: { ...type.label, color: colors.muted, marginTop: space.xs },

  result: {
    backgroundColor: colors.accent,
    borderRadius: radius.xl,
    padding: space.xl,
    paddingTop: space.xxl,
    overflow: 'hidden',
    alignItems: 'flex-start',
  },
  resultEyebrow: { ...type.label, color: colors.onAccent, opacity: 0.6, marginTop: space.md },
  resultWinner: { fontFamily: font.posterBlack, fontSize: 64, lineHeight: 62, color: colors.onAccent, textTransform: 'uppercase', letterSpacing: -1.5 },
  resultMargin: { fontFamily: font.poster, fontSize: 24, color: colors.onAccent, textTransform: 'uppercase' },
  resultScores: { alignSelf: 'stretch', marginTop: space.xl, borderTopWidth: 2, borderTopColor: colors.onAccent, paddingTop: space.md, gap: 4 },
  resultScore: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  resultTeam: { color: colors.onAccent, fontFamily: font.bold, fontSize: 15, flex: 1 },
  resultRuns: { color: colors.onAccent, fontFamily: font.posterBlack, fontSize: 28, ...type.num },
  resultOvers: { fontFamily: font.poster, fontSize: 16, opacity: 0.6 },
  potm: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.onAccent,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    marginTop: space.lg,
  },
  seriesLine: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 2,
    borderColor: colors.onAccent,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: 8,
    marginTop: space.sm,
  },
  seriesLineText: { fontFamily: font.poster, fontSize: 20, color: colors.onAccent, textTransform: 'uppercase' },
  potmLabel: { ...type.label, fontSize: 9, color: colors.accent },
  potmName: { fontFamily: font.poster, fontSize: 24, color: colors.text, textTransform: 'uppercase' },
  potmLine: { fontFamily: font.poster, fontSize: 18, color: colors.text, ...type.num },
  exportHint: { color: colors.faint, fontSize: 12, fontFamily: font.regular, textAlign: 'center', marginTop: -4 },

  breakCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: colors.accent,
    padding: space.xl,
    overflow: 'hidden',
  },
  breakEyebrow: { ...type.label, color: colors.accent },
  breakTarget: { fontFamily: font.posterBlack, fontSize: 120, lineHeight: 116, color: colors.text, letterSpacing: -3, ...type.num },
  breakTitle: { ...type.poster, fontSize: 26, color: colors.text },
  breakSub: { color: colors.muted, fontSize: 13, fontFamily: font.medium, marginTop: space.sm },
});
