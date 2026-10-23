import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ExportSheet } from '../../../components/ExportSheet.tsx';
import { Card, IconButton, Screen, SectionLabel, Segmented, useToast } from '../../../components/ui.tsx';
import { dismissal, matchState, oversText, playerName, type InningsState, type MatchState } from '../../../engine/engine.ts';
import { isPlaceholder, playerKey } from '../../../engine/stats.ts';
import type { Match, Team } from '../../../engine/types.ts';
import { useMatch } from '../../../store/matches.tsx';
import { useMatchFiles } from '../../../store/useMatchFiles.ts';
import { colors, radius, space, type, font } from '../../../theme.ts';

const econ = (runs: number, balls: number) => (balls ? ((runs * 6) / balls).toFixed(1) : '–');
const sr = (runs: number, balls: number) => (balls ? ((runs * 100) / balls).toFixed(1) : '–');

function shareText(match: Match, state: MatchState) {
  const lines = [`🏏 ${match.teams[0].name} vs ${match.teams[1].name} (${match.rules.overs} overs)`, ''];
  state.innings.forEach((inn, i) => {
    if (!match.innings[i].events.length) return;
    lines.push(`${inn.battingTeam.name}: ${inn.runs}/${inn.wickets} (${oversText(inn.legalBalls)} ov)`);
    const top = [...inn.batters].sort((a, b) => b.runs - a.runs).slice(0, 3);
    top.forEach((b) => lines.push(`  ${playerName(match, b.id)} ${b.runs}${b.out ? '' : '*'} (${b.balls})`));
    const best = [...inn.bowlers].sort((a, b) => b.wickets - a.wickets || a.runs - b.runs).slice(0, 2);
    best.forEach((b) => lines.push(`  ${playerName(match, b.id)} ${b.wickets}/${b.runs} (${oversText(b.balls)})`));
    lines.push('');
  });
  lines.push(state.result ?? 'Match in progress');
  return lines.join('\n');
}

/** A player's name that opens their career profile, unless they were never named. */
function PlayerLink({ match, team, id, style }: { match: Match; team: Team; id: string; style: StyleProp<TextStyle> }) {
  const name = playerName(match, id);
  if (isPlaceholder(name)) return <Text numberOfLines={1} style={style}>{name}</Text>;
  return (
    <Pressable
      hitSlop={6}
      style={{ flexShrink: 1, minWidth: 0 }}
      onPress={() => router.push({ pathname: '/player/[key]', params: { key: playerKey(team, name) } })}
    >
      {({ pressed }) => (
        <Text numberOfLines={1} style={[style, pressed && { opacity: 0.6 }]}>
          {name}
        </Text>
      )}
    </Pressable>
  );
}

function InningsCard({ match, s }: { match: Match; s: InningsState }) {
  const extras = s.extras.wide + s.extras.noball + s.extras.bye + s.extras.legbye;
  const yetToBat = s.battingTeam.players.filter((p) => !s.batters.some((b) => b.id === p.id));
  const atCrease = [s.striker, s.nonStriker];

  return (
    <>
      <View style={styles.totalRow}>
        <Text numberOfLines={1} style={styles.totalTeam}>
          {s.battingTeam.name}
        </Text>
        <Text style={styles.total}>
          {s.runs}/{s.wickets}
          <Text style={styles.totalOvers}>  {oversText(s.legalBalls)} ov</Text>
        </Text>
      </View>

      <SectionLabel>Batting</SectionLabel>
      <Card style={{ padding: 0 }}>
        <View style={styles.head}>
          <Text style={[styles.th, { flex: 1, textAlign: 'left' }]}>BATTER</Text>
          {['R', 'B', '4s', '6s'].map((h) => (
            <Text key={h} style={styles.th}>
              {h}
            </Text>
          ))}
          <Text style={[styles.th, { width: 58 }]}>SR</Text>
        </View>
        {s.batters.map((b) => {
          const notOut = !b.out && !b.retired;
          return (
            <View key={b.id} style={styles.row}>
              <View style={{ flex: 1, paddingRight: space.sm }}>
                <View style={styles.nameRow}>
                  <PlayerLink match={match} team={s.battingTeam} id={b.id} style={[styles.name, notOut && { color: colors.accent }]} />
                  {notOut && atCrease.includes(b.id) && <Text style={[styles.name, { color: colors.accent }]}>*</Text>}
                </View>
                <Text numberOfLines={1} style={styles.how}>
                  {dismissal(match, b)}
                </Text>
              </View>
              <Text style={[styles.td, styles.strong]}>{b.runs}</Text>
              <Text style={styles.td}>{b.balls}</Text>
              <Text style={styles.td}>{b.fours}</Text>
              <Text style={styles.td}>{b.sixes}</Text>
              <Text style={[styles.td, { width: 58 }]}>{sr(b.runs, b.balls)}</Text>
            </View>
          );
        })}
        <View style={styles.row}>
          <Text style={[styles.name, { flex: 1 }]}>Extras</Text>
          <Text style={styles.how}>
            wd {s.extras.wide}, nb {s.extras.noball}, b {s.extras.bye}, lb {s.extras.legbye}
          </Text>
          <Text style={[styles.td, styles.strong, { width: 40 }]}>{extras}</Text>
        </View>
        {yetToBat.length > 0 && (
          <View style={[styles.row, { alignItems: 'flex-start' }]}>
            <Text style={styles.how}>
              <Text style={{ color: colors.muted, fontFamily: font.bold }}>Yet to bat  </Text>
              {yetToBat.map((p) => p.name).join(', ')}
            </Text>
          </View>
        )}
      </Card>

      {s.fallOfWickets.length > 0 && (
        <>
          <SectionLabel>Fall of wickets</SectionLabel>
          <Card>
            <Text style={styles.fow}>
              {s.fallOfWickets.map((f) => `${f.runs}-${f.wicket} (${playerName(match, f.player)}, ${f.over})`).join('   ')}
            </Text>
          </Card>
        </>
      )}

      <SectionLabel>Bowling</SectionLabel>
      <Card style={{ padding: 0 }}>
        <View style={styles.head}>
          <Text style={[styles.th, { flex: 1, textAlign: 'left' }]}>BOWLER</Text>
          {['O', 'M', 'R', 'W'].map((h) => (
            <Text key={h} style={styles.th}>
              {h}
            </Text>
          ))}
          <Text style={[styles.th, { width: 58 }]}>ECON</Text>
        </View>
        {s.bowlers.map((b) => (
          <View key={b.id} style={styles.row}>
            <View style={{ flex: 1 }}>
              <View style={styles.nameRow}>
                <PlayerLink match={match} team={s.bowlingTeam} id={b.id} style={styles.name} />
              </View>
              {(b.wides > 0 || b.noballs > 0) && (
                <Text style={styles.how}>
                  {b.wides} wd · {b.noballs} nb
                </Text>
              )}
            </View>
            <Text style={styles.td}>{oversText(b.balls)}</Text>
            <Text style={styles.td}>{b.maidens}</Text>
            <Text style={styles.td}>{b.runs}</Text>
            <Text style={[styles.td, styles.strong, b.wickets > 0 && { color: colors.accent }]}>{b.wickets}</Text>
            <Text style={[styles.td, { width: 58 }]}>{econ(b.runs, b.balls)}</Text>
          </View>
        ))}
        {s.bowlers.length === 0 && <Text style={[styles.how, { padding: space.lg }]}>No overs bowled yet</Text>}
      </Card>
    </>
  );
}

export default function Scorecard() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { match } = useMatch(id);
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<'0' | '1' | null>(null);
  const toast = useToast();
  const { exportMatches, exportPdf } = useMatchFiles(toast.show);
  const [exporting, setExporting] = useState<Match[] | null>(null);

  if (!match) return <Screen>{null}</Screen>;
  const state = matchState(match);
  const shown = tab ?? (String(state.current) as '0' | '1');
  const s = state.innings[Number(shown)];
  const started = match.innings[Number(shown)].events.length > 0;

  return (
    <Screen>
      <View style={styles.header}>
        <IconButton icon="chevron-back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        <Text style={styles.headerTitle}>Scorecard</Text>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <IconButton icon="download-outline" label="Export match" onPress={() => setExporting([match])} />
          <IconButton icon="share-outline" label="Share summary" onPress={() => Share.share({ message: shareText(match, state) }).catch(() => {})} />
        </View>
      </View>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: space.sm, paddingBottom: insets.bottom + space.xxl }}>
        <View style={[styles.banner, state.result ? styles.bannerDone : null]}>
          <Ionicons
            name={state.result ? 'trophy' : 'radio-button-on'}
            size={16}
            color={state.result ? colors.onAccent : colors.danger}
          />
          <Text style={[styles.bannerText, state.result ? { color: colors.onAccent } : null]}>{state.result ?? 'Live · match in progress'}</Text>
        </View>
        <Segmented
          value={shown}
          onChange={setTab}
          options={state.innings.map((inn, i) => ({ value: String(i) as '0' | '1', label: inn.battingTeam.name }))}
        />
        {started ? (
          <InningsCard match={match} s={s} />
        ) : (
          <Text style={styles.empty}>{s.battingTeam.name} haven’t batted yet.</Text>
        )}
      </ScrollView>
      <ExportSheet
        visible={exporting !== null}
        matches={exporting ?? []}
        onClose={() => setExporting(null)}
        onExport={(format, chosen) => {
          setExporting(null);
          if (format === 'pdf') exportPdf(chosen);
          else exportMatches(chosen);
        }}
      />
      {toast.element}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingVertical: space.sm },
  headerTitle: { color: colors.text, fontSize: 26, fontFamily: font.poster, textTransform: 'uppercase' },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.dangerDim,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.md,
  },
  bannerDone: { backgroundColor: colors.accent, borderColor: colors.accent },
  bannerText: { color: colors.text, fontSize: 20, fontFamily: font.poster, textTransform: 'uppercase', flex: 1 },
  totalRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: space.xl, paddingHorizontal: space.xs },
  totalTeam: { color: colors.text, fontSize: 30, fontFamily: font.poster, textTransform: 'uppercase', flex: 1 },
  total: { color: colors.accent, fontSize: 48, lineHeight: 50, fontFamily: font.posterBlack, ...type.num },
  totalOvers: { color: colors.muted, fontSize: 18, fontFamily: font.poster },
  head: { flexDirection: 'row', paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.sm },
  th: { ...type.label, fontSize: 10, color: colors.faint, width: 32, textAlign: 'right' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  name: { color: colors.text, fontSize: 15, fontFamily: font.bold },
  nameRow: { flexDirection: 'row', alignItems: 'center', flexShrink: 1, minWidth: 0 },
  how: { color: colors.muted, fontSize: 12, fontFamily: font.regular, marginTop: 2, flexShrink: 1 },
  td: { width: 32, textAlign: 'right', color: colors.muted, fontSize: 18, fontFamily: font.poster, ...type.num },
  strong: { color: colors.text, fontFamily: font.posterBlack, fontSize: 20 },
  fow: { color: colors.muted, fontSize: 13, fontFamily: font.regular, lineHeight: 20 },
  empty: { color: colors.muted, textAlign: 'center', marginTop: space.xxl },
});
