import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { addEvent, matchState } from '../engine/engine.ts';
import type { Match } from '../engine/types.ts';
import { colors, font, radius, space } from '../theme.ts';
import { PressableScale, Sheet } from './ui.tsx';

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
        <View style={styles.intro}>
          <Ionicons name="information-circle-outline" size={18} color={colors.gold} />
          <Text style={styles.note}>
            {state.innings[1]?.battingTeam.name ?? 'The chase'} batted second and the innings was ended early. Pick how the match is called: on the score, a draw, or a forfeit.
          </Text>
        </View>
        {outcomeChoices(match, matchState({ ...match, outcome: undefined }).result).map((c) => {
          const current = outcomeKey(match.outcome) === c.key;
          const label = current ? `${c.label} (now)` : c.label;
          return (
            <PressableScale
              key={c.key}
              accessibilityLabel={label}
              accessibilityState={{ selected: current }}
              scaleTo={0.97}
              onPress={() => (current ? onClose() : onPick(c.outcome))}
              style={[styles.choice, current && styles.choiceOn]}
            >
              <View style={[styles.icon, current && { backgroundColor: colors.accent }]}>
                <Ionicons name={current ? 'checkmark' : c.icon} size={18} color={current ? colors.onAccent : colors.muted} />
              </View>
              <Text style={styles.choiceText}>{c.label}</Text>
              {current && <Text style={styles.now}>CURRENT</Text>}
            </PressableScale>
          );
        })}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  note: { flex: 1, color: colors.muted, fontSize: 13, fontFamily: font.regular, lineHeight: 19 },
  intro: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start', backgroundColor: colors.goldDim, borderRadius: radius.md, padding: space.md },
  choice: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingHorizontal: space.md, borderRadius: radius.lg, backgroundColor: colors.surfaceHi, borderWidth: 1, borderColor: colors.border },
  choiceOn: { borderColor: colors.accent },
  icon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  choiceText: { flex: 1, color: colors.text, fontSize: 15, fontFamily: font.bold },
  now: { color: colors.accentInk, fontSize: 10, fontFamily: font.heavy, letterSpacing: 1 },
});
