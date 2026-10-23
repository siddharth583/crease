import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, IconButton, Screen, SectionLabel, tap } from '../../components/ui.tsx';
import { cloudConfigured, createClub, findClub, formatCode, normalizeCode } from '../../store/cloud.ts';
import { useMatches, type SyncStatus } from '../../store/matches.tsx';
import { colors, gradients, radius, space, type, font, hero } from '../../theme.ts';

const STATUS: Record<SyncStatus, { label: string; color: string; icon: 'cloud-done' | 'cloud-upload' | 'cloud-offline' | 'warning' | 'cloud' }> = {
  off: { label: 'Not syncing', color: colors.faint, icon: 'cloud' },
  syncing: { label: 'Syncing…', color: colors.cyan, icon: 'cloud-upload' },
  synced: { label: 'Up to date', color: colors.accentInk, icon: 'cloud-done' },
  offline: { label: 'Offline · will sync when you’re back online', color: colors.gold, icon: 'cloud-offline' },
  error: { label: 'Sync problem', color: colors.danger, icon: 'warning' },
};

function confirm(title: string, body: string, onYes: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${body}`)) onYes();
    return;
  }
  Alert.alert(title, body, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Leave', style: 'destructive', onPress: onYes },
  ]);
}

function inviteLink(code: string) {
  return Platform.OS === 'web' && typeof window !== 'undefined' ? `${window.location.origin}/club?code=${code}` : null;
}

function since(ts: number | null) {
  if (!ts) return 'never';
  const s = Math.round((Date.now() - ts) / 1000);
  return s < 10 ? 'just now' : s < 60 ? `${s}s ago` : `${Math.round(s / 60)} min ago`;
}

export default function ClubScreen() {
  const params = useLocalSearchParams<{ code?: string }>();
  const insets = useSafeAreaInsets();
  const { club, sync, joinClub, leaveClub, syncNow, matches } = useMatches();
  const [name, setName] = useState('');
  const [code, setCode] = useState(params.code ? formatCode(normalizeCode(params.code)) : '');
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const run = async (kind: 'create' | 'join') => {
    setBusy(kind);
    setProblem(null);
    try {
      const found = kind === 'create' ? await createClub(name.trim()) : await findClub(code);
      if (!found) {
        setProblem('No club has that code. Check it with whoever shared it.');
        return;
      }
      tap('success');
      joinClub(found);
    } catch (e) {
      setProblem(e instanceof TypeError ? 'You’re offline. Connect to the internet and try again.' : 'Something went wrong. Try again.');
    } finally {
      setBusy(null);
    }
  };

  const copy = async () => {
    if (!club) return;
    await Clipboard.setStringAsync(inviteLink(club.code) ?? formatCode(club.code));
    tap('success');
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const share = () => {
    if (!club) return;
    const link = inviteLink(club.code);
    const message = `Join ${club.name} on Crease to see our scores and player stats.\nClub code: ${formatCode(club.code)}${link ? `\n${link}` : ''}`;
    Share.share({ message }).catch(() => copy());
  };

  const status = STATUS[sync.status];

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>CLUB</Text>
      </View>
      <ScrollView
        contentContainerStyle={{ padding: space.lg, paddingTop: space.sm, paddingBottom: 130 }}
        keyboardShouldPersistTaps="handled"
      >
        {!cloudConfigured ? (
          <Card style={{ gap: space.sm }}>
            <Ionicons name="cloud-offline" size={28} color={colors.faint} />
            <Text style={styles.cardTitle}>Sharing isn’t set up on this copy</Text>
            <Text style={styles.body}>
              Your matches and stats are saved on this phone. Share them with match files from the Matches tab, or connect
              this copy of Crease to a club database to sync automatically (see the README).
            </Text>
          </Card>
        ) : club ? (
          <>
            <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
              <View style={styles.heroGlow} />
              <Text style={styles.eyebrow}>YOUR CLUB</Text>
              <Text style={styles.clubName}>{club.name}</Text>
              <Text style={styles.body}>Everyone with this code scores into the same matches and player stats.</Text>
              <View style={styles.codeBox}>
                <Text style={styles.code} selectable>
                  {formatCode(club.code)}
                </Text>
                <IconButton icon={copied ? 'checkmark' : 'copy-outline'} label="Copy invite" tint={copied ? colors.accent : hero.text} onPress={copy} />
              </View>
              <Button label="Invite players" icon="share-social" onPress={share} style={{ marginTop: space.md }} />
            </LinearGradient>

            <SectionLabel>Sync</SectionLabel>
            <Card style={{ gap: space.md }}>
              <View style={styles.statusRow}>
                {sync.status === 'syncing' ? (
                  <ActivityIndicator color={status.color} />
                ) : (
                  <Ionicons name={status.icon} size={22} color={status.color} />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                  <Text style={styles.small}>
                    Last synced {since(sync.lastSynced)}
                    {sync.pending ? ` · ${sync.pending} change${sync.pending === 1 ? '' : 's'} waiting` : ''}
                  </Text>
                </View>
              </View>
              {sync.status === 'error' && sync.error && <Text style={styles.small}>{sync.error}</Text>}
              <Button variant="ghost" icon="refresh" label="Sync now" onPress={syncNow} />
            </Card>
            <Text style={styles.note}>
              {matches.length} match{matches.length === 1 ? '' : 'es'} on this phone. Scores sync every few seconds while
              the app is open, and anything scored offline goes up once you’re back online.
            </Text>

            <Button
              variant="ghost"
              icon="exit-outline"
              label="Leave club"
              style={{ marginTop: space.xl }}
              onPress={() =>
                confirm('Leave this club?', 'Matches already on this phone stay here, but they stop syncing.', leaveClub)
              }
            />
          </>
        ) : (
          <>
            <Text style={styles.intro}>
              Share one club between all your players: everyone sees the same matches, and every phone carries the same
              player stats.
            </Text>

            <SectionLabel>Join a club</SectionLabel>
            <Card style={{ gap: space.md }}>
              <TextInput
                value={code}
                onChangeText={(v) => {
                  const clean = normalizeCode(v).slice(0, 8);
                  setCode(clean.length > 4 ? formatCode(clean) : clean);
                }}
                placeholder="ABCD-2345"
                placeholderTextColor={colors.faint}
                autoCapitalize="characters"
                autoCorrect={false}
                style={[styles.input, styles.codeInput]}
              />
              <Button
                label={busy === 'join' ? 'Joining…' : 'Join club'}
                icon="enter-outline"
                disabled={normalizeCode(code).length !== 8 || busy !== null}
                onPress={() => run('join')}
              />
            </Card>

            <SectionLabel>Or start one</SectionLabel>
            <Card style={{ gap: space.md }}>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Club name, e.g. Sunday XI"
                placeholderTextColor={colors.faint}
                maxLength={40}
                autoCapitalize="words"
                style={styles.input}
              />
              <Button
                variant="ghost"
                label={busy === 'create' ? 'Creating…' : 'Create club'}
                icon="add-circle-outline"
                disabled={!name.trim() || busy !== null}
                onPress={() => run('create')}
              />
            </Card>

            {problem && (
              <View style={styles.problem}>
                <Ionicons name="alert-circle" size={18} color={colors.danger} />
                <Text style={styles.problemText}>{problem}</Text>
              </View>
            )}
            {matches.length > 0 && (
              <Text style={styles.note}>
                The {matches.length} match{matches.length === 1 ? '' : 'es'} on this phone will be added to the club.
              </Text>
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingVertical: space.sm },
  headerTitle: { fontFamily: font.posterBlack, fontSize: 54, lineHeight: 54, color: colors.text, letterSpacing: -1 },
  cardTitle: { color: colors.text, fontSize: 17, fontFamily: font.bold },
  body: { color: colors.muted, fontSize: 14, fontFamily: font.regular, lineHeight: 20 },
  intro: { color: colors.muted, fontSize: 15, fontFamily: font.regular, lineHeight: 22, paddingHorizontal: space.xs },
  hero: { borderRadius: radius.xl, padding: space.xl, overflow: 'hidden', borderWidth: 1, borderColor: hero.line, gap: space.sm },
  heroGlow: { position: 'absolute', right: -70, top: -80, width: 220, height: 220, borderRadius: 110, backgroundColor: colors.accentDim },
  eyebrow: { ...type.label, color: hero.accent },
  clubName: { fontFamily: font.posterBlack, fontSize: 48, lineHeight: 48, color: hero.text, textTransform: 'uppercase' },
  codeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.inset,
    borderRadius: radius.md,
    paddingLeft: space.lg,
    paddingRight: space.sm,
    paddingVertical: space.sm,
    marginTop: space.sm,
  },
  code: { color: hero.accent, fontSize: 38, fontFamily: font.posterBlack, letterSpacing: 3, ...type.num },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  statusText: { fontSize: 15, fontFamily: font.bold },
  small: { color: colors.muted, fontSize: 12, fontFamily: font.regular, marginTop: 2 },
  note: { color: colors.faint, fontSize: 13, fontFamily: font.regular, lineHeight: 19, marginTop: space.md, paddingHorizontal: space.xs },
  input: {
    color: colors.text,
    fontSize: 16, fontFamily: font.regular,
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: space.md,
    height: 48,
  },
  codeInput: { fontSize: 22, fontFamily: font.heavy, letterSpacing: 3, textAlign: 'center' },
  problem: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.lg, paddingHorizontal: space.xs },
  problemText: { color: colors.danger, fontSize: 14, fontFamily: font.regular, flex: 1 },
});
