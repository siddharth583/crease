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

const reballed = (e: BallEvent | null) => e?.extra === 'wide' || e?.extra === 'noball';

/**
 * Apply a fix from the sheet: the ball itself, then who bowled it. The fixed match, or why it can't be done.
 * `next` null deletes the ball.
 */
export function fixBall(match: Match, inningsIndex: number, eventIndex: number, next: BallEvent | null, bowler: string | null | undefined): Match | string {
  const old = match.innings[inningsIndex].events[eventIndex] as BallEvent;
  let fixed = JSON.stringify(next) === JSON.stringify(old) ? match : replaceBall(match, inningsIndex, eventIndex, next);
  if (fixed === match && next && JSON.stringify(next) !== JSON.stringify(old)) {
    if (reballed(next) !== reballed(old) && !canChangeLegality(match, inningsIndex, eventIndex))
      return 'That over is finished: a ball in it can’t become a wide or no-ball, or stop being one. Change the runs instead.';
    return 'That doesn’t fit with the balls after it (the chase would have ended sooner). Fix the later balls first.';
  }
  if (!next) {
    if (fixed !== match) return fixed;
    return canChangeLegality(match, inningsIndex, eventIndex)
      ? 'That doesn’t fit with the balls after it, so it can’t be deleted.'
      : 'That over is finished, so its balls can’t be deleted. Change the runs instead.';
  }
  if (bowler && bowler !== currentBowler(fixed, inningsIndex, eventIndex)) {
    const changed = setBowlerFrom(fixed, inningsIndex, eventIndex, bowler);
    if (changed === fixed) return `${playerName(match, bowler)} bowled the over before or after this one, so can’t bowl here.`;
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
}: {
  ball: BallView | null;
  event: BallEvent | null;
  match: Match;
  s: InningsState;
  onClose: () => void;
  onSave: (next: BallEvent | null, bowler: string | null) => void;
}) {
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
    if (event.wicket) {
      setHow(event.wicket.kind);
      setFielder(event.wicket.fielder);
    }
  }, [event, ball]);
  if (!ball || !event) return null;
  const byes = kind === 'bye' || kind === 'legbye';
  const keeper = match.keepers?.[s.bowlingTeam.id];

  // Where the ball sits: its over, and whether it opened it. The bowlers of the overs either side can't bowl it.
  const o = s.overs.findIndex((ov) => ov.some((b) => b.event === ball.event));
  const position = o === -1 ? 0 : s.overs[o].findIndex((b) => b.event === ball.event);
  const opensOver = position === 0;
  const nextDoor = [...(s.overBowlers[o - 1] ?? []), ...(s.overBowlers[o + 1] ?? [])];
  const changed = bowler !== (ball.bowler ?? null);

  const bowlerPart = (
    <>
      <Text style={styles.label}>Bowler</Text>
      <Text style={styles.note}>
        {opensOver
          ? `Who bowled over ${o + 1}.`
          : `If ${playerName(match, ball.bowler)} couldn’t finish the over, pick who took over: they bowl from this ball to the end of over ${o + 1}.`}
      </Text>
      <View style={styles.wrap}>
        {s.bowlingTeam.players.map((p) => {
          const blocked = nextDoor.includes(p.id) && p.id !== ball.bowler;
          return <Chip key={p.id} label={p.name} selected={bowler === p.id} disabled={blocked} onPress={() => setBowler(p.id)} />;
        })}
      </View>
      {changed && !opensOver && (
        <Text style={styles.note}>
          {playerName(match, bowler)} bowls ball {position + 1} onwards of over {o + 1}.
        </Text>
      )}
    </>
  );

  return (
    <Sheet visible onClose={onClose} title="Fix this ball">
      <ScrollView contentContainerStyle={{ gap: space.md, paddingBottom: space.md }}>
        <View style={styles.now}>
          <BallChip ball={ball} size={44} />
          <Text style={styles.nowText}>
            Over {o + 1}, ball {position + 1} · scored as {ball.label === '•' ? 'a dot ball' : ball.label}
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
                onSave(
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
                onSave(same ? event : { type: 'ball', runs, extra: kind === 'none' ? undefined : kind }, bowler);
              }}
            />
            <Button variant="ghost" label="Delete this ball" icon="trash-outline" onPress={() => onSave(null, null)} />
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
});
