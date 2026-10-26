import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ExportSheet } from '../../components/ExportSheet.tsx';
import { Button, FadeIn, GhostWord, IconButton, PitchStripes, PressableScale, Screen, SectionLabel, useToast } from '../../components/ui.tsx';
import { matchState, oversText } from '../../engine/engine.ts';
import { careerStats, playerOfTheMatch, seriesState, type SeriesState } from '../../engine/stats.ts';
import type { Match } from '../../engine/types.ts';
import { useMatches } from '../../store/matches.tsx';
import { useMatchFiles } from '../../store/useMatchFiles.ts';
import { colors, font, radius, space, type, hero, edge } from '../../theme.ts';

/** A dot per match of the series: who won it, or still to play. */
export function SeriesPips({ series, size = 14 }: { series: SeriesState; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {Array.from({ length: series.of }, (_, i) => {
        const m = series.matches.find((x) => x.series!.number === i + 1);
        const st = m ? matchState(m) : null;
        const winner = st?.result ? m!.teams.find((t) => t.id === st.winner)?.name ?? 'tie' : null;
        const first = winner && winner.trim().toLowerCase() === series.teams[0].trim().toLowerCase();
        return (
          <View
            key={i}
            style={[
              { width: size, height: size, borderRadius: 3, transform: [{ skewX: '-12deg' }] },
              winner === null
                ? { borderWidth: 1.5, borderColor: colors.borderHi, borderStyle: m ? 'solid' : 'dashed' }
                : winner === 'tie'
                  ? { backgroundColor: colors.faint }
                  : { backgroundColor: first ? colors.accent : colors.text },
            ]}
          />
        );
      })}
    </View>
  );
}

/** "Siddharth Singh" → "Siddharth S.", so names fit a narrow column. */
const short = (name: string) => {
  const [first, ...rest] = name.trim().split(/\s+/);
  return rest.length ? `${first} ${rest[rest.length - 1][0]}.` : first;
};

function Leaders({ matches }: { matches: Match[] }) {
  const careers = useMemo(() => careerStats(matches), [matches]);
  const runs = [...careers].filter((c) => c.batting.runs > 0).sort((a, b) => b.batting.runs - a.batting.runs).slice(0, 3);
  const wkts = [...careers].filter((c) => c.bowling.wickets > 0).sort((a, b) => b.bowling.wickets - a.bowling.wickets).slice(0, 3);
  const col = (title: string, list: typeof careers, value: (c: (typeof careers)[number]) => number, unit: string) => (
    <View style={styles.leaderCol}>
      <Text style={styles.leaderTitle}>{title}</Text>
      {list.map((c, i) => (
        <PressableScale
          key={c.key}
          scaleTo={0.97}
          onPress={() => router.push({ pathname: '/player/[key]', params: { key: c.key } })}
          style={styles.leaderRow}
        >
          <Text style={[styles.leaderRank, i === 0 && { color: colors.accentInk }]}>{i + 1}</Text>
          <Text style={styles.leaderName} numberOfLines={1}>
            {short(c.name)}
          </Text>
          <Text style={styles.leaderValue}>
            {value(c)}
            <Text style={styles.leaderUnit}>{unit}</Text>
          </Text>
        </PressableScale>
      ))}
    </View>
  );
  return (
    <View style={styles.leaders}>
      {col('Most runs', runs, (c) => c.batting.runs, 'r')}
      {col('Most wickets', wkts, (c) => c.bowling.wickets, 'w')}
    </View>
  );
}

export default function SeriesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { matches } = useMatches();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { exportAs } = useMatchFiles(toast.show);
  const [exporting, setExporting] = useState<Match[] | null>(null);
  const inSeries = matches.filter((m) => m.series?.id === id);

  const back = (
    <View style={styles.header}>
      <IconButton icon="chevron-back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      {inSeries.length > 0 && <IconButton icon="download-outline" label="Export series" onPress={() => setExporting(inSeries)} />}
    </View>
  );
  if (!inSeries.length) {
    return (
      <Screen>
        {back}
        <Text style={styles.missing}>Series not found</Text>
      </Screen>
    );
  }

  const s = seriesState(inSeries);
  const last = s.matches[s.matches.length - 1];
  const live = s.matches.find((m) => !matchState(m).result);

  return (
    <Screen>
      {back}
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: 0, paddingBottom: insets.bottom + space.xxl }}>
        <FadeIn>
          <View style={styles.hero}>
            <PitchStripes tint="255,255,255" />
            <GhostWord size={200} style={{ right: -20, bottom: -50, color: hero.ink(0.05) }}>
              SERIES
            </GhostWord>
            <Text style={styles.eyebrow}>SERIES · BEST OF {s.of}</Text>
            <Text style={styles.name}>{s.name}</Text>
            <View style={styles.scoreline}>
              <View style={styles.side}>
                <Text style={[styles.sideScore, s.wins[0] >= s.wins[1] && s.played > 0 && { color: hero.accent }]}>{s.wins[0]}</Text>
                <Text style={styles.sideName} numberOfLines={1}>
                  {s.teams[0]}
                </Text>
              </View>
              <Text style={styles.dash}>–</Text>
              <View style={[styles.side, { alignItems: 'flex-end' }]}>
                <Text style={[styles.sideScore, s.wins[1] >= s.wins[0] && s.played > 0 && { color: hero.text }]}>{s.wins[1]}</Text>
                <Text style={styles.sideName} numberOfLines={1}>
                  {s.teams[1]}
                </Text>
              </View>
            </View>
            <SeriesPips series={s} />
            <Text style={styles.status}>{s.status}</Text>
          </View>
        </FadeIn>

        {s.best && (
          <FadeIn delay={80}>
            <PressableScale
              scaleTo={0.98}
              onPress={() => router.push({ pathname: '/player/[key]', params: { key: s.best!.key } })}
              style={styles.mos}
            >
              <MaterialCommunityIcons name="trophy-award" size={30} color={colors.onAccent} />
              <View style={{ flex: 1 }}>
                <Text style={styles.mosLabel}>{s.over ? 'MAN OF THE SERIES' : 'LEADING FOR MAN OF THE SERIES'}</Text>
                <Text style={styles.mosName} numberOfLines={1}>
                  {s.best.name}
                </Text>
                <Text style={styles.mosLine}>
                  {s.best.team} · {s.best.summary}
                </Text>
              </View>
            </PressableScale>
          </FadeIn>
        )}

        {s.next !== null && (
          <Button
            label={`Play match ${s.next}`}
            icon="play"
            onPress={() => router.push({ pathname: '/new', params: { rematch: last.id, series: 'next' } })}
            style={{ marginTop: space.lg }}
          />
        )}
        {live && (
          <Button
            label={`Back to match ${live.series!.number}`}
            icon="radio-button-on"
            onPress={() => router.push({ pathname: '/match/[id]', params: { id: live.id } })}
            style={{ marginTop: space.lg }}
          />
        )}

        {s.played > 0 && (
          <>
            <SectionLabel>Series leaders</SectionLabel>
            <Leaders matches={s.matches} />
          </>
        )}

        <SectionLabel>Matches</SectionLabel>
        <View style={{ gap: space.sm }}>
          {s.matches.map((m) => {
            const st = matchState(m);
            const mom = playerOfTheMatch(m);
            return (
              <PressableScale
                key={m.id}
                scaleTo={0.98}
                onPress={() =>
                  router.push(
                    st.result
                      ? { pathname: '/match/[id]/scorecard', params: { id: m.id } }
                      : { pathname: '/match/[id]', params: { id: m.id } },
                  )
                }
                style={styles.match}
              >
                <View style={styles.matchNo}>
                  <Text style={styles.matchNoText}>{m.series!.number}</Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  {st.innings.slice(0, 2).map((inn, i) => (
                    <View key={i} style={styles.matchLine}>
                      <Text style={[styles.matchTeam, st.winner === inn.battingTeam.id && { color: colors.text }]} numberOfLines={1}>
                        {inn.battingTeam.name}
                      </Text>
                      <Text style={[styles.matchScore, st.winner === inn.battingTeam.id && { color: colors.text }]}>
                        {inn.runs}/{inn.wickets}
                        <Text style={styles.matchOvers}> {oversText(inn.legalBalls)}</Text>
                      </Text>
                    </View>
                  ))}
                  <Text style={styles.matchResult} numberOfLines={1}>
                    {st.result ?? 'In progress'}
                  </Text>
                  {mom && (
                    <Text style={styles.matchMom} numberOfLines={1}>
                      ★ {mom.name} · {mom.summary}
                    </Text>
                  )}
                </View>
              </PressableScale>
            );
          })}
          {Array.from({ length: s.over ? 0 : s.of - s.matches.length }, (_, i) => (
            <View key={i} style={[styles.match, styles.matchEmpty]}>
              <View style={[styles.matchNo, { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border }]}>
                <Text style={[styles.matchNoText, { color: colors.faint }]}>{s.matches.length + i + 1}</Text>
              </View>
              <Text style={styles.matchTbd}>To play</Text>
            </View>
          ))}
        </View>
      </ScrollView>
      <ExportSheet
        visible={exporting !== null}
        matches={exporting ?? []}
        onClose={() => setExporting(null)}
        onExport={(format, chosen) => {
          setExporting(null);
          exportAs(format, chosen);
        }}
      />
      {toast.element}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingVertical: space.sm },
  missing: { color: colors.muted, textAlign: 'center', marginTop: space.xxl, fontFamily: font.medium },
  hero: {
    backgroundColor: '#101010',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: hero.line,
    padding: space.xl,
    overflow: 'hidden',
    gap: space.md,
  },
  eyebrow: { ...type.label, color: hero.accent },
  name: { fontFamily: font.posterBlack, fontSize: 36, lineHeight: 40, color: hero.text, marginTop: -space.sm },
  scoreline: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md },
  side: { flex: 1 },
  sideScore: { fontFamily: font.posterBlack, fontSize: 79, lineHeight: 88, color: hero.muted, ...type.num },
  sideName: { fontFamily: font.poster, fontSize: 16, color: hero.muted },
  dash: { fontFamily: font.posterBlack, fontSize: 46, color: hero.faint, paddingBottom: 34 },
  status: { fontFamily: font.poster, fontSize: 18, color: hero.text },
  mos: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    padding: space.lg,
    marginTop: space.md,
    ...edge,
  },
  mosLabel: { ...type.label, fontSize: 10, color: colors.onAccent, opacity: 0.65 },
  mosName: { fontFamily: font.posterBlack, fontSize: 25, lineHeight: 28, color: colors.onAccent },
  mosLine: { fontFamily: font.bold, fontSize: 13, color: colors.onAccent },
  leaders: { flexDirection: 'row', gap: space.sm },
  leaderCol: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.md,
    gap: 6,
    ...edge,
  },
  leaderTitle: { ...type.label, fontSize: 10, color: colors.muted, marginBottom: 2 },
  leaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  leaderRank: { fontFamily: font.posterBlack, fontSize: 18, color: colors.faint, width: 14 },
  leaderName: { flex: 1, color: colors.text, fontSize: 13, fontFamily: font.bold },
  leaderValue: { fontFamily: font.posterBlack, fontSize: 16, color: colors.text, ...type.num },
  leaderUnit: { fontFamily: font.poster, fontSize: 13, color: colors.faint },
  match: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.md,
    ...edge,
  },
  matchEmpty: { backgroundColor: 'transparent', borderStyle: 'dashed' },
  matchNo: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.surfaceHi, alignItems: 'center', justifyContent: 'center' },
  matchNoText: { fontFamily: font.posterBlack, fontSize: 20, color: colors.text },
  matchLine: { flexDirection: 'row', alignItems: 'center' },
  matchTeam: { flex: 1, color: colors.muted, fontSize: 14, fontFamily: font.bold },
  matchScore: { color: colors.muted, fontSize: 16, fontFamily: font.posterBlack, ...type.num },
  matchOvers: { fontSize: 13, fontFamily: font.poster, color: colors.faint },
  matchResult: { color: colors.accentInk, fontSize: 12, fontFamily: font.bold, marginTop: 2 },
  matchMom: { color: colors.muted, fontSize: 12, fontFamily: font.semibold },
  matchTbd: { color: colors.faint, fontSize: 14, fontFamily: font.bold },
});
