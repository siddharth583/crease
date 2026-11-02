import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '../components/Avatar.tsx';
import { RatingChips } from '../components/Ratings.tsx';
import { Button, Card, Chip, IconButton, PitchStripes, Screen, SectionLabel } from '../components/ui.tsx';
import { playerRatings } from '../engine/ratings.ts';
import { battingAverage, bestFigures, careerStats, economy, playerKey, strikeRate } from '../engine/stats.ts';
import { playerForEmail } from '../engine/squad.ts';
import { photoFor } from '../engine/photos.ts';
import { nameKey } from '../engine/teams.ts';
import { useMatches } from '../store/matches.tsx';
import { usePrefs } from '../store/prefs.ts';
import { useSquad } from '../store/squad.ts';
import { ROLE, RequestEditor } from '../components/ClubSync.tsx';
import { useClubSync } from '../store/sync.tsx';
import { colors, font, gradients, hero, radius, space, type } from '../theme.ts';

// My profile: who's signed in and what they can do in the club, and their own cricket once they say which squad
// player they are. That choice is kept on this phone, for each account.

const fmt = (n: number | null, digits = 1) => (n === null ? '–' : n.toFixed(digits));
export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { matches } = useMatches();
  const { squad, photos } = useSquad();
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
  // Signed in as someone the squad knows by name: offer them first.
  const guess = !me && sync.user ? squad.find((p) => nameKey(p.name) === nameKey(sync.user!.name)) : undefined;
  const others = [...squad].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Screen>
      <View style={styles.header}>
        <IconButton icon="chevron-back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        <IconButton icon="settings-outline" label="Settings" onPress={() => router.push('/settings')} />
      </View>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: 0, paddingBottom: insets.bottom + space.xxl, gap: space.md }}>
        <Text style={styles.title}>My profile</Text>

        <Card style={styles.account}>
          <Avatar photo={photoFor(photos, me) ?? sync.user?.photo} name={sync.user?.name ?? me ?? ''} size={64} />
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
                  {sync.lastSync && <Text style={styles.note}>Synced</Text>}
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
        {sync.status !== 'unavailable' &&
          (sync.user ? (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Button variant="ghost" icon="people-outline" label="Club sync" onPress={() => router.push('/settings')} />
              </View>
              <View style={{ flex: 1 }}>
                <Button variant="ghost" icon="log-out-outline" label="Sign out" onPress={() => void sync.signOut()} />
              </View>
            </View>
          ) : (
            <Button icon="logo-google" label={sync.status === 'signing-in' ? 'Signing in…' : 'Sign in with Google'} disabled={sync.status === 'signing-in' || sync.status === 'starting'} onPress={() => void sync.signIn()} />
          ))}
        <RequestEditor />
        {sync.role === 'owner' && sync.requests.length > 0 && (
          <Card style={styles.waiting}>
            <Text style={styles.body}>
              {sync.requests.length === 1 ? `${sync.requests[0].name} wants` : `${sync.requests.length} people want`} to be an editor.
            </Text>
            <Button icon="people-outline" label="Review" onPress={() => router.push('/settings')} />
          </Card>
        )}

        {me ? (
          <>
            <SectionLabel
              right={byEmail && !prefs.me?.[account] ? <Text style={styles.note}>Linked by your email</Text> : <Chip icon="swap-horizontal" label="Not me" onPress={() => choose(null)} />}
            >
              My cricket
            </SectionLabel>
            <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.hero}>
              <PitchStripes tint="255,255,255" />
              <View style={styles.heroTop}>
                <Text style={styles.heroTeam}>{career?.team ?? 'Squad'}</Text>
                {rated?.form != null && (
                  <View style={[styles.formPill, rated.form >= 8 && { backgroundColor: hero.accent }]}>
                    <Text style={[styles.formText, rated.form >= 8 && { color: colors.onAccent }]}>Form {rated.form.toFixed(1)}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.heroName} numberOfLines={2}>
                {me}
                {player?.keeper === true ? '  WK' : player?.keeper === 'sometimes' ? '  (WK)' : ''}
              </Text>
              <View style={styles.heroStats}>
                {[
                  ['Matches', career?.matches ?? 0],
                  ['Runs', career?.batting.runs ?? 0],
                  ['Wickets', career?.bowling.wickets ?? 0],
                  ['Won', career?.history.filter((h) => h.won === true).length ?? 0],
                ].map(([label, value]) => (
                  <View key={label} style={{ flex: 1 }}>
                    <Text style={styles.heroValue}>{value}</Text>
                    <Text style={styles.heroLabel}>{label}</Text>
                  </View>
                ))}
              </View>
            </LinearGradient>

            {career ? (
              <>
                {rated && rated.history.length > 0 && (
                  <Card style={{ gap: space.sm }}>
                    <Text style={styles.label}>Match ratings · newest first</Text>
                    <RatingChips history={rated.history} />
                  </Card>
                )}
                <View style={styles.tiles}>
                  {[
                    ['Highest', `${career.batting.highest}${career.batting.highestNotOut ? '*' : ''}`],
                    ['Average', fmt(battingAverage(career))],
                    ['Strike rate', fmt(strikeRate(career), 0)],
                    ['Best bowling', bestFigures(career)],
                    ['Economy', fmt(economy(career), 2)],
                    ['Catches', String(career.fielding.catches)],
                  ].map(([label, value]) => (
                    <View key={label} style={styles.tile}>
                      <Text style={styles.tileValue}>{value}</Text>
                      <Text style={styles.tileLabel}>{label}</Text>
                    </View>
                  ))}
                </View>
                <Button icon="podium-outline" label="My full player page" onPress={() => router.push({ pathname: '/player/[key]', params: { key: career.key } })} />
              </>
            ) : (
              <Card>
                <Text style={styles.note}>No matches yet. Your numbers, ratings and form fill in after your first match.</Text>
              </Card>
            )}
          </>
        ) : (
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
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingVertical: space.sm },
  title: { fontFamily: font.posterBlack, fontSize: 38, lineHeight: 42, color: colors.text, letterSpacing: -1.4 },
  note: { color: colors.muted, fontSize: 13, fontFamily: font.regular, lineHeight: 19 },
  body: { color: colors.text, fontSize: 15, fontFamily: font.semibold },
  label: { ...type.label, color: colors.muted },
  row: { flexDirection: 'row', gap: space.sm },
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
  heroValue: { color: hero.text, fontSize: 24, fontFamily: font.posterBlack, ...type.num },
  heroLabel: { color: hero.muted, fontSize: 11, fontFamily: font.semibold, textTransform: 'uppercase', letterSpacing: 0.6 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: { width: '31.5%', flexGrow: 1, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: space.md },
  tileValue: { color: colors.text, fontSize: 20, fontFamily: font.posterBlack, ...type.num },
  tileLabel: { color: colors.muted, fontSize: 12, fontFamily: font.medium, marginTop: 2 },
});
