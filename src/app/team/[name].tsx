import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PlayerAvatar } from '../../components/Avatar.tsx';
import { OvalGround, SeamDivider } from '../../components/cricket.tsx';
import { CountUp, GrowBar, PopIn, Rise, Sheen, Tug } from '../../components/motion.tsx';
import { FormBadge } from '../../components/Ratings.tsx';
import { Stars } from '../../components/Stars.tsx';
import { TeamCrest, TeamWash } from '../../components/TeamCrest.tsx';
import { FormChips, RoleIcon, ROLE_NAME, useSquadByName } from '../../components/TeamsX.tsx';
import { Columns, Page, useLayout } from '../../components/layout.tsx';
import { Card, IconButton, PageToneProvider, PitchStripes, PressableScale, Screen, SectionLabel, usePageTone } from '../../components/ui.tsx';
import { headToHead, teamNames } from '../../engine/records.ts';
import { keyFor } from '../../engine/stats.ts';
import { teamProfile, type TeamLeader, type TeamResult } from '../../engine/teamPage.ts';
import { overall } from '../../engine/squad.ts';
import { nameKey, recentResults, sideStrength, strengthOf, strengths } from '../../engine/teams.ts';
import { useMatches } from '../../store/matches.tsx';
import { useSquad } from '../../store/squad.ts';
import { colors, font, hero, ink, ownTeamTheme, radius, space, teamTheme, type TeamTheme, type } from '../../theme.ts';

// One side: its record and form, its squad with their form, who scores its runs and takes its wickets, its best and
// worst totals, how it does against the other side, and every result. In the side's own colours.

const openMatch = (id: string) => router.push({ pathname: '/match/[id]/scorecard', params: { id } });
const openPlayer = (key: string) => router.push({ pathname: '/player/[key]', params: { key } });
const day = (at: number) => new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

function Leaders({ title, unit, rows }: { title: string; unit: string; rows: TeamLeader[] }) {
  const teamInk = usePageTone()?.ink ?? colors.text;
  if (!rows.length) return null;
  return (
    <Card style={styles.board}>
      <Text style={styles.label}>{title}</Text>
      {rows.map((x, i) => (
        <PressableScale key={x.key} scaleTo={0.98} onPress={() => openPlayer(x.key)} style={[styles.leader, i > 0 && styles.divided]} accessibilityLabel={`${x.name}, ${x.value} ${unit}`}>
          <PlayerAvatar name={x.name} size={32} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.leaderName} numberOfLines={1}>
              {x.name}
            </Text>
            {x.sub ? <Text style={styles.small}>{x.sub}</Text> : null}
          </View>
          <Text style={[styles.leaderValue, i === 0 && [styles.leaderTop, { color: teamInk }]]}>{x.value}</Text>
        </PressableScale>
      ))}
    </Card>
  );
}

/** A brass honours-board tile: the side's best in one thing. */
function Honour({ label, value, unit, who, sub, onPress, delay }: { label: string; value: number; unit: string; who?: string; sub?: string; onPress?: () => void; delay: number }) {
  const tone = usePageTone();
  const inner = (
    <View style={[styles.honour, tone && { backgroundColor: tone.card, borderColor: tone.line }]}>
      <View style={styles.honourTop}>
        <Ionicons name="star" size={12} color={colors.gold} />
        <Text style={styles.honourLabel}>{label}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
        <CountUp value={value} delay={delay} style={styles.honourValue} />
        <Text style={styles.small}>{unit}</Text>
      </View>
      {who ? (
        <View style={styles.honourWho}>
          <PlayerAvatar name={who} size={22} />
          <Text style={styles.honourName} numberOfLines={1}>
            {who}
          </Text>
        </View>
      ) : null}
      {sub ? <Text style={styles.small} numberOfLines={1}>{sub}</Text> : null}
    </View>
  );
  return onPress ? (
    <PressableScale scaleTo={0.97} onPress={onPress} wrapStyle={styles.tileWrap} style={{ flex: 1 }} accessibilityLabel={`${label}: ${who ? who + ', ' : ''}${value} ${unit}`}>
      {inner}
    </PressableScale>
  ) : (
    <View style={styles.tileWrap}>{inner}</View>
  );
}

/** A result as a match ticket: the outcome stub, both badges, the score and the day. */
function Ticket({ r, name, side, i }: { r: TeamResult; name: string; side: TeamTheme; i: number }) {
  const tone = usePageTone();
  const win = r.outcome === 'W';
  const loss = r.outcome === 'L';
  return (
    <Rise index={Math.min(i, 8)} step={45}>
      <PressableScale scaleTo={0.98} onPress={() => openMatch(r.matchId)} accessibilityLabel={r.result} style={[styles.ticket, tone && { backgroundColor: tone.card, borderColor: tone.line }]}>
        <View style={[styles.stub, win ? { backgroundColor: side.accent } : loss ? { backgroundColor: colors.dangerDim } : { backgroundColor: ink(0.08) }]}>
          <Text style={[styles.stubLetter, win ? { color: side.onAccent } : loss ? { color: colors.danger } : { color: colors.muted }]}>{r.outcome}</Text>
          <Text style={[styles.stubDay, win && { color: side.onAccent }]}>{day(r.date)}</Text>
        </View>
        <View style={styles.notchTop} />
        <View style={styles.notchBottom} />
        <View style={styles.ticketBody}>
          <View style={styles.crests}>
            <TeamCrest name={name} size={24} />
            <Text style={styles.vs}>v</Text>
            <TeamCrest name={r.opponent} size={24} />
          </View>
          <Text style={styles.leaderName} numberOfLines={1}>
            vs {r.opponent}
          </Text>
          <Text style={styles.small} numberOfLines={1}>
            {r.result}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', paddingRight: space.md }}>
          <Text style={styles.score}>{r.score}</Text>
          <Text style={styles.small}>v {r.against}</Text>
        </View>
      </PressableScale>
    </Rise>
  );
}

export default function TeamScreen() {
  const insets = useSafeAreaInsets();
  const { name: param } = useLocalSearchParams<{ name: string }>();
  const name = String(param ?? '');
  const { matches, savedTeams } = useMatches();
  const { squad } = useSquad();
  const roster = useSquadByName();
  const side = teamTheme(name);
  const t = useMemo(() => teamProfile(matches, name), [matches, name]);
  const table = useMemo(() => strengths(matches, squad), [matches, squad]);
  // Its squad: the usual side under this name, else whoever played for it last.
  const team = savedTeams.find((x) => nameKey(x.name) === nameKey(name)) ?? [...matches].sort((a, b) => b.createdAt - a.createdAt).flatMap((m) => m.teams).find((x) => nameKey(x.name) === nameKey(name));
  const players = (team?.players ?? []).map((p) => ({ p, s: strengthOf(table, p.name), key: keyFor(team!, p) })).sort((a, b) => b.s.power - a.s.power);
  const together = players.length ? sideStrength(players.map((x) => x.s)) : null;
  // Against the other side it plays most.
  const rival = teamNames(matches)
    .filter((x) => nameKey(x) !== nameKey(name))
    .map((x) => ({ x, h: headToHead(matches, name, x) }))
    .sort((a, b) => b.h.played - a.h.played)[0];
  const winPct = t.played ? Math.round((t.won / t.played) * 100) : null;
  const captain = players.find(({ p }) => team?.captain === p.id)?.p;
  const keeper = players.find(({ p }) => team?.keeper === p.id)?.p;
  const form = recentResults(matches, name);

  const tone = ownTeamTheme(name) ?? null;
  const layout = useLayout();
  const { wide, desk } = layout;

  const squadN = players.length > 0 && (
    <View>
      <SectionLabel right={together?.form != null ? <Text style={[styles.small, tone && { color: tone.ink }]}>Form {together.form.toFixed(1)} together</Text> : undefined}>Squad</SectionLabel>
      <Card style={{ gap: 0, paddingVertical: space.xs }}>
        {players.map(({ p, s, key }, i) => {
          const sq = roster.get(nameKey(p.name));
          return (
            <Rise key={p.id} index={Math.min(i, 9)} step={35}>
              <PressableScale scaleTo={0.98} onPress={() => openPlayer(key)} style={[styles.member, i > 0 && styles.divided]} accessibilityLabel={p.name}>
                <PlayerAvatar name={p.name} size={42} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.leaderName} numberOfLines={1}>
                    {p.name}
                    {team?.captain === p.id ? <Text style={[styles.mark, { color: side.ink }]}>{'  '}C</Text> : null}
                    {team?.keeper === p.id ? <Text style={styles.mark}>{'  '}WK</Text> : null}
                  </Text>
                  <View style={styles.subRow}>
                    {sq && <RoleIcon role={sq.role} size={18} />}
                    {sq && <Stars value={Math.max(1, Math.min(5, Math.round(overall(sq))))} size={11} />}
                    <Text style={styles.small}>
                      {sq ? `${ROLE_NAME[sq.role]} · ` : ''}Bat {s.bat} · Bowl {s.bowl}
                      {s.guest ? ' · not in the squad' : ''}
                    </Text>
                  </View>
                </View>
                {s.form != null && <FormBadge form={s.form} />}
                <Ionicons name="chevron-forward" size={15} color={colors.faint} />
              </PressableScale>
            </Rise>
          );
        })}
      </Card>
    </View>
  );
  const resultsN = t.results.length > 0 && (
    <View>
      <SectionLabel right={<Text style={styles.small}>{t.results.length}</Text>}>Results</SectionLabel>
      <View style={{ gap: space.sm }}>
        {t.results.map((r, i) => (
          <Ticket key={r.matchId} r={r} name={t.name} side={side} i={i} />
        ))}
      </View>
    </View>
  );
  const topRuns = t.runs[0];
  const topWk = t.wickets[0];
  const recordsN = (topRuns || topWk || t.highest) && (
    <View>
      <SectionLabel>Records of the side</SectionLabel>
      <View style={styles.honours}>
        {topRuns && <Honour delay={200} label="Top scorer" value={topRuns.value} unit="runs" who={topRuns.name} onPress={() => openPlayer(topRuns.key)} />}
        {topWk && <Honour delay={300} label="Top wicket taker" value={topWk.value} unit="wickets" who={topWk.name} onPress={() => openPlayer(topWk.key)} />}
        {t.highest && <Honour delay={400} label="Highest total" value={t.highest.runs} unit={`/${t.highest.wickets}`} sub={`vs ${t.highest.opponent}`} onPress={() => openMatch(t.highest!.matchId)} />}
      </View>
      {(t.lowest || t.averageScore !== null) && (
        <View style={[styles.tiles, { marginTop: space.sm }]}>
          {t.lowest && (
            <PressableScale scaleTo={0.97} onPress={() => openMatch(t.lowest!.matchId)} wrapStyle={styles.tileWrap} style={[styles.tile, tone && { backgroundColor: tone.card, borderColor: tone.line }]}>
              <Text style={styles.tileValue}>
                {t.lowest.runs}/{t.lowest.wickets}
              </Text>
              <Text style={styles.small}>Lowest total</Text>
            </PressableScale>
          )}
          {t.averageScore !== null && (
            <View style={[styles.tileWrap]}>
              <View style={[styles.tile, tone && { backgroundColor: tone.card, borderColor: tone.line }]}>
                <Text style={styles.tileValue}>{Math.round(t.averageScore)}</Text>
                <Text style={styles.small}>Average score</Text>
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
  const leadersN = (t.runs.length > 0 || t.wickets.length > 0) && (
    <View style={{ gap: space.md }}>
      <SectionLabel>Leaders</SectionLabel>
      <Leaders title="Most runs" unit="runs" rows={t.runs} />
      <Leaders title="Most wickets" unit="wickets" rows={t.wickets} />
      <Leaders title="Most sixes" unit="sixes" rows={t.sixes} />
      <Leaders title="Most catches" unit="catches" rows={t.catches} />
    </View>
  );
  const h2hN = rival && rival.h.played > 0 && (
    <View>
      <SectionLabel>Head to head</SectionLabel>
      <PressableScale
        scaleTo={0.98}
        onPress={() => router.push({ pathname: '/team/[name]', params: { name: rival.x } })}
        accessibilityLabel={`Head to head: open ${rival.x}`}
      >
        <Card style={styles.h2h}>
          <View style={styles.h2hRow}>
            <View style={{ flex: 1, gap: 4 }}>
              <TeamCrest name={t.name} size={40} />
              <CountUp value={rival.h.winsA} delay={250} style={[styles.h2hWins, { color: side.ink }]} />
              <Text style={styles.small} numberOfLines={1}>
                {t.name}
              </Text>
            </View>
            <Text style={styles.small}>{rival.h.ties ? `${rival.h.ties} drawn or tied` : 'wins'}</Text>
            <View style={{ flex: 1, alignItems: 'flex-end', gap: 4 }}>
              <TeamCrest name={rival.x} size={40} />
              <CountUp value={rival.h.winsB} delay={250} style={[styles.h2hWins, { color: teamTheme(rival.x).ink }]} />
              <Text style={styles.small} numberOfLines={1}>
                {rival.x}
              </Text>
            </View>
          </View>
          <Tug
            edge={rival.h.winsA + rival.h.winsB ? rival.h.winsA / (rival.h.winsA + rival.h.winsB) : 0.5}
            style={{ height: 12 }}
            leftStyle={{ height: 12, backgroundColor: side.accent, borderTopLeftRadius: 6, borderBottomLeftRadius: 6 }}
            rightStyle={{ height: 12, backgroundColor: teamTheme(rival.x).accent, borderTopRightRadius: 6, borderBottomRightRadius: 6 }}
          />
          <Text style={styles.h2hLine}>
            {rival.h.winsA === rival.h.winsB ? `Level at ${rival.h.winsA} wins each` : `${rival.h.winsA > rival.h.winsB ? t.name : rival.x} lead ${Math.max(rival.h.winsA, rival.h.winsB)} to ${Math.min(rival.h.winsA, rival.h.winsB)}`}
            {' '}in {rival.h.played} {rival.h.played === 1 ? 'match' : 'matches'}
          </Text>
          <Text style={[styles.h2hOpen, { color: teamTheme(rival.x).ink }]} numberOfLines={1}>
            vs {rival.x} ›
          </Text>
        </Card>
      </PressableScale>
    </View>
  );

  const stats: [string, number][] = t.played
    ? [
        ['Played', t.played],
        ['Won', t.won],
        ['Lost', t.lost],
        // Ties and draws too, so they add up to the matches played.
        [t.drawn ? (t.tied ? 'Tied/drawn' : 'Drawn') : 'Tied', t.tied + t.drawn],
      ]
    : [];
  const crestSize = wide ? 132 : 96;
  return (
    <PageToneProvider value={tone}>
      <Screen>
        <View style={[styles.header, wide && { paddingHorizontal: layout.gutter, paddingTop: space.lg, paddingBottom: space.md }]}>
          <Page>
            <IconButton icon="chevron-back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/teams'))} />
          </Page>
        </View>
        <ScrollView contentContainerStyle={{ padding: wide ? layout.gutter : space.lg, paddingTop: 0, paddingBottom: insets.bottom + space.xxl }}>
          <Page style={{ gap: space.md }}>
          <LinearGradient colors={side.hero} start={{ x: 0, y: 0 }} end={{ x: wide ? 1 : 0, y: 1 }} style={[styles.hero, wide && styles.heroWide]}>
            <OvalGround opacity={0.09} />
            <PitchStripes tint="255,255,255" />
            <TeamWash color={side.accent} strength={0.18} />
            <Sheen />
            <View style={wide ? styles.heroSplit : { gap: space.md }}>
              <View style={styles.heroMain}>
                <PopIn turn={-8}>
                  <TeamCrest name={name} size={crestSize} />
                </PopIn>
                <View style={{ flex: 1, minWidth: 0, gap: space.sm }}>
                  <View style={[styles.tag, { backgroundColor: side.accent }]}>
                    <Text style={[styles.tagText, { color: side.onAccent }]}>Team</Text>
                  </View>
                  <Text style={[styles.name, wide && styles.nameWide]} numberOfLines={2}>
                    {t.name}
                  </Text>
                  {!t.played ? (
                    <Text style={styles.noGames}>No matches yet. Its record, form and leaders start with its first match.</Text>
                  ) : (
                    <View style={styles.form}>
                      <FormChips results={form} size={28} accent={side.accent} onAccent={side.onAccent} onDark delay={300} />
                      {t.streak && t.streak.count > 1 && (
                        <Text style={styles.streak}>
                          {t.streak.count} {t.streak.outcome === 'W' ? 'wins' : t.streak.outcome === 'L' ? 'losses' : t.streak.outcome === 'D' ? 'draws' : 'ties'} in a row
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              </View>
              {t.played > 0 && (
                <View style={[styles.record, wide && { width: 430 }]}>
                  <View style={styles.winRow}>
                    <View>
                      <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
                        <CountUp value={winPct ?? 0} delay={250} style={styles.winValue} />
                        <Text style={styles.winPct}>%</Text>
                      </View>
                      <Text style={styles.statLabel}>Win %</Text>
                    </View>
                    <View style={{ flex: 1, gap: 6, paddingLeft: space.lg }}>
                      <GrowBar share={(winPct ?? 0) / 100} delay={350} trackStyle={styles.winTrack} style={[styles.winFill, { backgroundColor: side.accent }]} />
                      <Text style={styles.statLabel}>
                        {t.won} won of {t.played}
                      </Text>
                    </View>
                  </View>
                  <SeamDivider color={hero.line} />
                  <View style={styles.stats}>
                    {stats.map(([label, value], i) => (
                      <View key={label} style={{ flex: 1, alignItems: 'center' }}>
                        <CountUp value={value} delay={300 + i * 80} style={[styles.statValue, wide && { fontSize: 30, lineHeight: 34 }]} />
                        <Text style={styles.statLabel}>{label}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>
            {(captain || keeper) && (
              <View style={styles.leaders}>
                {captain && (
                  <View style={styles.who}>
                    <PlayerAvatar name={captain.name} size={30} />
                    <View>
                      <Text style={styles.whoRole}>Captain</Text>
                      <Text style={styles.whoName} numberOfLines={1}>{captain.name}</Text>
                    </View>
                  </View>
                )}
                {keeper && (
                  <View style={styles.who}>
                    <PlayerAvatar name={keeper.name} size={30} />
                    <View>
                      <Text style={styles.whoRole}>Keeper</Text>
                      <Text style={styles.whoName} numberOfLines={1}>{keeper.name}</Text>
                    </View>
                  </View>
                )}
              </View>
            )}
          </LinearGradient>

          {wide ? (
            // A tablet: the squad beside the records, head to head and results. A laptop: squad, records, results.
            <View style={styles.wideCols}>
              <View style={styles.wideCol}>{squadN}</View>
              <View style={styles.wideCol}>
                {recordsN}
                {h2hN}
                {leadersN}
                {!desk && resultsN}
              </View>
              {desk && <View style={styles.wideCol}>{resultsN}</View>}
            </View>
          ) : (
            <>
              {squadN}
              {resultsN}
              {recordsN}
              {h2hN}
              {leadersN}
            </>
          )}
          </Page>
        </ScrollView>
      </Screen>
    </PageToneProvider>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', paddingHorizontal: space.lg, paddingVertical: space.sm },
  hero: { borderRadius: radius.xl, padding: space.lg, overflow: 'hidden', borderWidth: 1, borderColor: hero.line, gap: space.md },
  heroMain: { flexDirection: 'row', alignItems: 'center', gap: space.lg, flex: 1, minWidth: 0 },
  tag: { alignSelf: 'flex-start', paddingHorizontal: 10, height: 24, borderRadius: radius.sm, justifyContent: 'center', transform: [{ skewX: '-8deg' }] },
  tagText: { ...type.label },
  name: { fontFamily: font.posterBlack, fontSize: 34, lineHeight: 38, color: hero.text, letterSpacing: -1.2 },
  form: { gap: 6 },
  streak: { color: hero.muted, fontSize: 12, fontFamily: font.semibold },
  record: { backgroundColor: hero.inset, borderRadius: radius.md, padding: space.md, gap: space.md },
  winRow: { flexDirection: 'row', alignItems: 'center' },
  winValue: { color: hero.text, fontSize: 46, lineHeight: 50, fontFamily: font.posterBlack, ...type.num },
  winPct: { color: hero.muted, fontSize: 20, fontFamily: font.posterBlack, marginBottom: 7, marginLeft: 2 },
  winTrack: { height: 8, borderRadius: 4, backgroundColor: hero.ink(0.12), overflow: 'hidden' },
  winFill: { height: 8, borderRadius: 4 },
  stats: { flexDirection: 'row' },
  statValue: { color: hero.text, fontSize: 24, lineHeight: 28, fontFamily: font.posterBlack, ...type.num },
  statLabel: { ...type.label, fontSize: 9, letterSpacing: 0.6, color: hero.muted, marginTop: 2 },
  noGames: { color: hero.muted, fontSize: 14, fontFamily: font.medium, lineHeight: 20 },
  leaders: { flexDirection: 'row', flexWrap: 'wrap', gap: space.lg },
  who: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  whoRole: { ...type.label, fontSize: 9, color: hero.muted },
  whoName: { color: hero.text, fontSize: 14, fontFamily: font.bold },
  honours: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  honour: { flex: 1, minWidth: 140, gap: 4, padding: space.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.gold },
  honourTop: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  honourLabel: { ...type.label, fontSize: 10, color: colors.gold },
  honourValue: { color: colors.text, fontSize: 34, lineHeight: 38, fontFamily: font.posterBlack, ...type.num },
  honourWho: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  honourName: { flex: 1, color: colors.text, fontSize: 13, fontFamily: font.semibold },
  tiles: { flexDirection: 'row', gap: space.sm },
  tileWrap: { flex: 1, minWidth: 140 },
  tile: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: space.md },
  tileValue: { color: colors.text, fontSize: 22, fontFamily: font.posterBlack, ...type.num },
  h2h: { gap: space.md },
  h2hOpen: { alignSelf: 'flex-end', fontSize: 13, fontFamily: font.bold },
  h2hLine: { color: colors.text, fontSize: 14, fontFamily: font.semibold, textAlign: 'center' },
  h2hRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  h2hWins: { fontSize: 38, lineHeight: 42, fontFamily: font.posterBlack, ...type.num },
  small: { color: colors.muted, fontSize: 12, fontFamily: font.medium },
  label: { ...type.label, color: colors.muted },
  heroWide: { padding: space.xxl, minHeight: 260, justifyContent: 'flex-end' },
  heroSplit: { flexDirection: 'row', alignItems: 'flex-end', gap: space.xl },
  nameWide: { fontSize: 56, lineHeight: 62, letterSpacing: -2 },
  wideCols: { flexDirection: 'row', gap: space.lg, alignItems: 'flex-start' },
  wideCol: { flex: 1, minWidth: 0, gap: space.md },
  board: { gap: 0 },
  leader: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  divided: { borderTopWidth: 1, borderTopColor: colors.border },
  leaderName: { color: colors.text, fontSize: 15, fontFamily: font.semibold },
  leaderValue: { color: colors.text, fontSize: 20, fontFamily: font.posterBlack, ...type.num },
  leaderTop: { fontSize: 24 },
  member: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm, paddingHorizontal: space.xs },
  subRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5, marginTop: 2 },
  mark: { fontSize: 11, fontFamily: font.heavy, color: colors.muted },
  ticket: { flexDirection: 'row', alignItems: 'center', gap: space.md, overflow: 'hidden', backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  stub: { width: 62, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: space.md },
  stubLetter: { fontSize: 26, lineHeight: 28, fontFamily: font.posterBlack },
  stubDay: { color: colors.muted, fontSize: 10, fontFamily: font.semibold },
  notchTop: { position: 'absolute', left: 55, top: -7, width: 14, height: 14, borderRadius: 7, backgroundColor: colors.bg },
  notchBottom: { position: 'absolute', left: 55, bottom: -7, width: 14, height: 14, borderRadius: 7, backgroundColor: colors.bg },
  ticketBody: { flex: 1, minWidth: 0, paddingVertical: space.sm, gap: 1 },
  crests: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3 },
  vs: { color: colors.faint, fontSize: 10, fontFamily: font.bold },
  score: { color: colors.text, fontSize: 18, fontFamily: font.posterBlack, ...type.num },
});
