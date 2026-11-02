import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PlayerAvatar } from '../components/Avatar.tsx';
import { NameSuggestions } from '../components/NameSuggestions.tsx';
import { Stars } from '../components/Stars.tsx';
import { Button, Card, FadeIn, IconButton, PressableScale, Screen, SectionLabel, Segmented, ToggleRow, useToast } from '../components/ui.tsx';
import { CATEGORIES, CATEGORY_LABEL, categoryOf, linkEmails, overall, ROLE_LABEL, type Category, type SquadPlayer } from '../engine/squad.ts';
import type { Role } from '../engine/types.ts';
import { MATCHES_TO_RATE, squadRatings, type PlayerRatings } from '../engine/ratings.ts';
import { FormBadge, RatingChips } from '../components/Ratings.tsx';
import { newId, useMatches } from '../store/matches.tsx';
import { pickPhoto, pickTextFile } from '../store/files.ts';
import { useSquad } from '../store/squad.ts';
import { parsePhotos, photoFor } from '../engine/photos.ts';
import { useAccess, usePhotos, useSetPhoto } from '../store/sync.tsx';
import { colors, font, radius, space, type } from '../theme.ts';

const ROLES: { value: Role; label: string }[] = [
  { value: 'bat', label: 'Bat' },
  { value: 'bowl', label: 'Bowl' },
  { value: 'ar', label: 'All-round' },
  { value: 'wk', label: 'Keeper' },
];


/** Their ratings match by match, newest first, and how the stars come about. */
function MatchRatings({ r, p, onChange }: { r: PlayerRatings | undefined; p: SquadPlayer; onChange: (p: SquadPlayer) => void }) {
  const rated = Boolean(r?.stars);
  return (
    <View style={{ gap: space.sm }}>
      <Text style={styles.rateLabel}>Match ratings</Text>
      {r && r.history.length > 0 ? (
        <RatingChips history={r.history} />
      ) : (
        <Text style={styles.catHint}>No matches yet. A rating out of 10 comes after each one they play.</Text>
      )}
      <Text style={styles.catHint}>
        {rated
          ? p.manual
            ? `Stars set by hand. Their ${r!.matches} matches say: bat ${r!.stars!.bat}, bowl ${r!.stars!.bowl}, field ${r!.stars!.field}.`
            : `Stars worked out from their ${r!.matches} matches, ranked against the squad. They update after every match.`
          : `Stars come from their matches once they've played ${MATCHES_TO_RATE}; set them by hand until then.`}
      </Text>
      {rated && <ToggleRow label="Set the stars by hand" hint="For the auction, instead of what the matches say" value={Boolean(p.manual)} onChange={(manual) => onChange({ ...p, manual })} />}
    </View>
  );
}

function PlayerRow({
  p,
  shown,
  r,
  open,
  onToggle,
  onChange,
  onRemove,
}: {
  p: SquadPlayer;
  /** The stars they play to: from their matches unless set by hand. */
  shown: SquadPlayer;
  r: PlayerRatings | undefined;
  open: boolean;
  onToggle: () => void;
  onChange: (p: SquadPlayer) => void;
  onRemove: () => void;
}) {
  const fromMatches = Boolean(r?.stars) && !p.manual;
  const photos = usePhotos();
  const setPhoto = useSetPhoto();
  const toast = useToast();
  const hasPhoto = Boolean(photoFor(photos, p.name));
  const choosePhoto = async () => {
    try {
      const photo = await pickPhoto();
      if (photo) await setPhoto(p, photo);
    } catch (e) {
      toast.show(e instanceof Error ? e.message : 'Couldn’t open that picture.', 'error');
    }
  };
  return (
    <Card style={styles.row}>
      <PressableScale scaleTo={0.98} onPress={onToggle} style={styles.rowHead} accessibilityLabel={`${p.name}, ${ROLE_LABEL[p.role]}`}>
        <PlayerAvatar name={p.name} size={44} />
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{overall(shown).toFixed(1)}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.name} numberOfLines={1}>
            {p.name}
            {p.keeper ? <Text style={styles.wk}>{'\u00A0\u00A0'}{p.keeper === 'sometimes' ? '(WK)' : 'WK'}</Text> : null}
          </Text>
          <View style={styles.mini}>
            <View style={styles.cat}>
              <Text style={styles.catText}>{CATEGORY_LABEL[categoryOf(p)]}</Text>
            </View>
            <Text style={styles.miniText}>Bat {shown.bat}</Text>
            <Text style={styles.miniText}>Bowl {shown.bowl}</Text>
            <Text style={styles.miniText}>Field {shown.field}</Text>
            {r?.form != null && <FormBadge form={r.form} />}
          </View>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.faint} />
      </PressableScale>
      {open && (
        <View style={styles.editor}>
          <TextInput
            value={p.name}
            onChangeText={(name) => onChange({ ...p, name })}
            style={styles.input}
            placeholder="Name"
            placeholderTextColor={colors.faint}
            maxLength={24}
            autoCapitalize="words"
          />
          <TextInput
            value={p.email ?? ''}
            onChangeText={(email) => onChange({ ...p, email: email.trim() || undefined })}
            style={styles.input}
            placeholder="Club email (for My profile)"
            placeholderTextColor={colors.faint}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            maxLength={60}
          />
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <View style={{ flex: 1 }}>
              <Button variant="ghost" icon="camera-outline" label={hasPhoto ? 'Change photo' : 'Set photo'} onPress={() => void choosePhoto()} />
            </View>
            {hasPhoto && (
              <View style={{ flex: 1 }}>
                <Button variant="ghost" icon="close-outline" label="Remove photo" onPress={() => void setPhoto(p, null).catch(() => toast.show('Couldn’t remove the photo. Try again.', 'error'))} />
              </View>
            )}
          </View>
          <Segmented value={p.role} onChange={(role) => onChange({ ...p, role, keeper: role === 'wk' ? true : p.keeper })} options={ROLES} />
          <View style={{ gap: space.sm }}>
            <Text style={styles.rateLabel}>Auction category</Text>
            <Segmented<Category>
              value={categoryOf(p)}
              onChange={(category) => onChange({ ...p, category })}
              options={CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABEL[c] }))}
            />
            <Text style={styles.catHint}>Sets their base price in the auction.</Text>
          </View>
          <MatchRatings r={r} p={p} onChange={onChange} />
          {(['bat', 'bowl', 'field'] as const).map((k) => (
            <View key={k} style={styles.rateRow}>
              <Text style={styles.rateLabel}>{k === 'bat' ? 'Batting' : k === 'bowl' ? 'Bowling' : 'Fielding'}</Text>
              <Stars value={shown[k]} size={22} label={k} onChange={fromMatches ? undefined : (v) => onChange({ ...p, [k]: v })} />
            </View>
          ))}
          <ToggleRow label="Keeps wicket" hint="Made keeper of whichever side picks them" value={Boolean(p.keeper)} onChange={(keeper) => onChange({ ...p, keeper })} />
          <Button variant="ghost" icon="trash-outline" label="Remove from squad" onPress={onRemove} />
        </View>
      )}
    </Card>
  );
}

/** Paste the club's list of emails once: each one links to its player, so signing in makes My profile theirs. */
function EmailLinker({ onLink }: { onLink: (text: string) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const found = (text.match(/@[^\s@]+\.[a-z]{2,}/gi) ?? []).length;
  if (!open) return <Button variant="ghost" icon="mail-outline" label="Link players’ emails" onPress={() => setOpen(true)} />;
  return (
    <Card style={{ gap: space.sm }}>
      <Text style={styles.catHint}>
        Paste the list as it is (an email and a name on each line, in any order). Each email links to its player, so signing
        in with it makes My profile theirs. New names join the squad. The emails stay in the squad, shared only with the club.
      </Text>
      <TextInput
        value={text}
        onChangeText={setText}
        multiline
        placeholder={'name@club.com - Their Name\nTheir Name - name@club.com'}
        placeholderTextColor={colors.faint}
        autoCapitalize="none"
        autoCorrect={false}
        style={[styles.input, { minHeight: 120, textAlignVertical: 'top', paddingTop: space.sm }]}
      />
      <Button
        icon="link-outline"
        label={found ? `Link ${found} email${found === 1 ? '' : 's'}` : 'Link the emails'}
        disabled={!found}
        onPress={() => {
          onLink(text);
          setText('');
          setOpen(false);
        }}
      />
      <Button variant="ghost" label="Cancel" onPress={() => (setText(''), setOpen(false))} />
    </Card>
  );
}

export default function SquadScreen() {
  const insets = useSafeAreaInsets();
  const { squad, setSquad, importPhotos } = useSquad();
  // Everyone sees the squad; only the admin changes it.
  const { admin } = useAccess();
  const { matches } = useMatches();
  const ratings = useMemo(() => squadRatings(matches, squad), [matches, squad]);
  const shownOf = (p: SquadPlayer) => {
    const stars = ratings.get(p.id)?.stars;
    return stars && !p.manual ? { ...p, ...stars } : p;
  };
  const toast = useToast();
  const [open, setOpen] = useState<string | null>(null);
  const [name, setName] = useState('');
  const sorted = [...squad].sort((a, b) => overall(shownOf(b)) - overall(shownOf(a)) || a.name.localeCompare(b.name));

  const add = () => {
    const n = name.trim();
    if (!n) return;
    if (squad.some((p) => p.name.trim().toLowerCase() === n.toLowerCase())) {
      toast.show(`${n} is already in the squad`, 'info');
      return;
    }
    const p: SquadPlayer = { id: newId(), name: n, role: 'ar', bat: 3, bowl: 3, field: 3 };
    setSquad([...squad, p]);
    setName('');
    setOpen(p.id);
  };

  return (
    <Screen>
      <View style={styles.header}>
        <IconButton icon="chevron-back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/players'))} />
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: 0, paddingBottom: insets.bottom + space.xxl }} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>
            The squad
          </Text>
          <Text style={styles.lead}>
            Your {squad.length} regulars. Every match gives each of them a rating out of 10, and their stars come from those matches: they set them up for the auction.
          </Text>

          {admin && (
          <>
          <Card style={styles.addCard}>
            <TextInput
              value={name}
              onChangeText={setName}
              onSubmitEditing={add}
              placeholder="Add a regular"
              placeholderTextColor={colors.faint}
              style={[styles.input, { flex: 1 }]}
              maxLength={24}
              autoCapitalize="words"
              returnKeyType="done"
            />
            <IconButton icon="add" label="Add to squad" active={Boolean(name.trim())} disabled={!name.trim()} onPress={add} />
          </Card>
          <NameSuggestions value={name} taken={squad.map((p) => p.name)} onPick={setName} />

          <EmailLinker
            onLink={(text) => {
              const r = linkEmails(squad, text, newId);
              if (!r.linked.length && !r.added.length) return toast.show('No emails found in that list.', 'info');
              setSquad(r.squad);
              toast.show(
                [r.linked.length && `${r.linked.length} emails linked`, r.added.length && `${r.added.join(', ')} added to the squad`].filter(Boolean).join('. '),
                'success',
              );
            }}
          />
          <Button
            variant="ghost"
            icon="images-outline"
            label="Import players’ photos"
            onPress={async () => {
              const text = await pickTextFile();
              if (text === null) return;
              const photos = parsePhotos(text);
              if (!photos) return toast.show('That isn’t a Crease photos file.', 'error');
              const n = importPhotos(photos);
              toast.show(n ? `${n} photo${n === 1 ? '' : 's'} added. Everyone in the club sees them.` : 'No photos in that file.', n ? 'success' : 'info');
            }}
          />
          </>
          )}

          <SectionLabel right={admin ? <Text style={styles.hint}>Tap to edit</Text> : undefined}>Best first</SectionLabel>
          <View style={{ gap: space.sm }}>
            {sorted.map((p, i) => (
              <FadeIn key={p.id} delay={Math.min(i, 10) * 25}>
                <PlayerRow
                  p={p}
                  shown={shownOf(p)}
                  r={ratings.get(p.id)}
                  open={admin && open === p.id}
                  onToggle={() => admin && setOpen(open === p.id ? null : p.id)}
                  onChange={(next) => setSquad(squad.map((x) => (x.id === p.id ? next : x)))}
                  onRemove={() => {
                    setSquad(squad.filter((x) => x.id !== p.id));
                    setOpen(null);
                    toast.show(`${p.name} removed. Their stats stay.`, 'info');
                  }}
                />
              </FadeIn>
            ))}
          </View>
          <Text style={styles.foot}>Renaming someone starts a fresh name in the stats; old matches keep the old spelling.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
      {toast.element}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', paddingHorizontal: space.lg, paddingVertical: space.sm },
  title: { fontFamily: font.posterBlack, fontSize: 38, lineHeight: 42, color: colors.text, letterSpacing: -1.4 },
  lead: { color: colors.muted, fontSize: 14, fontFamily: font.medium, marginTop: 4, lineHeight: 20 },
  hint: { color: colors.faint, fontSize: 12, fontFamily: font.medium },
  addCard: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.lg, padding: space.sm, paddingLeft: space.sm },
  input: {
    color: colors.text,
    fontSize: 15,
    fontFamily: font.medium,
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: space.md,
    height: 44,
  },
  row: { padding: 0, overflow: 'hidden' },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
  badge: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.accentDim, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: font.posterBlack, fontSize: 16, color: colors.accentInk, ...type.num },
  name: { color: colors.text, fontSize: 16, fontFamily: font.bold },
  wk: { color: colors.cyan, fontSize: 11, fontFamily: font.heavy },
  mini: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: 3, flexWrap: 'wrap' },
  cat: { backgroundColor: colors.surfaceHi, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  catText: { color: colors.text, fontSize: 10, fontFamily: font.heavy, letterSpacing: 0.5 },
  catHint: { color: colors.faint, fontSize: 12, fontFamily: font.regular },
  miniText: { color: colors.muted, fontSize: 12, fontFamily: font.medium },
  editor: { gap: space.md, padding: space.md, paddingTop: 0 },
  rateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rateLabel: { color: colors.text, fontSize: 14, fontFamily: font.semibold },
  foot: { color: colors.faint, fontSize: 12, fontFamily: font.regular, marginTop: space.lg, textAlign: 'center' },
});
