import { useEffect, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { CLUB_DOMAIN, CLUB_OWNER, LIVE_HOST, useClubSync, type ClubRole } from '../store/sync.tsx';
import { colors, font, radius, space } from '../theme.ts';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, Chip, SectionLabel, Segmented, Sheet, type IconName } from './ui.tsx';
import { Pulse } from './motion.tsx';

// Settings › Club sync: sign in, what this phone can do in the club, when it last synced; the admin's members list.

export const ROLE: Record<ClubRole, string> = { owner: 'Admin', scorer: 'Editor', viewer: 'Viewer' };
const ROLE_LOOK: Record<ClubRole, { icon: IconName; tint: string; bg: string; fg: string }> = {
  owner: { icon: 'shield-checkmark', tint: colors.gold, bg: colors.goldDim, fg: colors.gold },
  scorer: { icon: 'create', tint: colors.onAccent, bg: colors.accent, fg: colors.onAccent },
  viewer: { icon: 'eye', tint: colors.muted, bg: colors.surfaceHi, fg: colors.text },
};

/** Admin / Editor / Viewer as a chip with its own icon, so the role reads at a glance. */
export function RoleChip({ role }: { role: ClubRole | null }) {
  const look = role ? ROLE_LOOK[role] : { icon: 'help-circle' as IconName, tint: colors.muted, bg: colors.surfaceHi, fg: colors.text };
  return (
    <View style={[styles.roleChip, { backgroundColor: look.bg }]} accessibilityLabel={role ? `Your role: ${ROLE[role]}` : 'Not in the club'}>
      <Ionicons name={look.icon} size={13} color={look.tint} />
      <Text style={[styles.roleChipText, { color: look.fg }]}>{role ? ROLE[role] : 'Not in the club'}</Text>
    </View>
  );
}

/** A settings group's heading: an icon tile, a title and one line saying what it is for. */
export function GroupHeader({ icon, title, hint, right }: { icon: IconName; title: string; hint?: string; right?: ReactNode }) {
  return (
    <View style={styles.group} accessibilityRole="header">
      <View style={styles.groupIcon}>
        <Ionicons name={icon} size={18} color={colors.accentInk} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.groupTitle}>{title}</Text>
        {hint ? <Text style={styles.note}>{hint}</Text> : null}
      </View>
      {right}
    </View>
  );
}

/** One plain sentence for where the sync stands, with a dot: green when live, red when it failed, grey when offline. */
export function useSyncLine() {
  const { status, user, role, lastSync, online, pending } = useClubSync();
  const ago = useAgo(lastSync);
  if (status === 'unavailable') return { text: 'Club sync runs on the live app.', tone: 'off' as const };
  if (!user) return { text: 'Not signed in. Matches stay on this phone only.', tone: 'off' as const };
  if (status === 'error') return { text: 'Couldn’t reach the club. We’ll keep trying.', tone: 'bad' as const };
  if (!role || status === 'not-member') return { text: 'Signed in, but this account isn’t in the club yet.', tone: 'off' as const };
  if (!online) return { text: pending ? 'Offline. Your changes will send when you’re back online.' : 'Offline. Everything saves here and catches up later.', tone: 'off' as const };
  return { text: ago ? `Up to date with the club, synced ${ago}.` : 'Syncing with the club…', tone: 'good' as const };
}

/** The sync sentence with its status dot. */
export function SyncLine() {
  const { text, tone } = useSyncLine();
  return (
    <View style={styles.syncLine} accessibilityLiveRegion="polite">
      {tone === 'good' ? <Pulse color={colors.accent} size={8} /> : <View style={[styles.dot, { backgroundColor: tone === 'bad' ? colors.danger : colors.faint }]} />}
      <Text style={[styles.note, { flex: 1 }, tone === 'bad' && { color: colors.danger }]}>{text}</Text>
    </View>
  );
}

const when = (at: number) => new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

/** For a viewer, or someone signed in outside the club: ask the admin to be an editor, and where that stands. */
export function RequestEditor() {
  const { user, role, status, myRequest, requestEditor, cancelRequest, canRequest } = useClubSync();
  const [busy, setBusy] = useState(false);
  if (!user || role === 'owner' || role === 'scorer' || (status !== 'not-member' && role !== 'viewer')) return null;
  // Only club accounts and people the admin listed may ask; anyone else is told so in Club sync, with no button.
  if (!canRequest && myRequest?.status !== 'pending') return null;
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };
  if (myRequest?.status === 'pending') {
    return (
      <View style={{ gap: space.sm }}>
        <Text style={styles.body}>Editor access requested {when(myRequest.at)}. The admin will see it and say yes or no.</Text>
        <Button variant="ghost" icon="close-outline" label="Cancel the request" disabled={busy} onPress={() => void run(cancelRequest)} />
      </View>
    );
  }
  return (
    <View style={{ gap: space.sm }}>
      <Text style={styles.note}>
        {myRequest?.status === 'declined'
          ? 'The admin didn’t give editor access this time. You can ask again.'
          : 'Editors start and score matches for everyone. Viewers see everything and can export it. Only the admin changes the squad and sides.'}
      </Text>
      <Button icon="create-outline" label={myRequest ? 'Ask again for editor access' : 'Request editor access'} disabled={busy} onPress={() => void run(requestEditor)} />
    </View>
  );
}

/** The admin: everyone waiting to be an editor, oldest first, each to approve or decline. */
function Requests() {
  const { requests, answerRequest } = useClubSync();
  const [busy, setBusy] = useState<string | null>(null);
  if (!requests.length) return null;
  return (
    <>
      <SectionLabel right={<Text style={styles.count}>{requests.length} waiting</Text>}>Editor requests</SectionLabel>
      <Card style={{ gap: space.md }}>
        {requests.map((r, i) => (
          <View key={r.email} style={[styles.request, i === 0 && { borderTopWidth: 0, paddingTop: 0 }]}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.memberEmail} numberOfLines={1}>
                {r.name}
              </Text>
              <Text style={styles.note} numberOfLines={1}>
                {r.email} · asked {when(r.at)}
              </Text>
            </View>
            <Chip icon="checkmark" label="Approve" disabled={busy === r.email} onPress={() => (setBusy(r.email), void answerRequest(r.email, true).finally(() => setBusy(null)))} />
            <Chip icon="close" tone="danger" label="Decline" disabled={busy === r.email} onPress={() => (setBusy(r.email), void answerRequest(r.email, false).finally(() => setBusy(null)))} />
          </View>
        ))}
      </Card>
    </>
  );
}

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
          Everyone with a {CLUB_DOMAIN} Google account can already see and export everything. Add people here to make them
          editors, who start and score matches (or to let someone outside {CLUB_DOMAIN} view). The squad and sides stay
          yours to change.
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
                    { value: 'scorer', label: 'Editor' },
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
            { value: 'scorer', label: 'Can edit' },
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

/**
 * Sign out, after saying what it does: the club's matches leave this phone (they stay in the club, and signing in
 * brings them back), and anything not sent yet is warned about first.
 */
export function SignOutButton() {
  const { signOut, pending, online } = useClubSync();
  const [asking, setAsking] = useState(false);
  return (
    <>
      <Button variant="ghost" icon="log-out-outline" label="Sign out" onPress={() => setAsking(true)} />
      <Sheet visible={asking} onClose={() => setAsking(false)} title="Sign out?">
        <View style={{ gap: space.md }}>
          <Text style={styles.body}>
            The club’s matches, squad and sides come off this phone. They stay safe in the club: sign in again and they’re all
            back.
          </Text>
          {pending && (
            <Text style={styles.error}>
              Some changes haven’t reached the club yet
              {online ? '. Wait a moment for them to sync' : ': you’re offline. Sign out once you’re back online'}, or they’re lost.
            </Text>
          )}
          <Button
            variant="danger"
            icon="log-out-outline"
            label="Sign out"
            onPress={() => {
              setAsking(false);
              void signOut();
            }}
          />
          <Button variant="ghost" label="Stay signed in" onPress={() => setAsking(false)} />
        </View>
      </Sheet>
    </>
  );
}

export function ClubSyncSettings() {
  const { status, user, role, error, signIn, canRequest } = useClubSync();
  if (status === 'unavailable') {
    return (
      <>
        <GroupHeader icon="people-circle-outline" title="Club sync" hint="Share every match with the club, live" />
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
  return (
    <>
      <GroupHeader icon="people-circle-outline" title="Club sync" hint="Share every match with the club, live" />
      <Card style={{ gap: space.md }}>
        {!user ? (
          <>
            <Text style={styles.body}>
              Sign in to share everything with the club: every match, record, rating and form, the squad, sides and line-ups,
              on every phone, live.
            </Text>
            <Button icon="logo-google" label={status === 'signing-in' ? 'Signing in…' : 'Sign in with Google'} disabled={status === 'signing-in' || status === 'starting'} onPress={() => void signIn()} />
            <Text style={styles.note}>Once you’re in, the app keeps working with no signal and catches up when you’re back online.</Text>
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
              <RoleChip role={role} />
            </View>
            <SyncLine />
            {status === 'not-member' ? (
              <Text style={styles.body}>
                This account isn’t in the club. Sign in with your {CLUB_DOMAIN} account
                {canRequest ? ', or ask for access below.' : `, or ask the admin (${CLUB_OWNER}) to add this one.`}
              </Text>
            ) : role === 'viewer' ? (
              <Text style={styles.note}>You can watch and export every match, record and rating, live. Editors do the scoring.</Text>
            ) : role === 'scorer' ? (
              <Text style={styles.note}>
                Every match you start or score goes to the club straight away, and theirs comes here. When two phones change the
                same match, the later save wins. The squad and sides are the admin’s to change.
              </Text>
            ) : role ? (
              <Text style={styles.note}>
                Everything you score or change here goes to the club straight away, and theirs comes here. When two phones change
                the same match, the later save wins.
              </Text>
            ) : (
              <Text style={styles.note}>Checking the club…</Text>
            )}
            <RequestEditor />
            {error && <Text style={styles.error}>{error}</Text>}
            <SignOutButton />
          </>
        )}
      </Card>
      {role === 'owner' && <Requests />}
      {role === 'owner' && <Members />}
    </>
  );
}

const styles = StyleSheet.create({
  roleChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  roleChipText: { fontSize: 12, fontFamily: font.bold },
  group: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.xl, marginBottom: space.md },
  groupIcon: { width: 38, height: 38, borderRadius: radius.sm, backgroundColor: colors.accentDim, alignItems: 'center', justifyContent: 'center' },
  groupTitle: { color: colors.text, fontSize: 18, fontFamily: font.posterBlack, letterSpacing: -0.3 },
  syncLine: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
  count: { color: colors.faint, fontSize: 12, fontFamily: font.semibold },
  note: { color: colors.muted, fontSize: 13, fontFamily: font.regular, lineHeight: 19 },
  body: { color: colors.text, fontSize: 14, fontFamily: font.medium, lineHeight: 20 },
  error: { color: colors.danger, fontSize: 13, fontFamily: font.semibold, lineHeight: 19 },
  who: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  name: { color: colors.text, fontSize: 16, fontFamily: font.bold },
  role: { overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.surfaceHi, color: colors.text, fontSize: 12, fontFamily: font.bold },
  roleAdmin: { backgroundColor: colors.accent, color: colors.onAccent },
  request: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingTop: space.md, borderTopWidth: 1, borderTopColor: colors.border },
  member: { gap: space.sm, paddingTop: space.sm, borderTopWidth: 1, borderTopColor: colors.border },
  memberEmail: { color: colors.text, fontSize: 14, fontFamily: font.semibold },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  input: { height: 42, paddingHorizontal: space.md, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg, color: colors.text, fontSize: 14, fontFamily: font.regular },
});
