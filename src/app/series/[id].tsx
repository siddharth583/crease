import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PlayerAvatar } from '../../components/Avatar.tsx';
import { ExportSheet } from '../../components/ExportSheet.tsx';
import { Columns, Page, useLayout } from '../../components/layout.tsx';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { OvalGround, SeamDivider } from '../../components/cricket.tsx';
import { MatchTicket, TrophyRace, sideInk } from '../../components/HomeX.tsx';
import { CountUp, Rise, Sheen } from '../../components/motion.tsx';
import { TeamCrest } from '../../components/TeamCrest.tsx';
import { Button, FadeIn, IconButton, PitchStripes, PressableScale, Screen, SectionLabel, useToast } from '../../components/ui.tsx';
import { matchState } from '../../engine/engine.ts';
import { careerStats, seriesState, type SeriesState } from '../../engine/stats.ts';
import type { Match } from '../../engine/types.ts';
import { useMatches } from '../../store/matches.tsx';
import { useMatchFiles } from '../../store/useMatchFiles.ts';
import { colors, font, gradients, radius, space, type, hero, edge, ownTeamTheme } from '../../theme.ts';

/**
 * A dot per match of the series: who won it, in the winner's own colour when it has one, or still to play. `onHero`
 * for the dark panel, where the second side's fallback is light rather than the page's ink.
 */
export function SeriesPips({ series, size = 14, onHero }: { series: SeriesState; size?: number; onHero?: boolean }) {
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
                ? { borderWidth: 1.5, borderColor: onHero ? hero.ink(0.3) : colors.borderHi, borderStyle: m ? 'solid' : 'dashed' }
                : winner === 'tie'
                  ? { backgroundColor: onHero ? hero.faint : colors.faint }
                  : { backgroundColor: ownTeamTheme(winner)?.accent ?? (first ? colors.accent : onHero ? hero.text : colors.text) },
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
          <PlayerAvatar name={c.name} size={22} />
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
  const layout = useLayout();
  const { wide } = layout;

  const bar = (
    <View style={[styles.header, wide && { paddingHorizontal: 0, paddingTop: space.lg, paddingBottom: space.md }]}>
      <IconButton icon="chevron-back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      {inSeries.length > 0 && <IconButton icon="download-outline" label="Export series" onPress={() => setExporting(inSeries)} />}
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
  const mosN = (
    <>
      {s.best && (
        <FadeIn delay={80}>
          <PressableScale
            scaleTo={0.98}
            onPress={() => router.push({ pathname: '/player/[key]', params: { key: s.best!.key } })}
            accessibilityLabel={`${s.over ? 'Man of the Series' : 'Leading for Man of the Series'}: ${s.best.name}`}
            style={styles.mos}
          >
            <LinearGradient pointerEvents="none" colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            <OvalGround opacity={0.07} drift={false} />
            <Sheen every={7000} strength={0.07} />
            <View style={styles.mosInner}>
              <View style={styles.mosHead}>
                <Ionicons name="star" size={11} color={colors.gold} />
                <Text style={styles.mosLabel}>{s.over ? 'MAN OF THE SERIES' : 'LEADING FOR MAN OF THE SERIES'}</Text>
                <Ionicons name="star" size={11} color={colors.gold} />
              </View>
              <View style={styles.mosRow}>
                <View style={styles.mosRing}>
                  <PlayerAvatar name={s.best.name} size={56} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.mosName} numberOfLines={2}>
                    {s.best.name}
                  </Text>
                  <Text style={styles.mosLine}>
                    {s.best.team} · {s.best.summary}
                  </Text>
                </View>
              </View>
            </View>
          </PressableScale>
        </FadeIn>
      )}
    </>
  );
  const leader = s.played === 0 ? null : s.wins[0] === s.wins[1] ? 'Level' : s.wins[0] > s.wins[1] ? s.teams[0] : s.teams[1];

  return (
    <Screen>
      {back}
      <ScrollView contentContainerStyle={{ padding: wide ? layout.gutter : space.lg, paddingTop: 0, paddingBottom: insets.bottom + space.xxl }}>
        <Page>
        {/* A tablet or laptop: the scoreline, what's next and the leaders on the left; the man of the series and every
            match on the right. */}
        <Columns weights={[3, 2]} gap={wide ? space.lg : 0}>
        <View>
        {/* Each column opens on a label, so the scoreline and the right column start level. */}
        {wide && <SectionLabel flush>The series</SectionLabel>}
        <FadeIn>
          <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, wide && { padding: space.xxl }]}>
            <PitchStripes tint="255,255,255" />
            <OvalGround opacity={0.1} />
            <Sheen />
            <View style={styles.eyebrowRow}>
              <Ionicons name="trophy" size={13} color={colors.gold} />
              <Text style={styles.eyebrow}>SERIES · BEST OF {s.of}</Text>
            </View>
            <Text style={[styles.name, wide && { fontSize: 48, lineHeight: 54 }]}>{s.name}</Text>
            <View style={styles.scoreline}>
              {([0, 1] as const).map((i) => (
                <View key={i} style={[styles.side, i === 1 && { alignItems: 'flex-end' }]}>
                  <TeamCrest name={s.teams[i]} size={44} />
                  <CountUp
                    value={s.wins[i]}
                    delay={150 + i * 120}
                    style={[styles.sideScore, s.wins[i] >= s.wins[1 - i] && s.played > 0 && { color: sideInk(s.teams[i], i, true) }]}
                  />
                  <Text style={styles.sideName} numberOfLines={1}>
                    {s.teams[i]}
                  </Text>
                </View>
              ))}
            </View>
            <TrophyRace series={s} onHero />
            <SeamDivider color={hero.ink(0.2)} />
            <View style={styles.statusRow}>
              <SeriesPips series={s} onHero />
              {leader && (
                <Text style={styles.leading} numberOfLines={1}>
                  {s.over ? 'Won by ' : leader === 'Level' ? '' : 'Leading: '}
                  {leader === 'Level' ? 'Level' : leader}
                </Text>
              )}
            </View>
            <Text style={styles.status}>{s.status}</Text>
          </LinearGradient>
        </FadeIn>

        {!wide && mosN}
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
        </View>

        <View>
        {wide && s.best && (
          <>
            <SectionLabel flush>{s.over ? 'Man of the series' : 'Leading the series'}</SectionLabel>
            <View style={{ marginTop: -space.md }}>{mosN}</View>
          </>
        )}
        <SectionLabel flush={wide && !s.best}>Matches</SectionLabel>
        <View style={{ gap: space.sm }}>
          {s.matches.map((m, i) => {
            const st = matchState(m);
            return (
              <Rise key={m.id} index={i}>
                <MatchTicket
                  match={m}
                  label={`Match ${m.series!.number} of ${s.of} · ${new Date(m.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`}
                  accessibilityLabel={`Match ${m.series!.number}: ${st.result ?? 'in progress'}`}
                  onPress={() => router.push(st.result ? { pathname: '/match/[id]/scorecard', params: { id: m.id } } : { pathname: '/match/[id]', params: { id: m.id } })}
                />
              </Rise>
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
        </View>
        </Columns>
        </Page>
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
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: hero.line,
    padding: space.xl,
    overflow: 'hidden',
    gap: space.md,
  },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  eyebrow: { ...type.label, color: colors.gold },
  name: { fontFamily: font.posterBlack, fontSize: 34, lineHeight: 38, color: hero.text },
  scoreline: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md, marginTop: space.sm },
  side: { flex: 1, gap: 2 },
  sideScore: { fontFamily: font.posterBlack, fontSize: 79, lineHeight: 88, color: hero.muted, ...type.num },
  sideName: { fontFamily: font.poster, fontSize: 15, color: hero.muted },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  leading: { flexShrink: 1, color: colors.gold, fontFamily: font.bold, fontSize: 12 },
  status: { fontFamily: font.poster, fontSize: 18, color: hero.text },
  // Man of the Series: an honours-board plaque, brass on the deep green.
  mos: { borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.gold, marginTop: space.md, overflow: 'hidden' },
  mosInner: { margin: 5, borderRadius: radius.lg - 5, borderWidth: 1, borderColor: hero.ink(0.12), padding: space.lg, gap: space.md },
  mosHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  mosLabel: { ...type.label, fontSize: 10, color: colors.gold },
  mosRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  mosRing: { padding: 3, borderRadius: 40, borderWidth: 2, borderColor: colors.gold },
  mosName: { fontFamily: font.posterBlack, fontSize: 25, lineHeight: 28, color: hero.text },
  mosLine: { fontFamily: font.semibold, fontSize: 13, color: hero.muted, marginTop: 2 },
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
  leaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32 },
  leaderRank: { fontFamily: font.posterBlack, fontSize: 18, color: colors.faint, width: 14 },
  leaderName: { flex: 1, color: colors.text, fontSize: 13, fontFamily: font.bold },
  leaderValue: { fontFamily: font.posterBlack, fontSize: 16, color: colors.text, ...type.num },
  leaderUnit: { fontFamily: font.poster, fontSize: 13, color: colors.faint },
  match: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.md },
  matchEmpty: { backgroundColor: 'transparent', borderStyle: 'dashed' },
  matchNo: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.surfaceHi, alignItems: 'center', justifyContent: 'center' },
  matchNoText: { fontFamily: font.posterBlack, fontSize: 20, color: colors.text },
  matchTbd: { color: colors.faint, fontSize: 14, fontFamily: font.bold },
});
