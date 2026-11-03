import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Fragment, useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';

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
import { Platform, ScrollView, Share, StyleSheet, Text, TextInput, View, type ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BallEditSheet, fixBall } from '../../../components/BallEditSheet.tsx';
import { useAccess, useClubSync } from '../../../store/sync.tsx';
import { usePrefs } from '../../../store/prefs.ts';
import { PlayerAvatar } from '../../../components/Avatar.tsx';
import { OverEditSheet } from '../../../components/OverEditSheet.tsx';
import { NameSuggestions } from '../../../components/NameSuggestions.tsx';
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
  SectionLabel,
  Segmented,
  Sheet,
  Stepper,
  tap,
  useToast,
  type IconName,
  type Moment,
} from '../../../components/ui.tsx';
import {
  addEvent,
  addPlayer,
  allOutAt,
  canUndo,
  movePlayer,
  chaseTargetInfo,
  describeEvent,
  highlights,
  matchState,
  oversLeft,
  oversText,
  playerName,
  replaceOver,
  scoringLock,
  setOvers,
  startSuperOver,
  undo,
  type BallView,
  type InningsState,
  type MatchState,
} from '../../../engine/engine.ts';
import { plural } from '../../../engine/text.ts';
import { Confetti, GrowBar, PopIn, Pulse, Sheen, Ticker } from '../../../components/motion.tsx';
import { BallByBall, Partnerships, RunRace } from '../../../components/MatchCharts.tsx';
import { Columns, Page, useLayout } from '../../../components/layout.tsx';
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

/** The batters and bowler. Without `onSwap` and `onRetire` it's to watch only. `big`: larger photos on a tablet or laptop. */
function Crease({
  match,
  s,
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
            <PlayerAvatar name={playerName(match, id)} size={big ? 44 : 32} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={styles.batterName}>
                <Text numberOfLines={1} style={[styles.name, onStrike && { color: colors.text }]}>
                  {playerName(match, id)}
                </Text>
                {onStrike && <MaterialCommunityIcons name="cricket" size={15} color={colors.accentInk} />}
                {onRetire && (
                  <PressableScale accessibilityLabel={`Retire ${playerName(match, id)}`} hitSlop={7} onPress={() => onRetire(id)} style={styles.retire}>
                    <Text style={styles.retireText}>Retire</Text>
                  </PressableScale>
                )}
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
        {s.bowler ? (
          <View>
            <PlayerAvatar name={playerName(match, s.bowler)} size={big ? 44 : 34} />
            <View style={styles.bowlerBadge}>
              <MaterialCommunityIcons name="baseball" size={10} color={colors.danger} />
            </View>
          </View>
        ) : (
          <View style={styles.bowlerIcon}>
            <MaterialCommunityIcons name="baseball" size={16} color={colors.danger} />
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
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
        {s.nonStriker && onSwap && <IconButton icon="swap-vertical" label="Swap strike" onPress={onSwap} />}
      </View>
    </Card>
  );
}

// ─── This over and over-by-over ──────────────────────────────────────────────

/** A ball chip and the gap after it, in the over strip. */
const CHIP_STEP = 36 + 4;

/**
 * This over's balls; tap one to fix it. Before the first ball of a new over, the last over stays editable. `stacked`
 * puts the label above the balls, for the narrow scoring panel on a big screen.
 */
function ThisOver({ s, onEdit, stacked }: { s: InningsState; onEdit?: (b: BallView) => void; stacked?: boolean }) {
  const current = s.overs[s.overs.length - 1] ?? [];
  const showLast = current.length === 0 && s.overs.length > 1;
  const balls = showLast ? s.overs[s.overs.length - 2] : current;
  const totals = s.overTotals[s.overTotals.length - (showLast ? 2 : 1)];
  const slots = showLast ? 0 : 6 - (s.legalBalls % 6);
  const overNo = Math.floor(s.legalBalls / 6) + (showLast ? 0 : 1);
  // On a narrow phone the over runs off the edge: keep the newest ball (and the slot after it) in view.
  const strip = useRef<ScrollViewInstance>(null);
  const [stripWidth, setStripWidth] = useState(0);
  useEffect(() => {
    if (stripWidth) strip.current?.scrollTo({ x: Math.max(0, (balls.length + 1) * CHIP_STEP - stripWidth), animated: true });
  }, [balls.length, stripWidth]);
  return (
    <View style={[styles.scorebug, stacked && styles.scorebugStacked]}>
      <View style={[styles.scorebugLabel, stacked && styles.scorebugLabelStacked]}>
        <Text style={styles.scorebugTitle}>{showLast ? 'LAST OVER' : `OVER ${overNo}`}</Text>
        <Text style={styles.scorebugRuns}>{totals?.runs ?? 0} runs{onEdit ? ' · tap to fix' : ''}</Text>
      </View>
      <ScrollView
        ref={strip}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={stacked ? undefined : { flex: 1 }}
        contentContainerStyle={styles.overBalls}
        onLayout={(e) => setStripWidth(e.nativeEvent.layout.width)}
      >
        {balls.map((b, i) => (
          <PressableScale key={`${s.overs.length}-${i}`} scaleTo={0.85} hitSlop={4} accessibilityLabel={`Fix ball ${i + 1}`} disabled={!onEdit} dimWhenDisabled={false} onPress={() => onEdit?.(b)}>
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

/** A late arrival joins a side: their name, with the squad's names to pick from. `teamId` fixes the side. */
function LateArrival({ match, teamId, onAdd }: { match: Match; teamId?: string; onAdd: (teamId: string, name: string) => void }) {
  const [team, setTeam] = useState(teamId ?? match.teams[0].id);
  const [name, setName] = useState('');
  const side = match.teams.find((t) => t.id === team) ?? match.teams[0];
  return (
    <Card style={{ gap: space.sm }}>
      {!teamId && <Segmented value={team} onChange={setTeam} options={match.teams.map((t) => ({ value: t.id, label: t.name }))} />}
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Their name"
        placeholderTextColor={colors.faint}
        style={styles.input}
        autoCapitalize="words"
        maxLength={24}
      />
      <NameSuggestions value={name} taken={match.teams.flatMap((t) => t.players.map((p) => p.name))} onPick={setName} />
      <Button
        variant="ghost"
        label={teamId ? `Add to ${side.name}` : 'Add to the side'}
        icon="person-add-outline"
        disabled={!name.trim()}
        onPress={() => {
          onAdd(side.id, name.trim());
          setName('');
        }}
      />
    </Card>
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
  canDelete,
  onBowlerChange,
  onMovePlayer,
  onFixOver,
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
  /** Only the admin deletes a match. */
  canDelete: boolean;
  /** A new bowler finishes the over (the one bowling it is hurt or taken off). */
  onBowlerChange: (bowler: string) => void;
  /** A player switches to the other side. */
  onMovePlayer: (playerId: string) => void;
  /** Open one over of an innings to fix it. */
  onFixOver: (inningsIndex: number, over: number) => void;
  inningsLabel: string;
  /** Average first-innings score at this length, for DLS. */
  dlsG?: number;
  /** In a super over the overs and target are fixed: those parts of the menu go. */
  superOver: boolean;
}) {
  const [overs, setOversDraft] = useState(match.rules.overs);
  const [target, setTargetDraft] = useState(0);
  const [arming, setArming] = useState(false);
  const original = match.originalOvers ?? match.rules.overs;
  const midOver = s.status === 'live' && s.bowler !== null && (s.overs[s.overs.length - 1]?.length ?? 0) > 0;
  // What DLS would set if the overs changed to the draft value, and what stands now.
  const preview = overs !== match.rules.overs ? setOvers(match, overs, dlsG) : match;
  const firstRuns = matchState(preview).innings[0];
  const willAffectTarget = firstRuns.status === 'done' || matchState(match).current === 0;
  const dls = firstInningsRuns !== null || willAffectTarget ? chaseTargetInfo(preview, firstRuns.runs) : null;
  const now = firstInningsRuns !== null ? chaseTargetInfo(match, firstInningsRuns) : null;
  // Every innings with a ball in it: any of its overs can be put right while the match is on.
  const fixable = matchState(match)
    .innings.map((inn, index) => ({ index, inn }))
    .filter(({ inn }) => inn.overs.some((o) => o.length > 0));
  useEffect(() => {
    if (visible) {
      setOversDraft(match.rules.overs);
      setTargetDraft(firstInningsRuns !== null ? chaseTargetInfo(match, firstInningsRuns).target : 1);
      setArming(false);
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
        <LateArrival match={match} onAdd={onAddPlayer} />

        {fixable.length > 0 && (
          <>
            <Text style={styles.sheetLabel}>Fix an over</Text>
            <Card style={{ gap: space.sm }}>
              <Text style={styles.editNote}>Scored something wrong earlier? Open the over, put it right, and everything after it follows.</Text>
              {fixable.map(({ index: i, inn }) => (
                <View key={i} style={{ gap: 6 }}>
                  <Text style={styles.switchTeam}>{i >= 2 ? `Super over · ${inn.battingTeam.name}` : inn.battingTeam.name}</Text>
                  <View style={styles.wrap}>
                    {inn.overs.map((o, n) =>
                      o.length ? <Chip key={n} label={`Over ${n + 1}`} icon="create-outline" onPress={() => onFixOver(i, n)} /> : null,
                    )}
                  </View>
                </View>
              ))}
            </Card>
          </>
        )}

        <Text style={styles.sheetLabel}>Umpire’s call</Text>
        <Button variant="ghost" label="Dead ball" icon="hand-left-outline" onPress={onDeadBall} />

        <Button
          variant="danger"
          label={arming ? 'Tap again to end it' : `End ${inningsLabel} now`}
          icon="flag-outline"
          onPress={() => (arming ? onEndInnings() : setArming(true))}
          style={{ marginTop: space.sm }}
        />

        {canDelete && (
          <>
            <Text style={styles.sheetLabel}>Called off</Text>
            <Text style={styles.editNote}>Rained off, or just a test? Delete the match. It won’t count in anyone’s numbers.</Text>
            <Button variant="ghost" label="Delete this match" icon="trash-outline" onPress={onDelete} />
          </>
        )}
      </ScrollView>
    </Sheet>
  );
}

/** Runs in each of the last `max` overs (more on a big screen). */
function OverChart({ s, max = 12 }: { s: InningsState; max?: number }) {
  const totals = s.overTotals.slice(-max);
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

// ─── Big screens: the scorecard beside the scoring ───────────────────────────

const sr = (runs: number, balls: number) => (balls ? ((runs * 100) / balls).toFixed(0) : '–');

/** One table line: a name and its figures, the last one a little wider. */
function MiniRow({ name, cells, head, strong, dim }: { name: ReactNode; cells: (string | number)[]; head?: boolean; strong?: number; dim?: boolean }) {
  return (
    <View style={[styles.mcRow, head && styles.mcHead]}>
      <View style={{ flex: 1, minWidth: 0 }}>{typeof name === 'string' ? <Text numberOfLines={1} style={head ? [styles.mcTh, styles.mcThName] : [styles.mcName, dim && { color: colors.muted }]}>{name}</Text> : name}</View>
      {cells.map((c, i) => (
        <Text
          key={i}
          style={[head ? styles.mcTh : styles.mcTd, i === cells.length - 1 && styles.mcLast, !head && i === strong && styles.mcStrong]}
        >
          {c}
        </Text>
      ))}
    </View>
  );
}

/** An innings as a short scorecard: everyone who batted and bowled, and the extras. The full one is a tap away. */
function MiniScorecard({ match, s, title, onOpen, flush }: { match: Match; s: InningsState; title: string; onOpen?: () => void; flush?: boolean }) {
  const extras = s.extras.wide + s.extras.noball + s.extras.bye + s.extras.legbye + s.extras.penalty;
  const atCrease = s.status === 'done' ? [] : [s.striker, s.nonStriker];
  return (
    <View>
      <SectionLabel
        flush={flush}
        right={
          onOpen && (
            <PressableScale hitSlop={12} onPress={onOpen} accessibilityLabel="Full scorecard">
              <Text style={styles.mcLink}>Full scorecard</Text>
            </PressableScale>
          )
        }
      >
        {title}
      </SectionLabel>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <View style={styles.mcTotal}>
          <Text numberOfLines={1} style={styles.mcTeam}>
            {s.battingTeam.name}
          </Text>
          <Text style={styles.mcRuns}>
            {s.runs}/{s.wickets}
            <Text style={styles.mcOvers}>  {oversText(s.legalBalls)} ov</Text>
          </Text>
        </View>
        <MiniRow head name="BATTER" cells={['R', 'B', '4s', '6s', 'SR']} />
        {s.batters.map((b) => {
          const notOut = !b.out && !b.retired;
          return (
            <MiniRow
              key={b.id}
              strong={0}
              dim={!notOut}
              name={
                <Text numberOfLines={1} style={[styles.mcName, !notOut && { color: colors.muted }, notOut && atCrease.includes(b.id) && { color: colors.accentInk }]}>
                  {playerName(match, b.id)}
                  {notOut && atCrease.includes(b.id) ? '*' : ''}
                  {b.retired && !b.out ? <Text style={styles.mcHow}>  retired</Text> : null}
                </Text>
              }
              cells={[b.runs, b.balls, b.fours, b.sixes, sr(b.runs, b.balls)]}
            />
          );
        })}
        {s.batters.length === 0 && <Text style={styles.mcEmpty}>Openers not in yet</Text>}
        <View style={[styles.mcRow, styles.mcExtras]}>
          <Text style={[styles.mcName, { flex: 1, color: colors.muted }]}>
            Extras{' '}
            <Text style={styles.mcHow}>
              wd {s.extras.wide}, nb {s.extras.noball}, b {s.extras.bye}, lb {s.extras.legbye}
            </Text>
          </Text>
          <Text style={[styles.mcTd, styles.mcLast, styles.mcStrong]}>{extras}</Text>
        </View>
        <MiniRow head name="BOWLER" cells={['O', 'M', 'R', 'W', 'ECON']} />
        {s.bowlers.map((b) => (
          <MiniRow
            key={b.id}
            strong={3}
            name={
              <Text numberOfLines={1} style={[styles.mcName, b.id === s.bowler && s.status !== 'done' && { color: colors.accentInk }]}>
                {playerName(match, b.id)}
              </Text>
            }
            cells={[oversText(b.balls), b.maidens, b.runs, b.wickets, rate(b.runs, b.balls)]}
          />
        ))}
        {s.bowlers.length === 0 && <Text style={styles.mcEmpty}>No overs bowled yet</Text>}
      </Card>
    </View>
  );
}

/** Both sides, before a ball is bowled: who's playing, with their photos. */
function Sides({ match }: { match: Match }) {
  return (
    <View>
      <SectionLabel>Today’s sides</SectionLabel>
      <Card style={styles.sides}>
        {match.teams.map((t) => (
          <View key={t.id} style={{ flex: 1, minWidth: 0, gap: space.sm }}>
            <Text numberOfLines={1} style={styles.switchTeam}>
              {t.name} <Text style={{ color: colors.faint }}>· {t.players.length}</Text>
            </Text>
            {t.players.map((p) => (
              <View key={p.id} style={styles.sideRow}>
                <PlayerAvatar name={p.name} size={26} />
                <Text numberOfLines={1} style={styles.sideName}>
                  {p.name}
                </Text>
              </View>
            ))}
          </View>
        ))}
      </Card>
    </View>
  );
}

/** The overs before this one, newest first, for the scoring panel on a big screen. */
function RecentOvers({ match, s, count }: { match: Match; s: InningsState; count: number }) {
  // The over being bowled is on the strip above; before its first ball, the strip shows the last one instead.
  const current = s.overs[s.overs.length - 1] ?? [];
  const skip = current.length === 0 && s.overs.length > 1 ? 2 : 1;
  const done = s.overs.slice(0, Math.max(0, s.overs.length - skip));
  if (!done.length) return null;
  const shown = done.map((balls, i) => ({ balls, i })).slice(-count).reverse();
  return (
    <View style={{ gap: space.sm }}>
      <Text style={styles.nextLabel}>EARLIER OVERS</Text>
      {shown.map(({ balls, i }) => (
        <View key={i} style={styles.recentRow}>
          <Text style={styles.recentNo}>{i + 1}</Text>
          <View style={styles.recentBalls}>
            {balls.map((b, j) => (
              <BallChip key={j} ball={b} size={26} />
            ))}
          </View>
          <Text numberOfLines={1} style={styles.recentMeta}>
            {plural(s.overTotals[i]?.runs ?? 0, 'run')} · {playerName(match, s.overBowlers[i]?.[0] ?? null)}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Above the pad on a big screen: which ball is next, and who's bowling it to whom. */
function NextBall({ match, s }: { match: Match; s: InningsState }) {
  const ball = `${Math.floor(s.legalBalls / 6)}.${(s.legalBalls % 6) + 1}`;
  return (
    <View style={styles.nextBall}>
      <Text style={styles.nextLabel}>NEXT BALL · {ball}</Text>
      <View style={styles.nextRow}>
        {s.bowler && <PlayerAvatar name={playerName(match, s.bowler)} size={28} />}
        <Text numberOfLines={1} style={styles.nextText}>
          {s.bowler ? playerName(match, s.bowler) : 'Pick a bowler'}
          <Text style={styles.nextTo}>  to  </Text>
          {playerName(match, s.striker)}
        </Text>
        {s.striker && <PlayerAvatar name={playerName(match, s.striker)} size={28} />}
      </View>
    </View>
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
  onSomeoneElse,
  columns = 1,
}: {
  title: string;
  subtitle?: string;
  match: Match;
  ids: string[];
  disabled?: string[];
  note?: (id: string) => string | undefined;
  onPick: (id: string) => void;
  /** A late arrival who isn't on the list yet: add them to the side. */
  onSomeoneElse?: () => void;
  /** Two on a line on a tablet held upright, where one would stretch across the screen. */
  columns?: 1 | 2;
}) {
  const cell = columns === 2 ? styles.pickCell : undefined;
  return (
    <FadeIn>
      <Text style={styles.pickerTitle}>{title}</Text>
      {subtitle && <Text style={styles.pickerSub}>{subtitle}</Text>}
      <View style={[{ gap: space.sm, marginTop: space.md }, columns === 2 && styles.pickGrid]}>
        {ids.map((id, i) => {
          const off = disabled.includes(id);
          const extra = note?.(id);
          return (
            <FadeIn key={id} delay={i * 35} style={cell}>
              <PressableScale disabled={off} haptic="medium" scaleTo={0.97} onPress={() => onPick(id)} style={styles.pickRow}>
                <Text style={styles.pickNum}>{String(i + 1).padStart(2, '0')}</Text>
                <PlayerAvatar name={playerName(match, id)} size={34} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.pickName}>{playerName(match, id)}</Text>
                  {extra && <Text style={styles.pickNote}>{extra}</Text>}
                </View>
                <Ionicons name={off ? 'lock-closed' : 'arrow-forward'} size={18} color={off ? colors.faint : colors.accent} />
              </PressableScale>
            </FadeIn>
          );
        })}
        {onSomeoneElse && (
          <FadeIn delay={ids.length * 35} style={cell}>
            <PressableScale scaleTo={0.97} onPress={onSomeoneElse} style={[styles.pickRow, styles.pickElse]} accessibilityLabel="Someone else: add a late arrival">
              <Ionicons name="add" size={20} color={colors.accentInk} />
              <View style={{ flex: 1 }}>
                <Text style={styles.pickName}>Someone else</Text>
                <Text style={styles.pickNote}>A late arrival, not on the list yet</Text>
              </View>
            </PressableScale>
          </FadeIn>
        )}
      </View>
    </FadeIn>
  );
}

// ─── Scoring pad ─────────────────────────────────────────────────────────────

type PadMode = Extra | 'bouncer';

/** What OUT was pressed with: an extra picked first, or a bounce and its call. */
type Armed = { mode: Extra | null; bouncer?: 'fair' | 'wide' };

const EXTRAS: { value: PadMode; label: string }[] = [
  { value: 'wide', label: 'Wide' },
  { value: 'noball', label: 'No ball' },
  { value: 'bouncer', label: 'Bounce' },
];

const MODE_HINT: Record<Extra, string> = {
  wide: 'WIDE · tap Wd to add it',
  noball: 'NO BALL · tap the runs off the bat',
  bye: 'BYE · tap the runs they ran',
  legbye: 'LEG BYE · tap the runs they ran',
};

/** How the next bounce counts: the umpire's call (fair or wide) while the over's allowance lasts, then called. */
const ordinal = (n: number) => `${n}${[, 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] ?? 'th'}`;

type Bounce = { choice: boolean; hint: string; calledAs: 'wide' | 'noball' };

function bounceInfo(match: Match, s: InningsState): Bounce {
  const rule = match.rules.bouncer ?? { fair: 1, calledAs: 'noball' as const };
  const left = rule.fair - s.bouncersThisOver;
  return left > 0
    ? { choice: true, calledAs: rule.calledAs, hint: `BOUNCE · umpire’s call: fair or wide · ${left === 1 ? 'the next one is' : `${left} left, then`} a ${rule.calledAs === 'wide' ? 'wide' : 'no ball'}` }
    : {
        choice: false,
        calledAs: rule.calledAs,
        hint: `BOUNCE · ${ordinal(s.bouncersThisOver + 1)} this over: a ${rule.calledAs === 'wide' ? 'wide · tap Wd' : 'no ball · tap the runs'}`,
      };
}

function Key({
  label,
  sub,
  onPress,
  disabled,
  variant = 'plain',
  height = 66,
  icon,
  kbd,
}: {
  label: string;
  sub?: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'plain' | 'four' | 'six' | 'out' | 'mode';
  height?: number;
  /** Shown instead of the label (the label still names it for screen readers). */
  icon?: ComponentProps<typeof Ionicons>['name'];
  /** Its key on a keyboard, in the corner (laptops). */
  kbd?: string;
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
        style={[v[0], { height }]}
      >
        {icon ? (
          <Ionicons name={icon} size={26} color={v[1]} />
        ) : (
          <Text style={[styles.keyText, { color: v[1] }, height > 70 && styles.keyTextBig, label.length > 2 && { fontSize: 26 }]}>{label}</Text>
        )}
        {sub && <Text style={[styles.keySub, { color: v[1] }]}>{sub}</Text>}
        {kbd && <Text style={[styles.kbd, { color: v[1] }]}>{kbd}</Text>}
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

/** The pad's keys on a keyboard, for the extras row. */
const EXTRA_KBD: Partial<Record<PadMode, string>> = { wide: 'D', noball: 'N' };

function Pad({
  onBall,
  onWicket,
  bounce,
  extraRun,
  big,
  shortcuts,
  hints,
  onUndo,
}: {
  onBall: (b: BallEvent) => void;
  /** OUT: the extra or bounce armed before it goes with the wicket, so it isn't lost. */
  onWicket: (armed: Armed) => void;
  /** How a bounce would count right now. */
  bounce: Bounce;
  /** The wide's run, from the rules. */
  extraRun: number;
  /** Taller keys, for a tablet or laptop. */
  big?: boolean;
  /** Listen to the keyboard: 0–6 runs, W out, D wide, N no ball, Esc clears, U or Backspace undoes. */
  shortcuts?: boolean;
  /** Show each key's keyboard key in its corner. */
  hints?: boolean;
  /** Undo from the keyboard; missing when there's nothing to undo. */
  onUndo?: () => void;
}) {
  const [mode, setMode] = useState<PadMode | null>(null);
  const [call, setCall] = useState<'fair' | 'wide'>('fair');
  const score = (r: number) => {
    tap(r >= 4 ? 'heavy' : 'light');
    onBall(mode === 'bouncer' ? { type: 'ball', runs: r, bouncer: bounce.choice ? call : 'fair' } : { type: 'ball', runs: r, extra: mode ?? undefined });
    setMode(null);
    setCall('fair');
  };
  const out = () => {
    tap('warning');
    onWicket(mode === 'bouncer' ? { mode: null, bouncer: bounce.choice ? call : 'fair' } : { mode });
    setMode(null);
    setCall('fair');
  };
  const byes = mode === 'bye' || mode === 'legbye';
  // A wide is the one wide run the rules give and nothing more (turf: nobody runs on a wide). A bounce called wide too.
  const wide = mode === 'wide' || (mode === 'bouncer' && (bounce.choice ? call === 'wide' : bounce.calledAs === 'wide'));
  const blocked = (r: number) => (byes && r === 0) || (wide && r > 0);
  const keyHeight = big ? 84 : undefined;
  const runKey = (r: number) => {
    const boundary = !mode && (r === 4 || r === 6);
    const kbd = hints ? String(r) : undefined;
    if (wide && r === 0)
      return <Key key={r} label="Wd" sub={extraRun ? `+${extraRun} RUN` : 'NO RUN'} variant="mode" height={keyHeight} kbd={kbd} onPress={() => score(0)} />;
    return (
      <Key
        key={r}
        label={String(r)}
        sub={!mode ? (r === 0 ? 'DOT' : r === 4 ? 'FOUR' : r === 6 ? 'SIX' : undefined) : undefined}
        variant={mode ? 'mode' : boundary ? (r === 4 ? 'four' : 'six') : 'plain'}
        disabled={blocked(r)}
        height={keyHeight}
        kbd={kbd}
        onPress={() => score(r)}
      />
    );
  };

  // The keyboard does what the keys do. Read fresh each render, so it always sees the mode picked.
  const onKey = useRef<(e: KeyboardEvent) => void>(() => {});
  onKey.current = (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
    const el = e.target as HTMLElement | null;
    if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
    const k = e.key.toLowerCase();
    if (/^[0-46]$/.test(k)) {
      if (!blocked(Number(k))) score(Number(k));
    } else if (k === 'w') out();
    else if (k === 'd' || k === 'n') setMode((m) => (m === (k === 'd' ? 'wide' : 'noball') ? null : k === 'd' ? 'wide' : 'noball'));
    else if (k === 'escape') {
      setMode(null);
      setCall('fair');
    } else if ((k === 'u' || k === 'backspace') && onUndo) onUndo();
    else return;
    e.preventDefault();
  };
  useEffect(() => {
    if (!shortcuts || Platform.OS !== 'web' || typeof document === 'undefined') return;
    const listen = (e: KeyboardEvent) => onKey.current(e);
    document.addEventListener('keydown', listen);
    return () => document.removeEventListener('keydown', listen);
  }, [shortcuts]);

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
              style={[styles.extraKey, big && { height: 52 }, on && styles.extraKeyOn]}
            >
              <Text numberOfLines={1} style={[styles.extraText, big && { fontSize: 15 }, on && { color: colors.onAccent }]}>
                {e.label}
              </Text>
              {hints && EXTRA_KBD[e.value] && <Text style={[styles.kbd, on && { color: colors.onAccent }]}>{EXTRA_KBD[e.value]}</Text>}
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
      {/* OUT is two keys wide and Undo lives above the pad: nothing to mistake for it next to the runs. */}
      <View style={styles.grid}>
        {runKey(4)}
        {runKey(6)}
        <View style={{ flex: 2 }}>
          <Key label="OUT" variant="out" height={keyHeight} kbd={hints ? 'W' : undefined} onPress={out} />
        </View>
      </View>
    </View>
  );
}

/** Undo and Redo, on their own above the pad (or above the page between balls), with the club sync beside them. */
function UndoBar({
  canUndo: undoable,
  canRedo,
  onUndo,
  onRedo,
  label = 'Undo last ball',
}: {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  label?: string;
}) {
  return (
    <View style={styles.undoBar}>
      <PressableScale accessibilityLabel={label} disabled={!undoable} hitSlop={4} scaleTo={0.94} onPress={onUndo} style={styles.undoPill}>
        <Ionicons name="arrow-undo" size={16} color={colors.text} />
        <Text style={styles.undoText}>Undo</Text>
      </PressableScale>
      {canRedo && (
        <PressableScale accessibilityLabel="Redo the ball just undone" hitSlop={4} scaleTo={0.94} onPress={onRedo} style={styles.undoPill}>
          <Ionicons name="arrow-redo" size={16} color={colors.text} />
          <Text style={styles.undoText}>Redo</Text>
        </PressableScale>
      )}
      <View style={{ flex: 1 }} />
      <SyncBadge />
    </View>
  );
}

/** Whether this phone's balls have reached the club. Nothing where there's no club sync (a test copy, signed out). */
function SyncBadge() {
  const sync = useClubSync();
  if (sync.status === 'unavailable' || !sync.user) return null;
  const waiting = !sync.online || sync.pending;
  return (
    <View style={styles.syncBadge} accessibilityLiveRegion="polite">
      <Ionicons name={waiting ? 'cloud-offline-outline' : 'cloud-done-outline'} size={15} color={waiting ? colors.gold : colors.muted} />
      <Text style={[styles.syncText, waiting && { color: colors.gold }]}>{waiting ? 'Waiting for signal' : 'Saved to club'}</Text>
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

type Delivery = 'legal' | 'wide' | 'noball';

/** How a batter can be out off each kind of delivery: off a wide only stumped, run out or hit wicket; off a no ball only run out. */
const OUT_ON: Record<Delivery, WicketKind[] | null> = {
  legal: null,
  wide: ['stumped', 'runout', 'hitwicket'],
  noball: ['runout'],
};

const RETIRE_HOW = [
  { value: 'hurt', label: 'Retired hurt' },
  { value: 'out', label: 'Retired out' },
] as const;

function WicketSheet({
  visible,
  match,
  s,
  armed,
  retiring,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  match: Match;
  s: InningsState;
  /** What was picked on the pad before OUT: it stays with the wicket. */
  armed: Armed;
  /** Opened from a batter's Retire: straight to retiring them. */
  retiring?: string | null;
  onClose: () => void;
  onConfirm: (e: InningsEvent) => void;
}) {
  const [kind, setKind] = useState<WicketKind>('bowled');
  const [who, setWho] = useState<'striker' | 'nonStriker'>('striker');
  const [fielder, setFielder] = useState<string | undefined>();
  const [runs, setRuns] = useState('0');
  const [delivery, setDelivery] = useState<Delivery>('legal');
  const [retireHow, setRetireHow] = useState<'hurt' | 'out'>('hurt');
  const [runsFrom, setRunsFrom] = useState<'bat' | 'byes'>('bat');
  const preset = armed.mode;
  const bouncer = armed.bouncer;
  // A bounce is called by the umpire within the over's allowance, and by the rules past it: the call decides the delivery.
  const pastAllowance = s.bouncersThisOver >= (match.rules.bouncer?.fair ?? 1);
  const bounceAs: Delivery | null = !bouncer ? null : pastAllowance ? (match.rules.bouncer?.calledAs ?? 'noball') : bouncer === 'wide' ? 'wide' : 'legal';

  useEffect(() => {
    if (!visible) return;
    const start: Delivery = bounceAs ?? (preset === 'wide' || preset === 'noball' ? preset : 'legal');
    setKind(retiring ? 'retired' : s.freeHit || start === 'noball' ? 'runout' : start === 'wide' ? 'stumped' : 'bowled');
    setWho(retiring && retiring === s.nonStriker ? 'nonStriker' : 'striker');
    setRetireHow('hurt');
    setFielder(undefined);
    setRuns('0');
    setRunsFrom('bat');
    setDelivery(start);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, preset, bouncer, retiring]);

  const keeper = match.keepers?.[s.bowlingTeam.id];
  useEffect(() => {
    if (kind === 'stumped' && keeper) setFielder(keeper);
  }, [kind, keeper]);
  const chooseWho = kind === 'runout' || kind === 'retired';
  const needsFielder = kind === 'caught' || kind === 'runout' || kind === 'stumped';
  // The delivery can be changed only when nothing on the pad decided it already (a bounce's call does).
  const deliveries: readonly Delivery[] | null = bounceAs
    ? null
    : kind === 'runout'
      ? (['legal', 'wide', 'noball'] as const)
      : kind === 'stumped' || kind === 'hitwicket'
        ? (['legal', 'wide'] as const)
        : null;
  const outId = chooseWho && who === 'nonStriker' ? s.nonStriker : s.striker;
  // A wide or no ball picked first can't be lost: only the ways out that fit it are open (retiring isn't a ball at all).
  const fits = (k: WicketKind) => (k === 'retired' ? delivery === 'legal' && !bouncer : !OUT_ON[delivery] || OUT_ON[delivery]!.includes(k));
  // Runs on a wide: none past the wide's own. Runs run without the bat: byes, not the batter's.
  const runsCount = kind === 'runout' && delivery !== 'wide';
  const byes = runsCount && delivery === 'legal' && runsFrom === 'byes' && Number(runs) > 0;

  const confirm = () => {
    if (!outId) return;
    if (kind === 'retired') {
      // Retiring happens between balls, so it isn't a delivery.
      onConfirm(retireHow === 'out' ? { type: 'retire', batter: outId, out: true } : { type: 'retire', batter: outId });
      return;
    }
    const extra: Extra | undefined = byes ? 'bye' : bouncer || delivery === 'legal' ? undefined : delivery;
    onConfirm({
      type: 'ball',
      runs: runsCount ? Number(runs) : 0,
      extra,
      ...(bouncer ? { bouncer } : {}),
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
              disabled={(s.freeHit && k.value !== 'runout' && k.value !== 'retired') || !fits(k.value)}
              onPress={() => setKind(k.value)}
            />
          ))}
        </View>
        {s.freeHit && <Text style={styles.editNote}>Free hit: only a run out counts on this ball.</Text>}
        {(delivery !== 'legal' || bouncer) && (
          <Text style={styles.editNote}>
            {bouncer ? 'A bounce' : 'A'}
            {delivery === 'wide' ? ' wide' : delivery === 'noball' ? ' no ball' : ''}
            {delivery === 'wide' ? ': out only stumped, run out or hit wicket.' : delivery === 'noball' ? ': out only run out.' : ', and it stays one.'}
          </Text>
        )}

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

        {runsCount && (
          <>
            <Text style={styles.sheetLabel}>Runs completed</Text>
            <Segmented value={runs} onChange={setRuns} options={['0', '1', '2', '3'].map((v) => ({ value: v, label: v }))} />
            {delivery === 'legal' && runs !== '0' && (
              <Segmented
                value={runsFrom}
                onChange={setRunsFrom}
                options={[
                  { value: 'bat', label: 'Off the bat' },
                  { value: 'byes', label: 'Byes' },
                ]}
              />
            )}
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

/** The overs and what DLS knows of them: kept before a change of overs so Undo can put them back. */
type OversSnapshot = Pick<Match, 'rules' | 'interruptions' | 'originalOvers' | 'revisedTarget' | 'dlsG'>;

/** A question asked before something that can't be taken back, on a sheet of its own above everything else. */
type Ask = { title: string; body: string; label: string; icon: IconName; danger?: boolean; run: () => void };

function ConfirmSheet({ ask, onClose }: { ask: Ask | null; onClose: () => void }) {
  return (
    <Sheet visible={ask !== null} onClose={onClose} title={ask?.title ?? ''}>
      {ask && (
        <View style={{ gap: space.md, paddingBottom: space.md }}>
          <Text style={styles.editNote}>{ask.body}</Text>
          <Button
            variant={ask.danger ? 'danger' : 'primary'}
            label={ask.label}
            icon={ask.icon}
            onPress={() => {
              onClose();
              ask.run();
            }}
          />
          <Button variant="ghost" label="Cancel" onPress={onClose} />
        </View>
      )}
    </Sheet>
  );
}

/** The score in one line for the group, e.g. "Copan Strikers 87/3 (9.2) · need 41 off 32". */
function scoreLine(state: MatchState): string {
  const line = (inn: InningsState) => `${inn.battingTeam.name} ${inn.runs}/${inn.wickets} (${oversText(inn.legalBalls)})`;
  if (state.result) return `${state.innings.slice(0, 2).map(line).join(' · ')} · ${state.result}`;
  const s = state.innings[state.current];
  if (s.legalBalls === 0 && state.current >= 1) {
    const before = line(state.innings[state.current - 1]);
    return s.target !== null ? `${before} · ${s.battingTeam.name} need ${s.target} to win` : before;
  }
  if (s.target !== null) return `${line(s)} · need ${Math.max(s.target - s.runs, 0)} off ${s.maxBalls - s.legalBalls}`;
  return `${line(s)} v ${s.bowlingTeam.name}`;
}

/** Send a line of text: the phone's share sheet where there is one, else onto the clipboard. */
async function shareText(text: string): Promise<'shared' | 'copied' | 'cancelled' | 'failed'> {
  if (Platform.OS === 'web') {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ text });
        return 'shared';
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') return 'cancelled';
      }
    }
  } else {
    try {
      const r = await Share.share({ message: text });
      return r.action === Share.dismissedAction ? 'cancelled' : 'shared';
    } catch {
      // Falls through to the clipboard.
    }
  }
  try {
    await Clipboard.setStringAsync(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}

const eventCount = (m: Match) => m.innings.reduce((n, inn) => n + inn.events.length, 0);

export default function LiveMatch() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { match, saveMatch, ready } = useMatch(id);
  const access = useAccess();
  const sync = useClubSync();
  const { prefs } = usePrefs();
  const { matches, deleteMatch } = useMatches();
  const insets = useSafeAreaInsets();
  const layout = useLayout();
  const [openers, setOpeners] = useState<string[]>([]);
  const [wicketFor, setWicketFor] = useState<Armed | undefined>(undefined);
  const [retiring, setRetiring] = useState<string | null>(null);
  const [moment, setMoment] = useState<Moment | null>(null);
  const [editing, setEditing] = useState<BallView | null>(null);
  const [fixingOver, setFixingOver] = useState<{ innings: number; over: number } | null>(null);
  const [menu, setMenu] = useState(false);
  const [ask, setAsk] = useState<Ask | null>(null);
  const [lateFor, setLateFor] = useState<string | null>(null);
  // Only for this visit: balls undone (newest last) for Redo, and the overs before each change of them for Undo.
  const [redo, setRedo] = useState<{ at: number; event: InningsEvent }[]>([]);
  const [oversBefore, setOversBefore] = useState<{ was: OversSnapshot; events: number }[]>([]);
  // At the top here: the bottom of this screen is the scoring pad.
  const toast = useToast('top');
  const { exportAs } = useMatchFiles(toast.show);
  const [exporting, setExporting] = useState<Match[] | null>(null);
  const [sharing, setSharing] = useState(false);
  // One scorer at a time: someone else's balls in the last ten minutes lock the pad here. The clock moves on so the
  // lock lifts once they've stopped.
  const clubUser = sync.status !== 'unavailable' ? sync.user : null;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!clubUser) return;
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, [clubUser?.email]);
  // Nobody wants the screen going dark between balls.
  useScreenAwake();

  if (!match) {
    return (
      <Screen style={{ alignItems: 'center', justifyContent: 'center', gap: space.lg, padding: space.xl }}>
        <Text style={{ color: colors.muted, fontFamily: font.medium }}>{ready ? 'Match not found' : 'Loading…'}</Text>
        {ready && <Button variant="ghost" label="Back to home" icon="home-outline" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />}
      </Screen>
    );
  }

  const state = matchState(match);
  const index = state.current;
  const s = state.innings[index];
  const lock = clubUser && access.score ? scoringLock(match, clubUser.email, now) : null;
  const canScore = access.score && !lock;
  /**
   * Save what was scored here: this phone is the one scoring it (signed in to the club), and a result just reached
   * waits for the scorer to confirm it.
   */
  const commit = (next: Match) => {
    const ended = !state.result && Boolean(matchState(next).result);
    const stamped = clubUser ? { ...next, scoringBy: { email: clubUser.email, name: clubUser.name, at: Date.now() } } : next;
    saveMatch(ended ? { ...stamped, confirmed: false } : stamped);
  };
  // `flashAfter` lets a sheet slide away first, so the moment isn't hidden behind it.
  const push = (e: InningsEvent, flashAfter = 0) => {
    const next = addEvent(match, e);
    const found = highlights(s, matchState(next).innings[index]);
    // A milestone outranks the boundary or wicket that brought it.
    const big = found.find((h) => h.kind === 'hattrick') ?? found.find((h) => h.kind === 'hundred') ?? found.find((h) => h.kind === 'fifty');
    const m: Omit<Moment, 'key'> | null = big
      ? { kind: big.kind as Moment['kind'], caption: playerName(match, big.player) + ('runs' in big ? ` · ${big.runs}*` : '') }
      : momentFor(match, s, e);
    if (m && prefs.celebrate) setTimeout(() => setMoment({ ...m, key: Date.now() }), flashAfter);
    const maiden = found.find((h) => h.kind === 'maiden');
    if (maiden) toast.show(`Maiden over · ${playerName(match, maiden.player)}`, 'info');
    setRedo([]);
    commit(next);
  };

  // A change of overs is undone before any ball, as long as no ball came after it.
  const lastOvers = oversBefore[oversBefore.length - 1];
  const oversUndoable = Boolean(lastOvers) && lastOvers.events === eventCount(match);
  const undoLast = () => {
    tap('medium');
    if (oversUndoable) {
      commit({ ...match, ...lastOvers.was });
      setOversBefore(oversBefore.slice(0, -1));
      toast.show(`Back to ${plural(lastOvers.was.rules.overs, 'over')} an innings`, 'info');
      return;
    }
    // An unstarted super over goes, which puts the match back at the tie.
    if (match.innings.length > 2 && match.innings.slice(2).every((i) => i.events.length === 0)) {
      toast.show('Undid the super over', 'info');
      commit(undo(match));
      return;
    }
    const at = [...match.innings.keys()].reverse().find((i) => match.innings[i].events.length > 0);
    if (at === undefined) return;
    const event = match.innings[at].events[match.innings[at].events.length - 1];
    const prev = undo(match);
    toast.show(`Undid ${describeEvent(match, event, matchState(prev).innings[at].striker)}`, 'info');
    setOpeners([]);
    setRedo([...redo, { at, event }]);
    commit(prev);
  };
  const redoLast = () => {
    const r = redo[redo.length - 1];
    if (!r) return;
    const next = addEvent(match, r.event);
    // Something else was scored since (here or on another phone): the undone ball no longer fits.
    if (index !== r.at || next === match) {
      setRedo([]);
      return;
    }
    tap('medium');
    toast.show(`Redid ${describeEvent(match, r.event, s.striker)}`, 'info');
    setRedo(redo.slice(0, -1));
    commit(next);
  };
  const undoAllowed = !lock && !access.loading && (state.result ? access.admin || (access.score && match.confirmed === false) : access.score);
  const undoBar = undoAllowed && (
    <UndoBar
      canUndo={canUndo(match) || oversUndoable}
      canRedo={redo.length > 0 && !state.result}
      onUndo={undoLast}
      onRedo={redoLast}
      label={oversUndoable ? 'Undo the change of overs' : 'Undo last ball'}
    />
  );

  /** Ask first, on a sheet of its own: anything open closes so the question is never hidden behind it. */
  const confirm = (a: Ask) => {
    setMenu(false);
    setEditing(null);
    setFixingOver(null);
    setAsk(a);
  };

  const changeOvers = (o: number) => {
    let next = setOvers(match, o, dlsG);
    if (next === match) return;
    // A cut that ended the first innings, put back before the chase starts: the first innings opens again. Left to
    // itself the change would count as a cut to the chase and the first innings would stay ended.
    const first = state.innings[0];
    const cutShort =
      index === 1 &&
      match.innings[1].events.length === 0 &&
      !first.endedEarly &&
      first.wickets < allOutAt(match.rules, first.battingTeam) &&
      (match.interruptions ?? []).some((c) => c.innings === 0 && c.after * 6 === first.maxBalls) &&
      o * 6 > first.legalBalls;
    if (cutShort && next.interruptions?.length) {
      const cuts = [...next.interruptions];
      cuts[cuts.length - 1] = { ...cuts[cuts.length - 1], innings: 0, balls: first.legalBalls, wickets: first.wickets };
      next = { ...next, interruptions: cuts };
    }
    setOversBefore([
      ...oversBefore,
      {
        was: { rules: match.rules, interruptions: match.interruptions, originalOvers: match.originalOvers, revisedTarget: match.revisedTarget, dlsG: match.dlsG },
        events: eventCount(match),
      },
    ]);
    commit(next);
    const st = matchState(next);
    // The overs actually set: never fewer than have been bowled.
    const set = next.rules.overs === o ? '' : ` (${plural(Math.ceil(state.innings[index].legalBalls / 6), 'over')} already bowled)`;
    const how = chaseTargetInfo(next, st.innings[0].runs).method === 'dls' ? 'DLS target' : 'Target';
    toast.show(
      st.innings[0].status === 'done' && st.current >= 1
        ? `Now ${plural(next.rules.overs, 'over')}${set} · ${how} ${st.innings[1].target}`
        : `Now ${plural(next.rules.overs, 'over')} an innings${set}`,
      'success',
    );
  };

  const addLate = (teamId: string, name: string) => {
    saveMatch(addPlayer(match, teamId, { id: newId(), name }));
    toast.show(`${name} added`, 'success');
  };

  const shareScore = async () => {
    const how = await shareText(scoreLine(state));
    if (how === 'copied') toast.show('Score copied: paste it in the group', 'success');
    else if (how === 'failed') toast.show('Couldn’t share the score just now', 'error');
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
  // A tablet on its side or a laptop: the scoreboard on the left, the pad (or whoever's to pick) in a panel on the right.
  // A tablet held upright keeps one column, the pad along the foot, and puts things two to a line above it.
  const side = layout.wide && layout.width >= 960 && layout.width > layout.height;
  const panelWidth = layout.desk ? 420 : 380;
  // Is the left of the split wide enough for two things side by side?
  const twoUp = !side || layout.width - layout.gutter * 2 - panelWidth - space.lg >= 640;

  // Everyone sees the break: scorers above the openers, watchers above the line on who's scoring.
  const breakCard =
    freshChase && s.status === 'openers' ? (
      <FadeIn>
        <View style={[styles.breakCard, layout.wide && styles.breakCardWide]}>
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
    ) : null;

  const pickColumns = layout.wide && !side ? 2 : 1;
  let body = null;
  if (state.result) {
    const winner = state.winner ? match.teams.find((t) => t.id === state.winner) : null;
    const margin = winner ? state.result.replace(`${winner.name} won `, '') : '';
    const potm = playerOfTheMatch(match);
    const series = match.series ? seriesState(matches.filter((m) => m.series?.id === match.series!.id)) : null;
    body = (
      <FadeIn>
        {/* A result waits for the scorer's yes: a wrong tap on the last ball can still be undone until then. */}
        {match.confirmed === false &&
          (access.score && !lock ? (
            <Card style={[styles.confirmCard, { marginBottom: space.md }]}>
              <Text style={styles.watchTitle}>Is that the result?</Text>
              <Text style={styles.editNote}>Check the last ball. Undo puts a wrong tap right; once it’s confirmed only the admin can change it.</Text>
              <Button
                label="Confirm result"
                icon="checkmark-circle"
                onPress={() => {
                  saveMatch({ ...match, confirmed: true });
                  setRedo([]);
                  setOversBefore([]);
                  toast.show('Result confirmed', 'success');
                }}
              />
            </Card>
          ) : (
            <Text style={[styles.exportHint, { marginBottom: space.md, marginTop: 0 }]}>Waiting for the scorer to confirm the result.</Text>
          ))}
        <View style={styles.result}>
          <PitchStripes opacity={0.07} />
          {winner && prefs.celebrate && <Confetti height={640} />}
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
          {state.result === 'Match tied' && match.innings.length < 4 && canScore && (
            <Button label={'Play a super over'} icon="flash" onPress={() => saveMatch(startSuperOver(match))} />
          )}
          <Button label="Share result picture" icon="image-outline" onPress={() => setSharing(true)} />
          <Button
            variant="ghost"
            label={'Full scorecard'}
            icon="list"
            onPress={() => router.push({ pathname: '/match/[id]/scorecard', params: { id: match.id } })}
          />
          {!access.score ? null : series?.next ? (
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
        {!layout.wide && breakCard}
        {openers.length > 0 && (
          <View style={styles.openersPicked}>
            <Chip icon="close" label={`Striker: ${playerName(match, openers[0])}`} selected onPress={() => setOpeners([])} />
          </View>
        )}
        <PlayerPicker
          key={openers.length}
          title={openers.length === 0 ? 'Who’s on strike?' : 'And at the other end?'}
          subtitle={`${s.battingTeam.name} · opening pair`}
          columns={pickColumns}
          match={match}
          ids={pool}
          onSomeoneElse={() => setLateFor(s.battingTeam.id)}
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
        columns={pickColumns}
        match={match}
        ids={s.available}
        note={(pid) => (s.batters.find((b) => b.id === pid)?.retired ? 'Retired · can come back' : undefined)}
        onSomeoneElse={() => setLateFor(s.battingTeam.id)}
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
        columns={pickColumns}
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
        onSomeoneElse={() => setLateFor(s.bowlingTeam.id)}
        onPick={(bowler) => push({ type: 'bowler', bowler })}
      />
    );
  }

  // Watching, not scoring: the pickers (openers, bowler, next batter) give way to a line on who's scoring. While it's
  // still being worked out who this is, only a quiet word: a refusal that flips to the pad would only flicker.
  if (!state.result && !canScore) {
    body = (
      <>
        {!layout.wide && breakCard}
        {access.loading ? (
          <Text style={styles.quiet}>Loading…</Text>
        ) : lock ? (
          <Card style={styles.confirmCard}>
            <View style={styles.lockRow}>
              <Ionicons name="lock-closed" size={18} color={colors.gold} />
              <Text style={[styles.watchTitle, { flex: 1 }]} numberOfLines={2}>
                Being scored by {lock.name}
              </Text>
            </View>
            <Text style={styles.editNote}>One scorer at a time, so no ball goes missing. Take over only if {lock.name} has stopped scoring.</Text>
            <Button
              label="Take over"
              icon="hand-right-outline"
              onPress={() => {
                commit(match);
                toast.show('You’re scoring this match now', 'success');
              }}
            />
          </Card>
        ) : (
          <Card style={{ gap: space.sm }}>
            <Text style={styles.watchTitle}>{live ? 'Watching live' : 'Waiting for the next ball'}</Text>
            {access.why && <Text style={styles.editNote}>{access.why}</Text>}
            {sync.canRequest && <Button variant="ghost" label="Get editor access" icon="person-outline" onPress={() => router.push('/profile')} />}
          </Card>
        )}
      </>
    );
  }

  // Every sheet and flash the screen can open, the same on every screen size. Keyed, so turning a tablet round keeps
  // them where they are (a flash doesn't play again, an open sheet stays open).
  const overlays = (
    <Fragment key="overlays">
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
          commit(fixed);
          toast.show(next ? 'Ball fixed. Everything after it is updated.' : 'Ball deleted', 'success');
          setEditing(null);
        }}
      />
      {fixingOver && (
        <OverEditSheet
          key={`${fixingOver.innings}-${fixingOver.over}`}
          match={match}
          s={state.innings[fixingOver.innings]}
          inningsIndex={fixingOver.innings}
          over={fixingOver.over}
          onClose={() => setFixingOver(null)}
          onSave={(draft) => {
            const fixed = replaceOver(match, fixingOver.innings, fixingOver.over, draft);
            if (typeof fixed === 'string') return fixed;
            commit(fixed);
            setFixingOver(null);
            toast.show(`Over ${fixingOver.over + 1} saved. Everything after it is updated.`, 'success');
          }}
        />
      )}
      <MatchMenu
        canDelete={access.admin}
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
          const ends = index < 2 && s.status !== 'done' && matchState(next).innings[index].status === 'done';
          confirm({
            title: `${plural(next.rules.overs, 'over')} an innings?`,
            body: `${ends ? `That ends ${s.battingTeam.name}’s innings now, at ${oversText(s.legalBalls)} overs. ` : ''}Undo puts the overs back as they were.`,
            label: `Set ${plural(next.rules.overs, 'over')}`,
            icon: 'rainy-outline',
            danger: ends,
            run: () => changeOvers(o),
          });
        }}
        onTarget={(t) => {
          saveMatch({ ...match, revisedTarget: t });
          toast.show(t ? `Chase target is now ${t}` : 'Target back to normal', 'success');
          setMenu(false);
        }}
        onAddPlayer={(teamId, name) => {
          addLate(teamId, name);
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
        onDelete={() =>
          confirm({
            title: 'Delete this match?',
            body: clubUser
              ? 'It’s deleted for everyone in the club, on every phone, and won’t count in anyone’s numbers. This can’t be undone.'
              : 'It goes from this phone and won’t count in anyone’s numbers. This can’t be undone.',
            label: clubUser ? 'Delete it for everyone' : 'Delete this match',
            icon: 'trash-outline',
            danger: true,
            run: () => {
              deleteMatch(match.id);
              router.replace('/');
            },
          })
        }
        onMovePlayer={(playerId) => {
          const moved = movePlayer(match, playerId);
          if (typeof moved === 'string') {
            toast.show(moved, 'error');
            return;
          }
          const to = moved.teams.find((t) => t.players.some((p) => p.id === playerId))!;
          confirm({
            title: `Move ${playerName(match, playerId)} to ${to.name}?`,
            body: `They play for ${to.name} from now on. Captaincy or keeping for their old side goes.`,
            label: `Move to ${to.name}`,
            icon: 'swap-horizontal',
            run: () => {
              saveMatch(moved);
              toast.show(`${playerName(match, playerId)} now plays for ${to.name}`, 'success');
            },
          });
        }}
        onBowlerChange={(bowler) => {
          toast.show(`${playerName(match, bowler)} takes over from ${playerName(match, s.bowler)}`, 'info');
          setMenu(false);
          push({ type: 'bowler', bowler });
        }}
        onFixOver={(innings, over) => {
          setMenu(false);
          setFixingOver({ innings, over });
        }}
      />
      <Sheet visible={lateFor !== null} onClose={() => setLateFor(null)} title="Someone else">
        {lateFor && (
          <View style={{ gap: space.md, paddingBottom: space.md }}>
            <Text style={styles.editNote}>A late arrival joins {match.teams.find((t) => t.id === lateFor)?.name}, and goes on the list to pick.</Text>
            <LateArrival
              match={match}
              teamId={lateFor}
              onAdd={(teamId, name) => {
                addLate(teamId, name);
                setLateFor(null);
              }}
            />
          </View>
        )}
      </Sheet>
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
        armed={wicketFor ?? { mode: null }}
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
      <ConfirmSheet ask={ask} onClose={() => setAsk(null)} />
    </Fragment>
  );

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const openScorecard = () => router.push({ pathname: '/match/[id]/scorecard', params: { id: match.id } });
  const actions = (
    <View style={{ flexDirection: 'row', gap: space.sm }}>
      <IconButton icon="share-outline" label="Share score" onPress={() => void shareScore()} />
      <IconButton icon="stats-chart" label="Scorecard" onPress={openScorecard} />
      {!state.result && canScore && <IconButton icon="ellipsis-horizontal" label="Match options" onPress={() => setMenu(true)} />}
    </View>
  );
  const scoreboard = !(freshChase && s.status === 'openers') && !state.result ? <Scoreboard match={match} s={s} index={index} /> : null;
  const crease =
    s.striker && !state.result ? (
      <Crease
        match={match}
        s={s}
        big={layout.wide}
        onSwap={canScore ? () => push({ type: 'swap' }) : undefined}
        onRetire={
          canScore
            ? (id) => {
                setRetiring(id);
                setWicketFor({ mode: null });
              }
            : undefined
        }
      />
    ) : null;
  const thisOver = live ? <ThisOver s={s} onEdit={canScore ? setEditing : undefined} /> : null;
  const banners = (
    <>
      {s.freeHit && <Banner tone="volt" title={'FREE HIT'} body={'Only a run out counts on this ball'} />}
      {s.bowler && s.streaks[s.bowler] === 2 && <Banner tone="red" title={'HAT-TRICK BALL'} body={`${playerName(match, s.bowler)} has two in a row`} />}
    </>
  );
  const scoring = live && canScore;

  // ─── A phone: one column, the pad along the foot ───
  if (!layout.wide) {
    return (
      <Screen>
        <View style={styles.header}>
          <IconButton icon="chevron-back" label="Back" onPress={back} />
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
          {actions}
        </View>

        <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: space.sm, gap: space.md, paddingBottom: space.xl }}>
          {/* While scoring, Undo sits above the pad; between balls' screens (openers, bowler, result) it's up here. */}
          {!live && undoBar}
          {scoreboard}
          {crease}
          {thisOver}
          {!state.result && s.status !== 'openers' && <OverChart s={s} />}
          {body}
        </ScrollView>

        {scoring && (
          <View style={[styles.padWrap, { paddingBottom: insets.bottom + space.sm }]}>
            {undoBar}
            {banners}
            <Pad onBall={push} onWicket={setWicketFor} bounce={bounceInfo(match, s)} extraRun={match.rules.extraRun} />
          </View>
        )}
        {overlays}
      </Screen>
    );
  }

  // ─── A tablet or laptop ───
  // The keyboard scores on the web whenever nothing is open on top of the pad.
  const covered = wicketFor !== undefined || editing !== null || fixingOver !== null || menu || ask !== null || lateFor !== null || exporting !== null || sharing;
  const keys = Platform.OS === 'web' && !covered;
  const undoable = undoAllowed && (canUndo(match) || oversUndoable);
  const pad = (
    <Pad
      big
      shortcuts={keys}
      hints={layout.desk && Platform.OS === 'web'}
      onUndo={undoable ? undoLast : undefined}
      onBall={push}
      onWicket={setWicketFor}
      bounce={bounceInfo(match, s)}
      extraRun={match.rules.extraRun}
    />
  );
  // Labelled like the innings card it sits beside, so the two start level.
  const charts = !state.result && s.status !== 'openers' && s.legalBalls > 0 && (
    <View>
      <SectionLabel>Over by over</SectionLabel>
      <View style={{ gap: space.md }}>
        <OverChart s={s} max={20} />
        <Partnerships match={match} s={s} />
      </View>
    </View>
  );
  const thisInnings =
    !state.result && s.batters.length > 0 ? (
      <MiniScorecard match={match} s={s} title={superOver ? 'Super over' : index === 0 ? '1st innings' : '2nd innings'} onOpen={openScorecard} />
    ) : null;
  // At the break, the innings just gone sits beside the target.
  const before = freshChase && s.status === 'openers' ? state.innings[index - 1] : null;
  const beforeCard = before ? <MiniScorecard match={match} s={before} title={index >= 2 ? 'Their super over' : '1st innings'} onOpen={openScorecard} /> : null;
  const chase = index >= 1 && !state.result && state.innings[1].legalBalls > 0 ? <RunRace state={state} /> : null;
  const fresh = index === 0 && s.status === 'openers' && match.innings[0].events.length === 0 ? <Sides match={match} /> : null;

  const header = (
    <View style={[styles.header, { paddingHorizontal: layout.gutter, paddingVertical: space.md }]}>
      <IconButton icon="chevron-back" label="Back" onPress={back} />
      <View style={styles.headerTitle}>
        <Text numberOfLines={1} style={styles.wideTeams}>
          {match.teams[0].name}
          <Text style={styles.wideVs}>  vs  </Text>
          {match.teams[1].name}
        </Text>
        <Text numberOfLines={1} style={styles.wideSub}>
          {match.series ? `${match.series.name} · match ${match.series.number} · ` : ''}
          {plural(match.rules.overs, 'over')} a side
          {state.result ? ' · result' : live ? ` · ${superOver ? 'super over' : index === 0 ? '1st innings' : '2nd innings'}` : ''}
        </Text>
      </View>
      {actions}
    </View>
  );

  // The result: the winner and what to do next on the left, both innings on the right.
  if (state.result) {
    return (
      <Screen>
        {header}
        <ScrollView contentContainerStyle={{ paddingHorizontal: layout.gutter, paddingTop: space.sm, paddingBottom: space.xxl }}>
          <Page>
            {undoBar}
            {/* Both columns open on a label, so the result and the 1st innings start level. */}
            <Columns weights={[5, 6]} gap={space.xl}>
              <View>
                <SectionLabel flush>Full time</SectionLabel>
                {body}
              </View>
              <View style={{ gap: space.md }}>
                {state.innings.map((inn, i) =>
                  inn.legalBalls > 0 || inn.batters.length > 0 ? (
                    <MiniScorecard
                      key={i}
                      flush={i === 0}
                      match={match}
                      s={inn}
                      title={i >= 2 ? `Super over · ${inn.battingTeam.name}` : i === 0 ? '1st innings' : '2nd innings'}
                      onOpen={i === 0 ? openScorecard : undefined}
                    />
                  ) : null,
                )}
                <RunRace state={state} />
              </View>
            </Columns>
          </Page>
        </ScrollView>
        {overlays}
      </Screen>
    );
  }

  // A tablet on its side or a laptop: the match on the left, the pad or the pick on the right.
  if (side) {
    const watching = !canScore;
    return (
      <Screen>
        {header}
        <View style={[styles.split, { paddingHorizontal: layout.gutter, paddingBottom: insets.bottom + space.lg }]}>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: space.md, paddingBottom: space.xl }}>
            {breakCard}
            {beforeCard}
            {scoreboard}
            {crease}
            {watching && thisOver}
            {fresh}
            {watching ? (
              <>
                {charts}
                {chase}
              </>
            ) : (
              <>
                <Columns tablet={twoUp ? 2 : 1} gap={space.md}>
                  {thisInnings}
                  {charts}
                </Columns>
                {chase}
              </>
            )}
          </ScrollView>
          <View style={[styles.panel, { width: panelWidth }]}>
            <ScrollView contentContainerStyle={styles.panelBody}>
              {scoring ? (
                <>
                  <NextBall match={match} s={s} />
                  <ThisOver s={s} onEdit={setEditing} stacked />
                  <RecentOvers match={match} s={s} count={layout.height >= 800 ? 3 : 2} />
                  <View style={{ flex: 1, minHeight: space.sm }} />
                  {banners}
                  {undoBar}
                  {pad}
                  {layout.desk && Platform.OS === 'web' && <Text style={styles.keysHint}>Keys: 0–6 runs · W out · D wide · N no ball · U undo</Text>}
                </>
              ) : (
                <>
                  {!live && undoBar}
                  {body}
                  {watching && thisInnings}
                  {watching && s.log.length > 0 && <BallByBall match={match} s={s} />}
                </>
              )}
            </ScrollView>
          </View>
        </View>
        {overlays}
      </Screen>
    );
  }

  // A tablet held upright: one column at a reading width, two to a line where it fits, the pad along the foot.
  return (
    <Screen>
      {header}
      <ScrollView contentContainerStyle={{ paddingHorizontal: layout.gutter, paddingTop: space.sm, paddingBottom: space.xl }}>
        <Page style={{ gap: space.md }}>
          {!live && undoBar}
          {(breakCard || beforeCard) && (
            <Columns gap={space.md}>
              {breakCard}
              {beforeCard}
            </Columns>
          )}
          {(scoreboard || crease) && (
            <Columns gap={space.md}>
              {scoreboard}
              {(crease || thisOver) && (
                <View style={{ gap: space.md }}>
                  {crease}
                  {thisOver}
                </View>
              )}
            </Columns>
          )}
          {body}
          {fresh}
          {(thisInnings || charts) && (
            <Columns gap={space.md}>
              {thisInnings}
              {charts}
            </Columns>
          )}
          {chase}
          {!canScore && s.log.length > 0 && <BallByBall match={match} s={s} />}
        </Page>
      </ScrollView>
      {scoring && (
        <View style={[styles.padWrap, styles.padWrapWide, { paddingBottom: insets.bottom + space.md }]}>
          <View style={styles.padInner}>
            {undoBar}
            {banners}
            {pad}
          </View>
        </View>
      )}
      {overlays}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.sm },
  watchTitle: { color: colors.text, fontSize: 16, fontFamily: font.bold },
  quiet: { color: colors.faint, fontSize: 13, fontFamily: font.medium, textAlign: 'center', marginTop: space.md },
  confirmCard: { gap: space.sm, borderColor: colors.borderHi },
  lockRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  headerTitle: { flex: 1, minWidth: 0, paddingHorizontal: space.sm },
  headerTeam: { color: colors.text, fontSize: 16, lineHeight: 20, fontFamily: font.poster },
  headerVs: { color: colors.accentInk, fontFamily: font.semibold, fontSize: 13 },
  wideTeams: { color: colors.text, fontSize: 24, lineHeight: 30, fontFamily: font.posterBlack, letterSpacing: -0.6 },
  wideVs: { color: colors.accentInk, fontFamily: font.semibold, fontSize: 15, letterSpacing: 0 },
  wideSub: { color: colors.muted, fontSize: 13, fontFamily: font.medium, marginTop: 1 },

  // The split on a tablet on its side or a laptop: the match on the left, the scoring panel on the right.
  split: { flex: 1, flexDirection: 'row', gap: space.lg, minHeight: 0 },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl + 4,
    borderWidth: 1,
    borderColor: colors.borderHi,
    overflow: 'hidden',
    ...edge,
  },
  panelBody: { flexGrow: 1, padding: space.lg, gap: space.md },
  keysHint: { color: colors.faint, fontSize: 11, fontFamily: font.semibold, textAlign: 'center' },
  nextBall: { gap: 6 },
  recentRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  recentNo: { width: 20, color: colors.faint, fontSize: 14, fontFamily: font.poster, ...type.num },
  recentBalls: { flexDirection: 'row', flexWrap: 'wrap', flexShrink: 1, gap: 4 },
  recentMeta: { flex: 1, minWidth: 0, textAlign: 'right', color: colors.muted, fontSize: 12, fontFamily: font.semibold },
  nextLabel: { ...type.label, fontSize: 10, color: colors.accentInk },
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  nextText: { flex: 1, minWidth: 0, color: colors.text, fontSize: 16, fontFamily: font.bold },
  nextTo: { color: colors.faint, fontFamily: font.medium, fontSize: 13 },

  // The short scorecard beside the scoring.
  mcTotal: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  mcTeam: { flex: 1, color: colors.text, fontSize: 16, fontFamily: font.poster },
  mcRuns: { color: colors.text, fontSize: 22, fontFamily: font.posterBlack, ...type.num },
  mcOvers: { color: colors.faint, fontSize: 13, fontFamily: font.medium },
  mcRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, minHeight: 34, gap: 2, borderTopWidth: 1, borderTopColor: colors.border },
  mcHead: { backgroundColor: colors.surfaceHi, minHeight: 28 },
  mcTh: { ...type.label, fontSize: 10, color: colors.faint, width: 34, textAlign: 'right' },
  mcThName: { width: 'auto', textAlign: 'left' },
  mcTd: { width: 34, textAlign: 'right', color: colors.muted, fontSize: 13, fontFamily: font.semibold, ...type.num },
  mcLast: { width: 46 },
  mcStrong: { color: colors.text, fontFamily: font.heavy },
  mcName: { color: colors.text, fontSize: 14, fontFamily: font.bold },
  mcHow: { color: colors.faint, fontSize: 11, fontFamily: font.medium },
  mcExtras: { paddingVertical: 6 },
  mcEmpty: { color: colors.faint, fontSize: 13, fontFamily: font.medium, paddingHorizontal: space.lg, paddingVertical: space.md, borderTopWidth: 1, borderTopColor: colors.border },
  mcLink: { color: colors.accentInk, fontSize: 13, fontFamily: font.bold },
  sides: { flexDirection: 'row', gap: space.xl },
  sideRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  sideName: { flex: 1, color: colors.text, fontSize: 14, fontFamily: font.semibold },

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
  // 30 tall and 7 of slop all round: a 44 target without crowding the name.
  retire: { marginLeft: space.xs, paddingHorizontal: 10, height: 30, justifyContent: 'center', borderRadius: radius.sm, borderWidth: 1, borderColor: colors.borderHi },
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
  bowlerBadge: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
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
  scorebugStacked: { flexDirection: 'column', alignItems: 'stretch', gap: space.sm },
  scorebugLabelStacked: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', borderRightWidth: 0, paddingRight: 0 },
  scorebugTitle: { color: colors.text, fontSize: 16, fontFamily: font.poster },
  scorebugRuns: { color: colors.faint, fontSize: 11, fontFamily: font.bold, textTransform: 'uppercase' },
  // Six balls just fit beside the label on a 375 phone, so a full over isn't cut at the edge.
  overBalls: { gap: 4, alignItems: 'center' },

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
  pickGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  pickCell: { flexBasis: '48%', flexGrow: 1 },
  pickElse: { borderStyle: 'dashed', borderColor: colors.borderHi, backgroundColor: 'transparent' },
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
  padWrapWide: { alignItems: 'center', paddingHorizontal: space.lg },
  padInner: { width: '100%', maxWidth: 680 },
  pad: { gap: space.sm },
  undoBar: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.sm },
  undoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderHi,
    backgroundColor: colors.surfaceHi,
  },
  undoText: { color: colors.text, fontSize: 14, fontFamily: font.semibold },
  syncBadge: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  syncText: { color: colors.muted, fontSize: 12, fontFamily: font.semibold },
  extrasRow: { flexDirection: 'row', gap: 6 },
  extraKey: {
    height: 44,
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
  keyOut: { backgroundColor: colors.danger, borderColor: colors.danger },
  keyText: { color: colors.text, fontSize: 30, lineHeight: 34, fontFamily: font.posterBlack, ...type.num },
  keyTextBig: { fontSize: 36, lineHeight: 40 },
  // A key's keyboard key, small in its top corner.
  kbd: { position: 'absolute', top: 6, right: 9, fontSize: 10, fontFamily: font.bold, color: colors.faint, opacity: 0.6 },
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
  breakCardWide: { paddingVertical: space.xxl, justifyContent: 'center' },
  breakEyebrow: { ...type.label, color: hero.accent },
  breakTarget: { fontFamily: font.posterBlack, fontSize: 104, lineHeight: 114, color: hero.text, letterSpacing: -5, ...type.num },
  breakTitle: { ...type.poster, fontSize: 22, color: hero.text },
  breakSub: { color: hero.muted, fontSize: 13, fontFamily: font.medium, marginTop: space.sm },
});
