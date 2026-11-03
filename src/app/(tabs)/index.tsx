import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Columns, Page, useLayout, widePad } from '../../components/layout.tsx';
import { LinearGradient } from 'expo-linear-gradient';
import { CountUp, Pulse, Rise, Sheen, Ticker } from '../../components/motion.tsx';
import { ShareCardSheet } from '../../components/ShareCard.tsx';
import { Button, FadeIn, IconButton, PitchStripes, PressableScale, Screen, SectionLabel, Sheet, useToast, WideHead } from '../../components/ui.tsx';
import { sampleSeason } from '../../demo/sampleSeason.ts';
import { matchState, oversText } from '../../engine/engine.ts';
import { allSeries, careerStats, playerOfTheMatch, type SeriesState } from '../../engine/stats.ts';
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

const openMatch = (m: Match, live: boolean) =>
  router.push(live ? { pathname: '/match/[id]', params: { id: m.id } } : { pathname: '/match/[id]/scorecard', params: { id: m.id } });

/** An unfinished match nobody has touched for this long was left, not paused: it's no longer shown as live. */
const STALE_AFTER = 12 * 3_600_000;
const isStale = (m: Match, now: number) => now - (m.updatedAt ?? m.createdAt) > STALE_AFTER;

/** The match on right now leads the screen: a scoreboard on the pitch green, one tap from the scoring pad. */
function LiveHero({ match }: { match: Match }) {
  const access = useAccess();
  // Viewers follow along; only editors score.
  const go = access.score ? (matchState(match).result ? 'Confirm' : 'Score') : 'Watch';
  const state = matchState(match);
  const s = state.innings[state.current];
  const batted = match.innings[state.current].events.length > 0;
  const need = s.target !== null ? Math.max(s.target - s.runs, 0) : null;
  const rr = s.legalBalls ? ((s.runs * 6) / s.legalBalls).toFixed(2) : '0.00';
  return (
    <PressableScale scaleTo={0.98} onPress={() => openMatch(match, true)} accessibilityLabel={`Live: ${s.battingTeam.name} ${s.runs} for ${s.wickets}. ${access.score ? 'Open scoring' : 'Watch'}`}>
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
        <Text style={styles.liveTeam} numberOfLines={2}>
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
            {state.result ? `${state.result} · to confirm` : need !== null && batted ? `Need ${need} off ${s.maxBalls - s.legalBalls}` : batted ? `Run rate ${rr}` : 'Ready to start'}
          </Text>
          <View style={styles.liveGo}>
            <Text style={styles.liveGoText}>{go}</Text>
            <Ionicons name={access.score ? 'arrow-forward' : 'eye-outline'} size={16} color={colors.onAccent} />
          </View>
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

/** Matches already played and none on: a slim way to the next toss, or the same again. */
function StartCard({ last }: { last: Match }) {
  return (
    <View style={styles.start}>
      <Text style={styles.startTitle}>Ready for the toss?</Text>
      <View style={styles.startRow}>
        <PressableScale
          accessibilityLabel={`Rematch: ${last.teams[0].name} vs ${last.teams[1].name}, same sides and rules`}
          onPress={() => router.push({ pathname: '/new', params: { rematch: last.id } })}
          wrapStyle={{ flex: 1.4, minWidth: 0 }}
          style={styles.startGhost}
        >
          <Ionicons name="refresh" size={16} color={colors.text} />
          <Text style={styles.startGhostText} numberOfLines={1}>
            Rematch
          </Text>
        </PressableScale>
        <PressableScale accessibilityLabel="New match" haptic="medium" onPress={() => router.push('/new')} wrapStyle={{ flex: 1 }} style={styles.startGo}>
          <Ionicons name="add" size={18} color={colors.onAccent} />
          <Text style={styles.newMatchText}>New match</Text>
        </PressableScale>
      </View>
      <Text style={styles.startBody} numberOfLines={2}>
        Rematch is {last.teams[0].name} vs {last.teams[1].name} again, {last.rules.overs} overs.
      </Text>
    </View>
  );
}

/** Signed out on the live app: the club's matches are a sign-in away. */
function SignInHero() {
  const { status, signIn } = useClubSync();
  return (
    <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.poster}>
      <PitchStripes opacity={0.035} tint="255,255,255" />
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
      <Text style={styles.unfinishedGo}>{access.score ? 'Score' : 'Watch'}</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.faint} />
    </PressableScale>
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
          <View>
            <PlayerAvatar name={top.name} size={40} />
            <View style={styles.topCrown}>
              <MaterialCommunityIcons name="crown" size={11} color={colors.gold} />
            </View>
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

function ResultRow({ match, onMore, fill }: { match: Match; onMore: () => void; fill?: boolean }) {
  const state = matchState(match);
  const mom = state.result ? playerOfTheMatch(match) : null;
  const d = new Date(match.createdAt);
  // The ⋯ sits beside the row rather than inside it: a button can't hold another button.
  return (
    <View style={[styles.resultWrap, fill && { flex: 1 }]}>
      <PressableScale scaleTo={0.98} onPress={() => openMatch(match, false)} onLongPress={onMore} wrapStyle={fill && { flex: 1 }} style={[styles.result, fill && { flex: 1 }]}>
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
                <Text numberOfLines={2} style={[styles.resultTeam, won && { color: colors.text }]}>
                  {inn.battingTeam.name}
                </Text>
                <Text style={[styles.resultScore, won && { color: colors.text }]}>
                  {inn.runs}/{inn.wickets}
                  <Text style={styles.resultOvers}> {oversText(inn.legalBalls)}</Text>
                </Text>
              </View>
            );
          })}
          <Text numberOfLines={2} style={styles.resultText}>
            {state.result}
          </Text>
          {mom && (
            <View style={styles.resultMom}>
              <PlayerAvatar name={mom.name} size={18} />
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
  const { exportEverything } = useMatchFiles(toast.show);
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
  const backupDue = !clubKeeps && matches.length >= 2 && (!prefs.lastBackup || Date.now() - prefs.lastBackup > 7 * 86_400_000);
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
  // upright stacks them). The left column then opens on a label too, so it starts level with This season beside it.
  const twoUp = layout.width >= 1000;
  const lead = !twoUp || !ready || signedOut ? null : live.length ? 'On now' : matches.length > 0 && access.score ? 'Next match' : null;
  const seriesFirst = twoUp && !lead && !backupDue && stale.length === 0;

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
      <>
        <View style={styles.brandRow}>
          <AppMark size={34} />
          <Text style={styles.brand}>crease</Text>
          <View style={{ flex: 1 }} />
          {live.length > 0 && access.score && !signedOut && (
            <PressableScale accessibilityLabel="New match" haptic="medium" onPress={() => router.push('/new')} style={styles.newMatch}>
              <Ionicons name="add" size={18} color={colors.onAccent} />
              <Text style={styles.newMatchText}>New match</Text>
            </PressableScale>
          )}
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
      </>
    ),
    asked: (
      <>
        {asked > 0 && (
          <FadeIn>
            <PressableScale scaleTo={0.98} onPress={() => router.push('/settings')} style={styles.asked} accessibilityLabel={`${asked} editor requests. Review in Settings`}>
              <Ionicons name="person-add-outline" size={18} color={colors.gold} />
              <Text style={styles.askedText}>
                {asked === 1 ? `${sync.requests[0].name} asked` : `${asked} people asked`} for editor access
              </Text>
              <Text style={styles.askedGo}>Review</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.faint} />
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
            <StartCard last={matches[0]} />
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
    backup: (
      <>
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
                  if (await exportEverything()) setPrefs({ lastBackup: Date.now() });
                }}
                style={styles.backupButton}
              >
                <Text style={styles.backupButtonText}>Back up now</Text>
              </PressableScale>
            </View>
          </FadeIn>
        )}
      </>
    ),
    series: (
      <>
        {series.length > 0 && (
          <FadeIn delay={90}>
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
          <FadeIn delay={120}>
            <SectionLabel flush={twoUp}>This season</SectionLabel>
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
            <WideHead title="Matches" sub={`${live.length ? `${live.length} on now · ` : ''}${done.length} played this season`} />
            {pieces.asked}
            <Columns weights={[3, 2]} tablet={twoUp ? 2 : 1} gap={space.lg}>
              <View>
                {lead && <SectionLabel flush>{lead}</SectionLabel>}
                <View style={{ gap: space.sm }}>
                  {pieces.hero}
                  {pieces.backup}
                  {pieces.series}
                </View>
              </View>
              <View>
                {pieces.season}
                {pieces.dev}
              </View>
            </Columns>
            {done.length > 0 && (
              <FadeIn delay={240}>
                <SectionLabel>Results</SectionLabel>
                {/* Never narrower than a phone's card, so a side's name keeps to one line; every card in a row as tall. */}
                <Columns tablet={2} laptop={3} minItem={340} gap={space.sm}>
                  {done.map((m, i) => (
                    <Rise key={m.id} index={i} style={{ flex: 1 }}>
                      <ResultRow match={m} onMore={() => setMore(m)} fill />
                    </Rise>
                  ))}
                </Columns>
              </FadeIn>
            )}
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
        {pieces.backup}
        {pieces.series}
        {pieces.season}
        {pieces.dev}
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
      {menus}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: 130 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.xl },
  brand: { fontFamily: font.posterBlack, fontSize: 22, color: colors.text, letterSpacing: -0.6 },
  // Header buttons are at least 44 across, for a thumb.
  me: { width: 44, height: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.bg },
  dotText: { color: '#FFFFFF', fontSize: 10, fontFamily: font.heavy },
  newMatch: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 44, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: colors.accent },
  newMatchText: { color: colors.onAccent, fontFamily: font.bold, fontSize: 14 },
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
  backupButton: { backgroundColor: colors.text, borderRadius: radius.pill, paddingHorizontal: space.md, height: 44, justifyContent: 'center' },
  asked: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 52,
    paddingHorizontal: space.lg,
    marginBottom: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: colors.goldDim,
  },
  askedText: { flex: 1, color: colors.text, fontSize: 14, fontFamily: font.semibold },
  askedGo: { color: colors.text, fontSize: 13, fontFamily: font.bold },
  start: {
    gap: space.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
    ...edge,
  },
  startRow: { flexDirection: 'row', gap: space.sm },
  startTitle: { fontFamily: font.posterBlack, fontSize: 18, lineHeight: 22, color: colors.text, letterSpacing: -0.4 },
  startBody: { color: colors.muted, fontSize: 12, fontFamily: font.medium, lineHeight: 16 },
  startGhost: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, height: 44, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: colors.surfaceHi, borderWidth: 1, borderColor: colors.border },
  startGhostText: { color: colors.text, fontFamily: font.bold, fontSize: 13 },
  startGo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2, height: 44, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: colors.accent },
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
  topCrown: { position: 'absolute', right: -4, bottom: -2, width: 18, height: 18, borderRadius: 9, backgroundColor: colors.goldDim, borderWidth: 1, borderColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
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
  // A long side's name wraps to a second line rather than being cut off on a narrow phone.
  resultTeam: { flex: 1, minWidth: 0, color: colors.muted, fontSize: 14, lineHeight: 18, fontFamily: font.semibold },
  resultScore: { color: colors.muted, fontSize: 20, fontFamily: font.posterBlack, letterSpacing: -0.4, ...type.num },
  resultOvers: { fontSize: 13, fontFamily: font.medium, color: colors.faint },
  resultText: { color: colors.accentInk, fontSize: 12, fontFamily: font.semibold, marginTop: 4, marginLeft: 14 },
  resultMom: { flexDirection: 'row', alignItems: 'center', gap: 5, marginLeft: 14 },
  resultMomText: { flex: 1, color: colors.muted, fontSize: 12, fontFamily: font.medium },
  resultMomName: { color: colors.text, fontFamily: font.semibold },
});
