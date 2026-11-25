import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { MatchRating } from '../engine/ratings.ts';
import { colors, font, radius, space, type } from '../theme.ts';
import { GrowBar, PopIn } from './motion.tsx';
import { PressableScale, usePageTone } from './ui.tsx';

// A player's match ratings out of 10 and the form they make, the same on the squad list and the player's page.

const day = (ms: number) => new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

/** A rating's colour: volt for a big game, cyan for a good one, plain otherwise, red for a poor one. */
export const ratingTone = (r: number) => (r >= 8 ? styles.top : r >= 6.5 ? styles.good : r < 5 ? styles.poor : null);

/** Form as a small badge: "Form 7.4", coloured like a rating. */
export function FormBadge({ form }: { form: number }) {
  // On a team's page, a big game wears the side's colour.
  const tone = usePageTone();
  return (
    <View style={[styles.badge, ratingTone(form), tone && form >= 8 && { backgroundColor: tone.accent }]}>
      <Text style={[styles.badgeText, form >= 8 && { color: tone?.onAccent ?? colors.onAccent }]}>Form {form.toFixed(1)}</Text>
    </View>
  );
}

/** Their ratings, newest first, each with the day it was played. Each chip pops in, one after another. */
export function RatingChips({ history, max = 8 }: { history: MatchRating[]; max?: number }) {
  const tone = usePageTone();
  return (
    <View style={styles.chips}>
      {history.slice(0, max).map((m, i) => (
        <View key={m.matchId} style={styles.cell} accessibilityLabel={`Rated ${m.rating.toFixed(1)} out of 10 on ${day(m.date)}`}>
          <PopIn delay={i * 60} turn={-6}>
            <View style={[styles.chip, ratingTone(m.rating), tone && m.rating >= 8 && { backgroundColor: tone.accent }]}>
              <Text style={[styles.chipText, m.rating >= 8 && { color: tone?.onAccent ?? colors.onAccent }]}>{m.rating.toFixed(1)}</Text>
            </View>
          </PopIn>
          <View style={styles.meter}>
            <GrowBar share={m.rating / 10} delay={200 + i * 60} trackStyle={styles.meterTrack} style={[styles.meterFill, m.rating >= 8 && { backgroundColor: colors.gold }, m.rating < 5 && { backgroundColor: colors.danger }]} />
          </View>
          <Text style={styles.day} numberOfLines={1}>
            {day(m.date)}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** The colour a rating's number is written in, and the wash behind it. */
const inkOf = (r: number) => (r >= 8 ? colors.accentInk : r >= 6.5 ? colors.cyan : r < 5 ? colors.danger : colors.text);
const washOf = (r: number) => (r >= 8 ? colors.accentDim : r >= 6.5 ? colors.cyanDim : r < 5 ? colors.dangerDim : colors.surfaceHi);

/**
 * The player page's match ratings and nothing else: one tile per match, newest first, in one row that scrolls sideways. The
 * number is coloured by how good the game was; the best one wears a brass edge and a star. A tile opens that match.
 */
export function MatchRatings({ history }: { history: MatchRating[] }) {
  if (history.length === 0) return null;
  const best = history.reduce((b, m) => (m.rating > b.rating ? m : b), history[0]);
  const size = 54;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {history.map((m) => {
          const isBest = m.matchId === best.matchId;
          return (
            <PressableScale
              key={m.matchId}
              scaleTo={0.94}
              onPress={() => router.push({ pathname: '/match/[id]', params: { id: m.matchId } })}
              accessibilityLabel={`${isBest ? 'Best match. ' : ''}Rated ${m.rating.toFixed(1)} out of 10 on ${day(m.date)}. Open the match`}
              style={[styles.tile, { width: size, height: size * 1.05, backgroundColor: washOf(m.rating) }, isBest && styles.bestTile]}
            >
              {isBest && (
                <View style={styles.bestStar}>
                  <Ionicons name="star" size={9} color={colors.onAccent} />
                </View>
              )}
              <Text style={[styles.tileValue, { color: inkOf(m.rating), fontSize: 20 }]}>{m.rating.toFixed(1)}</Text>
              <Text style={styles.tileDay} numberOfLines={1}>
                {day(m.date)}
              </Text>
            </PressableScale>
          );
        })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: space.sm, paddingTop: 7, paddingRight: space.xs },
  tile: { borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', gap: 2, borderWidth: 1.5, borderColor: 'transparent' },
  bestTile: { borderColor: colors.gold },
  bestStar: { position: 'absolute', top: -7, alignSelf: 'center', width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.gold },
  tileValue: { fontFamily: font.posterBlack, ...type.num },
  tileDay: { color: colors.muted, fontSize: 10, fontFamily: font.medium },
  badge: { borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1, backgroundColor: colors.surfaceHi },
  badgeText: { color: colors.text, fontSize: 10, fontFamily: font.heavy, letterSpacing: 0.3, ...type.num },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  cell: { alignItems: 'center', gap: 3, width: 46 },
  chip: { width: 44, height: 32, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceHi },
  chipText: { fontFamily: font.posterBlack, fontSize: 15, color: colors.text, ...type.num },
  meter: { width: 36 },
  meterTrack: { height: 3, borderRadius: 2, backgroundColor: colors.surfaceHi, overflow: 'hidden' },
  meterFill: { height: 3, borderRadius: 2, backgroundColor: colors.accent },
  day: { color: colors.faint, fontSize: 10, fontFamily: font.medium },
  top: { backgroundColor: colors.accent },
  good: { backgroundColor: colors.cyanDim },
  poor: { backgroundColor: colors.dangerDim },
});
