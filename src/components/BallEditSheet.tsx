import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { canChangeLegality, playerName, replaceBall, setBowlerFrom, type BallView, type InningsState } from '../engine/engine.ts';
import type { BallEvent, Extra, Match, WicketKind } from '../engine/types.ts';
import { colors, font, space, type } from '../theme.ts';
import { BallChip, Button, Chip, Segmented, Sheet } from './ui.tsx';

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

/**
 * Apply a fix from the sheet: the ball itself, then who bowled it. The fixed match, or why it can't be done.
 * `next` null deletes the ball.
 */
export function fixBall(match: Match, inningsIndex: number, eventIndex: number, next: BallEvent | null, bowler: string | null | undefined): Match | string {
  const old = match.innings[inningsIndex].events[eventIndex] as BallEvent;
  let fixed = JSON.stringify(next) === JSON.stringify(old) ? match : replaceBall(match, inningsIndex, eventIndex, next);
  if (fixed === match && next && JSON.stringify(next) !== JSON.stringify(old)) {
    return 'That doesn’t fit with the balls after it (more balls than the overs allow, or the innings would have ended sooner). Fix the later balls first.';
  }
  if (!next) {
    if (fixed !== match) return fixed;
    return canChangeLegality(match, inningsIndex, eventIndex)
      ? 'That doesn’t fit with the balls after it, so it can’t be deleted.'
      : 'That over is finished, so taking a ball out would leave it a ball short. Change this ball to what really happened instead.';
  }
  if (bowler && bowler !== currentBowler(fixed, inningsIndex, eventIndex)) {
    const changed = setBowlerFrom(fixed, inningsIndex, eventIndex, bowler);
    if (changed === fixed) return `${playerName(match, bowler)} can’t be put on for this ball.`;
    fixed = changed;
  }
  return fixed;
}

/** Who was bowling a delivery: the last pick of a bowler before it. */
function currentBowler(match: Match, inningsIndex: number, eventIndex: number): string | null {
  const events = match.innings[inningsIndex].events;
  for (let k = eventIndex - 1; k >= 0; k--) {
    const e = events[k];
    if (e.type === 'bowler') return e.bowler;
  }
  return null;
}

/**
 * Fix a ball scored wrongly: its runs and extras (or delete it), how a wicket fell, and who bowled it. A new bowler
 * partway through an over bowls from this ball to the end of it: the one before couldn't finish.
 */
export function BallEditSheet({
  ball,
  event,
  match,
  s,
  onClose,
  onSave,
  adding,
}: {
  ball: BallView | null;
  event: BallEvent | null;
  match: Match;
  s: InningsState;
  onClose: () => void;
  /** Returns why the fix can't be made, shown in the sheet, or nothing when it was made. */
  onSave: (next: BallEvent | null, bowler: string | null) => string | void;
  /** Adding a ball to this over (its index) instead of fixing one: one the over was short of. */
  adding?: number;
}) {
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<'none' | Extra>('none');
  const [runs, setRuns] = useState(0);
  const [how, setHow] = useState<WicketKind>('bowled');
  const [fielder, setFielder] = useState<string | undefined>();
  const [bowler, setBowler] = useState<string | null>(null);
  useEffect(() => {
    if (!event) return;
    setKind(event.extra ?? 'none');
    setRuns(event.runs);
    setBowler(ball?.bowler ?? null);
    setError(null);
    if (event.wicket) {
      setHow(event.wicket.kind);
      setFielder(event.wicket.fielder);
    }
    // The ball's own identity, not the object: a caller may build it afresh each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, ball?.event, ball?.bowler]);
  if (!ball || !event) return null;
  const byes = kind === 'bye' || kind === 'legbye';
  const keeper = match.keepers?.[s.bowlingTeam.id];

  // Where the ball sits: its over, and whether it opened it. The bowlers of the overs either side can't bowl it.
  const o = adding ?? s.overs.findIndex((ov) => ov.some((b) => b.event === ball.event));
  const position = adding !== undefined ? s.overs[o].length : o === -1 ? 0 : s.overs[o].findIndex((b) => b.event === ball.event);
  const opensOver = position === 0;
  const changed = bowler !== (ball.bowler ?? null);
  const save = (next: BallEvent | null, who: string | null) => setError(onSave(next, who) || null);
  const nextDoorOvers = [o - 1, o + 1].filter((i) => bowler && s.overBowlers[i]?.includes(bowler)).map((i) => i + 1);

  const bowlerPart = adding !== undefined ? (
    error && <Text style={styles.error}>{error}</Text>
  ) : (
    <>
      <Text style={styles.label}>Bowler</Text>
      <Text style={styles.note}>
        {opensOver
          ? `Who bowled over ${o + 1}.`
          : `If ${playerName(match, ball.bowler)} couldn’t finish the over, pick who took over: they bowl from this ball to the end of over ${o + 1}.`}
      </Text>
      <View style={styles.wrap}>
        {s.bowlingTeam.players.map((p) => {
          return <Chip key={p.id} label={p.name} selected={bowler === p.id} onPress={() => setBowler(p.id)} />;
        })}
      </View>
      {changed && !opensOver && (
        <Text style={styles.note}>
          {playerName(match, bowler)} bowls ball {position + 1} onwards of over {o + 1}.
        </Text>
      )}
      {changed && nextDoorOvers.length > 0 && (
        <Text style={styles.note}>
          {playerName(match, bowler)} also bowled over {nextDoorOvers.join(' and ')}. The laws don’t allow it, but it’s saved if
          that’s what happened.
        </Text>
      )}
      {error && <Text style={styles.error}>{error}</Text>}
    </>
  );

  return (
    <Sheet visible onClose={onClose} title={adding !== undefined ? 'Add a ball' : 'Fix this ball'}>
      <ScrollView contentContainerStyle={{ gap: space.md, paddingBottom: space.md }}>
        <View style={styles.now}>
          <BallChip ball={ball} size={44} />
          <Text style={styles.nowText}>
            {adding !== undefined
              ? `Over ${o + 1}, ball ${position + 1} · bowled by ${playerName(match, ball.bowler)}`
              : `Over ${o + 1}, ball ${position + 1} · scored as ${ball.label === '•' ? 'a dot ball' : ball.label}`}
          </Text>
        </View>
        {event.wicket ? (
          <>
            <Text style={styles.note}>
              {playerName(match, event.wicket.playerOut)} stays out (everything after was scored without them). Fix how,
              or who took it.
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
            {bowlerPart}
            <Button
              label="Save"
              icon="checkmark"
              onPress={() =>
                save(
                  {
                    ...event,
                    runs: how === 'runout' ? runs : 0,
                    wicket: { kind: how, playerOut: event.wicket!.playerOut, fielder: how === 'caught' || how === 'runout' || how === 'stumped' ? fielder : undefined },
                  },
                  bowler,
                )
              }
            />
          </>
        ) : (
          <>
            <Segmented value={kind} onChange={setKind} options={EDIT_KINDS} />
            <View style={styles.wrap}>
              {[0, 1, 2, 3, 4, 5, 6].map((r) => (
                <Chip key={r} label={String(r)} selected={runs === r} disabled={byes && r === 0} onPress={() => setRuns(r)} />
              ))}
            </View>
            {bowlerPart}
            <Button
              label="Save"
              icon="checkmark"
              disabled={byes && runs === 0}
              onPress={() => {
                const same = (event.extra ?? 'none') === kind && event.runs === runs;
                save(same ? event : { type: 'ball', runs, extra: kind === 'none' ? undefined : kind }, bowler);
              }}
            />
            {adding === undefined && <Button variant="ghost" label="Delete this ball" icon="trash-outline" onPress={() => save(null, null)} />}
          </>
        )}
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  now: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  nowText: { flex: 1, color: colors.text, fontSize: 16, fontFamily: font.bold },
  note: { color: colors.muted, fontSize: 13, fontFamily: font.regular, lineHeight: 19 },
  label: { ...type.label, color: colors.muted, marginTop: space.xs },
  error: { color: colors.danger, fontSize: 13, fontFamily: font.semibold, lineHeight: 19 },
});
