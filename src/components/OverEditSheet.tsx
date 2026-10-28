import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ballView, couldComeIn, creaseAt, fairBalls, playerName, type InningsState, type OverBall } from '../engine/engine.ts';
import type { BallEvent, Extra, Match, WicketKind } from '../engine/types.ts';
import { colors, font, radius, space, type } from '../theme.ts';
import { BallChip, Button, Chip, PressableScale, Segmented, Sheet } from './ui.tsx';

const KINDS: { value: 'none' | Extra; label: string }[] = [
  { value: 'none', label: 'Runs' },
  { value: 'wide', label: 'Wide' },
  { value: 'noball', label: 'NB' },
  { value: 'bye', label: 'Bye' },
  { value: 'legbye', label: 'LB' },
];

const WICKET_KINDS: { value: WicketKind; label: string }[] = [
  { value: 'bowled', label: 'Bowled' },
  { value: 'caught', label: 'Caught' },
  { value: 'lbw', label: 'LBW' },
  { value: 'runout', label: 'Run out' },
  { value: 'stumped', label: 'Stumped' },
  { value: 'hitwicket', label: 'Hit wicket' },
  { value: 'retired', label: 'Retired hurt' },
  { value: 'retiredout', label: 'Retired out' },
];

const withFielder = (k: WicketKind) => k === 'caught' || k === 'runout' || k === 'stumped';

/** A ball that wasn't a wicket can be made one: the extras switch gains Out. */
const WITH_OUT: { value: 'none' | Extra | 'out'; label: string }[] = [...KINDS, { value: 'out', label: 'Out' }];

/**
 * Rewrite one bowled over: change any ball, add or take away balls, and say who bowled which. It saves once the over
 * has its six fair balls (the last over of an innings may have fewer), so no over after it moves.
 */
export function OverEditSheet({
  match,
  s,
  inningsIndex,
  over,
  onClose,
  onSave,
}: {
  match: Match;
  s: InningsState;
  inningsIndex: number;
  /** The over's index, or null when closed. */
  over: number | null;
  onClose: () => void;
  /** Returns why the over can't be saved, or nothing when it was. */
  onSave: (draft: OverBall[]) => string | void;
}) {
  const [draft, setDraft] = useState<OverBall[]>([]);
  const [picked, setPicked] = useState(0);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (over === null) return;
    const events = match.innings[inningsIndex]?.events ?? [];
    setDraft((s.overs[over] ?? []).map((b) => ({ ball: events[b.event!] as BallEvent, bowler: b.bowler ?? '', from: b.event })));
    setPicked(0);
    setError(null);
    // Only when a different over opens: the draft is the user's while it's open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [over]);
  if (over === null || !draft.length) return null;

  const final = over === s.overs.length - 1 || s.overs.slice(over + 1).every((o) => o.length === 0);
  const fair = fairBalls(match.rules, draft.map((d) => d.ball));
  const whole = final ? fair <= 6 : fair === 6;
  const current = draft[Math.min(picked, draft.length - 1)];
  const at = Math.min(picked, draft.length - 1);
  const ball = current.ball;
  const kind = ball.extra ?? 'none';
  const byes = kind === 'bye' || kind === 'legbye';
  const keeper = match.keepers?.[s.bowlingTeam.id];
  const events = match.innings[inningsIndex].events;
  // A wicket already scored stays one (only how can change); any other ball can be made a wicket, or not.
  const madeOut = Boolean(ball.wicket) && !(current.from !== undefined && (events[current.from] as BallEvent).wicket);
  const canBeOut = !ball.wicket || madeOut;
  // Who was batting on this ball, as it was scored: an added ball goes after the one before it.
  const prev = draft.slice(0, at + 1).reverse().find((d) => d.from !== undefined);
  const crease = creaseAt(match, inningsIndex, current.from ?? (prev?.from !== undefined ? prev.from + 1 : (draft[0].from ?? 0)));
  const taken = new Set(draft.filter((d, i) => i !== at && d.incoming).map((d) => d.incoming));
  const comers = couldComeIn(match, inningsIndex).filter((id) => !taken.has(id));

  const set = (patch: Partial<OverBall['ball']>, incoming?: string | null) => {
    // A changed ball is a plain one: a bounce call goes with the old version of it.
    setDraft(
      draft.map((d, i) =>
        i === at
          ? { ...d, ball: { type: 'ball', runs: ball.runs, extra: ball.extra, wicket: ball.wicket, ...patch }, incoming: incoming === undefined ? d.incoming : incoming ?? undefined }
          : d,
      ),
    );
    setError(null);
  };
  const makeOut = (out: boolean) =>
    out
      ? set({ runs: 0, extra: undefined, wicket: { kind: 'bowled', playerOut: crease[0] ?? crease[1] ?? '' } }, comers[0] ?? null)
      : set({ wicket: undefined }, null);
  const setBowler = (id: string) => {
    // From this ball to the end of the over: the one who took over finishes it.
    setDraft(draft.map((d, i) => (i >= at ? { ...d, bowler: id } : d)));
    setError(null);
  };
  const add = () => {
    setDraft([...draft, { ball: { type: 'ball', runs: 0 }, bowler: draft[draft.length - 1].bowler }]);
    setPicked(draft.length);
    setError(null);
  };
  const remove = () => {
    setDraft(draft.filter((_, i) => i !== at));
    setPicked(Math.max(0, at - 1));
    setError(null);
  };
  const bowlers = [...new Set(draft.map((d) => d.bowler))].map((id) => playerName(match, id)).join(' → ');
  const need = final ? '' : fair < 6 ? `Add ${6 - fair} more` : fair > 6 ? `${fair - 6} too many: take ${fair - 6 === 1 ? 'one' : 'some'} away, or make ${fair - 6 === 1 ? 'it' : 'them'} a wide or no-ball` : '';

  return (
    <Sheet visible onClose={onClose} title={`Over ${over + 1}`}>
      <ScrollView contentContainerStyle={{ gap: space.md, paddingBottom: space.md }}>
        <View style={styles.countRow}>
          <Text style={[styles.count, { color: whole ? colors.accentInk : colors.danger }]}>
            {fair} of 6 fair balls
          </Text>
          <Text style={styles.bowlers} numberOfLines={1}>
            {bowlers}
          </Text>
        </View>
        {need ? <Text style={styles.need}>{need}</Text> : null}

        <View style={styles.balls}>
          {draft.map((d, i) => (
            <PressableScale key={i} scaleTo={0.85} accessibilityLabel={`Ball ${i + 1}`} onPress={() => setPicked(i)} style={[styles.ring, i === at && styles.ringOn]}>
              <BallChip ball={ballView(match.rules, d.ball)} />
            </PressableScale>
          ))}
          <PressableScale scaleTo={0.85} accessibilityLabel="Add a ball" onPress={add} style={styles.add}>
            <Ionicons name="add" size={20} color={colors.accentInk} />
          </PressableScale>
        </View>

        <Text style={styles.label}>Ball {at + 1}</Text>
        {canBeOut && (
          <Segmented
            value={ball.wicket ? 'out' : kind}
            onChange={(v) => {
              if (v === 'out') return makeOut(true);
              if (ball.wicket) makeOut(false);
              setDraft((d) =>
                d.map((x, i) => (i === at ? { ...x, ball: { type: 'ball', runs: (v === 'bye' || v === 'legbye') && x.ball.runs === 0 ? 1 : x.ball.runs, extra: v === 'none' ? undefined : v } } : x)),
              );
            }}
            options={WITH_OUT}
          />
        )}
        {ball.wicket ? (
          <>
            {madeOut ? (
              <>
                <Text style={styles.label}>Who’s out</Text>
                <Segmented
                  value={ball.wicket.playerOut}
                  onChange={(id) => set({ wicket: { ...ball.wicket!, playerOut: id } })}
                  options={crease.filter((id): id is string => id !== null).map((id) => ({ value: id, label: playerName(match, id) }))}
                />
                <Text style={styles.label}>Who came in next</Text>
                {comers.length ? (
                  <View style={styles.wrap}>
                    {comers.map((id) => (
                      <Chip key={id} label={playerName(match, id)} selected={current.incoming === id} onPress={() => set({}, id)} />
                    ))}
                  </View>
                ) : (
                  <Text style={styles.note}>Everyone else has batted, so this can only be the innings’ last ball.</Text>
                )}
                <Text style={styles.note}>
                  Whatever {playerName(match, ball.wicket.playerOut)} did after this ball goes to {current.incoming ? playerName(match, current.incoming) : 'the batter who came in'}.
                </Text>
                <Text style={styles.label}>How</Text>
              </>
            ) : (
              <Text style={styles.note}>{playerName(match, ball.wicket.playerOut)} is out on this ball. Fix how, or who took it.</Text>
            )}
            <View style={styles.wrap}>
              {WICKET_KINDS.map((k) => (
                <Chip
                  key={k.value}
                  tone="danger"
                  label={k.label}
                  selected={ball.wicket!.kind === k.value}
                  onPress={() => set({ runs: k.value === 'runout' ? ball.runs : 0, wicket: { ...ball.wicket!, kind: k.value, fielder: withFielder(k.value) ? ball.wicket!.fielder : undefined } })}
                />
              ))}
            </View>
            {withFielder(ball.wicket.kind) && (
              <View style={styles.wrap}>
                {s.bowlingTeam.players.map((p) => (
                  <Chip
                    key={p.id}
                    label={p.id === keeper ? `${p.name} †` : p.name}
                    selected={ball.wicket!.fielder === p.id}
                    onPress={() => set({ wicket: { ...ball.wicket!, fielder: ball.wicket!.fielder === p.id ? undefined : p.id } })}
                  />
                ))}
              </View>
            )}
            {ball.wicket.kind === 'runout' && (
              <Segmented value={String(ball.runs)} onChange={(v) => set({ runs: Number(v) })} options={['0', '1', '2', '3'].map((v) => ({ value: v, label: `${v} run${v === '1' ? '' : 's'}` }))} />
            )}
          </>
        ) : (
          <>
            <View style={styles.wrap}>
              {[0, 1, 2, 3, 4, 5, 6].map((r) => (
                <Chip key={r} label={String(r)} selected={ball.runs === r} disabled={byes && r === 0} onPress={() => set({ runs: r })} />
              ))}
            </View>
          </>
        )}

        <Text style={styles.label}>Bowled by</Text>
        <View style={styles.wrap}>
          {s.bowlingTeam.players.map((p) => (
            <Chip key={p.id} label={p.name} selected={current.bowler === p.id} onPress={() => setBowler(p.id)} />
          ))}
        </View>
        <Text style={styles.note}>A new bowler bowls from this ball to the end of the over.</Text>

        {canBeOut && draft.length > 1 && (
          <Button variant="ghost" label={`Take ball ${at + 1} away`} icon="trash-outline" onPress={remove} />
        )}
        {error && <Text style={styles.error}>{error}</Text>}
        <Button label="Save over" icon="checkmark" disabled={!whole} onPress={() => setError(onSave(draft) || null)} />
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  countRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.md },
  count: { fontFamily: font.posterBlack, fontSize: 20 },
  bowlers: { flex: 1, textAlign: 'right', color: colors.muted, fontSize: 13, fontFamily: font.semibold },
  need: { color: colors.danger, fontSize: 13, fontFamily: font.semibold, marginTop: -space.sm },
  balls: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  ring: { padding: 2, borderRadius: radius.pill, borderWidth: 2, borderColor: 'transparent' },
  ringOn: { borderColor: colors.accentInk },
  add: {
    width: 40,
    height: 40,
    margin: 2,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.accentInk,
  },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  label: { ...type.label, color: colors.muted, marginTop: space.xs },
  note: { color: colors.muted, fontSize: 13, fontFamily: font.regular, lineHeight: 19 },
  error: { color: colors.danger, fontSize: 13, fontFamily: font.semibold, lineHeight: 19 },
});
