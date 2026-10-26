import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BallEditSheet, fixBall } from '../../../components/BallEditSheet.tsx';
import { ExportSheet } from '../../../components/ExportSheet.tsx';
import { BallByBall, Partnerships, RunRace } from '../../../components/MatchCharts.tsx';
import { BallChip, Card, IconButton, PressableScale, Screen, SectionLabel, Segmented, useToast } from '../../../components/ui.tsx';
import { dismissal, matchState, oversText, playerName, type BallView, type InningsState, type MatchState } from '../../../engine/engine.ts';
import { isPlaceholder, keyFor, playerOfTheMatch } from '../../../engine/stats.ts';
import type { BallEvent, Match, Team } from '../../../engine/types.ts';
import { plural } from '../../../engine/text.ts';
import { useMatch } from '../../../store/matches.tsx';
import { useMatchFiles } from '../../../store/useMatchFiles.ts';
import { colors, radius, space, type, font, edge } from '../../../theme.ts';

const econ = (runs: number, balls: number) => (balls ? ((runs * 6) / balls).toFixed(1) : '–');
const sr = (runs: number, balls: number) => (balls ? ((runs * 100) / balls).toFixed(1) : '–');

function shareText(match: Match, state: MatchState) {
  const lines = [`🏏 ${match.teams[0].name} vs ${match.teams[1].name} (${plural(match.rules.overs, 'over')})`, ''];
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
  const mom = state.result ? playerOfTheMatch(match) : null;
  if (mom) lines.push(`⭐ Man of the Match: ${mom.name} (${mom.summary})`);
  return lines.join('\n');
}

/** A player's name that opens their career profile, unless they were never named. */
function PlayerLink({ match, team, id, style }: { match: Match; team: Team; id: string; style: StyleProp<TextStyle> }) {
  const base = playerName(match, id);
  const marks = `${match.captains?.[team.id] === id ? ' (c)' : ''}${match.keepers?.[team.id] === id ? ' †' : ''}`;
  const name = base;
  if (isPlaceholder(name)) return <Text numberOfLines={1} style={style}>{name + marks}</Text>;
  return (
    <Pressable
      hitSlop={6}
      style={{ flexShrink: 1, minWidth: 0 }}
      onPress={() => router.push({ pathname: '/player/[key]', params: { key: keyFor(team, team.players.find((p) => p.id === id) ?? { name }) } })}
    >
      {({ pressed }) => (
        <Text numberOfLines={1} style={[style, pressed && { opacity: 0.6 }]}>
          {name}
          {marks}
        </Text>
      )}
    </Pressable>
  );
}

function InningsCard({ match, s }: { match: Match; s: InningsState }) {
  const extras = s.extras.wide + s.extras.noball + s.extras.bye + s.extras.legbye + s.extras.penalty;
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
                  <PlayerLink match={match} team={s.battingTeam} id={b.id} style={[styles.name, notOut && { color: colors.accentInk }]} />
                  {notOut && atCrease.includes(b.id) && <Text style={[styles.name, { color: colors.accentInk }]}>*</Text>}
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
            {s.extras.penalty ? `, pen ${s.extras.penalty}` : ''}
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
            <Text style={[styles.td, styles.strong, b.wickets > 0 && { color: colors.accentInk }]}>{b.wickets}</Text>
            <Text style={[styles.td, { width: 58 }]}>{econ(b.runs, b.balls)}</Text>
          </View>
        ))}
        {s.bowlers.length === 0 && <Text style={[styles.how, { padding: space.lg }]}>No overs bowled yet</Text>}
      </Card>
    </>
  );
}

/** Every over with its bowlers and balls, each ball open to fixing. */
function OversEditor({ match, s, onFix }: { match: Match; s: InningsState; onFix: (b: BallView) => void }) {
  return (
    <>
      <SectionLabel>Overs · tap a ball to fix it</SectionLabel>
      <Card style={{ padding: 0 }}>
        {s.overs.map((balls, o) =>
          balls.length === 0 ? null : (
            <View key={o} style={styles.editOver}>
              <Text style={styles.editOverTitle} numberOfLines={1}>
                OVER {o + 1} · {(s.overBowlers[o] ?? []).map((id) => playerName(match, id)).join(' → ') || 'no bowler'} · {s.overTotals[o]?.runs ?? 0} runs
              </Text>
              <View style={styles.editBalls}>
                {balls.map((b, i) => (
                  <PressableScale key={i} scaleTo={0.85} accessibilityLabel={`Fix over ${o + 1} ball ${i + 1}`} onPress={() => onFix(b)}>
                    <BallChip ball={b} />
                  </PressableScale>
                ))}
              </View>
            </View>
          ),
        )}
      </Card>
    </>
  );
}

export default function Scorecard() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { match, saveMatch } = useMatch(id);
  const [editMode, setEditMode] = useState(false);
  const [fixing, setFixing] = useState<BallView | null>(null);
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<string | null>(null);
  const toast = useToast();
  const { exportMatches, exportPdf } = useMatchFiles(toast.show);
  const [exporting, setExporting] = useState<Match[] | null>(null);

  if (!match) return <Screen>{null}</Screen>;
  const state = matchState(match);
  const mom = state.result ? playerOfTheMatch(match) : null;
  const shown = tab ?? (String(state.current));
  const s = state.innings[Number(shown)];
  const started = match.innings[Number(shown)].events.length > 0;

  return (
    <Screen>
      <View style={styles.header}>
        <IconButton icon="chevron-back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        <Text style={styles.headerTitle}>Scorecard</Text>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <IconButton
            icon={editMode ? 'checkmark' : 'create-outline'}
            label={editMode ? 'Done editing' : 'Edit scorecard'}
            onPress={() => setEditMode(!editMode)}
          />
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
        {mom && (
          <PressableScale
            scaleTo={0.98}
            disabled={isPlaceholder(mom.name)}
            dimWhenDisabled={false}
            onPress={() => router.push({ pathname: '/player/[key]', params: { key: mom.key } })}
            style={styles.mom}
          >
            <View style={styles.momIcon}>
              <Ionicons name="star" size={18} color={colors.gold} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.momLabel}>Man of the Match</Text>
              <Text style={styles.momName} numberOfLines={1}>
                {mom.name}
              </Text>
              <Text style={styles.momLine} numberOfLines={1}>
                {mom.team} · {mom.summary}
              </Text>
            </View>
            {!isPlaceholder(mom.name) && <Ionicons name="chevron-forward" size={18} color={colors.faint} />}
          </PressableScale>
        )}
        <Segmented
          value={shown}
          onChange={setTab}
          options={state.innings.map((inn, i) => ({ value: String(i), label: i >= 2 ? `SO · ${inn.battingTeam.name}` : inn.battingTeam.name }))}
        />
        {editMode && (
          <View style={styles.editHint}>
            <Ionicons name="create-outline" size={16} color={colors.accentInk} />
            <Text style={styles.editHintText}>
              Editing. Tap any ball below to fix its runs, extras, wicket or bowler; a bowler who couldn’t finish an over is
              changed from the ball the new one started. Everything updates as you go.
            </Text>
          </View>
        )}
        {started && editMode ? (
          <>
            <InningsCard match={match} s={s} />
            <OversEditor match={match} s={s} onFix={setFixing} />
          </>
        ) : started ? (
          <>
            <InningsCard match={match} s={s} />
            <Partnerships match={match} s={s} />
            <RunRace state={state} />
            <BallByBall match={match} s={s} />
          </>
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
      <BallEditSheet
        ball={fixing}
        event={fixing?.event !== undefined ? (match.innings[Number(shown)].events[fixing.event] as BallEvent) : null}
        match={match}
        s={s}
        onClose={() => setFixing(null)}
        onSave={(next, bowler) => {
          if (fixing?.event === undefined) return;
          const fixed = fixBall(match, Number(shown), fixing.event, next, bowler);
          if (typeof fixed === 'string') {
            toast.show(fixed, 'error');
            return;
          }
          saveMatch(fixed);
          setFixing(null);
          const now = matchState(fixed).result;
          if (now !== state.result) toast.show(now ? `Result now: ${now}` : 'The match isn’t finished any more: carry on scoring it.', 'info');
          else toast.show(next ? 'Fixed. The scorecard is updated.' : 'Ball deleted', 'success');
        }}
      />
      {toast.element}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingVertical: space.sm },
  headerTitle: { color: colors.text, fontSize: 21, fontFamily: font.poster },
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
  bannerDone: { backgroundColor: colors.accent, borderColor: colors.accent, ...edge },
  mom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: space.md,
    marginBottom: space.md,
    ...edge,
  },
  momIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.goldDim },
  momLabel: { ...type.label, fontSize: 9, color: colors.muted },
  momName: { fontFamily: font.poster, fontSize: 20, color: colors.text },
  momLine: { color: colors.muted, fontSize: 12, fontFamily: font.medium },
  bannerText: { color: colors.text, fontSize: 16, fontFamily: font.poster, flex: 1 },
  totalRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: space.xl, paddingHorizontal: space.xs },
  totalTeam: { color: colors.text, fontSize: 25, fontFamily: font.poster, flex: 1 },
  total: { color: colors.accentInk, fontSize: 39, lineHeight: 44, fontFamily: font.posterBlack, ...type.num },
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
  strong: { color: colors.text, fontFamily: font.posterBlack, fontSize: 16 },
  fow: { color: colors.muted, fontSize: 13, fontFamily: font.regular, lineHeight: 20 },
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
  editOver: { paddingHorizontal: space.lg, paddingVertical: space.md, borderTopWidth: 1, borderTopColor: colors.border, gap: space.sm },
  editOverTitle: { ...type.label, fontSize: 10, color: colors.muted },
  editBalls: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  empty: { color: colors.muted, textAlign: 'center', marginTop: space.xxl },
});
