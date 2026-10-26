import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ExportSheet } from '../../components/ExportSheet.tsx';
import { Button, FadeIn, GhostWord, PitchStripes, PressableScale, Screen, SectionLabel, useToast } from '../../components/ui.tsx';
import { sampleSeason } from '../../demo/sampleSeason.ts';
import { matchState, oversText } from '../../engine/engine.ts';
import { allSeries, careerStats, playerOfTheMatch, type SeriesState } from '../../engine/stats.ts';
import { SeriesPips } from '../series/[id].tsx';
import type { Match } from '../../engine/types.ts';
import { useMatches } from '../../store/matches.tsx';
import { useMatchFiles } from '../../store/useMatchFiles.ts';
import { usePrefs } from '../../store/prefs.ts';
import { colors, font, radius, space, type, hero, edge, isDay } from '../../theme.ts';

function confirmDelete(onYes: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm('Delete this match? This can’t be undone.')) onYes();
    return;
  }
  Alert.alert('Delete match?', 'This can’t be undone.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: onYes },
  ]);
}

const openMatch = (m: Match, live: boolean) =>
  router.push(live ? { pathname: '/match/[id]', params: { id: m.id } } : { pathname: '/match/[id]/scorecard', params: { id: m.id } });

/** The match on right now takes over the top of the screen, like a broadcast's live scorebug. */
function LiveHero({ match }: { match: Match }) {
  const state = matchState(match);
  const s = state.innings[state.current];
  const batted = match.innings[state.current].events.length > 0;
  const need = s.target !== null ? Math.max(s.target - s.runs, 0) : null;
  return (
    <PressableScale scaleTo={0.98} onPress={() => openMatch(match, true)} style={styles.liveHero}>
      <PitchStripes opacity={0.06} />
      <GhostWord size={170} style={{ right: -24, bottom: -40, color: 'rgba(0,0,0,0.07)' }}>
        LIVE
      </GhostWord>
      <View style={styles.liveTop}>
        <View style={styles.liveTag}>
          <View style={styles.liveDot} />
          <Text style={styles.liveTagText}>LIVE NOW</Text>
        </View>
        <Text style={styles.liveOvers}>
          {oversText(s.legalBalls)} / {match.rules.overs} OV
        </Text>
      </View>
      <Text style={styles.liveTeam} numberOfLines={1}>
        {s.battingTeam.name}
      </Text>
      <Text style={styles.liveScore}>{batted ? `${s.runs}/${s.wickets}` : 'NEW'}</Text>
      <View style={styles.liveFoot}>
        <Text style={styles.liveFootText} numberOfLines={1}>
          {need !== null && batted ? `Need ${need} off ${s.maxBalls - s.legalBalls}` : `vs ${s.bowlingTeam.name}`}
        </Text>
        <View style={styles.liveGo}>
          <Text style={styles.liveGoText}>SCORE</Text>
          <Ionicons name="arrow-forward" size={16} color={colors.accentInk} />
        </View>
      </View>
    </PressableScale>
  );
}

function PosterHero() {
  return (
    <View style={styles.poster}>
      <PitchStripes tint="255,255,255" />
      <GhostWord size={190} style={{ left: -12, bottom: -50, color: hero.ink(0.05) }}>
        CRICKET
      </GhostWord>
      <Text style={styles.posterEyebrow}>MATCHDAY</Text>
      <Text style={styles.posterTitle}>
        GAME{'\n'}
        <Text style={{ color: hero.accent }}>ON.</Text>
      </Text>
      <Text style={styles.posterBody}>Score every ball. Every player’s numbers add up, match after match.</Text>
      <Button label={'Start a match'} icon="play" onPress={() => router.push('/new')} style={{ marginTop: space.xl }} />
    </View>
  );
}

function Season({ matches }: { matches: Match[] }) {
  const { runs, wickets, top } = useMemo(() => {
    let r = 0;
    let w = 0;
    for (const m of matches)
      for (const inn of matchState(m).innings) {
        r += inn.runs;
        w += inn.wickets;
      }
    const best = [...careerStats(matches)].sort((a, b) => b.batting.runs - a.batting.runs)[0];
    return { runs: r, wickets: w, top: best && best.batting.runs > 0 ? best : null };
  }, [matches]);

  return (
    <View style={styles.season}>
      {(
        [
          ['MATCHES', matches.length],
          ['RUNS', runs],
          ['WICKETS', wickets],
        ] as const
      ).map(([label, value], i) => (
        <View key={label} style={[styles.seasonCell, i > 0 && styles.seasonBorder]}>
          <Text style={styles.seasonValue}>{value}</Text>
          <Text style={styles.seasonLabel}>{label}</Text>
        </View>
      ))}
      {top && (
        <View style={{ flexBasis: '100%' }}>
          <PressableScale
            scaleTo={0.98}
            onPress={() => router.push({ pathname: '/player/[key]', params: { key: top.key } })}
            style={styles.topScorer}
          >
            <MaterialCommunityIcons name="crown" size={18} color={colors.gold} />
            <Text style={styles.topScorerText} numberOfLines={1}>
              Top scorer <Text style={{ color: colors.text }}>{top.name}</Text> · {top.batting.runs} runs
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.faint} />
          </PressableScale>
        </View>
      )}
    </View>
  );
}

function SeriesCard({ s }: { s: SeriesState }) {
  return (
    <PressableScale scaleTo={0.98} onPress={() => router.push({ pathname: '/series/[id]', params: { id: s.id } })} style={styles.series}>
      <View style={{ flex: 1, gap: 6 }}>
        <Text style={styles.seriesEyebrow}>{s.over ? 'SERIES · FINAL' : `SERIES · BEST OF ${s.of}`}</Text>
        <Text style={styles.seriesName} numberOfLines={1}>
          {s.name}
        </Text>
        <SeriesPips series={s} size={12} />
        <Text style={styles.seriesStatus} numberOfLines={1}>
          {s.status}
          {s.best ? `  ·  ★ ${s.best.name}` : ''}
        </Text>
      </View>
      <Text style={styles.seriesScore}>
        {s.wins[0]}
        <Text style={{ color: colors.faint }}>–</Text>
        {s.wins[1]}
      </Text>
    </PressableScale>
  );
}

function ResultRow({ match, onDelete }: { match: Match; onDelete: () => void }) {
  const state = matchState(match);
  const mom = state.result ? playerOfTheMatch(match) : null;
  const d = new Date(match.createdAt);
  return (
    <PressableScale
      scaleTo={0.98}
      onPress={() => openMatch(match, false)}
      onLongPress={() => confirmDelete(onDelete)}
      style={styles.result}
    >
      <View style={styles.date}>
        <Text style={styles.dateDay}>{d.getDate()}</Text>
        <Text style={styles.dateMonth}>{d.toLocaleDateString(undefined, { month: 'short' }).toUpperCase()}</Text>
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        {/* The match itself; a super over shows in the result line. */}
        {state.innings.slice(0, 2).map((inn, i) => {
          const won = state.winner === inn.battingTeam.id;
          return (
            <View key={i} style={styles.resultLine}>
              <View style={[styles.winBar, won && { backgroundColor: colors.accent }]} />
              <Text numberOfLines={1} style={[styles.resultTeam, won && { color: colors.text }]}>
                {inn.battingTeam.name}
              </Text>
              <Text style={[styles.resultScore, won && { color: colors.text }]}>
                {inn.runs}/{inn.wickets}
                <Text style={styles.resultOvers}> {oversText(inn.legalBalls)}</Text>
              </Text>
            </View>
          );
        })}
        <Text numberOfLines={1} style={styles.resultText}>
          {state.result}
        </Text>
        {mom && (
          <View style={styles.resultMom}>
            <Ionicons name="star" size={11} color={colors.gold} />
            <Text numberOfLines={1} style={styles.resultMomText}>
              <Text style={styles.resultMomName}>{mom.name}</Text> · Man of the Match
            </Text>
          </View>
        )}
      </View>
    </PressableScale>
  );
}

export default function Home() {
  const { matches, deleteMatch, ready, importMatches } = useMatches();
  const toast = useToast();
  const { importFile, exportMatches, exportPdf } = useMatchFiles(toast.show);
  const { prefs, setPrefs } = usePrefs();
  // Remind once a week that a lost phone shouldn't mean lost matches.
  const backupDue = matches.length >= 2 && (!prefs.lastBackup || Date.now() - prefs.lastBackup > 7 * 86_400_000);
  const [exporting, setExporting] = useState<Match[] | null>(null);
  const live = matches.filter((m) => !matchState(m).result);
  const done = matches.filter((m) => matchState(m).result);
  const series = useMemo(() => allSeries(matches), [matches]);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.brandRow}>
          <View style={styles.logo}>
            <MaterialCommunityIcons name="cricket" size={20} color={colors.onAccent} />
          </View>
          <Text style={styles.brand}>CREASE</Text>
          <View style={{ flex: 1 }} />
          <PressableScale accessibilityLabel="Settings" onPress={() => router.push('/settings')} style={styles.gear}>
            <Ionicons name="settings-outline" size={18} color={colors.text} />
          </PressableScale>
          <PressableScale accessibilityLabel="Auction: pick the teams" onPress={() => router.push('/auction/new')} style={styles.auctionPill}>
            <Ionicons name="hammer" size={15} color={colors.accentInk} />
            <Text numberOfLines={1} style={styles.auctionText}>
              Auction
            </Text>
          </PressableScale>
        </View>

        <FadeIn>{live[0] ? <LiveHero match={live[0]} /> : <PosterHero />}</FadeIn>
        {live.slice(1).map((m, i) => (
          <FadeIn key={m.id} delay={80 + i * 40}>
            <LiveHero match={m} />
          </FadeIn>
        ))}

        {backupDue && (
          <FadeIn delay={60}>
            <View style={styles.backup}>
              <Ionicons name="cloud-upload-outline" size={20} color={colors.gold} />
              <View style={{ flex: 1 }}>
                <Text style={styles.backupTitle}>Back up your matches</Text>
                <Text style={styles.backupBody}>
                  {prefs.lastBackup ? 'It’s been over a week.' : 'Not backed up yet.'} Save one file to Drive or WhatsApp.
                </Text>
              </View>
              <PressableScale
                onPress={async () => {
                  await exportMatches(matches);
                  setPrefs({ lastBackup: Date.now() });
                }}
                style={styles.backupButton}
              >
                <Text style={styles.backupButtonText}>Back up now</Text>
              </PressableScale>
            </View>
          </FadeIn>
        )}

        {series.length > 0 && (
          <FadeIn delay={90}>
            <SectionLabel>Series</SectionLabel>
            <View style={{ gap: space.sm }}>
              {series.map((s) => (
                <SeriesCard key={s.id} s={s} />
              ))}
            </View>
          </FadeIn>
        )}

        {ready && matches.length > 0 && (
          <FadeIn delay={120}>
            <SectionLabel>This season</SectionLabel>
            <Season matches={matches} />
          </FadeIn>
        )}

        <FadeIn delay={180}>
          <SectionLabel>Match files</SectionLabel>
          <View style={styles.files}>
            <View style={{ flex: 1 }}>
              <PressableScale onPress={importFile} style={styles.fileButton}>
                <Ionicons name="push-outline" size={20} color={colors.accentInk} />
                <Text style={styles.fileTitle}>IMPORT</Text>
                <Text style={styles.fileBody}>A match someone sent you</Text>
              </PressableScale>
            </View>
            <View style={{ flex: 1 }}>
              <PressableScale disabled={!matches.length} onPress={() => setExporting(matches)} style={styles.fileButton}>
                <Ionicons name="download-outline" size={20} color={colors.accentInk} />
                <Text style={styles.fileTitle}>EXPORT</Text>
                <Text style={styles.fileBody}>PDF or match file, any matches</Text>
              </PressableScale>
            </View>
          </View>
        </FadeIn>

        {__DEV__ && (
          // Development builds only: a season of Copan A vs Copan B to try every screen with real-looking numbers.
          <PressableScale
            onPress={() => {
              const demo = sampleSeason();
              const { added } = importMatches(demo.matches, demo.teams);
              toast.show(added ? `Loaded ${added} sample matches` : 'Sample season already loaded', 'info');
            }}
            style={styles.devButton}
          >
            <Ionicons name="flask-outline" size={16} color={colors.faint} />
            <Text style={styles.devText}>Load sample season (development only)</Text>
          </PressableScale>
        )}

        {done.length > 0 && (
          <FadeIn delay={240}>
            <SectionLabel right={<Text style={styles.hint}>Hold to delete</Text>}>Results</SectionLabel>
            <View style={{ gap: space.sm }}>
              {done.map((m) => (
                <ResultRow key={m.id} match={m} onDelete={() => deleteMatch(m.id)} />
              ))}
            </View>
          </FadeIn>
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
  content: { padding: space.lg, paddingBottom: 130 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.lg },
  logo: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ skewX: '-8deg' }],
  },
  brand: { fontFamily: font.posterBlack, fontSize: 28, color: colors.text, letterSpacing: 0.5 },
  auctionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: 150,
    height: 36,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderHi,
    ...edge,
  },
  gear: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderHi,
    ...edge,
  },
  backup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: isDay ? colors.surface : colors.goldDim,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: isDay ? colors.border : colors.gold,
    padding: space.md,
    marginTop: space.md,
    ...edge,
  },
  backupTitle: { color: colors.text, fontSize: 14, fontFamily: font.bold },
  backupBody: { color: colors.muted, fontSize: 12, fontFamily: font.regular, marginTop: 1 },
  backupButton: { backgroundColor: isDay ? colors.text : colors.gold, borderRadius: isDay ? radius.pill : radius.sm, paddingHorizontal: space.md, height: 34, justifyContent: 'center' },
  backupButtonText: { color: isDay ? colors.surface : colors.onAccent, fontSize: 13, fontFamily: font.heavy },
  auctionText: { color: colors.text, fontSize: 13, fontFamily: font.bold, flexShrink: 1 },

  poster: {
    borderRadius: radius.xl,
    padding: space.xl,
    paddingTop: space.xxl,
    overflow: 'hidden',
    backgroundColor: '#101010',
    borderWidth: 1,
    borderColor: hero.line,
  },
  posterEyebrow: { ...type.label, color: hero.accent },
  posterTitle: { fontFamily: font.posterBlack, fontSize: 116, lineHeight: 100, color: hero.text, letterSpacing: -3, marginTop: space.sm },
  posterBody: { color: hero.muted, fontSize: 15, fontFamily: font.medium, lineHeight: 21, marginTop: space.md, maxWidth: 270 },

  liveHero: {
    borderRadius: radius.xl,
    padding: space.xl,
    overflow: 'hidden',
    backgroundColor: colors.accent,
    marginBottom: space.sm,
  },
  liveTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  liveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.onAccent,
    paddingHorizontal: 10,
    height: 24,
    borderRadius: radius.sm,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.danger },
  liveTagText: { ...type.label, fontSize: 11, color: colors.accentInk },
  liveOvers: { fontFamily: font.poster, fontSize: 18, color: colors.onAccent, ...type.num },
  liveTeam: { fontFamily: font.poster, fontSize: 26, color: colors.onAccent, textTransform: 'uppercase', marginTop: space.lg },
  liveScore: { fontFamily: font.posterBlack, fontSize: 104, lineHeight: 104, color: colors.onAccent, letterSpacing: -3, ...type.num },
  liveFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.sm },
  liveFootText: { color: colors.onAccent, fontFamily: font.bold, fontSize: 14, flex: 1, opacity: 0.75 },
  liveGo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.onAccent,
    paddingHorizontal: space.md,
    height: 36,
    borderRadius: radius.md,
  },
  liveGoText: { fontFamily: font.poster, fontSize: 18, color: colors.accentInk },

  season: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...edge,
  },
  seasonCell: { flex: 1, paddingVertical: space.lg, alignItems: 'center' },
  seasonBorder: { borderLeftWidth: 1, borderLeftColor: colors.border },
  seasonValue: { fontFamily: font.posterBlack, fontSize: 44, lineHeight: 46, color: colors.text, ...type.num },
  seasonLabel: { ...type.label, fontSize: 10, color: colors.faint },
  topScorer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  topScorerText: { flex: 1, color: colors.muted, fontSize: 13, fontFamily: font.semibold },

  files: { flexDirection: 'row', gap: space.sm },
  series: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.accent,
    padding: space.lg,
    ...edge,
  },
  seriesEyebrow: { ...type.label, fontSize: 10, color: colors.accentInk },
  seriesName: { fontFamily: font.posterBlack, fontSize: 28, lineHeight: 30, color: colors.text, textTransform: 'uppercase' },
  seriesStatus: { color: colors.muted, fontSize: 13, fontFamily: font.bold },
  seriesScore: { fontFamily: font.posterBlack, fontSize: 54, lineHeight: 56, color: colors.text, ...type.num },
  fileButton: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
    gap: 4,
    ...edge,
  },
  fileTitle: { fontFamily: font.poster, fontSize: 22, color: colors.text, marginTop: space.sm },
  fileBody: { color: colors.faint, fontSize: 12, fontFamily: font.medium },

  hint: { color: colors.faint, fontSize: 12, fontFamily: font.regular },
  devButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    marginTop: space.md,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderHi,
  },
  devText: { color: colors.faint, fontSize: 12, fontFamily: font.semibold },
  result: {
    flexDirection: 'row',
    gap: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.md,
    alignItems: 'center',
    ...edge,
  },
  date: {
    width: 54,
    alignSelf: 'stretch',
    borderRadius: radius.md,
    backgroundColor: colors.surfaceHi,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space.sm,
  },
  dateDay: { fontFamily: font.posterBlack, fontSize: 30, lineHeight: 30, color: colors.text },
  dateMonth: { ...type.label, fontSize: 10, color: colors.accentInk },
  resultLine: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  winBar: { width: 3, height: 16, borderRadius: 2, backgroundColor: 'transparent' },
  resultTeam: { flex: 1, color: colors.muted, fontSize: 15, fontFamily: font.bold },
  resultScore: { color: colors.muted, fontSize: 22, fontFamily: font.posterBlack, ...type.num },
  resultOvers: { fontSize: 14, fontFamily: font.poster, color: colors.faint },
  resultText: { color: colors.accentInk, fontSize: 12, fontFamily: font.bold, marginTop: 2, marginLeft: 11 },
  resultMom: { flexDirection: 'row', alignItems: 'center', gap: 5, marginLeft: 11 },
  resultMomText: { flex: 1, color: colors.muted, fontSize: 12, fontFamily: font.medium },
  resultMomName: { color: colors.text, fontFamily: font.bold },
});
