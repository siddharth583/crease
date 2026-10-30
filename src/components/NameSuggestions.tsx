import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { knownNames, suggestNames } from '../engine/names.ts';
import { useMatches } from '../store/matches.tsx';
import { useSquad } from '../store/squad.ts';
import { colors, font, space } from '../theme.ts';
import { Chip } from './ui.tsx';

/** Every player Crease knows by name: the squad first, then everyone in the matches and saved sides, most played first. */
export function useKnownNames(): string[] {
  const { matches, savedTeams } = useMatches();
  const { squad } = useSquad();
  return useMemo(
    () =>
      knownNames(
        squad.map((p) => p.name),
        [...matches.map((m) => m.teams.flatMap((t) => t.players.map((p) => p.name))), ...savedTeams.map((t) => t.players.map((p) => p.name))],
      ),
    [matches, savedTeams, squad],
  );
}

/**
 * Under a name being typed: the known players it could be, to tap instead of typing a second spelling of the same
 * person. `taken` are names already used here (never suggested twice).
 */
export function NameSuggestions({ value, taken = [], onPick }: { value: string; taken?: string[]; onPick: (name: string) => void }) {
  const known = useKnownNames();
  const list = useMemo(() => suggestNames(value, known, taken), [value, known, taken]);
  if (!list.length) return null;
  return (
    <View style={styles.row}>
      <Text style={styles.label}>Already playing as</Text>
      {list.map((name) => (
        <Chip key={name} icon="person-outline" label={name} onPress={() => onPick(name)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
  label: { color: colors.faint, fontSize: 12, fontFamily: font.semibold },
});
