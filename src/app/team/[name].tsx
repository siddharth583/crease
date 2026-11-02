import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PlayerAvatar } from '../../components/Avatar.tsx';
import { FormBadge } from '../../components/Ratings.tsx';
import { Card, IconButton, PageToneProvider, PitchStripes, PressableScale, Screen, SectionLabel, usePageTone } from '../../components/ui.tsx';
import { headToHead, teamNames } from '../../engine/records.ts';
import { keyFor } from '../../engine/stats.ts';
import { teamProfile, type TeamLeader } from '../../engine/teamPage.ts';
import { nameKey, sideStrength, strengthOf, strengths } from '../../engine/teams.ts';
import { useMatches } from '../../store/matches.tsx';
import { useSquad } from '../../store/squad.ts';
import { colors, font, hero, ownTeamTheme, radius, space, teamTheme, type } from '../../theme.ts';

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

export default function TeamScreen() {
  const insets = useSafeAreaInsets();
  const { name: param } = useLocalSearchParams<{ name: string }>();
  const name = String(param ?? '');
  const { matches, savedTeams } = useMatches();
  const { squad } = useSquad();
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

  const tone = ownTeamTheme(name) ?? null;
  const tile = [styles.tile, tone && { backgroundColor: tone.card, borderColor: tone.line }];
  return (
    <PageToneProvider value={tone}>
      <Screen>
        <View style={styles.header}>
          <IconButton icon="chevron-back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/teams'))} />
        </View>
        <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: 0, paddingBottom: insets.bottom + space.xxl, gap: space.md }}>
          <LinearGradient colors={side.hero} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.hero}>
            <PitchStripes tint="255,255,255" />
            <View style={[styles.tag, { backgroundColor: side.accent }]}>
              <Text style={[styles.tagText, { color: side.onAccent }]}>Team</Text>
            </View>
            <Text style={styles.name} numberOfLines={2}>
              {t.name}
            </Text>
            <View style={styles.form}>
              {t.results.slice(0, 5).map((r) => (
                <View key={r.matchId} style={[styles.dot, r.outcome === 'W' ? { backgroundColor: side.accent } : r.outcome === 'L' ? styles.dotLoss : styles.dotTie]}>
                  <Text style={[styles.dotText, r.outcome === 'W' && { color: side.onAccent }]}>{r.outcome}</Text>
                </View>
              ))}
              {t.streak && t.streak.count > 1 && (
                <Text style={styles.streak}>
                  {t.streak.count} {t.streak.outcome === 'W' ? 'wins' : t.streak.outcome === 'L' ? 'losses' : 'ties'} in a row
                </Text>
              )}
            </View>
            <View style={styles.stats}>
              {[
                ['Played', String(t.played)],
                ['Won', String(t.won)],
                ['Lost', String(t.lost)],
                ['Win %', winPct === null ? '–' : `${winPct}`],
              ].map(([label, value]) => (
                <View key={label} style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={styles.statValue}>{value}</Text>
                  <Text style={styles.statLabel}>{label}</Text>
                </View>
              ))}
            </View>
          </LinearGradient>

          {(t.highest || rival) && (
            <View style={styles.tiles}>
              {t.highest && (
                <PressableScale scaleTo={0.97} onPress={() => openMatch(t.highest!.matchId)} style={tile}>
                  <Text style={styles.tileValue}>
                    {t.highest.runs}/{t.highest.wickets}
                  </Text>
                  <Text style={styles.small}>Highest total</Text>
                </PressableScale>
              )}
              {t.lowest && (
                <PressableScale scaleTo={0.97} onPress={() => openMatch(t.lowest!.matchId)} style={tile}>
                  <Text style={styles.tileValue}>
                    {t.lowest.runs}/{t.lowest.wickets}
                  </Text>
                  <Text style={styles.small}>Lowest total</Text>
                </PressableScale>
              )}
              {t.averageScore !== null && (
                <View style={tile}>
                  <Text style={styles.tileValue}>{Math.round(t.averageScore)}</Text>
                  <Text style={styles.small}>Average score</Text>
                </View>
              )}
            </View>
          )}

          {rival && rival.h.played > 0 && (
            <PressableScale scaleTo={0.98} onPress={() => router.push({ pathname: '/team/[name]', params: { name: rival.x } })}>
              <Card style={styles.h2h}>
                <Text style={styles.label}>Head to head</Text>
                <View style={styles.h2hRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.h2hWins, { color: side.accent }]}>{rival.h.winsA}</Text>
                    <Text style={styles.small} numberOfLines={1}>
                      {t.name}
                    </Text>
                  </View>
                  <Text style={styles.small}>{rival.h.ties ? `${rival.h.ties} tied` : 'vs'}</Text>
                  <View style={{ flex: 1, alignItems: 'flex-end' }}>
                    <Text style={[styles.h2hWins, { color: teamTheme(rival.x).accent }]}>{rival.h.winsB}</Text>
                    <Text style={styles.small} numberOfLines={1}>
                      {rival.x}
                    </Text>
                  </View>
                </View>
              </Card>
            </PressableScale>
          )}

          {players.length > 0 && (
            <>
              <SectionLabel right={together?.form != null ? <Text style={[styles.small, tone && { color: tone.ink }]}>Form {together.form.toFixed(1)} together</Text> : undefined}>Squad</SectionLabel>
              <Card style={{ gap: 0, paddingVertical: space.xs }}>
                {players.map(({ p, s, key }, i) => (
                  <PressableScale key={p.id} scaleTo={0.98} onPress={() => openPlayer(key)} style={[styles.member, i > 0 && styles.divided]} accessibilityLabel={p.name}>
                    <PlayerAvatar name={p.name} size={40} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.leaderName} numberOfLines={1}>
                        {p.name}
                        {team?.captain === p.id ? <Text style={[styles.mark, { color: side.accent }]}>{'  '}C</Text> : null}
                        {team?.keeper === p.id ? <Text style={styles.mark}>{'  '}WK</Text> : null}
                      </Text>
                      <Text style={styles.small}>
                        Bat {s.bat} · Bowl {s.bowl}
                        {s.guest ? ' · not in the squad' : ''}
                      </Text>
                    </View>
                    {s.form != null && <FormBadge form={s.form} />}
                  </PressableScale>
                ))}
              </Card>
            </>
          )}

          {(t.runs.length > 0 || t.wickets.length > 0) && <SectionLabel>Leaders</SectionLabel>}
          <View style={styles.boards}>
            <Leaders title="Most runs" unit="runs" rows={t.runs} />
            <Leaders title="Most wickets" unit="wickets" rows={t.wickets} />
            <Leaders title="Most sixes" unit="sixes" rows={t.sixes} />
            <Leaders title="Most catches" unit="catches" rows={t.catches} />
          </View>

          {t.results.length > 0 && (
            <>
              <SectionLabel right={<Text style={styles.small}>{t.results.length}</Text>}>Results</SectionLabel>
              <Card style={{ gap: 0, paddingVertical: space.xs }}>
                {t.results.map((r, i) => (
                  <PressableScale key={r.matchId} scaleTo={0.98} onPress={() => openMatch(r.matchId)} style={[styles.result, i > 0 && styles.divided]} accessibilityLabel={r.result}>
                    <View style={[styles.dot, r.outcome === 'W' ? { backgroundColor: side.accent } : r.outcome === 'L' ? styles.dotLoss : styles.dotTie]}>
                      <Text style={[styles.dotText, r.outcome === 'W' && { color: side.onAccent }]}>{r.outcome}</Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.leaderName} numberOfLines={1}>
                        vs {r.opponent}
                      </Text>
                      <Text style={styles.small} numberOfLines={1}>
                        {r.result}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.score}>
                        {r.score} <Text style={styles.small}>· {r.against}</Text>
                      </Text>
                      <Text style={styles.small}>{day(r.date)}</Text>
                    </View>
                  </PressableScale>
                ))}
              </Card>
            </>
          )}

          {!t.played && !players.length && (
            <Card>
              <Text style={styles.small}>No matches for {name} yet.</Text>
            </Card>
          )}
        </ScrollView>
      </Screen>
    </PageToneProvider>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', paddingHorizontal: space.lg, paddingVertical: space.sm },
  hero: { borderRadius: radius.xl, padding: space.xl, overflow: 'hidden', borderWidth: 1, borderColor: hero.line, gap: space.sm },
  tag: { alignSelf: 'flex-start', paddingHorizontal: 10, height: 24, borderRadius: radius.sm, justifyContent: 'center', transform: [{ skewX: '-8deg' }] },
  tagText: { ...type.label },
  name: { fontFamily: font.posterBlack, fontSize: 44, lineHeight: 48, color: hero.text, letterSpacing: -1.4 },
  form: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  dot: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  dotLoss: { backgroundColor: 'rgba(255,90,60,0.22)' },
  dotTie: { backgroundColor: hero.ink(0.14) },
  dotText: { color: hero.text, fontSize: 11, fontFamily: font.heavy },
  streak: { color: hero.muted, fontSize: 12, fontFamily: font.semibold, marginLeft: 4 },
  stats: { flexDirection: 'row', marginTop: space.sm, backgroundColor: colors.inset, borderRadius: radius.md, paddingVertical: space.md },
  statValue: { color: hero.text, fontSize: 26, lineHeight: 30, fontFamily: font.posterBlack, ...type.num },
  statLabel: { ...type.label, fontSize: 9, color: hero.faint, marginTop: 2 },
  tiles: { flexDirection: 'row', gap: space.sm },
  tile: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: space.md },
  tileValue: { color: colors.text, fontSize: 22, fontFamily: font.posterBlack, ...type.num },
  h2h: { gap: space.sm },
  h2hRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  h2hWins: { fontSize: 34, lineHeight: 38, fontFamily: font.posterBlack, ...type.num },
  label: { ...type.label, color: colors.muted },
  small: { color: colors.muted, fontSize: 12, fontFamily: font.medium },
  boards: { gap: space.md },
  board: { gap: 0 },
  leader: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  divided: { borderTopWidth: 1, borderTopColor: colors.border },
  leaderName: { color: colors.text, fontSize: 15, fontFamily: font.semibold },
  leaderValue: { color: colors.text, fontSize: 20, fontFamily: font.posterBlack, ...type.num },
  leaderTop: { fontSize: 24 },
  member: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm, paddingHorizontal: space.xs },
  mark: { fontSize: 11, fontFamily: font.heavy, color: colors.muted },
  result: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm, paddingHorizontal: space.xs },
  score: { color: colors.text, fontSize: 15, fontFamily: font.bold, ...type.num },
});
