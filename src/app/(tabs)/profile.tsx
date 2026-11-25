import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BigHits } from '../../components/BigHits.tsx';
import { Avatar } from '../../components/Avatar.tsx';
import { Columns, Page, useLayout } from '../../components/layout.tsx';
import { RatingChips } from '../../components/Ratings.tsx';
import { Button, Card, Chip, PageToneProvider, PitchStripes, PressableScale, Screen, SectionLabel, useToast, WideHead } from '../../components/ui.tsx';
import { playerRatings } from '../../engine/ratings.ts';
import { bigHits, matchups } from '../../engine/records.ts';
import { battingAverage, bestFigures, careerStats, economy, playerKey, strikeRate } from '../../engine/stats.ts';
import { playerForEmail } from '../../engine/squad.ts';
import { photoFor } from '../../engine/photos.ts';
import { nameKey } from '../../engine/teams.ts';
import { useMatches } from '../../store/matches.tsx';
import { usePrefs } from '../../store/prefs.ts';
import { useSquad } from '../../store/squad.ts';
import { OvalGround, Stagger } from '../../components/cricket.tsx';
import { CountUp } from '../../components/motion.tsx';
import { TeamCrest } from '../../components/TeamCrest.tsx';
import { RequestEditor, RoleChip, SignOutButton, SyncLine } from '../../components/ClubSync.tsx';
import { useClubSync, usePhotos, useSetPhoto } from '../../store/sync.tsx';
import { pickPhoto } from '../../store/files.ts';
import { colors, edge, font, gradients, hero, ownTeamTheme, radius, space, teamTheme, type } from '../../theme.ts';

// My profile: who's signed in and what they can do in the club, and their own cricket once they say which squad
// player they are. That choice is kept on this phone, for each account.

const fmt = (n: number | null, digits = 1) => (n === null ? '–' : n.toFixed(digits));
export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { wide, desk, gutter } = useLayout();
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
  const hits = useMemo(() => (key ? bigHits(matchups(matches), key) : []), [matches, key, squad]);
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

  const [query, setQuery] = useState('');
  const shown = others.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()));
  const noSync = sync.status === 'unavailable';

  const accountCard = (
    <Card style={{ gap: space.md }}>
      <View style={styles.account}>
        <Avatar photo={myPhoto ?? sync.user?.photo} name={sync.user?.name ?? me ?? ''} size={52} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.accountName} numberOfLines={1}>
            {sync.user ? sync.user.name : me ?? 'Not signed in'}
          </Text>
          {sync.user && (
            <Text style={styles.note} numberOfLines={1}>
              {sync.user.email}
            </Text>
          )}
        </View>
        {sync.user && <RoleChip role={sync.role} />}
      </View>
      <SyncLine />
      {sync.role === 'owner' && <Text style={styles.note}>You’re the admin: you manage the squad, the sides and who can edit.</Text>}
      {sync.role === 'scorer' && <Text style={styles.note}>You’re an editor: you can start and score matches for everyone.</Text>}
      {sync.role === 'viewer' && <Text style={styles.note}>You’re a viewer: you can watch and export everything.</Text>}
      {!noSync &&
        (sync.user ? (
          <SignOutButton />
        ) : (
          <Button icon="logo-google" label={sync.status === 'signing-in' ? 'Signing in…' : 'Sign in with Google'} disabled={sync.status === 'signing-in' || sync.status === 'starting'} onPress={() => void sync.signIn()} />
        ))}
      <RequestEditor />
    </Card>
  );
  const waiting = sync.role === 'owner' && sync.requests.length > 0 && (
    <Card style={styles.waiting}>
      <Text style={styles.body}>
        {sync.requests.length === 1 ? `${sync.requests[0].name} wants` : `${sync.requests.length} people want`} to be an editor.
      </Text>
      <Button icon="people-outline" label="Review" onPress={() => router.push('/settings')} />
    </Card>
  );
  const settingsButton = (
    <PressableScale accessibilityLabel="Settings" onPress={() => router.push('/settings')} scaleTo={0.97} style={styles.settingsCard}>
      <View style={styles.settingsIcon}>
        <Ionicons name="settings-outline" size={22} color={colors.accentInk} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.body}>Settings</Text>
        <Text style={styles.note}>Day or night look, backups, club sync, export</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </PressableScale>
  );
  const myCricketLabel = (
    <SectionLabel
      flush={wide}
      right={byEmail && !prefs.me?.[account] ? <Text style={styles.note}>Linked by your email</Text> : undefined}
    >
      My cricket
    </SectionLabel>
  );
  const heroStats: [string, number][] = [
    ['Matches', career?.matches ?? 0],
    ['Runs', career?.batting.runs ?? 0],
    ['Wickets', career?.bowling.wickets ?? 0],
    ['Won', career?.history.filter((h) => h.won === true).length ?? 0],
  ];
  const photoBadge = photoOwner ? (
    <PressableScale accessibilityLabel={myPhoto ? 'Change my photo' : 'Add my photo'} onPress={() => void changePhoto()} scaleTo={0.9} style={styles.camera}>
      <Ionicons name="camera" size={15} color={colors.onAccent} />
    </PressableScale>
  ) : null;
  // The player card: photo, name, side, role, form, and the four numbers that matter.
  const heroCard = (
    <View style={[styles.hero, wide && styles.heroWide]}>
      <LinearGradient colors={side.hero} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
      <PitchStripes tint="255,255,255" />
      <OvalGround opacity={0.08} />
      <View style={styles.heroTopRow}>
        <View>
          <Avatar photo={myPhoto ?? sync.user?.photo} name={me ?? ''} size={desk ? 104 : 88} />
          {photoBadge}
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <View style={styles.teamRow}>
            {career?.team ? <TeamCrest name={career.team} size={22} /> : null}
            <Text style={[styles.heroTeam, tone && { color: side.accent }]} numberOfLines={1}>{career?.team ?? 'Squad'}</Text>
          </View>
          <Text style={[styles.heroName, wide && styles.heroNameWide]} numberOfLines={2}>
            {me}
          </Text>
          <View style={styles.teamRow}>
            {player?.keeper ? (
              <View style={styles.rolePill}>
                <Ionicons name="hand-left-outline" size={12} color={hero.text} />
                <Text style={styles.rolePillText}>{player.keeper === true ? 'Wicketkeeper' : 'Sometimes keeps'}</Text>
              </View>
            ) : null}
            {rated?.form != null && (
              <View style={[styles.formPill, rated.form >= 8 && { backgroundColor: tone ? side.accent : hero.accent }]}>
                <Ionicons name="flame" size={12} color={rated.form >= 8 ? side.onAccent : hero.text} />
                <Text style={[styles.formText, rated.form >= 8 && { color: side.onAccent }]}>Form {rated.form.toFixed(1)}</Text>
              </View>
            )}
          </View>
        </View>
      </View>
      <View style={styles.photoRow}>
        {photoOwner ? (
          <>
            <PressableScale accessibilityLabel={myPhoto ? 'Change my photo' : 'Add my photo'} onPress={() => void changePhoto()} style={styles.photoBtn}>
              <Ionicons name="camera-outline" size={16} color={hero.text} />
              <Text style={styles.photoBtnText}>{myPhoto ? 'Change photo' : 'Add photo'}</Text>
            </PressableScale>
            {myPhoto ? (
              <PressableScale accessibilityLabel="Remove my photo" onPress={() => void changePhoto(true)} style={styles.photoBtn}>
                <Ionicons name="close-outline" size={16} color={hero.text} />
                <Text style={styles.photoBtnText}>Remove</Text>
              </PressableScale>
            ) : null}
          </>
        ) : Boolean(me && sync.user) ? (
          <Text style={styles.heroNote}>To set your photo, ask the admin to add {account} to your name in The squad.</Text>
        ) : null}
      </View>
      <View style={styles.heroStats}>
        {heroStats.map(([label, value], i) => (
          <View key={label} style={styles.heroStat}>
            <CountUp value={value} delay={200 + i * 120} style={[styles.heroValue, wide && styles.heroValueWide]} />
            <Text style={styles.heroLabel}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
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
        ['Highest', `${career.batting.highest}${career.batting.highestNotOut ? '*' : ''}`, 'runs'],
        ['Average', fmt(battingAverage(career)), 'runs per dismissal'],
        ['Strike rate', fmt(strikeRate(career), 0), 'runs per 100 balls'],
        ['Best bowling', bestFigures(career), 'wickets/runs'],
        ['Economy', fmt(economy(career), 2), 'runs an over'],
        ['Catches', String(career.fielding.catches), 'taken'],
      ].map(([label, value, unit]) => (
        <View key={label} style={[styles.tile, tone && { backgroundColor: tone.card, borderColor: tone.line }]}>
          <Text style={[styles.tileValue, desk && styles.tileValueDesk]}>{value}</Text>
          <Text style={styles.tileLabel}>{label}</Text>
          <Text style={styles.tileUnit}>{unit}</Text>
        </View>
      ))}
    </View>
  );
  const careerBody = career ? (
    <>
      {ratingsCard}
      {tiles}
      <BigHits hits={hits} first={(me ?? '').split(' ')[0]} limit={3} />
      <Button icon="podium-outline" label="My full player page" onPress={() => router.push({ pathname: '/player/[key]', params: { key: career.key } })} />
    </>
  ) : (
    <Card>
      <Text style={styles.note}>No matches yet. Your numbers, ratings and form fill in after your first match.</Text>
    </Card>
  );
  // First run: say who you are with one tap.
  const picker = (
    <View style={styles.firstRun}>
      <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} />
      <OvalGround opacity={0.08} />
      <Text style={styles.heroTeam}>Welcome</Text>
      <Text style={styles.pickTitle}>Who are you?</Text>
      <Text style={styles.heroNote}>Tap your name to see your own form, ratings and numbers here. It’s kept on this phone.</Text>
      {guess && (
        <Button icon="checkmark" label={`Yes, I’m ${guess.name}`} onPress={() => choose(guess.name)} />
      )}
      <View style={styles.search}>
        <Ionicons name="search" size={16} color={colors.muted} />
        <TextInput value={query} onChangeText={setQuery} placeholder="Search the squad" placeholderTextColor={colors.faint} accessibilityLabel="Search the squad" style={styles.searchInput} />
      </View>
      <View style={styles.wrap}>
        {shown.map((p) => (
          <PressableScale key={p.id} accessibilityLabel={p.name} onPress={() => choose(p.name)} scaleTo={0.94} style={styles.nameChip}>
            <Avatar photo={photoFor(photos, p.name)} name={p.name} size={28} />
            <Text style={styles.nameChipText}>{p.name}</Text>
          </PressableScale>
        ))}
        {!shown.length && <Text style={styles.heroNote}>No one in the squad matches that.</Text>}
      </View>
    </View>
  );

  const dockPad = wide ? insets.bottom + space.xxl : 130;
  return (
    <PageToneProvider value={tone}>
    <Screen>
      {wide ? (
        <View style={{ paddingHorizontal: gutter, paddingTop: space.lg }}>
          <Page>
            <WideHead title="Me" right={<Button variant="ghost" icon="settings-outline" label="Settings" onPress={() => router.push('/settings')} />} />
          </Page>
        </View>
      ) : (
        <View style={styles.header}>
          <Text style={styles.title}>Me</Text>
          <Chip icon="settings-outline" label="Settings" onPress={() => router.push('/settings')} />
        </View>
      )}
      {wide ? (
        <ScrollView contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: dockPad }}>
          <Page>
            <Stagger step={80}>
              {[
                me ? (
                  <View key="h">
                    {myCricketLabel}
                    {heroCard}
                  </View>
                ) : (
                  <View key="p">{picker}</View>
                ),
                <Columns key="c" weights={[3, 2]} gap={space.lg}>
                  <View style={{ gap: space.md }}>
                    {me ? (
                      <View>
                        <SectionLabel>My numbers</SectionLabel>
                        <View style={{ gap: space.md }}>{careerBody}</View>
                      </View>
                    ) : null}
                  </View>
                  <View style={{ gap: space.md }}>
                    <View>
                      <SectionLabel>Account</SectionLabel>
                      {accountCard}
                    </View>
                    {waiting}
                    {settingsButton}
                  </View>
                </Columns>,
              ]}
            </Stagger>
          </Page>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: 0, paddingBottom: dockPad }}>
          <Stagger step={80} style={{ gap: space.md }}>
            {[
              me ? <View key="h">{heroCard}</View> : <View key="p">{picker}</View>,
              me ? <View key="m" style={{ gap: space.md }}>{myCricketLabel}{careerBody}</View> : <View key="e" />,
              <View key="a"><SectionLabel>Account</SectionLabel>{accountCard}</View>,
              <View key="w" style={{ gap: space.md }}>{waiting}{settingsButton}</View>,
            ]}
          </Stagger>
        </ScrollView>
      )}
    </Screen>
    </PageToneProvider>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingVertical: space.sm },
  title: { fontFamily: font.posterBlack, fontSize: 38, lineHeight: 42, color: colors.text, letterSpacing: -1.4 },
  note: { color: colors.muted, fontSize: 13, fontFamily: font.regular, lineHeight: 19 },
  body: { color: colors.text, fontSize: 15, fontFamily: font.semibold },
  label: { ...type.label, color: colors.muted },
  waiting: { gap: space.sm, borderColor: colors.gold },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  account: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  accountName: { color: colors.text, fontSize: 17, fontFamily: font.bold },
  settingsCard: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderHi, ...edge },
  settingsIcon: { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.accentDim, alignItems: 'center', justifyContent: 'center' },
  hero: { borderRadius: radius.xl, padding: space.xl, overflow: 'hidden', gap: space.md, borderWidth: 1, borderColor: colors.borderHi },
  heroWide: { padding: space.xxl, marginBottom: space.sm },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  camera: { position: 'absolute', right: -2, bottom: -2, width: 30, height: 30, borderRadius: 15, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#0D2418' },
  teamRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  heroTeam: { color: hero.muted, fontSize: 12, fontFamily: font.bold, letterSpacing: 1, textTransform: 'uppercase' },
  heroName: { color: hero.text, fontSize: 30, lineHeight: 34, fontFamily: font.posterBlack, letterSpacing: -0.8 },
  heroNameWide: { fontSize: 44, lineHeight: 48, letterSpacing: -1.4 },
  rolePill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3, backgroundColor: hero.ink(0.12) },
  rolePillText: { color: hero.text, fontSize: 12, fontFamily: font.bold },
  formPill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3, backgroundColor: hero.ink(0.12) },
  formText: { color: hero.text, fontSize: 12, fontFamily: font.heavy },
  photoRow: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  photoBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: hero.ink(0.12), borderWidth: 1, borderColor: hero.ink(0.18) },
  photoBtnText: { color: hero.text, fontSize: 13, fontFamily: font.bold },
  heroNote: { color: hero.muted, fontSize: 13, fontFamily: font.regular, lineHeight: 19 },
  heroStats: { flexDirection: 'row', marginTop: space.sm, paddingTop: space.md, borderTopWidth: 1, borderTopColor: hero.ink(0.12) },
  heroStat: { flex: 1 },
  heroValue: { color: hero.text, fontSize: 28, fontFamily: font.posterBlack, ...type.num },
  heroValueWide: { fontSize: 38 },
  heroLabel: { color: hero.muted, fontSize: 11, fontFamily: font.semibold, textTransform: 'uppercase', letterSpacing: 0.6 },
  firstRun: { borderRadius: radius.xl, padding: space.xl, overflow: 'hidden', gap: space.md, borderWidth: 1, borderColor: colors.borderHi },
  pickTitle: { color: hero.text, fontSize: 36, lineHeight: 40, fontFamily: font.posterBlack, letterSpacing: -1 },
  search: { flexDirection: 'row', alignItems: 'center', gap: space.sm, height: 46, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: hero.inset, borderWidth: 1, borderColor: hero.ink(0.14) },
  searchInput: { flex: 1, color: hero.text, fontSize: 15, fontFamily: font.regular, height: 44 },
  nameChip: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 48, paddingLeft: 10, paddingRight: space.lg, borderRadius: radius.pill, backgroundColor: hero.ink(0.1), borderWidth: 1, borderColor: hero.ink(0.16) },
  nameChipText: { color: hero.text, fontSize: 15, fontFamily: font.bold },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: { width: '31.5%', flexGrow: 1, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: space.md, ...edge },
  tileValue: { color: colors.text, fontSize: 22, fontFamily: font.posterBlack, ...type.num },
  tileValueDesk: { fontSize: 26 },
  tileLabel: { color: colors.text, fontSize: 12, fontFamily: font.semibold, marginTop: 2 },
  tileUnit: { color: colors.faint, fontSize: 11, fontFamily: font.regular },
});
