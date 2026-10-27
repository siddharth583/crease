import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card, IconButton, Screen, SectionLabel, tap, GhostWord, PitchStripes } from '../../components/ui.tsx';
import { CountUp, GrowBar } from '../../components/motion.tsx';
import { RatingChips } from '../../components/Ratings.tsx';
import { playerRatings } from '../../engine/ratings.ts';
import { oversText } from '../../engine/engine.ts';
import {
  battingAverage,
  bestFigures,
  bowlingAverage,
  bowlingOvers,
  careerStats,
  economy,
  strikeRate,
  type MatchLine,
} from '../../engine/stats.ts';
import { useMatches } from '../../store/matches.tsx';
import { useSquad } from '../../store/squad.ts';
import { colors, gradients, radius, space, type, font, ink, hero } from '../../theme.ts';

const fmt = (n: number | null, digits = 1) => (n === null ? '–' : n.toFixed(digits));

/** A figure that counts up when it's a number ("24.5", 147); text like "3/18" or "–" just shows. */
function Figure({ value, style }: { value: string | number; style: StyleProp<TextStyle> }) {
  const text = String(value);
  if (!/^\d+(\.\d+)?$/.test(text)) return <Text style={style}>{text}</Text>;
  const decimals = text.includes('.') ? text.split('.')[1].length : 0;
  return <CountUp value={Number(text)} style={style} format={(n) => n.toFixed(decimals)} />;
}

function Tiles({ items }: { items: [string, string | number, boolean?][] }) {
  return (
    <View style={styles.tiles}>
      {items.map(([label, value, hero]) => (
        <View key={label} style={[styles.tile, hero && styles.tileHero]}>
          <Figure value={value} style={[styles.tileValue, hero && { color: colors.accentInk }]} />
          <Text style={styles.tileLabel}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

function MatchRow({ line, first }: { line: MatchLine; first: boolean }) {
  const date = new Date(line.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  const parts = [
    line.bat && `${line.bat.runs}${line.bat.notOut ? '*' : ''} (${line.bat.balls})`,
    line.bowl && `${line.bowl.wickets}/${line.bowl.runs} (${oversText(line.bowl.balls)})`,
  ].filter(Boolean);

  return (
    <Pressable
      onPress={() => {
        tap();
        router.push({ pathname: '/match/[id]/scorecard', params: { id: line.matchId } });
      }}
      style={({ pressed }) => [styles.matchRow, !first && styles.matchBorder, pressed && { opacity: 0.7 }]}
    >
      <View
        style={[
          styles.result,
          line.won === true && { backgroundColor: colors.accentDim },
          line.won === false && { backgroundColor: colors.dangerDim },
        ]}
      >
        <Text
          style={[
            styles.resultText,
            line.won === true && { color: colors.accentInk },
            line.won === false && { color: colors.danger },
          ]}
        >
          {line.won === null ? '–' : line.won ? 'W' : 'L'}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={styles.matchTitle}>
          vs {line.opponent}
        </Text>
        <Text style={styles.matchDate}>{date}</Text>
      </View>
      <Text style={styles.matchFigures}>{parts.length ? parts.join('  ·  ') : 'Did not bat or bowl'}</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.faint} />
    </Pressable>
  );
}

export default function PlayerProfile() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const { matches, ready } = useMatches();
  const insets = useSafeAreaInsets();
  const { squad } = useSquad();
  const c = useMemo(() => careerStats(matches).find((x) => x.key === key), [matches, key, squad]);
  // Their match ratings out of 10 and their form, as on the squad list.
  const rated = useMemo(() => playerRatings(matches, key), [matches, key]);

  const back = (
    <View style={styles.header}>
      <IconButton icon="chevron-back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/players'))} />
    </View>
  );
  if (!c) {
    return (
      <Screen>
        {back}
        <Text style={styles.missing}>{ready ? 'Player not found' : 'Loading…'}</Text>
      </Screen>
    );
  }

  const wins = c.history.filter((h) => h.won === true).length;
  // Oldest first, so the chart reads left to right like a season.
  const form = c.history.filter((h) => h.bat).slice(0, 10).reverse();
  const peak = Math.max(20, ...form.map((h) => h.bat!.runs));

  return (
    <Screen>
      {back}
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: 0, paddingBottom: insets.bottom + space.xxl }}>
        <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.hero}>
          <PitchStripes tint="255,255,255" />
          <GhostWord size={260} style={{ right: -20, top: -60, color: hero.ink(0.05) }}>
            {c.name.slice(0, 1)}
          </GhostWord>
          <View style={styles.heroTop}>
            <View style={styles.teamTag}>
              <Text style={styles.teamTagText}>{c.team}</Text>
            </View>
            {rated.form !== null && (
              <View style={[styles.formPill, rated.form >= 8 && { backgroundColor: hero.accent }]}>
                <Text style={[styles.formPillText, rated.form >= 8 && { color: colors.onAccent }]}>
                  Form <Text style={styles.formPillValue}>{rated.form.toFixed(1)}</Text>
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.name} numberOfLines={2}>
            {c.name}
          </Text>
          <View style={styles.heroStats}>
            {[
              ['Matches', c.matches],
              ['Won', wins],
              ['Runs', c.batting.runs],
              ['Wickets', c.bowling.wickets],
            ].map(([label, value]) => (
              <View key={label} style={styles.heroStat}>
                <CountUp value={Number(value)} style={styles.heroValue} />
                <Text style={styles.heroLabel}>{label}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        {rated.history.length > 0 && (
          <>
            <SectionLabel right={<Text style={styles.formHint}>Out of 10</Text>}>Match ratings</SectionLabel>
            <Card style={{ gap: space.md }}>
              <RatingChips history={rated.history} />
              <Text style={styles.formHint}>
                A rating for each match from what they did with the bat, the ball and in the field. Form is the average of their last{' '}
                {Math.min(5, rated.history.length)}.
              </Text>
            </Card>
          </>
        )}

        {form.length > 0 && (
          <>
            <SectionLabel right={<Text style={styles.formHint}>Last {form.length} innings</Text>}>Recent innings</SectionLabel>
            <Card style={styles.formCard}>
              {form.map((h, i) => {
                const hot = h.bat!.runs >= 30;
                return (
                  <View key={h.matchId} style={styles.formCol}>
                    <Text style={[styles.formText, hot && { color: colors.accentInk }]}>
                      {h.bat!.runs}
                      {h.bat!.notOut ? '*' : ''}
                    </Text>
                    <GrowBar
                      vertical
                      share={Math.max(4 / 90, h.bat!.runs / peak)}
                      delay={150 + i * 70}
                      trackStyle={styles.formTrack}
                      style={[
                        styles.formBar,
                        hot && { backgroundColor: colors.accent },
                        h.bat!.runs === 0 && !h.bat!.notOut && { backgroundColor: colors.danger },
                      ]}
                    />
                    <Text style={styles.formVs} numberOfLines={1}>
                      {new Date(h.date).getDate()}/{new Date(h.date).getMonth() + 1}
                    </Text>
                  </View>
                );
              })}
            </Card>
          </>
        )}

        <SectionLabel>Batting</SectionLabel>
        {c.batting.innings ? (
          <Tiles
            items={[
              ['Runs', c.batting.runs, true],
              ['Average', fmt(battingAverage(c))],
              ['Strike rate', fmt(strikeRate(c))],
              ['Innings', c.batting.innings],
              ['Highest', `${c.batting.highest}${c.batting.highestNotOut ? '*' : ''}`],
              ['Not outs', c.batting.notOuts],
              ['Fours', c.batting.fours],
              ['Sixes', c.batting.sixes],
              ['50s', c.batting.fifties],
            ]}
          />
        ) : (
          <Card>
            <Text style={styles.none}>Hasn’t batted yet</Text>
          </Card>
        )}

        <SectionLabel>Bowling</SectionLabel>
        {c.bowling.balls ? (
          <Tiles
            items={[
              ['Wickets', c.bowling.wickets, true],
              ['Economy', fmt(economy(c), 2)],
              ['Best', bestFigures(c)],
              ['Overs', bowlingOvers(c)],
              ['Average', fmt(bowlingAverage(c))],
              ['Maidens', c.bowling.maidens],
            ]}
          />
        ) : (
          <Card>
            <Text style={styles.none}>Hasn’t bowled yet</Text>
          </Card>
        )}

        <SectionLabel>Fielding</SectionLabel>
        <Tiles
          items={[
            ['Catches', c.fielding.catches],
            ['Run outs', c.fielding.runOuts],
            ['Stumpings', c.fielding.stumpings],
          ]}
        />

        <SectionLabel>Matches</SectionLabel>
        <Card style={{ padding: 0 }}>
          {c.history.map((h, i) => (
            <MatchRow key={h.matchId} line={h} first={i === 0} />
          ))}
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', paddingHorizontal: space.lg, paddingVertical: space.sm },
  missing: { color: colors.muted, textAlign: 'center', marginTop: space.xxl },
  hero: {
    borderRadius: radius.xl,
    padding: space.xl,
    alignItems: 'flex-start',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: hero.line,
  },
  name: { fontFamily: font.posterBlack, fontSize: 49, lineHeight: 55, color: hero.text, letterSpacing: -1.5, marginTop: space.lg, alignSelf: 'stretch' },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  formPill: { flexDirection: 'row', alignItems: 'center', height: 28, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: hero.ink(0.12) },
  formPillText: { ...type.label, color: hero.text },
  formPillValue: { fontFamily: font.posterBlack, fontSize: 15, letterSpacing: 0, ...type.num },
  teamTag: { alignSelf: 'flex-start', backgroundColor: colors.accent, paddingHorizontal: 10, height: 24, borderRadius: radius.sm, justifyContent: 'center', transform: [{ skewX: '-8deg' }] },
  teamTagText: { ...type.label, color: colors.onAccent },
  heroStats: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    marginTop: space.xl,
    backgroundColor: colors.inset,
    borderRadius: radius.md,
    paddingVertical: space.md,
  },
  heroStat: { flex: 1, alignItems: 'center' },
  heroValue: { color: hero.text, fontSize: 28, lineHeight: 31, fontFamily: font.posterBlack, ...type.num },
  heroLabel: { ...type.label, fontSize: 9, color: hero.faint, marginTop: 2 },
  form: { flexDirection: 'row', gap: space.sm },
  formChip: {
    minWidth: 52,
    height: 44,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formHot: { borderColor: colors.gold, backgroundColor: colors.goldDim },
  formHint: { color: colors.faint, fontSize: 12, fontFamily: font.medium },
  formCard: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 160, paddingBottom: space.md },
  formCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  formTrack: { height: 90, width: '100%', maxWidth: 24, marginTop: 4, justifyContent: 'flex-end' },
  formBar: { width: '100%', borderRadius: 6, backgroundColor: ink(0.25) },
  formVs: { color: colors.faint, fontSize: 9, fontFamily: font.bold, marginTop: 4 },
  formText: { color: colors.text, fontSize: 16, fontFamily: font.posterBlack, ...type.num },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: {
    width: '31.5%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
  },
  tileHero: { borderColor: colors.accent, backgroundColor: colors.accentDim },
  tileValue: { color: colors.text, fontSize: 28, lineHeight: 31, fontFamily: font.posterBlack, ...type.num },
  tileLabel: { color: colors.muted, fontSize: 12, fontFamily: font.semibold, marginTop: 2 },
  none: { color: colors.muted, fontSize: 14 , fontFamily: font.regular},
  matchRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  matchBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  result: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.surfaceHi,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultText: { color: colors.muted, fontFamily: font.heavy, fontSize: 13 },
  matchTitle: { color: colors.text, fontSize: 15, fontFamily: font.bold },
  matchDate: { color: colors.faint, fontSize: 12, fontFamily: font.regular, marginTop: 1 },
  matchFigures: { color: colors.muted, fontSize: 13, fontFamily: font.bold, ...type.num },
});
