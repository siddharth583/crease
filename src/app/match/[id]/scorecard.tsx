import { MomAward } from '../../../components/MomAward.tsx';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, type ComponentProps, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, type StyleProp, type TextStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PlayerAvatar } from '../../../components/Avatar.tsx';
import { NameSuggestions } from '../../../components/NameSuggestions.tsx';
import { OverEditSheet } from '../../../components/OverEditSheet.tsx';
import { ExportSheet } from '../../../components/ExportSheet.tsx';
import { canChangeResult, ResultSheet } from '../../../components/ResultSheet.tsx';
import { BallByBall, Partnerships, ChaseInsights, RunRace } from '../../../components/MatchCharts.tsx';
import { FallOfWickets, Grow, Manhattan, RunMix } from '../../../components/ScoreCharts.tsx';
import { TeamCrest } from '../../../components/TeamCrest.tsx';
import { OvalGround, SeamDivider } from '../../../components/cricket.tsx';
import { CountUp, Pulse, PopIn, Rise, Sheen } from '../../../components/motion.tsx';
import { BallChip, Button, Card, IconButton, PressableScale, Screen, SectionLabel, Segmented, Sheet, useToast, WideHead } from '../../../components/ui.tsx';
import { Columns, Page, useLayout } from '../../../components/layout.tsx';
import { BOWLER_WICKETS, dismissal, fairBalls, matchState, oversText, playerName, renamePlayer, replaceOver, retirements, setRetirement, type BatterLine, type BowlerLine, type InningsState, type MatchState } from '../../../engine/engine.ts';
import { isPlaceholder, keyFor, momChoices, playerOfTheMatch, type PlayerOfMatch } from '../../../engine/stats.ts';
import type { BallEvent, Match, Team } from '../../../engine/types.ts';
import { useMatch, useMatches } from '../../../store/matches.tsx';
import { useMatchFiles } from '../../../store/useMatchFiles.ts';
import { useAccess, useClubSync } from '../../../store/sync.tsx';
import { colors, radius, space, type, font, edge, gradients, hero, ink } from '../../../theme.ts';

type IconName = ComponentProps<typeof Ionicons>['name'];

const econ = (runs: number, balls: number) => (balls ? ((runs * 6) / balls).toFixed(1) : '–');
const sr = (runs: number, balls: number) => (balls ? ((runs * 100) / balls).toFixed(1) : '–');

/** A side's name short enough for a tab: "Copan Strikers" v "Copan Royals" is Strikers v Royals. */
function shortSide(name: string, match: Match) {
  const words = match.teams.map((t) => t.name.trim().split(/\s+/));
  const shared = words[0].length > 1 && words[1].length > 1 && words[0][0].toLowerCase() === words[1][0].toLowerCase();
  return shared ? name.trim().split(/\s+/).slice(1).join(' ') : name.trim();
}

/** The innings' top scorer, if anyone scored. */
const topBatter = (s: InningsState): BatterLine | null => s.batters.reduce<BatterLine | null>((a, b) => (b.runs > (a?.runs ?? 0) ? b : a), null);
/** Most wickets, then fewest runs. */
const bestBowler = (s: InningsState): BowlerLine | null =>
  s.bowlers.filter((b) => b.balls > 0).reduce<BowlerLine | null>((a, b) => (!a || b.wickets > a.wickets || (b.wickets === a.wickets && b.runs < a.runs) ? b : a), null);

/** A hat-trick in the log: three wicket balls in a row by one bowler (wides and no-balls don't break it). */
function hatTricks(s: InningsState) {
  const run: Record<string, number> = {};
  const got: string[] = [];
  for (const d of s.log) {
    const id = d.bowler;
    if (!id) continue;
    const w = d.ball.wicket;
    if (w && BOWLER_WICKETS.includes(w.kind)) {
      run[id] = (run[id] ?? 0) + 1;
      if (run[id] === 3) got.push(id);
    } else if (d.ball.extra !== 'wide' && d.ball.extra !== 'noball') run[id] = 0;
  }
  return got;
}

/** The match's moments in a few words: milestones, five-fors, hat-tricks, the best stand, a close finish. */
function matchStory(match: Match, state: MatchState): { icon: IconName; text: string }[] {
  const out: { icon: IconName; text: string }[] = [];
  state.innings.forEach((s) => {
    s.batters.forEach((b) => {
      if (b.runs >= 100) out.push({ icon: 'ribbon', text: `${playerName(match, b.id)} hundred (${b.runs})` });
      else if (b.runs >= 50) out.push({ icon: 'flame', text: `${playerName(match, b.id)} fifty (${b.runs})` });
    });
    s.bowlers.forEach((b) => {
      if (b.wickets >= 5) out.push({ icon: 'ribbon', text: `${playerName(match, b.id)} five-for (${b.wickets}/${b.runs})` });
      else if (b.wickets === 3 || b.wickets === 4) out.push({ icon: 'flash', text: `${playerName(match, b.id)} ${b.wickets}/${b.runs}` });
    });
    hatTricks(s).forEach((id) => out.push({ icon: 'trophy', text: `Hat-trick: ${playerName(match, id)}` }));
  });
  const stands = state.innings.flatMap((s) => s.partnerships.map((p) => ({ p, s })));
  const best = stands.reduce<(typeof stands)[number] | null>((a, x) => (x.p.runs > (a?.p.runs ?? 0) ? x : a), null);
  if (best && best.p.runs >= 30) {
    const names = best.p.batters.filter((id): id is string => Boolean(id)).map((id) => playerName(match, id));
    out.push({ icon: 'people', text: `Best stand ${best.p.runs}: ${names.join(' & ')}` });
  }
  const mostSixes = state.innings.flatMap((s) => s.batters).reduce<BatterLine | null>((a, b) => (b.sixes > (a?.sixes ?? 0) ? b : a), null);
  if (mostSixes && mostSixes.sixes >= 3) out.push({ icon: 'rocket', text: `${mostSixes.sixes} sixes: ${playerName(match, mostSixes.id)}` });
  const b = state.innings[1];
  if (state.winner && b.status === 'done' && b.target !== null) {
    const close = state.winner === b.battingTeam.id ? allOutLeft(b) <= 1 && b.runs >= b.target : b.target - 1 - b.runs <= 5;
    if (close) out.push({ icon: 'timer', text: 'Went down to the wire' });
  }
  return out;
}
const allOutLeft = (s: InningsState) => Math.max(0, s.battingTeam.players.length - 1 - s.wickets);

function PlayerLink({ match, team, id, style, after }: { match: Match; team: Team; id: string; style: StyleProp<TextStyle>; after?: string }) {
  const base = playerName(match, id);
  const marks = `${match.captains?.[team.id] === id ? ' (c)' : ''}${match.keepers?.[team.id] === id ? ' †' : ''}${after ?? ''}`;
  const name = base;
  if (isPlaceholder(name))
    return (
      <View style={styles.who}>
        <PlayerAvatar name="" size={24} />
        <Text numberOfLines={2} style={[style, { flexShrink: 1 }]}>
          {name + marks}
        </Text>
      </View>
    );
  return (
    <Pressable
      hitSlop={6}
      style={{ flexShrink: 1, minWidth: 0 }}
      onPress={() => router.push({ pathname: '/player/[key]', params: { key: keyFor(team, team.players.find((p) => p.id === id) ?? { name }) } })}
    >
      {({ pressed }) => (
        <View style={[styles.who, pressed && { opacity: 0.6 }]}>
          <PlayerAvatar name={name} size={24} />
          <Text numberOfLines={2} style={[style, { flexShrink: 1 }]}>
            {name}
            {marks}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

/**
 * One innings in the scorer's book: its total, batting, fall of wickets and bowling. `part` draws just one of them, so
 * two columns can share the innings and `fill` stretches its card to the row.
 */
function InningsCard({ match, s, part, fill }: { match: Match; s: InningsState; part?: 'batting' | 'fow' | 'bowling'; fill?: boolean }) {
  const show = (p: 'batting' | 'fow' | 'bowling') => !part || part === p;
  const grow = fill ? { flex: 1 } : null;
  const extras = s.extras.wide + s.extras.noball + s.extras.bye + s.extras.legbye + s.extras.penalty;
  const yetToBat = s.battingTeam.players.filter((p) => !s.batters.some((b) => b.id === p.id));
  // Once the innings is over, whoever didn't get in never will.
  const over = s.status === 'done';
  const atCrease = [s.striker, s.nonStriker];
  const top = topBatter(s);
  const topRuns = Math.max(1, top?.runs ?? 1);
  const star = bestBowler(s);

  return (
    <>
      {show('batting') && (
        <View style={grow}>
          <View style={styles.totalRow}>
            <TeamCrest name={s.battingTeam.name} size={40} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={2} style={styles.totalTeam}>
                {s.battingTeam.name}
              </Text>
              <Text style={styles.totalSub}>
                {oversText(s.legalBalls)} overs · run rate {econ(s.runs, s.legalBalls)}
              </Text>
            </View>
            <Text style={styles.total}>
              <CountUp value={s.runs} style={styles.total} />/{s.wickets}
            </Text>
          </View>

          <SectionLabel>Batting</SectionLabel>
          <Card style={[{ padding: 0, overflow: 'hidden' }, grow]}>
            <View style={styles.head}>
              <Text style={[styles.th, { flex: 1, textAlign: 'left' }]}>BATTER</Text>
              <Text style={[styles.th, { width: 36 }]}>R</Text>
              {['B', '4s', '6s'].map((h) => (
                <Text key={h} style={styles.th}>
                  {h}
                </Text>
              ))}
              <Text style={[styles.th, styles.wide]}>SR</Text>
            </View>
            {s.batters.map((b, i) => {
              const notOut = !b.out && !b.retired;
              const isTop = top?.id === b.id;
              return (
                <View key={b.id} style={styles.row}>
                  {b.runs > 0 && <Grow share={b.runs / topRuns} delay={120 + i * 60} style={[styles.fill, { backgroundColor: isTop ? colors.goldDim : ink(0.04) }]} />}
                  <View style={{ flex: 1, paddingRight: space.sm }}>
                    <View style={styles.nameRow}>
                      <PlayerLink match={match} team={s.battingTeam} id={b.id} style={[styles.name, notOut && { color: colors.accentInk }]} after={notOut && atCrease.includes(b.id) ? '*' : undefined} />
                      {isTop && <Ionicons name="star" size={11} color={colors.gold} style={{ marginLeft: 6 }} accessibilityLabel="Top scorer" />}
                    </View>
                    <Text numberOfLines={2} style={[styles.how, styles.howIndent]}>
                      {dismissal(match, b)}
                    </Text>
                  </View>
                  <Text style={[styles.td, styles.strong, { width: 36 }, isTop && { color: colors.gold, fontSize: 18 }]}>{b.runs}</Text>
                  <Text style={styles.td}>{b.balls}</Text>
                  <Text style={[styles.td, b.fours > 0 && { color: colors.cyan }]}>{b.fours}</Text>
                  <Text style={[styles.td, b.sixes > 0 && { color: colors.accentInk }]}>{b.sixes}</Text>
                  <Text style={[styles.td, styles.wide, styles.srText]}>{sr(b.runs, b.balls)}</Text>
                </View>
              );
            })}
            <View style={styles.row}>
              <Text style={[styles.name, { width: 56 }]}>Extras</Text>
              <Text style={[styles.how, { flex: 1, marginTop: 0 }]}>
                wd {s.extras.wide}, nb {s.extras.noball}, b {s.extras.bye}, lb {s.extras.legbye}
                {s.extras.penalty ? `, pen ${s.extras.penalty}` : ''}
              </Text>
              <Text style={[styles.td, styles.strong, { width: 40 }]}>{extras}</Text>
            </View>
            <View style={[styles.row, styles.totalLine]}>
              <Text style={[styles.name, { flex: 1 }]}>Total</Text>
              <Text style={styles.how}>
                {oversText(s.legalBalls)} ov · RR {econ(s.runs, s.legalBalls)}
              </Text>
              <Text style={[styles.totalNum]}>
                {s.runs}/{s.wickets}
              </Text>
            </View>
            {yetToBat.length > 0 && (
              <View style={[styles.row, { alignItems: 'flex-start' }]}>
                <Text style={styles.how}>
                  <Text style={{ color: colors.muted, fontFamily: font.bold }}>{over ? 'Did not bat' : 'Yet to bat'}  </Text>
                  {yetToBat.map((p) => p.name).join(', ')}
                </Text>
              </View>
            )}
          </Card>
        </View>
      )}

      {show('fow') && (
        <View style={grow}>
          <FallOfWickets match={match} s={s} />
        </View>
      )}

      {show('bowling') && (
        <View style={grow}>
          <SectionLabel>Bowling</SectionLabel>
          <Card style={[{ padding: 0, overflow: 'hidden' }, grow]}>
            <View style={styles.head}>
              <Text style={[styles.th, { flex: 1, textAlign: 'left' }]}>BOWLER</Text>
              {['O', 'M', 'R', 'W'].map((h) => (
                <Text key={h} style={styles.th}>
                  {h}
                </Text>
              ))}
              <Text style={[styles.th, styles.wide]}>ECON</Text>
            </View>
            {s.bowlers.map((b, i) => {
              const isBest = star?.id === b.id && (b.wickets > 0 || s.bowlers.length === 1);
              return (
                <View key={b.id} style={styles.row}>
                  {isBest && <Grow share={1} delay={120 + i * 60} style={[styles.fill, { backgroundColor: colors.goldDim }]} />}
                  <View style={{ flex: 1, paddingRight: space.sm }}>
                    <View style={styles.nameRow}>
                      <PlayerLink match={match} team={s.bowlingTeam} id={b.id} style={styles.name} />
                      {isBest && <Ionicons name="star" size={11} color={colors.gold} style={{ marginLeft: 6 }} accessibilityLabel="Best bowler" />}
                    </View>
                    {(b.wides > 0 || b.noballs > 0) && (
                      <Text style={[styles.how, styles.howIndent]}>
                        {b.wides} wd · {b.noballs} nb
                      </Text>
                    )}
                  </View>
                  <Text style={styles.td}>{oversText(b.balls)}</Text>
                  <Text style={styles.td}>{b.maidens}</Text>
                  <Text style={styles.td}>{b.runs}</Text>
                  <Text style={[styles.td, styles.strong, b.wickets > 0 && { color: isBest ? colors.gold : colors.accentInk }]}>{b.wickets}</Text>
                  <Text style={[styles.td, styles.wide, styles.srText]}>{econ(b.runs, b.balls)}</Text>
                </View>
              );
            })}
            {s.bowlers.length === 0 && <Text style={[styles.how, { padding: space.lg }]}>No overs bowled yet</Text>}
          </Card>
        </View>
      )}
    </>
  );
}

/** The result on the outfield: both sides as a scoreboard, the margin, and the Man of the Match as a brass plaque. */
function ResultHero({
  match,
  state,
  mom,
  canCall,
  admin,
  onCall,
  onPickMom,
  wide,
}: {
  match: Match;
  state: MatchState;
  mom: PlayerOfMatch | null;
  canCall: boolean;
  admin: boolean;
  onCall: () => void;
  onPickMom: () => void;
  wide: boolean;
}) {
  const date = new Date(match.createdAt).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const tossTeam = match.teams.find((t) => t.id === match.toss.winner)?.name;
  const sides = state.innings.slice(0, 2);
  const live = !state.result;

  const meta: { icon: IconName; text: string }[] = [
    { icon: 'calendar-outline', text: date },
    { icon: 'time-outline', text: `${match.rules.overs} overs` },
  ];
  if (match.series) meta.push({ icon: 'trophy-outline', text: `${match.series.name} · match ${match.series.number} of ${match.series.of}` });

  const plaque = mom && (
    <View style={wide ? { flex: 2, minWidth: 0 } : undefined}>
      <MomAward
        name={mom.name}
        team={mom.team}
        summary={mom.summary}
        picked={Boolean(match.mom)}
        compact={wide}
        disabled={isPlaceholder(mom.name)}
        onPress={() => router.push({ pathname: '/player/[key]', params: { key: mom.key } })}
        action={
          admin ? (
            <PressableScale accessibilityLabel="Change the Man of the Match" hitSlop={6} onPress={onPickMom} style={styles.heroPill}>
              <Text style={styles.heroPillText}>Change</Text>
            </PressableScale>
          ) : undefined
        }
      />
    </View>
  );

  const board = (
    <View style={[styles.board, wide && { flex: 3 }]}>
      {sides.map((inn, i) => {
        const started = match.innings[i].events.length > 0;
        const won = state.winner === inn.battingTeam.id;
        return (
          <View key={i} style={{ flex: 1, minWidth: 0, flexDirection: 'row' }}>
            {i === 1 && <Text style={styles.vs}>v</Text>}
            <Rise index={i + 1} style={[styles.side, !won && state.winner ? { opacity: 0.82 } : null]}>
              <View style={styles.crestWrap}>
                <TeamCrest name={inn.battingTeam.name} size={wide ? 58 : 50} />
                {won && (
                  <PopIn delay={700} style={styles.winBadge}>
                    <Ionicons name="trophy" size={11} color={colors.onAccent} accessibilityLabel="Winner" />
                  </PopIn>
                )}
              </View>
              <Text style={[styles.sideName, won && { color: hero.gold }]} numberOfLines={2}>
                {inn.battingTeam.name}
              </Text>
              {started ? (
                <>
                  <View style={styles.scoreRow}>
                    <CountUp value={inn.runs} delay={250 + i * 150} style={styles.score} />
                    <Text style={styles.scoreWk}>/{inn.wickets}</Text>
                  </View>
                  <Text style={styles.sideOvers}>
                    {oversText(inn.legalBalls)} / {match.rules.overs} ov
                  </Text>
                </>
              ) : (
                <Text style={styles.sideOvers}>yet to bat</Text>
              )}
            </Rise>
          </View>
        );
      })}
    </View>
  );

  return (
    <View style={styles.hero}>
      <LinearGradient colors={gradients.hero} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={StyleSheet.absoluteFill} />
      <OvalGround />
      <Sheen />
      <View style={styles.metaRow}>
        {meta.map((m) => (
          <View key={m.text} style={styles.metaChip}>
            <Ionicons name={m.icon} size={12} color={hero.muted} />
            <Text style={styles.metaText} numberOfLines={1}>
              {m.text}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.resultRow}>
        {live ? <Pulse color={colors.danger} size={9} /> : <Ionicons name={state.drawn || !state.winner ? 'remove-circle' : 'trophy'} size={20} color={hero.gold} />}
        <Text style={[styles.resultText, wide && { fontSize: 28, lineHeight: 32 }]} accessibilityRole="header">
          {state.result ?? 'Live · match in progress'}
        </Text>
        {state.result && canCall && (
          <PressableScale accessibilityLabel="Change the result" hitSlop={6} onPress={onCall} style={styles.heroPill}>
            <Text style={styles.heroPillText}>Change</Text>
          </PressableScale>
        )}
      </View>

      <View style={wide ? { flexDirection: 'row', gap: space.lg, alignItems: 'stretch' } : { gap: space.md }}>
        {board}
        {plaque}
      </View>

      {state.innings.length > 2 && (
        <Text style={styles.heroNote}>
          Super over: {state.innings.slice(2).map((inn) => `${shortSide(inn.battingTeam.name, match)} ${inn.runs}/${inn.wickets}`).join(' · ')}
        </Text>
      )}
      {tossTeam && (
        <Text style={styles.heroNote}>
          {tossTeam} won the toss and chose to {match.toss.choice}.
        </Text>
      )}
    </View>
  );
}

/** The sticky row of tabs: summary, each innings with its score, the charts and the commentary. */
function TabBar({ tabs, value, onChange }: { tabs: { value: string; label: string; sub?: string; icon?: IconName }[]; value: string; onChange: (v: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs} accessibilityRole="tablist">
      {tabs.map((t) => {
        const on = t.value === value;
        return (
          <PressableScale
            key={t.value}
            accessibilityLabel={t.label}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            scaleTo={0.95}
            onPress={() => onChange(t.value)}
            style={[styles.tab, on && styles.tabOn]}
          >
            <View style={{ alignItems: 'center' }}>
              <Text style={[styles.tabText, on && styles.tabTextOn]} numberOfLines={1}>
                {t.label}
              </Text>
              {t.sub ? (
                <Text style={[styles.tabSub, on && { color: colors.onAccent, opacity: 0.75 }]} numberOfLines={1}>
                  {t.sub}
                </Text>
              ) : null}
            </View>
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}

/** One row of the options menu. */
function MenuRow({ icon, title, sub, onPress, danger, label }: { icon: IconName; title: string; sub: string; onPress: () => void; danger?: boolean; label: string }) {
  return (
    <PressableScale scaleTo={0.98} accessibilityLabel={label} onPress={onPress} style={styles.menuRow}>
      <View style={[styles.menuIcon, danger && { backgroundColor: colors.dangerDim }]}>
        <Ionicons name={icon} size={20} color={danger ? colors.danger : colors.accentInk} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.menuTitle, danger && { color: colors.danger }]}>{title}</Text>
        <Text style={styles.menuSub}>{sub}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.faint} />
    </PressableScale>
  );
}

/** The Summary tab: the match story, who starred, and the run race. */
function SummaryTab({ match, state, wide }: { match: Match; state: MatchState; wide: boolean }) {
  const story = matchStory(match, state);
  const leaders = state.innings.slice(0, 2).flatMap((s, i) => {
    if (!match.innings[i].events.length) return [];
    const bat = topBatter(s);
    const bowl = bestBowler(s);
    const cards: ReactNode[] = [];
    if (bat)
      cards.push(
        <View key={`b${i}`} style={styles.leader}>
          <Text style={styles.leaderLabel}>TOP SCORER · {shortSide(s.battingTeam.name, match).toUpperCase()}</Text>
          <Text style={styles.leaderName} numberOfLines={1}>
            {playerName(match, bat.id)}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
            <CountUp value={bat.runs} style={styles.leaderBig} delay={300} />
            <Text style={styles.leaderUnit}>runs · {bat.balls} balls</Text>
          </View>
          <Text style={styles.leaderSub}>
            {bat.fours} fours · {bat.sixes} sixes · SR {sr(bat.runs, bat.balls)}
          </Text>
        </View>,
      );
    if (bowl)
      cards.push(
        <View key={`w${i}`} style={styles.leader}>
          <Text style={styles.leaderLabel}>BEST BOWLER · {shortSide(s.bowlingTeam.name, match).toUpperCase()}</Text>
          <Text style={styles.leaderName} numberOfLines={1}>
            {playerName(match, bowl.id)}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
            <Text style={[styles.leaderBig, { color: colors.gold }]}>
              {bowl.wickets}/{bowl.runs}
            </Text>
            <Text style={styles.leaderUnit}>in {oversText(bowl.balls)} ov</Text>
          </View>
          <Text style={styles.leaderSub}>
            economy {econ(bowl.runs, bowl.balls)} · {bowl.maidens} maiden{bowl.maidens === 1 ? '' : 's'}
          </Text>
        </View>,
      );
    return cards;
  });
  if (!match.innings[0].events.length) return <Text style={styles.empty}>The match hasn’t started yet.</Text>;
  const left = (
    <View>
      {story.length > 0 && (
        <>
          <SectionLabel flush>Match story</SectionLabel>
          <View style={styles.storyRow}>
            {story.map((c, i) => (
              <PopIn key={c.text} delay={150 + i * 90} turn={-4}>
                <View style={styles.storyChip}>
                  <Ionicons name={c.icon} size={13} color={colors.gold} />
                  <Text style={styles.storyText}>{c.text}</Text>
                </View>
              </PopIn>
            ))}
          </View>
        </>
      )}
      <SectionLabel>Who starred</SectionLabel>
      <View style={styles.leaders}>
        {leaders.map((c, i) => (
          <Rise key={i} index={i} style={{ flexGrow: 1, flexBasis: wide ? '45%' : '47%', minWidth: 140 }}>
            <Card style={{ flex: 1, gap: 2 }}>{c}</Card>
          </Rise>
        ))}
      </View>
    </View>
  );
  return (
    <Columns weights={[1, 1]} gap={space.lg}>
      {left}
      <View>
        <RunRace state={state} />
      </View>
    </Columns>
  );
}
/** Every over with its bowlers and balls; tap one to rewrite it. */
function OversEditor({ match, s, inningsIndex, onOpen }: { match: Match; s: InningsState; inningsIndex: number; onOpen: (over: number) => void }) {
  const events = match.innings[inningsIndex].events;
  const lastOver = s.overs.reduce((n, o, i) => (o.length ? i : n), 0);
  return (
    <>
      <SectionLabel>Overs · tap one to edit it</SectionLabel>
      <Card style={{ padding: 0 }}>
        {s.overs.map((balls, o) => {
          if (balls.length === 0) return null;
          const fair = fairBalls(match.rules, balls.map((b) => events[b.event!] as BallEvent));
          const off = o !== lastOver && fair !== 6;
          return (
            <PressableScale key={o} scaleTo={0.98} accessibilityLabel={`Edit over ${o + 1}`} onPress={() => onOpen(o)} style={styles.editOver}>
              <View style={styles.editOverHead}>
                <Text style={styles.editOverTitle} numberOfLines={1}>
                  OVER {o + 1} · {(s.overBowlers[o] ?? []).map((id) => playerName(match, id)).join(' → ') || 'no bowler'} · {s.overTotals[o]?.runs ?? 0} runs
                </Text>
                <Ionicons name="create-outline" size={16} color={colors.accentInk} />
              </View>
              <View style={styles.editBalls}>
                {balls.map((b, i) => (
                  <BallChip key={i} ball={b} />
                ))}
              </View>
              {off && <Text style={styles.offNote}>{fair} fair balls: tap to make it 6</Text>}
            </PressableScale>
          );
        })}
      </Card>
    </>
  );
}

/** Every batter who retired in the innings: switch each between retired hurt and retired out. */
function RetirementsEditor({ match, inningsIndex, onChange }: { match: Match; inningsIndex: number; onChange: (eventIndex: number, out: boolean) => void }) {
  const list = retirements(match, inningsIndex);
  return (
    <>
      <SectionLabel>Retirements</SectionLabel>
      <Card style={{ gap: space.md }}>
        {list.length === 0 ? (
          <Text style={styles.namesHint}>
            Nobody retired. If a wicket was really a retirement, tap its over above, tap the ball, and pick Retired hurt or Retired out.
          </Text>
        ) : (
          <>
            <Text style={styles.namesHint}>Retired hurt isn’t a wicket and they can bat again. Retired out is a wicket, to no bowler.</Text>
            {list.map((r) => (
              <View key={r.event} style={{ gap: 6 }}>
                <Text style={styles.namesTeam}>
                  {playerName(match, r.batter)} <Text style={{ color: colors.faint }}>· after {r.over} overs</Text>
                </Text>
                <Segmented
                  value={r.out ? 'out' : 'hurt'}
                  onChange={(v) => v !== (r.out ? 'out' : 'hurt') && onChange(r.event, v === 'out')}
                  options={[
                    { value: 'hurt', label: 'Retired hurt' },
                    { value: 'out', label: 'Retired out' },
                  ]}
                />
              </View>
            ))}
          </>
        )}
      </Card>
    </>
  );
}

/** Pick the Man of the Match by hand, or leave it to Crease. Everyone who played, biggest impact first. */
function MomSheet({ match, visible, onClose, onPick }: { match: Match; visible: boolean; onClose: () => void; onPick: (id: string | undefined) => void }) {
  if (!visible) return null;
  const auto = playerOfTheMatch({ ...match, mom: undefined });
  const choices = momChoices(match);
  return (
    <Sheet visible onClose={onClose} title="Man of the Match">
      <ScrollView style={{ maxHeight: 520 }} contentContainerStyle={{ gap: space.sm, paddingBottom: space.md }}>
        <PressableScale scaleTo={0.98} onPress={() => onPick(undefined)} style={[styles.momPick, !match.mom && styles.momPickOn]}>
          <Ionicons name="sparkles" size={18} color={colors.accentInk} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.momPickName}>Let Crease pick</Text>
            <Text style={styles.momLine} numberOfLines={1}>
              {auto ? `${auto.name} · ${auto.team}` : 'Nobody yet'}
            </Text>
          </View>
          {!match.mom && <Ionicons name="checkmark-circle" size={20} color={colors.accentInk} />}
        </PressableScale>
        <Text style={styles.momHint}>
          Crease picks the biggest impact on the winning side: runs (more for scoring fast), 20 a wicket, 5 a maiden, 8 a
          catch or run out, and runs saved or given away against the match’s scoring rate. Someone on the losing side gets
          it only for half as much again.
        </Text>
        {choices.map((c) => (
          <PressableScale key={c.id} scaleTo={0.98} onPress={() => onPick(c.id)} style={[styles.momPick, match.mom === c.id && styles.momPickOn]}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.momPickName} numberOfLines={1}>
                {c.name}
              </Text>
              <Text style={styles.momLine} numberOfLines={1}>
                {c.team} · {c.summary}
              </Text>
            </View>
            {match.mom === c.id && <Ionicons name="checkmark-circle" size={20} color={colors.accentInk} />}
          </PressableScale>
        ))}
      </ScrollView>
    </Sheet>
  );
}

/** One player's name, editable: saved when they finish typing, put back if left empty. */
function NameField({ name, taken, onSave }: { name: string; taken: string[]; onSave: (name: string) => void }) {
  const [draft, setDraft] = useState(name);
  const save = () => {
    if (!draft.trim()) setDraft(name);
    else if (draft.trim() !== name) onSave(draft);
  };
  return (
    <View style={{ gap: space.sm }}>
    <TextInput
      value={draft}
      onChangeText={setDraft}
      onBlur={save}
      onSubmitEditing={save}
      returnKeyType="done"
      autoCapitalize="words"
      maxLength={28}
      style={styles.nameInput}
      placeholderTextColor={colors.faint}
      accessibilityLabel={`Rename ${name}`}
    />
    {draft.trim() !== name && (
      <NameSuggestions
        value={draft}
        taken={taken}
        onPick={(picked) => {
          setDraft(picked);
          onSave(picked);
        }}
      />
    )}
    </View>
  );
}

/** Every player's name in this match, both sides, to fix a spelling or put in a full name. */
function NamesEditor({ match, onRename }: { match: Match; onRename: (playerId: string, name: string) => void }) {
  return (
    <>
      <SectionLabel>Players’ names</SectionLabel>
      <Card style={{ gap: space.md }}>
        <Text style={styles.namesHint}>Tap a name to change it. Their runs and wickets stay with them, and their stats follow the new name.</Text>
        {match.teams.map((t) => (
          <View key={t.id} style={{ gap: space.sm }}>
            <Text style={styles.namesTeam}>{t.name}</Text>
            {t.players
              .filter((p) => !(p.common && t !== match.teams[0]))
              .map((p) => (
                <NameField
                  key={p.id}
                  name={p.name}
                  taken={match.teams.flatMap((x) => x.players.filter((o) => o.id !== p.id).map((o) => o.name))}
                  onSave={(name) => onRename(p.id, name)}
                />
              ))}
          </View>
        ))}
      </Card>
    </>
  );
}

export default function Scorecard() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { match, saveMatch } = useMatch(id);
  // Only the admin changes a scorecard, picks the Man of the Match or deletes a match.
  const access = useAccess();
  const { admin } = access;
  const { deleteMatch } = useMatches();
  // Signed in to the club, a delete goes to everyone's phone.
  const { user } = useClubSync();
  const [deleting, setDeleting] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingOver, setEditingOver] = useState<number | null>(null);
  const [pickingMom, setPickingMom] = useState(false);
  const [callingResult, setCallingResult] = useState(false);
  const [menu, setMenu] = useState(false);
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<string | null>(null);
  const [talk, setTalk] = useState<string | null>(null);
  const toast = useToast();
  const { exportAs } = useMatchFiles(toast.show);
  const [exporting, setExporting] = useState<Match[] | null>(null);
  const layout = useLayout();
  const { wide } = layout;

  if (!match) return <Screen>{null}</Screen>;
  const state = matchState(match);
  const mom = state.result ? playerOfTheMatch(match) : null;
  // A finished match opens on its summary; one still being played on the innings in progress.
  const shown = tab ?? (state.result ? 'summary' : String(state.current));
  const isInnings = /^\d+$/.test(shown);
  const idx = isInnings ? Number(shown) : 0;
  const s = state.innings[idx];
  const started = match.innings[idx].events.length > 0;
  const talkIdx = Number(talk ?? (state.current > 1 ? 1 : state.innings[1].legalBalls ? 1 : 0));
  const pad = wide ? layout.gutter : space.lg;

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const startEdit = () => {
    setEditMode(true);
    if (!isInnings) setTab(String(Math.min(state.current, state.innings.length - 1)));
  };
  const tools = (
    <>
      {admin && editMode && <IconButton icon="checkmark" label="Done editing" onPress={() => setEditMode(false)} />}
      <PressableScale accessibilityLabel="Match options" scaleTo={0.95} onPress={() => setMenu(true)} style={styles.options}>
        <Ionicons name="ellipsis-horizontal" size={18} color={colors.text} />
        <Text style={styles.optionsText}>Options</Text>
      </PressableScale>
    </>
  );
  const names = (
    <NamesEditor
      match={match}
      onRename={(playerId, name) => {
        const renamed = renamePlayer(match, playerId, name);
        if (!renamed || renamed === match) return;
        saveMatch(renamed);
        toast.show(`${playerName(match, playerId)} is now ${playerName(renamed, playerId)}`, 'success');
      }}
    />
  );

  const tabs = [
    { value: 'summary', label: 'Summary' },
    ...state.innings.slice(0, 2).map((inn, i) => ({ value: String(i), label: shortSide(inn.battingTeam.name, match), sub: match.innings[i].events.length ? `${inn.runs}/${inn.wickets}` : 'yet to bat' })),
    ...state.innings.slice(2).map((inn, i) => ({ value: String(i + 2), label: `Super over`, sub: `${shortSide(inn.battingTeam.name, match)} ${inn.runs}/${inn.wickets}` })),
    { value: 'insights', label: 'Insights' },
    { value: 'commentary', label: 'Commentary' },
  ];

  const empty = <Text style={styles.empty}>{s.battingTeam.name} haven’t batted yet.</Text>;
  let body: ReactNode;
  if (shown === 'summary') body = <SummaryTab match={match} state={state} wide={wide} />;
  else if (shown === 'insights')
    body = match.innings[0].events.length ? (
      <Columns weights={[1, 1]} gap={space.lg}>
        <View>
          <RunRace state={state} />
          <Manhattan state={state} />
        </View>
        <View>
          <ChaseInsights match={match} state={state} />
          <RunMix state={state} />
        </View>
      </Columns>
    ) : (
      <Text style={styles.empty}>Charts appear once the match is under way.</Text>
    );
  else if (shown === 'commentary') {
    const cs = state.innings[talkIdx];
    body = (
      <>
        <Segmented
          multiline
          value={String(talkIdx)}
          onChange={setTalk}
          options={state.innings.map((inn, i) => ({ value: String(i), label: i < 2 ? inn.battingTeam.name : `Super over · ${shortSide(inn.battingTeam.name, match)}` }))}
        />
        {match.innings[talkIdx].events.length > 0 ? (
          <Columns weights={[3, 2]} gap={space.lg}>
            <BallByBall match={match} s={cs} initial={6} />
            <View>
              <FallOfWickets match={match} s={cs} />
              <Partnerships match={match} s={cs} />
            </View>
          </Columns>
        ) : (
          <Text style={styles.empty}>{cs.battingTeam.name} haven’t batted yet.</Text>
        )}
      </>
    );
  } else if (!started) body = empty;
  else if (editMode && admin)
    body = (
      <>
        <View style={styles.editHint}>
          <Ionicons name="create-outline" size={16} color={colors.accentInk} />
          <Text style={styles.editHintText}>
            Editing. Tap any over below to change its balls, add or take some away, or say who bowled them (a new bowler
            mid-over takes over from the ball they started). Every over keeps its 6 fair balls.{' '}
            {wide ? 'Retirements are under the overs, players’ names under the card.' : 'Retirements and players’ names are at the bottom.'}
          </Text>
        </View>
        {/* A tablet or laptop: the card and the players' names on the left, the overs and retirements beside them. */}
        <Columns weights={[1, 1]} gap={space.lg}>
          <View>
            <InningsCard match={match} s={s} />
            {wide && names}
          </View>
          <View>
            <OversEditor match={match} s={s} inningsIndex={idx} onOpen={setEditingOver} />
            <RetirementsEditor
              match={match}
              inningsIndex={idx}
              onChange={(eventIndex, out) => {
                const fixed = setRetirement(match, idx, eventIndex, out);
                if (typeof fixed === 'string') return toast.show(fixed, 'info');
                saveMatch(fixed);
                const r = retirements(fixed, idx).find((x) => x.event === eventIndex)!;
                toast.show(`${playerName(match, r.batter)} is now retired ${out ? 'out' : 'hurt'}`, 'success');
              }}
            />
            {!wide && names}
          </View>
        </Columns>
      </>
    );
  else if (wide)
    // The batting card and the fall of wickets on the left; bowling and the stands beside them.
    body = (
      <Columns weights={[3, 2]} gap={space.lg}>
        <View>
          <InningsCard match={match} s={s} part="batting" />
          <InningsCard match={match} s={s} part="fow" />
        </View>
        <View>
          <InningsCard match={match} s={s} part="bowling" />
          <Partnerships match={match} s={s} />
        </View>
      </Columns>
    );
  else
    body = (
      <>
        <InningsCard match={match} s={s} />
        <Partnerships match={match} s={s} />
      </>
    );

  return (
    <Screen>
      {wide ? (
        <View style={{ paddingHorizontal: layout.gutter, paddingTop: space.lg }}>
          <Page>
            <WideHead
              title={`${match.teams[0].name} v ${match.teams[1].name}`}
              sub={`Scorecard · ${new Date(match.createdAt).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} · ${match.rules.overs} overs`}
              onBack={back}
              right={tools}
            />
          </Page>
        </View>
      ) : (
        <View style={styles.header}>
          <IconButton icon="chevron-back" label="Back" onPress={back} />
          <Text style={styles.headerTitle}>Scorecard</Text>
          <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>{tools}</View>
        </View>
      )}
      <ScrollView stickyHeaderIndices={[1]} contentContainerStyle={{ paddingBottom: insets.bottom + space.xxl }}>
        <View style={{ paddingHorizontal: pad, paddingTop: wide ? 0 : space.sm }}>
          <Page>
            <ResultHero match={match} state={state} mom={mom} canCall={canChangeResult(match, access)} admin={admin} onCall={() => setCallingResult(true)} onPickMom={() => setPickingMom(true)} wide={wide} />
          </Page>
        </View>
        <View style={{ backgroundColor: colors.bg, paddingHorizontal: pad, paddingTop: space.md, paddingBottom: space.sm }}>
          <Page>
            <TabBar tabs={tabs} value={shown} onChange={setTab} />
          </Page>
        </View>
        <View style={{ paddingHorizontal: pad }}>
          <Page>
            <Rise key={shown} index={0} step={0}>
              {body}
            </Rise>
          </Page>
        </View>
      </ScrollView>

      <Sheet visible={menu} onClose={() => setMenu(false)} title="Match options">
        <View style={{ gap: space.sm }}>
          {admin && (
            <MenuRow
              icon="create-outline"
              label={editMode ? 'Done editing' : 'Edit scorecard'}
              title={editMode ? 'Finish editing' : 'Edit scorecard'}
              sub="Fix a ball, an over, a bowler or a name."
              onPress={() => {
                setMenu(false);
                if (editMode) setEditMode(false);
                else startEdit();
              }}
            />
          )}
          <MenuRow
            icon="download-outline"
            label="Export match"
            title="Export match"
            sub="Save or share it as a file."
            onPress={() => {
              setMenu(false);
              setExporting([match]);
            }}
          />
          {admin && (
            <>
              <SeamDivider color={ink(0.14)} style={{ marginVertical: space.xs }} />
              <MenuRow
                icon="trash-outline"
                danger
                label="Delete this match"
                title="Delete this match"
                sub="Removes its runs and wickets from the stats."
                onPress={() => {
                  setMenu(false);
                  setDeleting(true);
                }}
              />
            </>
          )}
        </View>
      </Sheet>
      <ExportSheet
        visible={exporting !== null}
        matches={exporting ?? []}
        onClose={() => setExporting(null)}
        onExport={(format, chosen) => {
          setExporting(null);
          exportAs(format, chosen);
        }}
      />
      <OverEditSheet
        match={match}
        s={s}
        inningsIndex={idx}
        over={editingOver}
        onClose={() => setEditingOver(null)}
        onSave={(draft) => {
          if (editingOver === null) return;
          const fixed = replaceOver(match, idx, editingOver, draft);
          if (typeof fixed === 'string') return fixed;
          saveMatch(fixed);
          setEditingOver(null);
          const now = matchState(fixed).result;
          if (now !== state.result) toast.show(now ? `Over saved. Result now: ${now}` : 'Over saved. The match isn’t finished any more: carry on scoring it.', 'info');
          else toast.show(`Over ${editingOver + 1} saved`, 'success');
        }}
      />
      <ResultSheet
        match={match}
        visible={callingResult}
        onClose={() => setCallingResult(false)}
        onPick={(outcome) => {
          setCallingResult(false);
          saveMatch({ ...match, outcome });
          toast.show(matchState({ ...match, outcome }).result ?? 'Result changed', 'success');
        }}
      />
      <MomSheet
        match={match}
        visible={pickingMom}
        onClose={() => setPickingMom(false)}
        onPick={(id) => {
          saveMatch({ ...match, mom: id });
          setPickingMom(false);
          toast.show(id ? `${playerName(match, id)} is Man of the Match` : 'Crease picks the Man of the Match', 'success');
        }}
      />
      <Sheet visible={deleting} onClose={() => setDeleting(false)} title="Delete this match?">
        <View style={{ gap: space.md }}>
          <Text style={styles.deleteText}>
            {match.teams[0].name} v {match.teams[1].name}, {new Date(match.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
            {state.result ? ` · ${state.result}` : ''}. Its runs and wickets leave everyone’s stats and the record book{user ? ', for everyone in the club' : ''}. This can’t be undone.
          </Text>
          <Button
            variant="danger"
            icon="trash-outline"
            label={user ? 'Delete it for everyone' : 'Delete the match'}
            onPress={() => {
              setDeleting(false);
              router.replace('/');
              deleteMatch(match.id);
            }}
          />
          <Button variant="ghost" label="Keep it" onPress={() => setDeleting(false)} />
        </View>
      </Sheet>
      {toast.element}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingVertical: space.sm },
  headerTitle: { color: colors.text, fontSize: 21, fontFamily: font.poster },
  options: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 44, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: colors.surfaceHi, borderWidth: 1, borderColor: colors.border },
  optionsText: { color: colors.text, fontSize: 13, fontFamily: font.bold },

  // The hero on the outfield.
  hero: { borderRadius: radius.xl, overflow: 'hidden', padding: space.lg, gap: space.md, backgroundColor: gradients.hero[1] },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: hero.inset, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5, maxWidth: '100%' },
  metaText: { color: hero.muted, fontSize: 11.5, fontFamily: font.semibold, flexShrink: 1 },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  resultText: { flex: 1, color: hero.text, fontSize: 22, lineHeight: 26, fontFamily: font.posterBlack, letterSpacing: -0.5 },
  heroPill: { paddingHorizontal: space.md, height: 32, justifyContent: 'center', borderRadius: radius.pill, backgroundColor: hero.inset, borderWidth: 1, borderColor: hero.line },
  heroPillText: { color: hero.text, fontSize: 12, fontFamily: font.bold },
  board: { flexDirection: 'row', alignItems: 'stretch', backgroundColor: hero.inset, borderRadius: radius.lg, paddingVertical: space.md, paddingHorizontal: space.sm },
  side: { flex: 1, alignItems: 'center', gap: 4, minWidth: 0, paddingHorizontal: 4 },
  vs: { position: 'absolute', left: -9, top: '38%', color: hero.faint, fontSize: 12, fontFamily: font.bold, width: 18, textAlign: 'center' },
  crestWrap: { paddingBottom: 2 },
  winBadge: { position: 'absolute', right: -8, top: -4, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: hero.gold },
  sideName: { color: hero.text, fontSize: 14, lineHeight: 17, fontFamily: font.bold, textAlign: 'center' },
  scoreRow: { flexDirection: 'row', alignItems: 'baseline' },
  score: { color: hero.text, fontSize: 40, lineHeight: 44, fontFamily: font.posterBlack, letterSpacing: -1, ...type.num },
  scoreWk: { color: hero.muted, fontSize: 22, fontFamily: font.poster, ...type.num },
  sideOvers: { color: hero.muted, fontSize: 12, fontFamily: font.medium, ...type.num },
  heroNote: { color: hero.faint, fontSize: 12, fontFamily: font.medium },

  // The Man of the Match: an engraved brass plate.
  plaque: { flex: 1, borderRadius: radius.lg, borderWidth: 1, borderColor: hero.gold, flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, overflow: 'hidden', minHeight: 76 },
  plaqueInner: { position: 'absolute', left: 4, right: 4, top: 4, bottom: 4, borderRadius: radius.lg - 4, borderWidth: 1, borderColor: hero.gold, opacity: 0.35 },
  plaquePlayer: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  plaqueStar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: hero.gold },
  plaqueLabel: { color: hero.gold, fontSize: 9.5, fontFamily: font.heavy, letterSpacing: 1.6 },
  plaqueName: { color: hero.text, fontSize: 21, lineHeight: 25, fontFamily: font.posterBlack, letterSpacing: -0.4 },
  plaqueLine: { color: hero.muted, fontSize: 12, fontFamily: font.medium },

  // Tabs.
  tabs: { gap: space.sm, paddingRight: space.lg, alignItems: 'stretch' },
  tab: { minHeight: 46, paddingHorizontal: space.lg, justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.surfaceHi, borderWidth: 1, borderColor: colors.border },
  tabOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  tabText: { color: colors.muted, fontSize: 14, fontFamily: font.bold },
  tabTextOn: { color: colors.onAccent, fontFamily: font.heavy },
  tabSub: { color: colors.faint, fontSize: 11, fontFamily: font.semibold, ...type.num },

  // Menu.
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, minHeight: 56, borderRadius: radius.lg, backgroundColor: colors.surfaceHi },
  menuIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentDim },
  menuTitle: { color: colors.text, fontSize: 15, fontFamily: font.bold },
  menuSub: { color: colors.muted, fontSize: 12, fontFamily: font.medium },

  // Summary.
  storyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  storyChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.goldDim, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: colors.border },
  storyText: { color: colors.text, fontSize: 13, fontFamily: font.semibold },
  leaders: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  leader: { gap: 2 },
  leaderLabel: { ...type.label, fontSize: 9.5, color: colors.faint },
  leaderName: { color: colors.text, fontSize: 15, fontFamily: font.bold, marginTop: 2 },
  leaderBig: { color: colors.accentInk, fontSize: 32, lineHeight: 36, fontFamily: font.posterBlack, ...type.num },
  leaderUnit: { color: colors.muted, fontSize: 12, fontFamily: font.medium },
  leaderSub: { color: colors.faint, fontSize: 12, fontFamily: font.medium },

  // Innings.
  totalRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.lg, paddingHorizontal: space.xs },
  totalTeam: { color: colors.text, fontSize: 20, lineHeight: 24, fontFamily: font.poster },
  totalSub: { color: colors.muted, fontSize: 12, fontFamily: font.medium },
  total: { color: colors.accentInk, fontSize: 36, lineHeight: 40, fontFamily: font.posterBlack, ...type.num },
  head: { flexDirection: 'row', paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.sm },
  th: { ...type.label, fontSize: 10, color: colors.faint, width: 30, textAlign: 'right' },
  /** The strike rate and economy column: room for 234.6, and no more, so a name fits on a phone. */
  wide: { width: 48 },
  who: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1, minWidth: 0 },
  /** Under the name, lined up with it past the photo. */
  howIndent: { marginLeft: 32 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  totalLine: { borderTopColor: colors.borderHi, paddingVertical: 12 },
  totalNum: { color: colors.text, fontSize: 20, fontFamily: font.posterBlack, marginLeft: space.sm, ...type.num },
  name: { color: colors.text, fontSize: 14, lineHeight: 18, fontFamily: font.bold },
  nameRow: { flexDirection: 'row', alignItems: 'center', flexShrink: 1, minWidth: 0 },
  how: { color: colors.faint, fontSize: 12, fontFamily: font.regular, marginTop: 2, flexShrink: 1 },
  td: { width: 30, textAlign: 'right', color: colors.muted, fontSize: 15, fontFamily: font.poster, ...type.num },
  srText: { color: colors.faint, fontSize: 13 },
  strong: { color: colors.text, fontFamily: font.posterBlack, fontSize: 16 },
  editHint: {
    flexDirection: 'row',
    gap: space.sm,
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.accentInk,
    borderRadius: radius.lg,
    padding: space.md,
    marginBottom: space.md,
  },
  editHintText: { flex: 1, color: colors.text, fontSize: 13, lineHeight: 19, fontFamily: font.medium },
  namesHint: { color: colors.muted, fontSize: 13, lineHeight: 19, fontFamily: font.medium },
  namesTeam: { ...type.label, color: colors.muted },
  nameInput: {
    color: colors.text,
    fontSize: 15,
    fontFamily: font.semibold,
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: space.md,
    height: 44,
  },
  editOver: { paddingHorizontal: space.lg, paddingVertical: space.md, borderTopWidth: 1, borderTopColor: colors.border, gap: space.sm },
  editOverHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  editOverTitle: { ...type.label, fontSize: 10, color: colors.muted },
  editBalls: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  offNote: { color: colors.danger, fontSize: 12, fontFamily: font.semibold },
  deleteText: { color: colors.muted, fontSize: 14, lineHeight: 21, fontFamily: font.medium },
  empty: { color: colors.muted, textAlign: 'center', marginTop: space.xxl },
  momPick: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.surfaceHi,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: space.md,
  },
  momPickOn: { borderColor: colors.accentInk },
  momPickName: { fontFamily: font.bold, fontSize: 15, color: colors.text },
  momHint: { color: colors.muted, fontSize: 12, fontFamily: font.medium, lineHeight: 18 },
  momLine: { color: colors.muted, fontSize: 12, fontFamily: font.medium },
});
