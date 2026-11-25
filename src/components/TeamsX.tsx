import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { SquadPlayer } from '../engine/squad.ts';
import { nameKey } from '../engine/teams.ts';
import type { Role } from '../engine/types.ts';
import { useSquad } from '../store/squad.ts';
import { colors, font, hero, ink, type } from '../theme.ts';
import { PopIn } from './motion.tsx';

// Small pieces shared by the Teams tab, a team's page and the squad: the role icon, the form chips, the squad lookup.

export const ROLE_NAME: Record<Role, string> = { bat: 'Batter', bowl: 'Bowler', ar: 'All-rounder', wk: 'Keeper' };

/** Bat, ball, both, or gloves: a round badge so a role reads before the word does. */
export function RoleIcon({ role: r, size = 26 }: { role: Role; size?: number }) {
  const tint = r === 'bat' ? colors.accentInk : r === 'bowl' ? colors.cyan : r === 'wk' ? colors.violet : colors.gold;
  const bg = r === 'bat' ? colors.accentDim : r === 'bowl' ? colors.cyanDim : r === 'wk' ? colors.violetDim : colors.goldDim;
  const s = Math.round(size * 0.58);
  return (
    <View style={[styles.role, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]} accessibilityLabel={ROLE_NAME[r]}>
      {r === 'bat' ? (
        <MaterialCommunityIcons name="cricket" size={s} color={tint} />
      ) : r === 'bowl' ? (
        <Ionicons name="tennisball" size={s} color={tint} />
      ) : r === 'wk' ? (
        <MaterialCommunityIcons name="hand-back-right" size={s} color={tint} />
      ) : (
        <Ionicons name="flash" size={s} color={tint} />
      )}
    </View>
  );
}

/** The squad by name: a side's player's role and stars come from here. */
export function useSquadByName() {
  const { squad } = useSquad();
  return useMemo(() => new Map<string, SquadPlayer>(squad.map((p) => [nameKey(p.name), p])), [squad]);
}

type Result = 'W' | 'L' | 'T' | 'D';

/** The last results as chips that pop in one after another: wins in the side's colour, losses leather red. */
export function FormChips({ results, size = 24, accent, onAccent, delay = 0, onDark }: { results: Result[]; size?: number; accent?: string; onAccent?: string; delay?: number; onDark?: boolean }) {
  if (!results.length) return null;
  return (
    <View style={styles.chips} accessibilityLabel={`Last ${results.length} results, newest first: ${results.join(' ')}`}>
      {results.map((r, i) => (
        <PopIn key={i} delay={delay + i * 70} turn={-18}>
          <View
            style={[
              styles.chip,
              { width: size, height: size, borderRadius: size * 0.3 },
              r === 'W' ? { backgroundColor: accent ?? colors.accent } : r === 'L' ? { backgroundColor: colors.dangerDim, borderColor: colors.danger } : { backgroundColor: onDark ? hero.ink(0.14) : ink(0.1) },
            ]}
          >
            <Text style={[styles.chipText, { fontSize: size * 0.46 }, r === 'W' ? { color: onAccent ?? colors.onAccent } : r === 'L' ? { color: colors.danger } : { color: onDark ? hero.muted : colors.muted }]}>{r}</Text>
          </View>
        </PopIn>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  role: { alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  chip: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'transparent' },
  chipText: { fontFamily: font.heavy, ...type.num },
});
