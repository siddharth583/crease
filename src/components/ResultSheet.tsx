import { StyleSheet, Text, View } from 'react-native';
import { addEvent, matchState } from '../engine/engine.ts';
import type { Match } from '../engine/types.ts';
import { colors, font, space } from '../theme.ts';
import { Button, Sheet } from './ui.tsx';

type Outcome = Match['outcome'];

/** The ways a chase ended by hand can be called: on the score, a draw, or either side forfeits. */
export function outcomeChoices(match: Match, scoreResult: string | null) {
  const [a, b] = match.teams;
  return [
    { key: 'score', label: scoreResult ? `On the score: ${scoreResult}` : 'On the score', icon: 'stats-chart-outline' as const, outcome: undefined as Outcome },
    { key: 'draw', label: 'A draw', icon: 'remove-circle-outline' as const, outcome: { kind: 'draw' } as Outcome },
    { key: `forfeit-${a.id}`, label: `${a.name} forfeit, ${b.name} win`, icon: 'flag-outline' as const, outcome: { kind: 'forfeit', team: a.id } as Outcome },
    { key: `forfeit-${b.id}`, label: `${b.name} forfeit, ${a.name} win`, icon: 'flag-outline' as const, outcome: { kind: 'forfeit', team: b.id } as Outcome },
  ];
}

const outcomeKey = (o: Outcome) => (!o ? 'score' : o.kind === 'draw' ? 'draw' : `forfeit-${o.team}`);

/** What the result would be on the score alone, with the chase ended now. */
export const scoreResultIfEnded = (match: Match) => matchState(addEvent({ ...match, outcome: undefined }, { type: 'endInnings' })).result;

/** A chase ended early can have its result changed: whoever could undo it (the admin, or a scorer before it's confirmed). */
export const canChangeResult = (match: Match, access: { admin: boolean; score: boolean }) =>
  match.innings.length <= 2 && Boolean(matchState(match).innings[1]?.endedEarly) && (access.admin || (access.score && match.confirmed === false));

/** Change how a chase ended early is called. `onPick` gets the new call; the current one is marked. */
export function ResultSheet({ match, visible, onClose, onPick }: { match: Match; visible: boolean; onClose: () => void; onPick: (outcome: Outcome) => void }) {
  const state = matchState(match);
  return (
    <Sheet visible={visible} onClose={onClose} title="Change the result">
      <View style={{ gap: space.sm, paddingBottom: space.md }}>
        <Text style={styles.note}>{state.innings[1]?.battingTeam.name ?? 'The chase'} batted second, and the innings was ended early. Call the match on the score, a draw, or a forfeit.</Text>
        {outcomeChoices(match, matchState({ ...match, outcome: undefined }).result).map((c) => {
          const current = outcomeKey(match.outcome) === c.key;
          return (
            <Button
              key={c.key}
              variant={current ? 'primary' : 'ghost'}
              label={current ? `${c.label} (now)` : c.label}
              icon={current ? 'checkmark-circle' : c.icon}
              onPress={() => (current ? onClose() : onPick(c.outcome))}
            />
          );
        })}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  note: { color: colors.muted, fontSize: 13, fontFamily: font.regular, lineHeight: 19 },
});
