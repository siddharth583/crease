import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '../components/Avatar.tsx';
import { Columns, Page, useLayout } from '../components/layout.tsx';
import { RatingChips } from '../components/Ratings.tsx';
import { Button, Card, Chip, IconButton, PageToneProvider, PitchStripes, Screen, SectionLabel, useToast, WideHead } from '../components/ui.tsx';
import { playerRatings } from '../engine/ratings.ts';
import { battingAverage, bestFigures, careerStats, economy, playerKey, strikeRate } from '../engine/stats.ts';
import { playerForEmail } from '../engine/squad.ts';
import { photoFor } from '../engine/photos.ts';
import { nameKey } from '../engine/teams.ts';
import { useMatches } from '../store/matches.tsx';
import { usePrefs } from '../store/prefs.ts';
import { useSquad } from '../store/squad.ts';
import { ROLE, RequestEditor, SignOutButton } from '../components/ClubSync.tsx';
import { useClubSync, usePhotos, useSetPhoto } from '../store/sync.tsx';
import { pickPhoto } from '../store/files.ts';
import { colors, font, hero, ownTeamTheme, radius, space, teamTheme, type } from '../theme.ts';

// My profile: who's signed in and what they can do in the club, and their own cricket once they say which squad
// player they are. That choice is kept on this phone, for each account.

const fmt = (n: number | null, digits = 1) => (n === null ? '–' : n.toFixed(digits));
export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { wide, desk, gutter } = useLayout();
  // A tablet's side column is too narrow for two buttons side by side: they stack.
  const narrowColumn = wide && !desk;
  const { matches } = useMatches();
  const { squad } = useSquad();
  const photos = usePhotos();
  const setPhoto = useSetPhoto();
  const toast = useToast();
  const { prefs, setPrefs } = usePrefs();
  const sync = useClubSync();
  const account = sync.user?.email ?? '';
  // The squad player with this account's email is them; a pick made on this phone (for anyone else) comes after.
  const byEmail = playerForEmail(squad, sync.user?.email);
  const me = prefs.me?.[account] ?? byEmail?.name;
  const choose = (name: string | null) => {
    const next = { ...(prefs.me ?? {}) };
    if (name) next[account] = name;
    else delete next[account];
    setPrefs({ me: next });
  };

  // Their squad entry and career, by the same key the player pages use.
  const player = me ? squad.find((p) => nameKey(p.name) === nameKey(me)) : undefined;
  const key = me ? playerKey({ id: '', name: '', players: [] }, me) : '';
  const career = useMemo(() => (key ? careerStats(matches).find((c) => c.key === key) : undefined), [matches, key]);
  const rated = useMemo(() => (key ? playerRatings(matches, key) : null), [matches, key]);
  // Their photo: kept under their email on the live app, so only a squad entry with this account's email can change it
  // from here (the admin links emails in The squad). A copy without the club sync keeps it on the phone.
  const myPhoto = photoFor(photos, me);
  const photoOwner = sync.status === 'unavailable' ? (player ? { name: player.name } : null) : byEmail ? { name: byEmail.name, email: account } : null;
  const changePhoto = async (remove = false) => {
    if (!photoOwner) return;
    try {
      const photo = remove ? null : await pickPhoto();
      if (photo === null && !remove) return;
      await setPhoto(photoOwner, photo);
      toast.show(remove ? 'Photo removed' : 'Photo updated. Everyone in the club sees it.', 'success');
    } catch (e) {
      toast.show(e instanceof Error && e.message.includes('picture') ? e.message : 'Couldn’t save the photo. Try again.', 'error');
    }
  };
  // Signed in as someone the squad knows by name: offer them first.
  const guess = !me && sync.user ? squad.find((p) => nameKey(p.name) === nameKey(sync.user!.name)) : undefined;
  const others = [...squad].sort((a, b) => a.name.localeCompare(b.name));
  // My cricket wears my side's colours, as my player page does.
  const side = teamTheme(career?.team);
  const tone = ownTeamTheme(career?.team) ?? null;

  const accountCard = (
    <Card style={styles.account}>
      <Avatar photo={myPhoto ?? sync.user?.photo} name={sync.user?.name ?? me ?? ''} size={64} />
      <View style={{ flex: 1, minWidth: 0 }}>
        {sync.user ? (
          <>
            <Text style={styles.accountName} numberOfLines={1}>
              {sync.user.name}
            </Text>
            <Text style={styles.note} numberOfLines={1}>
              {sync.user.email}
            </Text>
            <View style={styles.tags}>
              {sync.role ? (
                <Text style={[styles.role, sync.role === 'owner' && styles.roleAdmin]}>{ROLE[sync.role]}</Text>
              ) : (
                <Text style={styles.role}>Not in the club</Text>
              )}
              {sync.status === 'error' ? (
                <Text style={[styles.note, { color: colors.danger }]}>Not synced</Text>
              ) : (
                (sync.status === 'synced' || sync.status === 'syncing') && sync.lastSync && <Text style={styles.note}>Synced</Text>
              )}
            </View>
          </>
        ) : (
          <>
            <Text style={styles.accountName}>{me ?? 'Not signed in'}</Text>
            <Text style={styles.note}>
              {sync.status === 'unavailable' ? 'Club sync runs on the live app.' : 'Sign in to see the club’s matches on every phone.'}
            </Text>
          </>
        )}
      </View>
    </Card>
  );
  const photoActions = photoOwner ? (
    <View style={[styles.row, narrowColumn && styles.stack]}>
      <View style={{ flex: 1 }}>
        <Button variant="ghost" icon="camera-outline" label={myPhoto ? 'Change my photo' : 'Add my photo'} onPress={() => void changePhoto()} />
      </View>
      {myPhoto && (
        <View style={{ flex: 1 }}>
          <Button variant="ghost" icon="close-outline" label="Remove my photo" onPress={() => void changePhoto(true)} />
        </View>
      )}
    </View>
  ) : (
    Boolean(me && sync.user) && <Text style={styles.note}>To set your own photo, ask the admin to add {account} to your name in The squad.</Text>
  );
  const syncActions =
    sync.status !== 'unavailable' &&
    (sync.user ? (
      <View style={[styles.row, narrowColumn && styles.stack]}>
        <View style={{ flex: 1 }}>
          <Button variant="ghost" icon="people-outline" label="Club sync" onPress={() => router.push('/settings')} />
        </View>
        <View style={{ flex: 1 }}>
          <SignOutButton />
        </View>
      </View>
    ) : (
      <Button icon="logo-google" label={sync.status === 'signing-in' ? 'Signing in…' : 'Sign in with Google'} disabled={sync.status === 'signing-in' || sync.status === 'starting'} onPress={() => void sync.signIn()} />
    ));
  const waiting = sync.role === 'owner' && sync.requests.length > 0 && (
    <Card style={styles.waiting}>
      <Text style={styles.body}>
        {sync.requests.length === 1 ? `${sync.requests[0].name} wants` : `${sync.requests.length} people want`} to be an editor.
      </Text>
      <Button icon="people-outline" label="Review" onPress={() => router.push('/settings')} />
    </Card>
  );
  const myCricketLabel = (
    <SectionLabel
      flush={wide}
      right={byEmail && !prefs.me?.[account] ? <Text style={styles.note}>Linked by your email</Text> : <Chip icon="swap-horizontal" label="Not me" onPress={() => choose(null)} />}
    >
      My cricket
    </SectionLabel>
  );
  const heroStats = [
    ['Matches', career?.matches ?? 0],
    ['Runs', career?.batting.runs ?? 0],
    ['Wickets', career?.bowling.wickets ?? 0],
    ['Won', career?.history.filter((h) => h.won === true).length ?? 0],
  ].map(([label, value]) => (
    <View key={label} style={{ flex: 1 }}>
      <Text style={[styles.heroValue, wide && styles.heroValueWide]}>{value}</Text>
      <Text style={styles.heroLabel}>{label}</Text>
    </View>
  ));
  // On a tablet or laptop the hero runs across the page: who they are on the left, the four numbers on the right.
  const heroCard = (
    <LinearGradient colors={side.hero} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={[styles.hero, wide && styles.heroWide]}>
      <PitchStripes tint="255,255,255" />
      {wide && <Avatar photo={myPhoto ?? sync.user?.photo} name={me ?? ''} size={desk ? 96 : 80} />}
      <View style={wide ? { flex: 1, minWidth: 0, gap: space.sm } : { gap: space.sm }}>
        <View style={[styles.heroTop, wide && styles.heroTopWide]}>
          <Text style={[styles.heroTeam, tone && { color: side.accent }]}>{career?.team ?? 'Squad'}</Text>
          {rated?.form != null && (
            <View style={[styles.formPill, rated.form >= 8 && { backgroundColor: tone ? side.accent : hero.accent }]}>
              <Text style={[styles.formText, rated.form >= 8 && { color: side.onAccent }]}>Form {rated.form.toFixed(1)}</Text>
            </View>
          )}
        </View>
        <Text style={[styles.heroName, wide && styles.heroNameWide]} numberOfLines={2}>
          {me}
          {player?.keeper === true ? '  WK' : player?.keeper === 'sometimes' ? '  (WK)' : ''}
        </Text>
      </View>
      <View style={[styles.heroStats, wide && styles.heroStatsWide]}>{heroStats}</View>
    </LinearGradient>
  );
  const ratingsCard = career && rated && rated.history.length > 0 && (
    <Card style={{ gap: space.sm }}>
      <Text style={styles.label}>Match ratings · newest first</Text>
      <RatingChips history={rated.history} />
    </Card>
  );
  const tiles = career && (
    <View style={styles.tiles}>
      {[
        ['Highest', `${career.batting.highest}${career.batting.highestNotOut ? '*' : ''}`],
        ['Average', fmt(battingAverage(career))],
        ['Strike rate', fmt(strikeRate(career), 0)],
        ['Best bowling', bestFigures(career)],
        ['Economy', fmt(economy(career), 2)],
        ['Catches', String(career.fielding.catches)],
      ].map(([label, value]) => (
        <View key={label} style={[styles.tile, tone && { backgroundColor: tone.card, borderColor: tone.line }]}>
          <Text style={[styles.tileValue, desk && styles.tileValueDesk]}>{value}</Text>
          <Text style={styles.tileLabel}>{label}</Text>
        </View>
      ))}
    </View>
  );
  const careerBody = career ? (
    <>
      {ratingsCard}
      {tiles}
      <Button icon="podium-outline" label="My full player page" onPress={() => router.push({ pathname: '/player/[key]', params: { key: career.key } })} />
    </>
  ) : (
    <Card>
      <Text style={styles.note}>No matches yet. Your numbers, ratings and form fill in after your first match.</Text>
    </Card>
  );
  const picker = (
    <>
      <SectionLabel>Who are you in the squad?</SectionLabel>
      <Card style={{ gap: space.md }}>
        {guess && (
          <>
            <Text style={styles.body}>Are you {guess.name}?</Text>
            <Button icon="checkmark" label={`Yes, I’m ${guess.name}`} onPress={() => choose(guess.name)} />
          </>
        )}
        <Text style={styles.note}>Pick yourself to see your own form, ratings and numbers here. It’s kept on this phone.</Text>
        <View style={styles.wrap}>
          {others.map((p) => (
            <Chip key={p.id} label={p.name} onPress={() => choose(p.name)} />
          ))}
        </View>
      </Card>
    </>
  );

  return (
    <PageToneProvider value={tone}>
    <Screen>
      {wide ? (
        // Back, the title and Settings on one line, as on every other page.
        <View style={{ paddingHorizontal: gutter, paddingTop: space.lg }}>
          <Page>
            <WideHead
              title="My profile"
              onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
              right={<IconButton icon="settings-outline" label="Settings" onPress={() => router.push('/settings')} />}
            />
          </Page>
        </View>
      ) : (
        <View style={styles.header}>
          <IconButton icon="chevron-back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
          <IconButton icon="settings-outline" label="Settings" onPress={() => router.push('/settings')} />
        </View>
      )}
      {wide ? (
        // A tablet or laptop: my cricket's hero across the top, then my numbers beside the account, its photo and club
        // sync, rather than one long column.
        <ScrollView contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: insets.bottom + space.xxl }}>
          <Page>
            {me && myCricketLabel}
            {me && heroCard}
            {/* Both columns open on a label, so their first cards start level. */}
            <Columns weights={[3, 2]} gap={space.lg}>
              <View style={{ gap: space.md }}>
                {me ? (
                  <View>
                    <SectionLabel>My numbers</SectionLabel>
                    <View style={{ gap: space.md }}>{careerBody}</View>
                  </View>
                ) : (
                  picker
                )}
              </View>
              <View style={{ gap: space.md }}>
                <View>
                  <SectionLabel>Account</SectionLabel>
                  {accountCard}
                </View>
                {photoActions}
                {syncActions}
                <RequestEditor />
                {waiting}
              </View>
            </Columns>
          </Page>
        </ScrollView>
      ) : (
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: 0, paddingBottom: insets.bottom + space.xxl, gap: space.md }}>
        <Text style={styles.title}>My profile</Text>
        {accountCard}
        {photoActions}
        {syncActions}
        <RequestEditor />
        {waiting}
        {me ? (
          <>
            {myCricketLabel}
            {heroCard}
            {careerBody}
          </>
        ) : (
          picker
        )}
      </ScrollView>
      )}
    </Screen>
    </PageToneProvider>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingVertical: space.sm },
  title: { fontFamily: font.posterBlack, fontSize: 38, lineHeight: 42, color: colors.text, letterSpacing: -1.4 },
  note: { color: colors.muted, fontSize: 13, fontFamily: font.regular, lineHeight: 19 },
  body: { color: colors.text, fontSize: 15, fontFamily: font.semibold },
  label: { ...type.label, color: colors.muted },
  row: { flexDirection: 'row', gap: space.sm },
  stack: { flexDirection: 'column' },
  waiting: { gap: space.sm, borderColor: colors.gold },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  account: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  accountName: { color: colors.text, fontSize: 18, fontFamily: font.bold },
  tags: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: 6 },
  role: { overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: colors.surfaceHi, color: colors.text, fontSize: 12, fontFamily: font.bold },
  roleAdmin: { backgroundColor: colors.accent, color: colors.onAccent },
  hero: { borderRadius: radius.xl, padding: space.xl, overflow: 'hidden', gap: space.sm },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroTeam: { color: hero.muted, fontSize: 12, fontFamily: font.bold, letterSpacing: 1, textTransform: 'uppercase' },
  formPill: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3, backgroundColor: hero.ink(0.12) },
  formText: { color: hero.text, fontSize: 12, fontFamily: font.heavy },
  heroName: { color: hero.text, fontSize: 30, lineHeight: 34, fontFamily: font.posterBlack, letterSpacing: -0.8 },
  heroStats: { flexDirection: 'row', marginTop: space.sm },
  heroWide: { flexDirection: 'row', alignItems: 'center', gap: space.xl, padding: space.xxl, marginBottom: space.sm },
  heroTopWide: { justifyContent: 'flex-start', gap: space.sm },
  heroNameWide: { fontSize: 44, lineHeight: 48, letterSpacing: -1.4 },
  heroStatsWide: { flex: 1, marginTop: 0 },
  heroValueWide: { fontSize: 34 },
  tileValueDesk: { fontSize: 24 },
  heroValue: { color: hero.text, fontSize: 24, fontFamily: font.posterBlack, ...type.num },
  heroLabel: { color: hero.muted, fontSize: 11, fontFamily: font.semibold, textTransform: 'uppercase', letterSpacing: 0.6 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: { width: '31.5%', flexGrow: 1, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: space.md },
  tileValue: { color: colors.text, fontSize: 20, fontFamily: font.posterBlack, ...type.num },
  tileLabel: { color: colors.muted, fontSize: 12, fontFamily: font.medium, marginTop: 2 },
});
