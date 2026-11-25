import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Columns, Page, useLayout, widePad } from '../../components/layout.tsx';
import { LinearGradient } from 'expo-linear-gradient';
import { OvalGround, SeamDivider } from '../../components/cricket.tsx';
import { CountUp, GrowBar, Pulse, Rise, Sheen, Ticker } from '../../components/motion.tsx';
import { ShareCardSheet } from '../../components/ShareCard.tsx';
import { Button, Chip, FadeIn, IconButton, PitchStripes, PressableScale, Screen, SectionLabel, Sheet, useToast, WideHead } from '../../components/ui.tsx';
import { sampleSeason } from '../../demo/sampleSeason.ts';
import { matchState, oversText } from '../../engine/engine.ts';
import { allSeries, careerStats, type SeriesState } from '../../engine/stats.ts';
import { SeriesPips } from '../series/[id].tsx';
import type { Match } from '../../engine/types.ts';
import { useMatches } from '../../store/matches.tsx';
import { useMatchFiles } from '../../store/useMatchFiles.ts';
import { useAccess, useClubSync, usePhotos } from '../../store/sync.tsx';
import { Avatar, PlayerAvatar } from '../../components/Avatar.tsx';
import { usePrefs } from '../../store/prefs.ts';
import { useSquad } from '../../store/squad.ts';
import { playerForEmail } from '../../engine/squad.ts';
import { photoFor } from '../../engine/photos.ts';
import { colors, font, gradients, radius, space, type, hero, edge } from '../../theme.ts';
import { AppMark } from '../../components/AppMark.tsx';
import { crestOf, TeamCrest } from '../../components/TeamCrest.tsx';
import { MatchTicket, QuickTile, TrophyRace } from '../../components/HomeX.tsx';

const openMatch = (m: Match, live: boolean) =>
  router.push(live ? { pathname: '/match/[id]', params: { id: m.id } } : { pathname: '/match/[id]/scorecard', params: { id: m.id } });

/** An unfinished match nobody has touched for this long was left, not paused: it's no longer shown as live. */
const STALE_AFTER = 12 * 3_600_000;
const isStale = (m: Match, now: number) => now - (m.updatedAt ?? m.createdAt) > STALE_AFTER;

/** The match on right now leads the screen: a scoreboard on the outfield, one tap from the scoring pad. */
function LiveHero({ match }: { match: Match }) {
  const access = useAccess();
  // Viewers follow along; only editors score.
  const go = access.score ? (matchState(match).result ? 'Confirm the result' : 'Score ball by ball') : 'Watch live';
  const state = matchState(match);
  const s = state.innings[state.current];
  const batted = match.innings[state.current].events.length > 0;
  const need = s.target !== null ? Math.max(s.target - s.runs, 0) : null;
  const left = s.maxBalls - s.legalBalls;
  const rr = s.legalBalls ? (s.runs * 6) / s.legalBalls : 0;
  const rrr = need !== null && left > 0 ? (need * 6) / left : null;
  const line = state.result
    ? `${state.result} · to confirm`
    : need !== null && batted
      ? `Need ${need} off ${left} ball${left === 1 ? '' : 's'}${rrr !== null ? ` · ${rrr.toFixed(1)} an over, scoring ${rr.toFixed(1)}` : ''}`
      : batted
        ? `Run rate ${rr.toFixed(2)} an over`
        : 'Ready to start';
  return (
    <PressableScale scaleTo={0.985} onPress={() => openMatch(match, true)} accessibilityLabel={`Live: ${s.battingTeam.name} ${s.runs} for ${s.wickets}. ${access.score ? 'Open scoring' : 'Watch'}`}>
      <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.liveHero}>
        <PitchStripes opacity={0.035} tint="255,255,255" />
        <OvalGround opacity={0.1} />
        <Sheen />
        <View style={styles.liveTop}>
          <View style={styles.liveTag}>
            <Pulse color={colors.danger} size={7} />
            <Text style={styles.liveTagText}>LIVE</Text>
          </View>
          <Text style={styles.liveVs} numberOfLines={1}>
            Innings {state.current + 1} · {match.rules.overs} overs
          </Text>
        </View>
        <View style={styles.liveTeamRow}>
          <TeamCrest name={s.battingTeam.name} size={44} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.liveTeam} numberOfLines={1}>
              {s.battingTeam.name}
            </Text>
            <Text style={styles.liveVsLine} numberOfLines={1}>
              vs {s.bowlingTeam.name}
            </Text>
          </View>
        </View>
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
        <GrowBar share={s.maxBalls ? s.legalBalls / s.maxBalls : 0} trackStyle={styles.liveTrack} style={styles.liveFill} delay={300} />
        <Text style={styles.liveFootText} numberOfLines={2}>
          {line}
        </Text>
        <View style={styles.liveGo}>
          <Text style={styles.liveGoText}>{go}</Text>
          <Ionicons name={access.score ? 'arrow-forward' : 'eye-outline'} size={17} color={colors.onAccent} />
        </View>
      </LinearGradient>
    </PressableScale>
  );
}

/** No matches yet: the big welcome, and the way to the first toss. */
function PosterHero() {
  const access = useAccess();
  const { canRequest } = useClubSync();
  return (
    <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.poster}>
      <PitchStripes opacity={0.035} tint="255,255,255" />
      <OvalGround opacity={0.11} />
      <Sheen every={6500} />
      <AppMark size={52} />
      <Text style={styles.posterTitle}>Ready for{'\n'}the toss?</Text>
      <Text style={styles.posterBody}>
        {access.score || access.loading
          ? 'Score every ball. Every player’s numbers add up, match after match.'
          : 'The club’s matches show here, ball by ball, as soon as an editor starts one.'}
      </Text>
      {/* While access is still being worked out, no prompt at all: it would only flicker. */}
      {access.loading ? null : access.score ? (
        <Button label="Start a match" icon="play" onPress={() => router.push('/new')} style={{ marginTop: space.xl }} />
      ) : (
        canRequest && <Button label="Get editor access to score" icon="person-outline" onPress={() => router.push('/profile')} style={{ marginTop: space.xl }} />
      )}
    </LinearGradient>
  );
}

/**
 * Matches already played and none on: the next fixture as a poster. The two sides of the last match face off, each in
 * its own colours; the whole poster is the way to the same again, and the tiles under it to a different one.
 */
function FixtureHero({ last }: { last: Match }) {
  const [a, b] = last.teams;
  const ca = crestOf(a.name);
  const cb = crestOf(b.name);
  return (
    <PressableScale
      scaleTo={0.985}
      accessibilityLabel={`Rematch: ${a.name} vs ${b.name}, same sides and rules`}
      onPress={() => router.push({ pathname: '/new', params: { rematch: last.id } })}
    >
      <View style={styles.fixture}>
        <LinearGradient colors={[ca.to, '#0B130D', cb.to]} locations={[0, 0.5, 1]} start={{ x: 0, y: 0.2 }} end={{ x: 1, y: 0.8 }} style={StyleSheet.absoluteFill} />
        <PitchStripes opacity={0.03} tint="255,255,255" />
        <OvalGround opacity={0.08} />
        <Sheen every={6000} />
        <View style={styles.fixtureTag}>
          <Ionicons name="flash" size={12} color={colors.onAccent} />
          <Text style={styles.fixtureTagText}>Next match</Text>
        </View>
        <View style={styles.fixtureFaceOff}>
          <View style={styles.fixtureSide}>
            <TeamCrest name={a.name} size={76} />
            <Text style={styles.fixtureName} numberOfLines={2}>
              {a.name}
            </Text>
          </View>
          <Text style={styles.fixtureVs}>VS</Text>
          <View style={styles.fixtureSide}>
            <TeamCrest name={b.name} size={76} />
            <Text style={styles.fixtureName} numberOfLines={2}>
              {b.name}
            </Text>
          </View>
        </View>
        <View style={styles.fixtureFoot}>
          <Ionicons name="refresh" size={15} color={hero.text} />
          <Text style={styles.fixtureFootText} numberOfLines={1}>
            Tap for a rematch · same sides, {last.rules.overs} overs
          </Text>
        </View>
      </View>
    </PressableScale>
  );
}

/** Signed out on the live app: the club's matches are a sign-in away. */
function SignInHero() {
  const { status, signIn } = useClubSync();
  return (
    <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.poster}>
      <PitchStripes opacity={0.035} tint="255,255,255" />
      <OvalGround opacity={0.1} />
      <AppMark size={52} />
      <Text style={[styles.posterTitle, { fontSize: 36, lineHeight: 40 }]}>Sign in to see the club’s matches</Text>
      <Text style={styles.posterBody}>Every match, scorecard and player’s numbers, live on every phone.</Text>
      <Button
        label={status === 'signing-in' ? 'Signing in…' : 'Sign in with Google'}
        icon="logo-google"
        disabled={status === 'signing-in'}
        onPress={() => void signIn()}
        style={{ marginTop: space.xl }}
      />
    </LinearGradient>
  );
}

/** A match left unfinished: no longer live, still there to finish (or to look at). */
function UnfinishedRow({ match }: { match: Match }) {
  const access = useAccess();
  const state = matchState(match);
  const s = state.innings[state.current];
  const d = new Date(match.updatedAt ?? match.createdAt);
  return (
    <PressableScale scaleTo={0.98} onPress={() => openMatch(match, true)} style={styles.unfinished} accessibilityLabel={`Unfinished: ${match.teams[0].name} vs ${match.teams[1].name}`}>
      <View style={styles.unfinishedTag}>
        <Text style={styles.unfinishedTagText}>Unfinished</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.unfinishedTeams} numberOfLines={2}>
          {match.teams[0].name} vs {match.teams[1].name}
        </Text>
        <Text style={styles.unfinishedMeta} numberOfLines={1}>
          {s.battingTeam.name} {s.runs}/{s.wickets} · {oversText(s.legalBalls)} ov · {d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
        </Text>
      </View>
      <Text style={styles.unfinishedGo}>{access.score ? 'Finish it' : 'Watch'}</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.faint} />
    </PressableScale>
  );
}

/** The season as a bento: runs the big tile, wickets and sixes beside it, the top scorer as a brass plaque, then awards. */
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
        <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.tile, styles.tileBig]}>
          <OvalGround opacity={0.1} />
          <Text style={[styles.tileLabel, { color: hero.muted }]}>Runs scored</Text>
          <CountUp value={runs} style={styles.tileBigValue} />
          <Text style={[styles.tileSub, { color: hero.muted }]}>
            in {matches.length} match{matches.length === 1 ? '' : 'es'}
          </Text>
        </LinearGradient>
        <View style={{ flex: 1, gap: space.sm }}>
          <View style={styles.tile}>
            <View style={styles.tileHead}>
              <MaterialCommunityIcons name="cricket" size={14} color={colors.danger} />
              <Text style={styles.tileLabel}>Wickets</Text>
            </View>
            <CountUp value={wickets} style={styles.tileValue} delay={120} />
          </View>
          <View style={[styles.tile, { backgroundColor: colors.accentDim, borderColor: colors.accentDim }]}>
            <View style={styles.tileHead}>
              <Ionicons name="flash" size={13} color={colors.accentInk} />
              <Text style={[styles.tileLabel, { color: colors.accentInk }]}>Sixes</Text>
            </View>
            <CountUp value={sixes} style={[styles.tileValue, { color: colors.accentInk }]} delay={200} />
          </View>
        </View>
      </View>
      {top && (
        <PressableScale scaleTo={0.98} onPress={() => router.push({ pathname: '/player/[key]', params: { key: top.key } })} accessibilityLabel={`Top scorer ${top.name}, ${top.batting.runs} runs`} style={styles.topScorer}>
          <View>
            <PlayerAvatar name={top.name} size={44} />
            <View style={styles.topCrown}>
              <MaterialCommunityIcons name="crown" size={11} color={colors.gold} />
            </View>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.tileLabel, { color: colors.gold }]}>Top scorer</Text>
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
      <PressableScale scaleTo={0.98} onPress={() => router.push('/awards')} style={styles.awards} accessibilityLabel="Season awards">
        <View style={styles.awardsIcon}>
          <Ionicons name="ribbon" size={18} color={colors.gold} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.awardsTitle}>Season awards</Text>
          <Text style={styles.awardsSub}>Best batter, best bowler, Player of the Season and more</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.faint} />
      </PressableScale>
    </View>
  );
}

/** A series as a trophy race: its name and score, who needs how many wins, the pips and the leader. */
function SeriesCard({ s }: { s: SeriesState }) {
  return (
    <PressableScale
      scaleTo={0.98}
      onPress={() => router.push({ pathname: '/series/[id]', params: { id: s.id } })}
      accessibilityLabel={`Series ${s.name}: ${s.status}`}
      style={styles.series}
    >
      <View style={styles.seriesTop}>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <View style={styles.seriesEyebrowRow}>
            <Ionicons name="trophy" size={12} color={colors.gold} />
            <Text style={styles.seriesEyebrow}>{s.over ? 'Series · final' : `Series · best of ${s.of}`}</Text>
          </View>
          <Text style={styles.seriesName} numberOfLines={1}>
            {s.name}
          </Text>
        </View>
        <Text style={styles.seriesScore}>
          {s.wins[0]}
          <Text style={{ color: colors.faint }}>–</Text>
          {s.wins[1]}
        </Text>
      </View>
      <TrophyRace series={s} />
      <SeamDivider />
      <View style={styles.seriesFoot}>
        <SeriesPips series={s} size={12} />
        <Text style={styles.seriesStatus} numberOfLines={1}>
          {s.status}
          {s.best ? `  ·  ★ ${s.best.name}` : ''}
        </Text>
        <Ionicons name="chevron-forward" size={16} color={colors.faint} />
      </View>
    </PressableScale>
  );
}

/** What can be done with a finished match: play it again, share the result, or delete it. */
function ResultMenu({ match, onClose, onShare, onDelete }: { match: Match | null; onClose: () => void; onShare: () => void; onDelete: () => void }) {
  const [deleting, setDeleting] = useState(false);
  const access = useAccess();
  // On the live app a match is the club's: deleting it takes it off every phone.
  const { status } = useClubSync();
  const shared = status !== 'unavailable';
  const close = () => {
    setDeleting(false);
    onClose();
  };
  return (
    <Sheet visible={match !== null} onClose={close} title={match ? `${match.teams[0].name} vs ${match.teams[1].name}` : ''}>
      <View style={{ gap: space.sm }}>
        {access.score && (
          <Button
            variant="ghost"
            icon="refresh"
            label="Rematch"
            onPress={() => {
              close();
              if (match) router.push({ pathname: '/new', params: { rematch: match.id } });
            }}
          />
        )}
        <Button variant="ghost" icon="image-outline" label="Share result picture" onPress={onShare} />
        {access.admin && (
          <Button
            variant="danger"
            icon="trash-outline"
            label={deleting ? (shared ? 'Tap again to delete it for everyone' : 'Tap again to delete it') : shared ? 'Delete for everyone' : 'Delete this match'}
            onPress={() => {
              if (!deleting) return setDeleting(true);
              setDeleting(false);
              onDelete();
            }}
          />
        )}
      </View>
    </Sheet>
  );
}

const PAGE = 8;

/** The results as tickets, with chips (All, a side, Series) so a long season is easy to get around. */
function Results({ done, wide, onMore }: { done: Match[]; wide: boolean; onMore: (m: Match) => void }) {
  const [filter, setFilter] = useState('all');
  const [all, setAll] = useState(false);
  const teams = useMemo(() => {
    const seen = new Map<string, string>();
    for (const m of done) for (const t of m.teams) if (!seen.has(t.name.trim().toLowerCase())) seen.set(t.name.trim().toLowerCase(), t.name);
    return [...seen.entries()];
  }, [done]);
  const hasSeries = done.some((m) => m.series);
  const shown = useMemo(
    () =>
      filter === 'all'
        ? done
        : filter === 'series'
          ? done.filter((m) => m.series)
          : done.filter((m) => m.teams.some((t) => t.name.trim().toLowerCase() === filter)),
    [done, filter],
  );
  const limit = wide ? PAGE * 2 : PAGE;
  const list = all ? shown : shown.slice(0, limit);
  const pick = (f: string) => {
    setFilter(f);
    setAll(false);
  };
  const cards = list.map((m, i) => (
    <Rise key={m.id} index={i % 6} style={wide ? { flex: 1 } : undefined}>
      <MatchTicket match={m} fill={wide} onPress={() => openMatch(m, false)} onLongPress={() => onMore(m)} onMore={() => onMore(m)} />
    </Rise>
  ));
  return (
    <FadeIn delay={240}>
      <SectionLabel right={<Text style={styles.count}>{filter === 'all' ? `${done.length} played` : `${shown.length} of ${done.length}`}</Text>}>Results</SectionLabel>
      {(teams.length > 1 || hasSeries) && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chips}>
          <Chip label="All" selected={filter === 'all'} onPress={() => pick('all')} />
          {teams.map(([key, name]) => (
            <Chip key={key} label={name} selected={filter === key} onPress={() => pick(key)} />
          ))}
          {hasSeries && <Chip label="Series" icon="trophy-outline" selected={filter === 'series'} onPress={() => pick('series')} />}
        </ScrollView>
      )}
      {shown.length === 0 ? (
        <View style={styles.none}>
          <Text style={styles.noneText}>No matches for this filter yet.</Text>
          <Button variant="ghost" label="Show all results" onPress={() => pick('all')} />
        </View>
      ) : wide ? (
        // Never narrower than a phone's card, so a side's name keeps to one line; every card in a row as tall.
        <Columns tablet={2} laptop={3} minItem={340} gap={space.sm}>
          {cards}
        </Columns>
      ) : (
        <View style={{ gap: space.sm }}>{cards}</View>
      )}
      {!all && shown.length > limit && (
        <View style={{ marginTop: space.md }}>
          <Button variant="ghost" icon="chevron-down" label={`Show all ${shown.length} results`} onPress={() => setAll(true)} />
        </View>
      )}
    </FadeIn>
  );
}

export default function Home() {
  const { matches, deleteMatch, ready, importMatches } = useMatches();
  const toast = useToast();
  const { exportEverything, importFile } = useMatchFiles(toast.show);
  const sync = useClubSync();
  const access = useAccess();
  const { prefs, setPrefs } = usePrefs();
  const { squad } = useSquad();
  const photos = usePhotos();
  // The signed-in player: by their email in the squad, or who they said they are on this phone.
  const meName = prefs.me?.[sync.user?.email ?? ''] ?? playerForEmail(squad, sync.user?.email)?.name;
  const mePhoto = photoFor(photos, meName) ?? sync.user?.photo;
  // Remind once a week that a lost phone shouldn't mean lost matches, unless the club sync is keeping them already.
  const clubKeeps = Boolean(sync.user) && (sync.status === 'synced' || sync.status === 'syncing');
  const [bannerGone, setBannerGone] = useState(false);
  const backupDue = !bannerGone && !clubKeeps && matches.length >= 2 && (!prefs.lastBackup || Date.now() - prefs.lastBackup > 7 * 86_400_000);
  const [more, setMore] = useState<Match | null>(null);
  const [sharing, setSharing] = useState<Match | null>(null);
  const now = Date.now();
  // A result still waiting for the scorer to confirm it is still on: it opens on the match, where it's confirmed.
  const unfinished = matches.filter((m) => !matchState(m).result || m.confirmed === false);
  // Live only while someone's at it; one left overnight is unfinished.
  const live = unfinished.filter((m) => !isStale(m, now));
  const stale = unfinished.filter((m) => isStale(m, now));
  const done = matches.filter((m) => matchState(m).result && m.confirmed !== false);
  const signedOut = sync.status === 'signed-out';
  const asked = sync.role === 'owner' ? sync.requests.length : 0;
  const series = useMemo(() => allSeries(matches), [matches]);
  const layout = useLayout();
  // What's on and the season side by side only where the season's column is wide enough for its tiles (a tablet held
  // upright stacks them). The left column then opens on a label too, so it starts level with the season beside it.
  const twoUp = layout.width >= 1000;
  const lead = !twoUp || !ready || signedOut ? null : live.length ? 'On now' : matches.length > 0 && access.score ? 'Next match' : null;
  const seriesFirst = twoUp && !lead && !backupDue && stale.length === 0;

  const backUp = async () => {
    if (await exportEverything()) setPrefs({ lastBackup: Date.now() });
  };

  const menus = (
    <>
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
    </>
  );
  const pieces = {
    header: (
      <View style={styles.brandRow}>
        <AppMark size={34} />
        <Text style={styles.brand}>
          crease<Text style={{ color: colors.accent }}>.</Text>
        </Text>
        <View style={{ flex: 1 }} />
        <PressableScale accessibilityLabel="My profile" onPress={() => router.push('/profile')} style={styles.me}>
          <Avatar photo={mePhoto} name={meName ?? sync.user?.name ?? ''} size={36} />
          {sync.requests.length > 0 && (
            <View style={styles.dot} accessibilityLabel={`${sync.requests.length} editor requests waiting`}>
              <Text style={styles.dotText}>{sync.requests.length}</Text>
            </View>
          )}
        </PressableScale>
        <PressableScale accessibilityLabel="Settings" onPress={() => router.push('/settings')} style={styles.gear}>
          <Ionicons name="settings-outline" size={18} color={colors.text} />
        </PressableScale>
      </View>
    ),
    asked: (
      <>
        {asked > 0 && (
          <FadeIn>
            <PressableScale scaleTo={0.98} onPress={() => router.push('/settings')} style={styles.asked} accessibilityLabel={`${asked} editor requests. Review in Settings`}>
              <View style={styles.askedIcon}>
                <Ionicons name="person-add" size={16} color={colors.onAccent} />
              </View>
              <Text style={styles.askedText}>
                {asked === 1 ? `${sync.requests[0].name} asked` : `${asked} people asked`} for editor access
              </Text>
              <Text style={styles.askedGo}>Review</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.gold} />
            </PressableScale>
          </FadeIn>
        )}
      </>
    ),
    hero: (
      <>
        <FadeIn>
          {signedOut ? (
            <SignInHero />
          ) : live[0] ? (
            <LiveHero match={live[0]} />
          ) : matches.length === 0 ? (
            <PosterHero />
          ) : access.score ? (
            <FixtureHero last={matches[0]} />
          ) : null}
        </FadeIn>
        {!signedOut &&
          live.slice(1).map((m, i) => (
            <FadeIn key={m.id} delay={80 + i * 40}>
              <LiveHero match={m} />
            </FadeIn>
          ))}
        {!signedOut && stale.length > 0 && (
          <FadeIn delay={60} style={{ gap: space.sm, marginTop: space.sm }}>
            {stale.map((m) => (
              <UnfinishedRow key={m.id} match={m} />
            ))}
          </FadeIn>
        )}
      </>
    ),
    // Directly under the hero: what to do next, as words and icons.
    actions: (
      <>
        {!signedOut && (access.score || access.admin || matches.length > 0) && (
          <FadeIn delay={70}>
            <View style={styles.actions}>
              {access.score && <QuickTile primary icon="add-circle" label="New match" accessibilityLabel="New match" onPress={() => router.push('/new')} />}
              {access.score && matches.length > 0 && (
                <QuickTile icon="refresh" label="Rematch" accessibilityLabel="Rematch the last match" onPress={() => router.push({ pathname: '/new', params: { rematch: matches[0].id } })} />
              )}
              {access.admin && <QuickTile icon="download-outline" label="Import match file" accessibilityLabel="Import a match file" onPress={() => void importFile()} />}
              {matches.length > 0 && <QuickTile icon="cloud-upload-outline" label="Back up" accessibilityLabel="Back up all matches" onPress={() => void backUp()} />}
            </View>
          </FadeIn>
        )}
      </>
    ),
    backup: (
      <>
        {backupDue && (
          <FadeIn delay={100}>
            <View style={styles.backup}>
              <Ionicons name="cloud-upload-outline" size={18} color={colors.gold} />
              <Text style={styles.backupBody}>{prefs.lastBackup ? 'It’s been over a week since your last backup.' : 'Your matches aren’t backed up yet.'}</Text>
              <PressableScale accessibilityLabel="Back up now" onPress={() => void backUp()} style={styles.backupButton}>
                <Text style={styles.backupButtonText}>Back up</Text>
              </PressableScale>
              <IconButton icon="close" label="Dismiss backup reminder" tint={colors.faint} onPress={() => setBannerGone(true)} />
            </View>
          </FadeIn>
        )}
      </>
    ),
    series: (
      <>
        {series.length > 0 && (
          <FadeIn delay={130}>
            <SectionLabel flush={seriesFirst}>Series</SectionLabel>
            <View style={{ gap: space.sm }}>
              {series.map((s, i) => (
                <Rise key={s.id} index={i}>
                  <SeriesCard s={s} />
                </Rise>
              ))}
            </View>
          </FadeIn>
        )}
      </>
    ),
    season: (
      <>
        {ready && matches.length > 0 && (
          <FadeIn delay={160}>
            <SectionLabel flush={twoUp}>Season at a glance</SectionLabel>
            <Season matches={matches} />
          </FadeIn>
        )}
      </>
    ),
    dev: (
      <>
        {__DEV__ && (
          // Development builds only: a season of Copan Strikers vs Copan Royals to try every screen with real-looking numbers.
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
      </>
    ),
  };

  // A tablet or laptop: the rail has the brand, profile and settings, so the page opens on its title; what's on now
  // and what to do sit beside the season, and the results fill the width as a grid.
  if (layout.wide)
    return (
      <Screen>
        <ScrollView contentContainerStyle={widePad(layout.gutter)}>
          <Page>
            <WideHead title="Matchday" sub={`${live.length ? `${live.length} on now · ` : ''}${done.length} played this season`} />
            {pieces.asked}
            <Columns weights={[3, 2]} tablet={twoUp ? 2 : 1} gap={space.lg}>
              <View>
                {lead && <SectionLabel flush>{lead}</SectionLabel>}
                <View style={{ gap: space.sm }}>
                  {pieces.hero}
                  {pieces.actions}
                  {pieces.backup}
                  {pieces.series}
                </View>
              </View>
              <View>
                {pieces.season}
                {pieces.dev}
              </View>
            </Columns>
            {done.length > 0 && <Results done={done} wide onMore={setMore} />}
          </Page>
        </ScrollView>
        {menus}
      </Screen>
    );

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        {pieces.header}
        {pieces.asked}
        {pieces.hero}
        <View style={{ marginTop: space.md }}>{pieces.actions}</View>
        {pieces.backup && <View style={{ marginTop: backupDue ? space.md : 0 }}>{pieces.backup}</View>}
        {pieces.series}
        {pieces.season}
        {pieces.dev}
        {done.length > 0 && <Results done={done} wide={false} onMore={setMore} />}
      </ScrollView>
      {menus}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: 130 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.lg },
  brand: { fontFamily: font.posterBlack, fontSize: 22, color: colors.text, letterSpacing: -0.6 },
  // Header buttons are at least 44 across, for a thumb.
  me: { width: 44, height: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.bg },
  dotText: { color: '#FFFFFF', fontSize: 10, fontFamily: font.heavy },
  gear: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...edge,
  },
  actions: { flexDirection: 'row', gap: space.sm },
  backup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.goldDim,
    borderRadius: radius.lg,
    paddingVertical: 4,
    paddingLeft: space.md,
    paddingRight: 2,
    minHeight: 52,
  },
  backupBody: { flex: 1, color: colors.muted, fontSize: 12, fontFamily: font.medium, lineHeight: 16 },
  backupButton: { backgroundColor: colors.text, borderRadius: radius.pill, paddingHorizontal: space.md, height: 36, justifyContent: 'center' },
  backupButtonText: { color: colors.bg, fontSize: 12, fontFamily: font.bold },
  asked: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 56,
    paddingHorizontal: space.md,
    marginBottom: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: colors.goldDim,
  },
  askedIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center' },
  askedText: { flex: 1, color: colors.text, fontSize: 14, fontFamily: font.semibold },
  askedGo: { color: colors.text, fontSize: 13, fontFamily: font.bold },
  unfinished: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.md,
    minHeight: 56,
    ...edge,
  },
  unfinishedTag: { backgroundColor: colors.surfaceHi, borderRadius: radius.pill, paddingHorizontal: 8, height: 22, justifyContent: 'center' },
  unfinishedTagText: { color: colors.muted, fontSize: 11, fontFamily: font.bold },
  unfinishedTeams: { color: colors.text, fontSize: 14, fontFamily: font.semibold },
  unfinishedMeta: { color: colors.muted, fontSize: 12, fontFamily: font.medium, marginTop: 2 },
  unfinishedGo: { color: colors.accentInk, fontSize: 13, fontFamily: font.bold },

  fixture: { borderRadius: radius.xl, padding: space.xl, overflow: 'hidden', gap: space.lg, borderWidth: 1, borderColor: hero.line, backgroundColor: '#0B130D' },
  fixtureTag: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', height: 24, paddingHorizontal: 10, borderRadius: radius.sm, backgroundColor: colors.accent, transform: [{ skewX: '-8deg' }] },
  fixtureTagText: { ...type.label, color: colors.onAccent },
  fixtureFaceOff: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  fixtureSide: { flex: 1, alignItems: 'center', gap: space.sm },
  fixtureName: { color: hero.text, fontSize: 16, lineHeight: 19, fontFamily: font.heavy, textAlign: 'center' },
  fixtureVs: { color: hero.accent, fontSize: 32, fontFamily: font.posterBlack, fontStyle: 'italic', letterSpacing: -1 },
  fixtureFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 44, borderRadius: radius.pill, backgroundColor: hero.ink(0.1), borderWidth: 1, borderColor: hero.ink(0.2) },
  fixtureFootText: { color: hero.text, fontFamily: font.bold, fontSize: 13 },

  poster: { borderRadius: radius.xl, padding: space.xl, overflow: 'hidden' },
  posterTitle: { fontFamily: font.posterBlack, fontSize: 46, lineHeight: 51, color: hero.text, letterSpacing: -1.6, marginTop: space.xl },
  posterBody: { color: hero.muted, fontSize: 15, fontFamily: font.medium, lineHeight: 22, marginTop: space.md, maxWidth: 290 },

  liveHero: { borderRadius: radius.xl, padding: space.xl, overflow: 'hidden', marginBottom: space.sm, borderWidth: 1, borderColor: hero.line },
  liveTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.md },
  liveTag: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: 'rgba(229,72,93,0.2)', paddingHorizontal: 10, height: 26, borderRadius: radius.pill },
  liveTagText: { fontSize: 11, fontFamily: font.heavy, color: hero.text, letterSpacing: 1.4 },
  liveVs: { color: hero.muted, fontSize: 12, fontFamily: font.semibold, flexShrink: 1 },
  liveTeamRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.lg },
  liveTeam: { fontFamily: font.poster, fontSize: 22, color: hero.text, letterSpacing: -0.4 },
  liveVsLine: { color: hero.muted, fontSize: 12, fontFamily: font.medium },
  liveScoreRow: { flexDirection: 'row', alignItems: 'flex-end' },
  liveScore: { fontFamily: font.posterBlack, fontSize: 92, lineHeight: 101, color: hero.text, letterSpacing: -4, ...type.num },
  liveWkts: { fontFamily: font.poster, fontSize: 40, lineHeight: 70, color: hero.faint, letterSpacing: -1 },
  liveMetaValue: { fontFamily: font.posterBlack, fontSize: 26, color: hero.text, ...type.num },
  liveMetaOf: { fontFamily: font.poster, fontSize: 16, color: hero.faint },
  liveMetaLabel: { ...type.label, fontSize: 10, color: hero.muted, marginBottom: 14 },
  liveTrack: { height: 5, borderRadius: 3, backgroundColor: hero.ink(0.12), overflow: 'hidden', marginTop: space.sm },
  liveFill: { height: 5, borderRadius: 3, backgroundColor: hero.accent },
  liveFootText: { color: hero.text, fontFamily: font.semibold, fontSize: 14, lineHeight: 19, marginTop: space.md },
  liveGo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: hero.accent, height: 48, borderRadius: radius.pill, marginTop: space.md },
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
    gap: space.sm,
    overflow: 'hidden',
    ...edge,
  },
  tileBig: { flex: 1.4, borderColor: hero.line },
  tileHead: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  tileLabel: { ...type.label, fontSize: 10, color: colors.muted },
  tileBigValue: { fontFamily: font.posterBlack, fontSize: 60, lineHeight: 66, color: hero.text, letterSpacing: -3, marginTop: space.lg, ...type.num },
  tileSub: { fontSize: 13, fontFamily: font.semibold },
  tileValue: { fontFamily: font.posterBlack, fontSize: 34, lineHeight: 38, color: colors.text, letterSpacing: -1, ...type.num },
  // The top scorer is an honours-board plaque: brass on the card.
  topScorer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.goldDim,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gold,
    padding: space.md,
    paddingRight: space.lg,
  },
  topCrown: { position: 'absolute', right: -4, bottom: -2, width: 18, height: 18, borderRadius: 9, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.gold, alignItems: 'center', justifyContent: 'center' },
  topName: { color: colors.text, fontSize: 17, fontFamily: font.bold, marginTop: 2 },
  topRuns: { fontFamily: font.posterBlack, fontSize: 28, color: colors.text, ...type.num },
  topUnit: { fontFamily: font.medium, fontSize: 13, color: colors.muted },
  awards: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.md, paddingRight: space.lg, ...edge },
  awardsIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.goldDim, alignItems: 'center', justifyContent: 'center' },
  awardsTitle: { color: colors.text, fontSize: 15, fontFamily: font.bold },
  awardsSub: { color: colors.muted, fontSize: 12, fontFamily: font.regular, marginTop: 1 },

  series: {
    gap: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
    ...edge,
  },
  seriesTop: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  seriesEyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  seriesEyebrow: { ...type.label, fontSize: 10, color: colors.gold },
  seriesName: { fontFamily: font.posterBlack, fontSize: 24, lineHeight: 28, color: colors.text, letterSpacing: -0.6 },
  seriesFoot: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  seriesStatus: { flex: 1, color: colors.muted, fontSize: 13, fontFamily: font.medium },
  seriesScore: { fontFamily: font.posterBlack, fontSize: 44, lineHeight: 48, color: colors.text, letterSpacing: -1.5, ...type.num },

  count: { color: colors.faint, fontSize: 12, fontFamily: font.semibold },
  chipScroll: { marginHorizontal: -space.lg, marginBottom: space.md, flexGrow: 0 },
  chips: { gap: space.sm, paddingHorizontal: space.lg },
  none: { alignItems: 'center', gap: space.md, paddingVertical: space.xl },
  noneText: { color: colors.muted, fontSize: 14, fontFamily: font.medium },
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
});
