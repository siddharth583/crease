import { StyleSheet, Text, View } from 'react-native';
import type { MatchRating } from '../engine/ratings.ts';
import { colors, font, radius, space, type } from '../theme.ts';

// A player's match ratings out of 10 and the form they make, the same on the squad list and the player's page.

const day = (ms: number) => new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

/** A rating's colour: volt for a big game, cyan for a good one, plain otherwise, red for a poor one. */
export const ratingTone = (r: number) => (r >= 8 ? styles.top : r >= 6.5 ? styles.good : r < 5 ? styles.poor : null);

/** Form as a small badge: "Form 7.4", coloured like a rating. */
export function FormBadge({ form }: { form: number }) {
  return (
    <View style={[styles.badge, ratingTone(form)]}>
      <Text style={[styles.badgeText, form >= 8 && { color: colors.onAccent }]}>Form {form.toFixed(1)}</Text>
    </View>
  );
}

/** Their ratings, newest first, each with the day it was played. */
export function RatingChips({ history, max = 8 }: { history: MatchRating[]; max?: number }) {
  return (
    <View style={styles.chips}>
      {history.slice(0, max).map((m) => (
        <View key={m.matchId} style={styles.cell}>
          <View style={[styles.chip, ratingTone(m.rating)]}>
            <Text style={[styles.chipText, m.rating >= 8 && { color: colors.onAccent }]}>{m.rating.toFixed(1)}</Text>
          </View>
          <Text style={styles.day} numberOfLines={1}>
            {day(m.date)}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1, backgroundColor: colors.surfaceHi },
  badgeText: { color: colors.text, fontSize: 10, fontFamily: font.heavy, letterSpacing: 0.3, ...type.num },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  cell: { alignItems: 'center', gap: 3, width: 46 },
  chip: { width: 44, height: 32, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceHi },
  chipText: { fontFamily: font.posterBlack, fontSize: 15, color: colors.text, ...type.num },
  day: { color: colors.faint, fontSize: 10, fontFamily: font.medium },
  top: { backgroundColor: colors.accent },
  good: { backgroundColor: colors.cyanDim },
  poor: { backgroundColor: colors.dangerDim },
});
