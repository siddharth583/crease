import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { CLUB_DOMAIN, CLUB_OWNER, LIVE_HOST, useClubSync, type ClubRole } from '../store/sync.tsx';
import { colors, font, radius, space } from '../theme.ts';
import { Button, Card, Chip, SectionLabel, Segmented } from './ui.tsx';

// Settings › Club sync: sign in, what this phone can do in the club, when it last synced; the admin's members list.

const ROLE: Record<ClubRole, string> = { owner: 'Admin', scorer: 'Scorer', viewer: 'Viewer' };

/** "just now", "4 min ago", "2 h ago": refreshed every half minute. */
function useAgo(at: number | null) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  if (!at) return null;
  const min = Math.floor((now - at) / 60_000);
  return min < 1 ? 'just now' : min < 60 ? `${min} min ago` : `${Math.floor(min / 60)} h ago`;
}

function Members() {
  const { members, setMember } = useClubSync();
  const [email, setEmail] = useState('');
  const [as, setAs] = useState<'scorer' | 'viewer'>('scorer');
  const [busy, setBusy] = useState(false);
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const list = Object.entries(members).sort(([a], [b]) => a.localeCompare(b));
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <SectionLabel right={<Text style={styles.count}>{list.length}</Text>}>Members</SectionLabel>
      <Card style={{ gap: space.md }}>
        <Text style={styles.note}>
          Everyone with a {CLUB_DOMAIN} Google account can already see and export everything. Add people here to let them
          score (or to let someone outside {CLUB_DOMAIN} view).
        </Text>
        {list.map(([who, role]) => (
          <View key={who} style={styles.member}>
            <Text style={styles.memberEmail} numberOfLines={1}>
              {who}
            </Text>
            <View style={styles.memberRow}>
              <View style={{ flex: 1 }}>
                <Segmented
                  value={role}
                  onChange={(r) => void run(() => setMember(who, r))}
                  options={[
                    { value: 'scorer', label: 'Scorer' },
                    { value: 'viewer', label: 'Viewer' },
                  ]}
                />
              </View>
              <Chip icon="close" tone="danger" label="Remove" disabled={busy} onPress={() => void run(() => setMember(who, null))} />
            </View>
          </View>
        ))}
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Their Google email"
          placeholderTextColor={colors.faint}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          style={styles.input}
        />
        <Segmented
          value={as}
          onChange={setAs}
          options={[
            { value: 'scorer', label: 'Can score' },
            { value: 'viewer', label: 'Can view' },
          ]}
        />
        <Button
          variant="ghost"
          icon="person-add-outline"
          label="Add to the club"
          disabled={!valid || busy}
          onPress={() =>
            void run(async () => {
              await setMember(email, as);
              setEmail('');
            })
          }
        />
      </Card>
    </>
  );
}

export function ClubSyncSettings() {
  const { status, user, role, lastSync, error, signIn, signOut } = useClubSync();
  const ago = useAgo(lastSync);
  if (status === 'unavailable') {
    return (
      <>
        <SectionLabel>Club sync</SectionLabel>
        <Card>
          <Text style={styles.note}>
            {Platform.OS === 'web'
              ? `Club sync is off on this copy of the app, so test matches never reach the club. It runs on ${LIVE_HOST}/crease.`
              : `Club sync works in the web app: open ${LIVE_HOST}/crease and sign in there.`}
          </Text>
        </Card>
      </>
    );
  }
  const inClub = Boolean(role) && status !== 'not-member';
  return (
    <>
      <SectionLabel right={inClub ? <Text style={[styles.count, status === 'error' && { color: colors.danger }]}>{status === 'error' ? 'Not synced' : ago ? `Synced ${ago}` : 'Syncing…'}</Text> : undefined}>
        Club sync
      </SectionLabel>
      <Card style={{ gap: space.md }}>
        {!user ? (
          <>
            <Text style={styles.body}>
              Sign in to share everything with the club: every match, record, rating and form, the squad, sides and line-ups,
              on every phone, live.
            </Text>
            <Button icon="logo-google" label={status === 'signing-in' ? 'Signing in…' : 'Sign in with Google'} disabled={status === 'signing-in' || status === 'starting'} onPress={() => void signIn()} />
            <Text style={styles.note}>Everything stays on this phone too, so scoring works with no signal and catches up later.</Text>
          </>
        ) : (
          <>
            <View style={styles.who}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.name} numberOfLines={1}>
                  {user.name}
                </Text>
                <Text style={styles.note} numberOfLines={1}>
                  {user.email}
                </Text>
              </View>
              {role && <Text style={[styles.role, role === 'owner' && styles.roleAdmin]}>{ROLE[role]}</Text>}
            </View>
            {status === 'not-member' ? (
              <Text style={styles.body}>
                This account isn’t in the club. Sign in with your {CLUB_DOMAIN} account, or ask the admin ({CLUB_OWNER}) to add
                this one.
              </Text>
            ) : role === 'viewer' ? (
              <Text style={styles.note}>
                You can see and export every match, record and rating, live. To score for the club, ask the admin to make you a
                scorer; anything you score meanwhile stays on this phone.
              </Text>
            ) : role ? (
              <Text style={styles.note}>
                Everything you score or change here goes to the club straight away, and theirs comes here. When two phones change
                the same match, the later save wins.
              </Text>
            ) : (
              <Text style={styles.note}>Checking the club…</Text>
            )}
            {error && <Text style={styles.error}>{error}</Text>}
            <Button variant="ghost" icon="log-out-outline" label="Sign out" onPress={() => void signOut()} />
          </>
        )}
      </Card>
      {role === 'owner' && <Members />}
    </>
  );
}

const styles = StyleSheet.create({
  count: { color: colors.faint, fontSize: 12, fontFamily: font.semibold },
  note: { color: colors.muted, fontSize: 13, fontFamily: font.regular, lineHeight: 19 },
  body: { color: colors.text, fontSize: 14, fontFamily: font.medium, lineHeight: 20 },
  error: { color: colors.danger, fontSize: 13, fontFamily: font.semibold, lineHeight: 19 },
  who: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  name: { color: colors.text, fontSize: 16, fontFamily: font.bold },
  role: { overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.surfaceHi, color: colors.text, fontSize: 12, fontFamily: font.bold },
  roleAdmin: { backgroundColor: colors.accent, color: colors.onAccent },
  member: { gap: space.sm, paddingTop: space.sm, borderTopWidth: 1, borderTopColor: colors.border },
  memberEmail: { color: colors.text, fontSize: 14, fontFamily: font.semibold },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  input: { height: 42, paddingHorizontal: space.md, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg, color: colors.text, fontSize: 14, fontFamily: font.regular },
});
