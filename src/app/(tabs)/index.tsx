import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CountUp, Pulse, Rise, Sheen, Ticker } from '../../components/motion.tsx';
import { ShareCardSheet } from '../../components/ShareCard.tsx';
import { Button, FadeIn, IconButton, PitchStripes, PressableScale, Screen, SectionLabel, Sheet, useToast } from '../../components/ui.tsx';
import { sampleSeason } from '../../demo/sampleSeason.ts';
import { matchState, oversText } from '../../engine/engine.ts';
import { allSeries, careerStats, playerOfTheMatch, type SeriesState } from '../../engine/stats.ts';
import { SeriesPips } from '../series/[id].tsx';
import type { Match } from '../../engine/types.ts';
import { useMatches } from '../../store/matches.tsx';
import { useMatchFiles } from '../../store/useMatchFiles.ts';
import { usePrefs } from '../../store/prefs.ts';
import { colors, font, gradients, radius, space, type, hero, edge } from '../../theme.ts';
import { AppMark } from '../../components/AppMark.tsx';

const openMatch = (m: Match, live: boolean) =>
  router.push(live ? { pathname: '/match/[id]', params: { id: m.id } } : { pathname: '/match/[id]/scorecard', params: { id: m.id } });

/** The match on right now leads the screen: a scoreboard on the pitch green, one tap from the scoring pad. */
function LiveHero({ match }: { match: Match }) {
  const state = matchState(match);
  const s = state.innings[state.current];
  const batted = match.innings[state.current].events.length > 0;
  const need = s.target !== null ? Math.max(s.target - s.runs, 0) : null;
  const rr = s.legalBalls ? ((s.runs * 6) / s.legalBalls).toFixed(2) : '0.00';
  return (
    <PressableScale scaleTo={0.98} onPress={() => openMatch(match, true)} accessibilityLabel={`Live: ${s.battingTeam.name} ${s.runs} for ${s.wickets}. Open scoring`}>
      <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.liveHero}>
        <PitchStripes opacity={0.035} tint="255,255,255" />
        <Sheen />
        <View style={styles.liveTop}>
          <View style={styles.liveTag}>
            <Pulse color={colors.danger} size={7} />
            <Text style={styles.liveTagText}>Live</Text>
          </View>
          <Text style={styles.liveVs} numberOfLines={1}>
            vs {s.bowlingTeam.name}
          </Text>
        </View>
        <Text style={styles.liveTeam} numberOfLines={1}>
          {s.battingTeam.name}
        </Text>
        <View style={styles.liveScoreRow}>
          <Ticker value={batted ? s.runs : 0} style={styles.liveScore} lineHeight={101} />
          <Text style={styles.liveWkts}>/{batted ? s.wickets : 0}</Text>
          <View style={{ flex: 1 }} />
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.liveMetaValue}>
              {oversText(s.legalBalls)}
              <Text style={styles.liveMetaOf}> / {match.rules.overs}</Text>
            </Text>
            <Text style={styles.liveMetaLabel}>Overs</Text>
          </View>
        </View>
        <View style={styles.liveFoot}>
          <Text style={styles.liveFootText} numberOfLines={1}>
            {need !== null && batted ? `Need ${need} off ${s.maxBalls - s.legalBalls}` : batted ? `Run rate ${rr}` : 'Ready to start'}
          </Text>
          <View style={styles.liveGo}>
            <Text style={styles.liveGoText}>Score</Text>
            <Ionicons name="arrow-forward" size={16} color={colors.onAccent} />
          </View>
        </View>
      </LinearGradient>
    </PressableScale>
  );
}

function PosterHero() {
  return (
    <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.poster}>
      <PitchStripes opacity={0.035} tint="255,255,255" />
      <Sheen every={6500} />
      <AppMark size={52} />
      <Text style={styles.posterTitle}>Ready for{'\n'}the toss?</Text>
      <Text style={styles.posterBody}>Score every ball. Every player’s numbers add up, match after match.</Text>
      <Button label="Start a match" icon="play" onPress={() => router.push('/new')} style={{ marginTop: space.xl }} />
    </LinearGradient>
  );
}

function Season({ matches }: { matches: Match[] }) {
  const { runs, wickets, sixes, top } = useMemo(() => {
    let r = 0;
    let w = 0;
    for (const m of matches)
      for (const inn of matchState(m).innings) {
        r += inn.runs;
        w += inn.wickets;
      }
    const careers = careerStats(matches);
    const best = [...careers].sort((a, b) => b.batting.runs - a.batting.runs)[0];
    return { runs: r, wickets: w, sixes: careers.reduce((n, c) => n + c.batting.sixes, 0), top: best && best.batting.runs > 0 ? best : null };
  }, [matches]);

  return (
    <View style={{ gap: space.sm }}>
      <View style={styles.bento}>
        <View style={[styles.tile, styles.tileBig]}>
          <Text style={styles.tileLabel}>Runs scored</Text>
          <CountUp value={runs} style={styles.tileBigValue} />
          <Text style={styles.tileSub}>
            in {matches.length} match{matches.length === 1 ? '' : 'es'}
          </Text>
        </View>
        <View style={{ flex: 1, gap: space.sm }}>
          <View style={styles.tile}>
            <CountUp value={wickets} style={styles.tileValue} delay={120} />
            <Text style={styles.tileLabel}>Wickets</Text>
          </View>
          <View style={styles.tile}>
            <CountUp value={sixes} style={styles.tileValue} delay={200} />
            <Text style={styles.tileLabel}>Sixes</Text>
          </View>
        </View>
      </View>
      {top && (
        <PressableScale scaleTo={0.98} onPress={() => router.push({ pathname: '/player/[key]', params: { key: top.key } })} style={styles.topScorer}>
          <View style={styles.topIcon}>
            <MaterialCommunityIcons name="crown" size={18} color={colors.gold} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.tileLabel}>Top scorer</Text>
            <Text style={styles.topName} numberOfLines={1}>
              {top.name}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
            <CountUp value={top.batting.runs} style={styles.topRuns} delay={260} />
            <Text style={styles.topUnit}> runs</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.faint} />
        </PressableScale>
      )}
    </View>
  );
}

function SeriesCard({ s }: { s: SeriesState }) {
  return (
    <PressableScale scaleTo={0.98} onPress={() => router.push({ pathname: '/series/[id]', params: { id: s.id } })} style={styles.series}>
      <View style={{ flex: 1, gap: 6 }}>
        <Text style={styles.seriesEyebrow}>{s.over ? 'Series · final' : `Series · best of ${s.of}`}</Text>
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

/** What can be done with a finished match: play it again, share the result, or delete it. */
function ResultMenu({ match, onClose, onShare, onDelete }: { match: Match | null; onClose: () => void; onShare: () => void; onDelete: () => void }) {
  const [deleting, setDeleting] = useState(false);
  const close = () => {
    setDeleting(false);
    onClose();
  };
  return (
    <Sheet visible={match !== null} onClose={close} title={match ? `${match.teams[0].name} vs ${match.teams[1].name}` : ''}>
      <View style={{ gap: space.sm }}>
        <Button
          variant="ghost"
          icon="refresh"
          label="Rematch"
          onPress={() => {
            close();
            if (match) router.push({ pathname: '/new', params: { rematch: match.id } });
          }}
        />
        <Button variant="ghost" icon="image-outline" label="Share result picture" onPress={onShare} />
        <Button
          variant="danger"
          icon="trash-outline"
          label={deleting ? 'Tap again to delete it' : 'Delete this match'}
          onPress={() => {
            if (!deleting) return setDeleting(true);
            setDeleting(false);
            onDelete();
          }}
        />
      </View>
    </Sheet>
  );
}

function ResultRow({ match, onMore }: { match: Match; onMore: () => void }) {
  const state = matchState(match);
  const mom = state.result ? playerOfTheMatch(match) : null;
  const d = new Date(match.createdAt);
  // The ⋯ sits beside the row rather than inside it: a button can't hold another button.
  return (
    <View style={styles.resultWrap}>
      <PressableScale scaleTo={0.98} onPress={() => openMatch(match, false)} onLongPress={onMore} style={styles.result}>
        <View style={styles.date}>
          <Text style={styles.dateDay}>{d.getDate()}</Text>
          <Text style={styles.dateMonth}>{d.toLocaleDateString(undefined, { month: 'short' })}</Text>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          {/* The match itself; a super over shows in the result line. */}
          {state.innings.slice(0, 2).map((inn, i) => {
            const won = state.winner === inn.battingTeam.id;
            return (
              <View key={i} style={styles.resultLine}>
                <View style={[styles.winBar, won && { backgroundColor: colors.accentInk }]} />
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
      <View style={styles.more}>
        <IconButton icon="ellipsis-horizontal" label="More for this match" onPress={onMore} />
      </View>
    </View>
  );
}

export default function Home() {
  const { matches, deleteMatch, ready, importMatches } = useMatches();
  const toast = useToast();
  const { exportMatches } = useMatchFiles(toast.show);
  const { prefs, setPrefs } = usePrefs();
  // Remind once a week that a lost phone shouldn't mean lost matches.
  const backupDue = matches.length >= 2 && (!prefs.lastBackup || Date.now() - prefs.lastBackup > 7 * 86_400_000);
  const [more, setMore] = useState<Match | null>(null);
  const [sharing, setSharing] = useState<Match | null>(null);
  const live = matches.filter((m) => !matchState(m).result);
  const done = matches.filter((m) => matchState(m).result);
  const series = useMemo(() => allSeries(matches), [matches]);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.brandRow}>
          <AppMark size={34} />
          <Text style={styles.brand}>crease</Text>
          <View style={{ flex: 1 }} />
          <PressableScale accessibilityLabel="Settings" onPress={() => router.push('/settings')} style={styles.gear}>
            <Ionicons name="settings-outline" size={18} color={colors.text} />
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
              {series.map((s, i) => (
                <Rise key={s.id} index={i}>
                  <SeriesCard s={s} />
                </Rise>
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
            <SectionLabel>Results</SectionLabel>
            <View style={{ gap: space.sm }}>
              {done.map((m, i) => (
                <Rise key={m.id} index={i}>
                  <ResultRow match={m} onMore={() => setMore(m)} />
                </Rise>
              ))}
            </View>
          </FadeIn>
        )}
      </ScrollView>
      <ResultMenu
        match={more}
        onClose={() => setMore(null)}
        onShare={() => {
          setSharing(more);
          setMore(null);
        }}
        onDelete={() => {
          if (more) deleteMatch(more.id);
          setMore(null);
          toast.show('Match deleted', 'info');
        }}
      />
      {sharing && <ShareCardSheet match={sharing} all={matches} visible onClose={() => setSharing(null)} notify={toast.show} />}
      {toast.element}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: 130 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.xl },
  brand: { fontFamily: font.posterBlack, fontSize: 22, color: colors.text, letterSpacing: -0.6 },
  gear: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...edge,
  },
  backup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.md,
    paddingLeft: space.lg,
    marginTop: space.md,
    ...edge,
  },
  backupTitle: { color: colors.text, fontSize: 14, fontFamily: font.bold },
  backupBody: { color: colors.muted, fontSize: 12, fontFamily: font.regular, marginTop: 2, lineHeight: 17 },
  backupButton: { backgroundColor: colors.text, borderRadius: radius.pill, paddingHorizontal: space.md, height: 36, justifyContent: 'center' },
  backupButtonText: { color: colors.bg, fontSize: 13, fontFamily: font.bold },

  poster: { borderRadius: radius.xl, padding: space.xl, overflow: 'hidden' },
  posterTitle: { fontFamily: font.posterBlack, fontSize: 46, lineHeight: 51, color: hero.text, letterSpacing: -1.6, marginTop: space.xl },
  posterBody: { color: hero.muted, fontSize: 15, fontFamily: font.medium, lineHeight: 22, marginTop: space.md, maxWidth: 290 },

  liveHero: { borderRadius: radius.xl, padding: space.xl, overflow: 'hidden', marginBottom: space.sm },
  liveTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.md },
  liveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,90,60,0.16)',
    paddingHorizontal: 10,
    height: 26,
    borderRadius: radius.pill,
  },
  liveTagText: { fontSize: 12, fontFamily: font.bold, color: '#FF8A73' },
  liveVs: { color: hero.muted, fontSize: 13, fontFamily: font.medium, flexShrink: 1 },
  liveTeam: { fontFamily: font.poster, fontSize: 22, color: hero.text, marginTop: space.lg, letterSpacing: -0.4 },
  liveScoreRow: { flexDirection: 'row', alignItems: 'flex-end' },
  liveScore: { fontFamily: font.posterBlack, fontSize: 92, lineHeight: 101, color: hero.text, letterSpacing: -4, ...type.num },
  liveWkts: { fontFamily: font.poster, fontSize: 40, lineHeight: 70, color: hero.faint, letterSpacing: -1 },
  liveMetaValue: { fontFamily: font.posterBlack, fontSize: 26, color: hero.text, ...type.num },
  liveMetaOf: { fontFamily: font.poster, fontSize: 16, color: hero.faint },
  liveMetaLabel: { ...type.label, fontSize: 10, color: hero.muted, marginBottom: 14 },
  liveFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.md,
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: hero.ink(0.08),
  },
  liveFootText: { color: hero.muted, fontFamily: font.semibold, fontSize: 14, flex: 1 },
  liveGo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: hero.accent,
    paddingHorizontal: space.lg,
    height: 40,
    borderRadius: radius.pill,
  },
  liveGoText: { fontFamily: font.bold, fontSize: 15, color: colors.onAccent },

  bento: { flexDirection: 'row', gap: space.sm },
  tile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
    justifyContent: 'space-between',
    ...edge,
  },
  tileBig: { flex: 1.3, backgroundColor: colors.accent, borderColor: colors.accent },
  tileLabel: { ...type.label, fontSize: 10, color: colors.muted },
  tileBigValue: { fontFamily: font.posterBlack, fontSize: 64, lineHeight: 70, color: colors.onAccent, letterSpacing: -3, marginTop: space.xl, ...type.num },
  tileSub: { color: 'rgba(10,13,6,0.6)', fontSize: 13, fontFamily: font.semibold },
  tileValue: { fontFamily: font.posterBlack, fontSize: 32, lineHeight: 36, color: colors.text, letterSpacing: -1, ...type.num },
  topScorer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.md,
    paddingRight: space.lg,
    ...edge,
  },
  topIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.goldDim, alignItems: 'center', justifyContent: 'center' },
  topName: { color: colors.text, fontSize: 16, fontFamily: font.bold, marginTop: 2 },
  topRuns: { fontFamily: font.posterBlack, fontSize: 24, color: colors.text, ...type.num },
  topUnit: { fontFamily: font.medium, fontSize: 13, color: colors.muted },

  series: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
    ...edge,
  },
  seriesEyebrow: { ...type.label, fontSize: 10, color: colors.accentInk },
  seriesName: { fontFamily: font.posterBlack, fontSize: 24, lineHeight: 28, color: colors.text, letterSpacing: -0.6 },
  seriesStatus: { color: colors.muted, fontSize: 13, fontFamily: font.medium },
  seriesScore: { fontFamily: font.posterBlack, fontSize: 44, lineHeight: 48, color: colors.text, letterSpacing: -1.5, ...type.num },

  devButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    marginTop: space.md,
    height: 42,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderHi,
  },
  devText: { color: colors.faint, fontSize: 12, fontFamily: font.semibold },
  resultWrap: { justifyContent: 'center' },
  more: { position: 'absolute', right: space.sm },
  result: {
    paddingRight: 56,
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
    width: 52,
    alignSelf: 'stretch',
    borderRadius: radius.md,
    backgroundColor: colors.surfaceHi,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space.sm,
  },
  dateDay: { fontFamily: font.posterBlack, fontSize: 24, lineHeight: 26, color: colors.text, ...type.num },
  dateMonth: { fontSize: 11, fontFamily: font.semibold, color: colors.muted },
  resultLine: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  winBar: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'transparent' },
  resultTeam: { flex: 1, color: colors.muted, fontSize: 15, fontFamily: font.semibold },
  resultScore: { color: colors.muted, fontSize: 20, fontFamily: font.posterBlack, letterSpacing: -0.4, ...type.num },
  resultOvers: { fontSize: 13, fontFamily: font.medium, color: colors.faint },
  resultText: { color: colors.accentInk, fontSize: 12, fontFamily: font.semibold, marginTop: 4, marginLeft: 14 },
  resultMom: { flexDirection: 'row', alignItems: 'center', gap: 5, marginLeft: 14 },
  resultMomText: { flex: 1, color: colors.muted, fontSize: 12, fontFamily: font.medium },
  resultMomName: { color: colors.text, fontFamily: font.semibold },
});
