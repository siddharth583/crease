import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PlayerAvatar } from '../../components/Avatar.tsx';
import { Card, IconButton, PageToneProvider, PressableScale, Screen, usePageTone, SectionLabel, tap, GhostWord, PitchStripes, useToast, inYear, matchYears, YearChips } from '../../components/ui.tsx';
import { CountUp, GrowBar } from '../../components/motion.tsx';
import { Page, useLayout } from '../../components/layout.tsx';
import { RatingChips } from '../../components/Ratings.tsx';
import { playerRatings } from '../../engine/ratings.ts';
import { oversText } from '../../engine/engine.ts';
import { BALLS_TO_CALL, matchups, type Matchup } from '../../engine/records.ts';
import type { Match } from '../../engine/types.ts';
import {
  battingAverage,
  bestFigures,
  bowlingAverage,
  bowlingOvers,
  careerStats,
  COMMON_TEAM,
  economy,
  keyFor,
  strikeRate,
  type MatchLine,
} from '../../engine/stats.ts';
import { useMatches } from '../../store/matches.tsx';
import { useSquad } from '../../store/squad.ts';
import { useAccess, usePhotos, useSetPhoto } from '../../store/sync.tsx';
import { pickPhoto } from '../../store/files.ts';
import { colors, gradients, radius, space, type, font, ink, hero, ownTeamTheme, teamTheme } from '../../theme.ts';
import { photoFor, photoKey } from '../../engine/photos.ts';

const fmt = (n: number | null, digits = 1) => (n === null ? '–' : n.toFixed(digits));
const day = (ms: number) => new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * The side they play for most (the latest of them on a tie), not just their last. Matches as the common player count
 * for neither; someone who has only ever been the common player is "Both teams".
 */
function mainTeam(matches: Match[], key: string): string {
  const count = new Map<string, { name: string; n: number; last: number }>();
  for (const m of matches)
    for (const t of m.teams)
      for (const p of t.players) {
        if (p.common || keyFor(t, p) !== key) continue;
        const k = t.name.trim().toLowerCase();
        const was = count.get(k) ?? { name: t.name.trim(), n: 0, last: 0 };
        count.set(k, { name: t.name.trim(), n: was.n + 1, last: Math.max(was.last, m.createdAt) });
      }
  const best = [...count.values()].sort((a, b) => b.n - a.n || b.last - a.last)[0];
  return best?.name ?? COMMON_TEAM;
}

type Milestone = { title: string; line: MatchLine };

/** Their landmarks, in the match each came in: a first fifty, career runs and wickets. Oldest first. */
function milestones(history: MatchLine[]): Milestone[] {
  const out: Milestone[] = [];
  let runs = 0;
  let wickets = 0;
  let fifty = false;
  const RUNS = [100, 250, 500, 1000];
  const WICKETS = [10, 25, 50];
  for (const line of [...history].reverse()) {
    const r = line.bat?.runs ?? 0;
    if (!fifty && r >= 50) {
      fifty = true;
      out.push({ title: `First fifty: ${r}${line.bat!.notOut ? '*' : ''}`, line });
    }
    for (const n of RUNS) if (runs < n && runs + r >= n) out.push({ title: `${n} career runs`, line });
    runs += r;
    const w = line.bowl?.wickets ?? 0;
    for (const n of WICKETS) if (wickets < n && wickets + w >= n) out.push({ title: `${n} career wickets`, line });
    wickets += w;
  }
  return out;
}

/** One duel on the player's page: the other player, how often one got the other out, and the duel's page. */
function DuelRow({ m, name, first }: { m: Matchup; name: string; first: boolean }) {
  return (
    <PressableScale
      scaleTo={0.98}
      onPress={() => router.push({ pathname: '/rivalry', params: { bat: m.batterKey, bowl: m.bowlerKey } })}
      style={[styles.duel, !first && styles.matchBorder]}
      accessibilityLabel={`${name}: out ${m.outs} times in ${m.balls} balls`}
    >
      <PlayerAvatar name={name} size={32} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.matchTitle} numberOfLines={2}>
          {name}
        </Text>
        <Text style={styles.matchDate}>
          {m.runs} off {m.balls} ball{m.balls === 1 ? '' : 's'} · {m.matches} match{m.matches === 1 ? '' : 'es'}
        </Text>
      </View>
      <Text style={styles.duelOuts}>
        {m.outs}
        <Text style={styles.duelUnit}>×</Text>
      </Text>
      <Ionicons name="chevron-forward" size={16} color={colors.faint} />
    </PressableScale>
  );
}

/** A figure that counts up when it's a number ("24.5", 147); text like "3/18" or "–" just shows. */
function Figure({ value, style }: { value: string | number; style: StyleProp<TextStyle> }) {
  const text = String(value);
  if (!/^\d+(\.\d+)?$/.test(text)) return <Text style={style}>{text}</Text>;
  const decimals = text.includes('.') ? text.split('.')[1].length : 0;
  return <CountUp value={Number(text)} style={style} format={(n) => n.toFixed(decimals)} />;
}

/** Three to a row, always: a short last row keeps the columns above it rather than stretching across. */
function Tiles({ items }: { items: [string, string | number, boolean?][] }) {
  const tone = usePageTone();
  const rows: (typeof items)[] = [];
  items.forEach((item, i) => (rows[Math.floor(i / 3)] ??= []).push(item));
  return (
    <View style={styles.tiles}>
      {rows.map((row, r) => (
        <View key={r} style={styles.tileRow}>
          {[0, 1, 2].map((k) => {
            if (!row[k]) return <View key={k} style={styles.tileGap} />;
            const [label, value, hero] = row[k];
            return (
              <View key={label} style={[styles.tile, tone && { backgroundColor: tone.card, borderColor: tone.line }, hero && (tone ? { borderColor: tone.accent, backgroundColor: tone.soft } : styles.tileHero)]}>
                <Figure value={value} style={[styles.tileValue, hero && { color: tone?.ink ?? colors.accentInk }]} />
                <Text style={styles.tileLabel}>{label}</Text>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function MatchRow({ line, first }: { line: MatchLine; first: boolean }) {
  const tone = usePageTone();
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
          line.won === true && { backgroundColor: tone?.soft ?? colors.accentDim },
          line.won === false && { backgroundColor: colors.dangerDim },
        ]}
      >
        <Text
          style={[
            styles.resultText,
            line.won === true && { color: tone?.ink ?? colors.accentInk },
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
  const photos = usePhotos();
  const setPhoto = useSetPhoto();
  const { admin } = useAccess();
  const toast = useToast();
  const layout = useLayout();
  const { wide, desk } = layout;
  const [year, setYear] = useState<number | null>(null);
  const whole = useMemo(() => careerStats(matches).find((x) => x.key === key), [matches, key, squad]);
  // A season: only the years they played in, and every figure below from that year's matches alone.
  const years = useMemo(() => matchYears((whole?.history ?? []).map((h) => ({ createdAt: h.date }))), [whole]);
  const seasonMatches = useMemo(() => inYear(matches, year), [matches, year]);
  const c = useMemo(() => (year === null ? whole : careerStats(seasonMatches).find((x) => x.key === key) ?? whole), [whole, year, seasonMatches, key, squad]);
  const team = useMemo(() => (whole ? mainTeam(matches, whole.key) : COMMON_TEAM), [matches, whole, squad]);
  const duels = useMemo(() => matchups(seasonMatches), [seasonMatches, squad]);
  const photo = c ? photoFor(photos, c.name) : undefined;
  // The page wears the colours of the side they play for most.
  const side = teamTheme(team);
  // Their side's theme over the whole page: the haze, the cards, the highlights.
  const tone = ownTeamTheme(team) ?? null;
  // Their match ratings out of 10 and their form, as on the squad list.
  const rated = useMemo(() => playerRatings(matches, key), [matches, key]);

  // The admin can set a squad player's photo from here.
  const regular = c ? squad.find((p) => photoKey(p.name) === photoKey(c.name)) : undefined;
  const choosePhoto = async () => {
    if (!regular) return;
    try {
      const picked = await pickPhoto();
      if (picked) await setPhoto(regular, picked);
    } catch {
      toast.show('Couldn’t save the photo. Try again.', 'error');
    }
  };
  const bar = (
    <View style={[styles.header, wide && { paddingHorizontal: 0, paddingTop: space.lg, paddingBottom: space.md }]}>
      <IconButton icon="chevron-back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/players'))} />
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        {c && (
          <PressableScale
            scaleTo={0.94}
            accessibilityLabel={`Compare ${c.name} with another player`}
            onPress={() => router.push({ pathname: '/compare', params: { a: c.key } })}
            style={styles.compare}
          >
            <Ionicons name="git-compare-outline" size={17} color={colors.text} />
            <Text style={styles.compareText}>Compare</Text>
          </PressableScale>
        )}
        {admin && regular && <IconButton icon="camera-outline" label={photo ? 'Change photo' : 'Add photo'} onPress={() => void choosePhoto()} />}
      </View>
    </View>
  );
  // A tablet or laptop: the bar lines up with the page under it.
  const back = wide ? (
    <View style={{ paddingHorizontal: layout.gutter }}>
      <Page>{bar}</Page>
    </View>
  ) : (
    bar
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
  // Landmarks count the whole career (a season's 100 runs isn't one); a season shows the ones that came in it.
  const marks = milestones((whole ?? c).history).filter((m) => year === null || new Date(m.line.date).getFullYear() === year);
  // Who gets them out most, and whom they get out most: every duel with a wicket in it, most wickets first.
  const byOuts = (a: Matchup, b: Matchup) => b.outs - a.outs || a.balls - b.balls;
  const nemeses = duels.filter((d) => d.batterKey === c.key && d.outs > 0).sort(byOuts).slice(0, 3);
  const bunnies = duels.filter((d) => d.bowlerKey === c.key && d.outs > 0).sort(byOuts).slice(0, 3);
  // Oldest first, so the chart reads left to right like a season.
  const form = c.history.filter((h) => h.bat).slice(0, 10).reverse();
  const peak = Math.max(20, ...form.map((h) => h.bat!.runs));

  const sections = {
    ratings: (
      <>
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
      </>
    ),
    form: (
      <>
      {form.length > 0 && (
        <>
          <SectionLabel right={<Text style={styles.formHint}>Last {form.length} innings</Text>}>Recent innings</SectionLabel>
          <Card style={styles.formCard}>
            {form.map((h, i) => {
              const hot = h.bat!.runs >= 30;
              return (
                <View key={h.matchId} style={styles.formCol}>
                  <Text style={[styles.formText, hot && { color: side.ink }]}>
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
                      hot && { backgroundColor: side.accent },
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
      </>
    ),
    batting: (
      <>
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
      </>
    ),
    bowling: (
      <>
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
            ['Fours conceded', c.bowling.fours],
            ['Sixes conceded', c.bowling.sixes],
          ]}
        />
      ) : (
        <Card>
          <Text style={styles.none}>Hasn’t bowled yet</Text>
        </Card>
      )}
      </>
    ),
    fielding: (
      <>
      <SectionLabel>Fielding</SectionLabel>
      <Tiles
        items={[
          ['Catches', c.fielding.catches],
          ['Run outs', c.fielding.runOuts],
          ['Stumpings', c.fielding.stumpings],
        ]}
      />
      </>
    ),
    marks: (
      <>
      {marks.length > 0 && (
        <>
          <SectionLabel right={<Text style={styles.formHint}>{marks.length}</Text>}>Milestones</SectionLabel>
          <Card style={{ padding: 0 }}>
            {marks.map((m, i) => (
              <PressableScale
                key={`${m.title}-${m.line.matchId}`}
                scaleTo={0.98}
                onPress={() => router.push({ pathname: '/match/[id]/scorecard', params: { id: m.line.matchId } })}
                style={[styles.duel, i > 0 && styles.matchBorder]}
              >
                <View style={[styles.result, { backgroundColor: tone?.soft ?? colors.goldDim }]}>
                  <Ionicons name="ribbon" size={15} color={tone?.ink ?? colors.gold} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.matchTitle}>{m.title}</Text>
                  <Text style={styles.matchDate} numberOfLines={1}>
                    vs {m.line.opponent} · {day(m.line.date)}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.faint} />
              </PressableScale>
            ))}
          </Card>
        </>
      )}
      </>
    ),
    rivals: (
      <>
      {(nemeses.length > 0 || bunnies.length > 0) && (
        <>
          <SectionLabel>Rivalries</SectionLabel>
          <View style={{ gap: space.md }}>
            {nemeses.length > 0 && (
              <Card style={{ padding: 0 }}>
                <Text style={styles.duelHead}>Who gets {c.name.split(' ')[0]} out</Text>
                {nemeses.map((d, i) => (
                  <DuelRow key={d.id} m={d} name={d.bowler} first={i === 0} />
                ))}
              </Card>
            )}
            {bunnies.length > 0 && (
              <Card style={{ padding: 0 }}>
                <Text style={styles.duelHead}>Whom {c.name.split(' ')[0]} gets out most</Text>
                {bunnies.map((d, i) => (
                  <DuelRow key={d.id} m={d} name={d.batter} first={i === 0} />
                ))}
              </Card>
            )}
            <Text style={styles.formHint}>Tap one for the whole duel. A duel gets a verdict once they’ve met for {BALLS_TO_CALL} balls.</Text>
          </View>
        </>
      )}
      </>
    ),
    matches: (
      <>
      <SectionLabel>Matches</SectionLabel>
      <Card style={{ padding: 0 }}>
        {c.history.map((h, i) => (
          <MatchRow key={h.matchId} line={h} first={i === 0} />
        ))}
      </Card>
      </>
    ),
  };

  return (
    <PageToneProvider value={tone}>
      <Screen>
      {back}
      <ScrollView contentContainerStyle={{ padding: wide ? layout.gutter : space.lg, paddingTop: 0, paddingBottom: insets.bottom + space.xxl }}>
        <Page>
        <LinearGradient colors={side.hero} start={{ x: 0, y: 0 }} end={{ x: wide ? 1 : 0, y: 1 }} style={[styles.hero, wide && styles.heroWide]}>
          <PitchStripes tint="255,255,255" />
          {!photo && (
            <GhostWord size={260} style={{ right: -20, top: -60, color: hero.ink(0.05) }}>
              {c.name.slice(0, 1)}
            </GhostWord>
          )}
          <View style={photo ? [styles.stage, wide && styles.stageWide] : styles.plain}>
            {photo && (
              // Their photo set into the corner, the shoulders and the left edge fading into the card. Larger on a
              // tablet or laptop, where the panel runs the width of the page.
              <Image source={{ uri: photo }} style={[styles.portrait, wide && styles.portraitWide, PORTRAIT_FADE]} resizeMode="cover" accessibilityIgnoresInvertColors />
            )}
            <View style={styles.heroTop}>
              {team === COMMON_TEAM ? (
                // The common player has no one side: a label, not a link to an empty page.
                <View style={[styles.teamTag, { backgroundColor: side.accent }]}>
                  <Text style={[styles.teamTagText, { color: side.onAccent }]}>{team}</Text>
                </View>
              ) : (
                <PressableScale
                  scaleTo={0.95}
                  hitSlop={10}
                  onPress={() => router.push({ pathname: '/team/[name]', params: { name: team } })}
                  accessibilityLabel={`${team} team page`}
                  style={[styles.teamTag, { backgroundColor: side.accent }]}
                >
                  <Text style={[styles.teamTagText, { color: side.onAccent }]}>{team} ›</Text>
                </PressableScale>
              )}
              {rated.form !== null && (
                <View style={[styles.formPill, rated.form >= 8 && { backgroundColor: side.accent }]}>
                  <Text style={[styles.formPillText, rated.form >= 8 && { color: side.onAccent }]}>
                    Form <Text style={styles.formPillValue}>{rated.form.toFixed(1)}</Text>
                  </Text>
                </View>
              )}
            </View>
            <Text
              style={[
                styles.name,
                photo ? [styles.nameOnPhoto, longestWord(c.name) > 10 && styles.nameOnPhotoLong] : longestWord(c.name) > 10 && styles.nameLong,
                wide && styles.nameWide,
                wide && photo && { maxWidth: '62%' },
              ]}
              numberOfLines={2}
            >
              {c.name}
            </Text>
          </View>
          <View style={[styles.heroStats, photo && { marginTop: space.md }, wide && styles.heroStatsWide]}>
            {[
              ['Matches', c.matches],
              ['Won', wins],
              ['Runs', c.batting.runs],
              ['Wickets', c.bowling.wickets],
            ].map(([label, value]) => (
              <View key={label} style={styles.heroStat}>
                <CountUp value={Number(value)} style={[styles.heroValue, wide && { fontSize: 34, lineHeight: 38 }]} />
                <Text style={styles.heroLabel}>{label}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        {years.length > 1 && (
          <View style={{ marginTop: space.md }}>
            <YearChips years={years} value={year} onChange={setYear} />
          </View>
        )}

        {wide ? (
          // A tablet: the numbers on the left, the story (ratings, form, landmarks, rivals, matches) on the right. A
          // laptop: the numbers, then form and landmarks, then rivals and matches, each a column.
          <View style={styles.wideCols}>
            <View style={styles.wideCol}>
              {sections.batting}
              {sections.bowling}
              {sections.fielding}
            </View>
            <View style={styles.wideCol}>
              {sections.ratings}
              {sections.form}
              {sections.marks}
              {!desk && sections.rivals}
              {!desk && sections.matches}
            </View>
            {desk && (
              <View style={styles.wideCol}>
                {sections.rivals}
                {sections.matches}
              </View>
            )}
          </View>
        ) : (
          <>
            {sections.ratings}
            {sections.form}
            {sections.batting}
            {sections.bowling}
            {sections.fielding}
            {sections.marks}
            {sections.rivals}
            {sections.matches}
          </>
        )}
        </Page>
      </ScrollView>
      </Screen>
    </PageToneProvider>
  );
}

/** A long word (a surname like Bhattacharjee) gets smaller type, so it fits on its line rather than being cut. */
const longestWord = (name: string) => Math.max(...name.split(/\s+/).map((w) => w.length));

/** Fades the portrait's shoulders and its left edge into the card (the browser's mask; elsewhere it shows as is). */
const PORTRAIT_FADE = (Platform.OS === 'web'
  ? {
      maskImage: 'linear-gradient(to bottom, #000 62%, transparent 100%), linear-gradient(to right, transparent 0%, #000 22%)',
      maskComposite: 'intersect',
      WebkitMaskImage: 'linear-gradient(to bottom, #000 62%, transparent 100%), linear-gradient(to right, transparent 0%, #000 22%)',
      WebkitMaskComposite: 'source-in',
    }
  : {}) as object;

const styles = StyleSheet.create({
  plain: { alignSelf: 'stretch' },
  heroWide: { padding: space.xxl, minHeight: 300 },
  stageWide: { height: 220 },
  portraitWide: { top: -space.xxl, right: -space.xxl, width: 340, height: 340 },
  nameWide: { fontSize: 64, lineHeight: 70, letterSpacing: -2 },
  heroStatsWide: { alignSelf: 'flex-start', width: '100%', maxWidth: 560, paddingHorizontal: space.md, zIndex: 1 },
  wideCols: { flexDirection: 'row', gap: space.lg, alignItems: 'flex-start' },
  wideCol: { flex: 1, minWidth: 0 },
  // With a photo: a fixed stage the photo fills on the right; the tags at the top, the name at the foot over the faded shoulders.
  stage: { alignSelf: 'stretch', height: 168, justifyContent: 'space-between' },
  portrait: { position: 'absolute', top: -space.xl, right: -space.xl, width: 200, height: 200 },
  nameOnPhoto: { fontSize: 36, lineHeight: 40, letterSpacing: -1, marginTop: 0, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 14, textShadowOffset: { width: 0, height: 2 } },
  nameOnPhotoLong: { fontSize: 30, lineHeight: 34 },
  nameLong: { fontSize: 38, lineHeight: 44 },
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingVertical: space.sm },
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
  // The team, and their form under it, the same size.
  heroTop: { alignSelf: 'flex-start', alignItems: 'flex-start', gap: 6 },
  formPill: { flexDirection: 'row', alignItems: 'center', height: 24, paddingHorizontal: 10, borderRadius: radius.sm, backgroundColor: hero.ink(0.12) },
  formPillText: { ...type.label, color: hero.text },
  formPillValue: { fontFamily: font.heavy, letterSpacing: 0, ...type.num },
  teamTag: { alignSelf: 'flex-start', backgroundColor: colors.accent, paddingHorizontal: 10, height: 24, borderRadius: radius.sm, justifyContent: 'center', transform: [{ skewX: '-8deg' }] },
  teamTagText: { ...type.label, color: colors.onAccent },
  // On the dark panel in either theme: a darker strip and the night greys, so it reads in Day mode too.
  heroStats: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    marginTop: space.xl,
    backgroundColor: hero.inset,
    borderRadius: radius.md,
    paddingVertical: space.md,
  },
  heroStat: { flex: 1, alignItems: 'center' },
  heroValue: { color: hero.text, fontSize: 28, lineHeight: 31, fontFamily: font.posterBlack, ...type.num },
  heroLabel: { ...type.label, fontSize: 9, color: hero.muted, marginTop: 2 },
  compare: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 44, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: colors.surfaceHi, borderWidth: 1, borderColor: colors.border },
  compareText: { color: colors.text, fontSize: 13, fontFamily: font.bold },
  duel: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  duelHead: { ...type.label, color: colors.muted, paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.xs },
  duelOuts: { color: colors.danger, fontSize: 22, fontFamily: font.posterBlack, ...type.num },
  duelUnit: { fontSize: 14, fontFamily: font.poster },
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
  tiles: { gap: space.sm },
  tileRow: { flexDirection: 'row', gap: space.sm },
  tileGap: { flex: 1 },
  tile: {
    flex: 1,
    minWidth: 0,
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
