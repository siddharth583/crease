import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PlayerAvatar } from '../components/Avatar.tsx';
import { Columns, Page, useLayout } from '../components/layout.tsx';
import { NameSuggestions } from '../components/NameSuggestions.tsx';
import { Stars } from '../components/Stars.tsx';
import { Button, Card, FadeIn, IconButton, PressableScale, Screen, SectionLabel, Segmented, ToggleRow, useToast, WideHead } from '../components/ui.tsx';
import { CATEGORIES, CATEGORY_LABEL, categoryOf, linkEmails, overall, ROLE_LABEL, type Category, type SquadPlayer } from '../engine/squad.ts';
import type { Role } from '../engine/types.ts';
import { MATCHES_TO_RATE, squadRatings, type PlayerRatings } from '../engine/ratings.ts';
import { FormBadge, RatingChips } from '../components/Ratings.tsx';
import { newId, useMatches } from '../store/matches.tsx';
import { pickPhoto, pickTextFile } from '../store/files.ts';
import { useSquad } from '../store/squad.ts';
import { parsePhotos, photoFor, photoKey } from '../engine/photos.ts';
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

type RowProps = {
  p: SquadPlayer;
  /** The stars they play to: from their matches unless set by hand. */
  shown: SquadPlayer;
  r: PlayerRatings | undefined;
  onChange: (p: SquadPlayer) => void;
  /** A new name, once typed: false when it can't be used, and the old one comes back. */
  onRename: (name: string) => boolean;
  onRemove: () => void;
};

function PlayerRow({
  open,
  onToggle,
  editorBelow,
  ...props
}: RowProps & {
  open: boolean;
  onToggle: () => void;
  /** On a tablet or laptop the editor opens across the grid under this card's row, not inside the card. */
  editorBelow?: boolean;
}) {
  const { p, shown, r } = props;
  return (
    <Card style={[styles.row, editorBelow && styles.rowGrid, editorBelow && open && styles.rowOpen]}>
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
      {open && !editorBelow && <PlayerEditor {...props} />}
    </Card>
  );
}

/** Everything about one player that the admin can change. Laid out in columns when it opens across a wide grid. */
function PlayerEditor({ p, shown, r, onChange, onRename, onRemove, wide }: RowProps & { wide?: boolean }) {
  // The name is typed here and only renamed when done, so their stats and photo move once, not letter by letter.
  const [typed, setTyped] = useState(p.name);
  useEffect(() => setTyped(p.name), [p.name]);
  const rename = () => {
    if (typed.trim() === p.name) return;
    if (!onRename(typed)) setTyped(p.name);
  };
  // Removing asks twice: the first tap says what it does.
  const [removing, setRemoving] = useState(false);
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
  const who = (
    <>
      <TextInput
        value={typed}
        onChangeText={setTyped}
        onBlur={rename}
        onSubmitEditing={rename}
        returnKeyType="done"
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
    </>
  );
  const ratings = (
    <>
      <MatchRatings r={r} p={p} onChange={onChange} />
      {(['bat', 'bowl', 'field'] as const).map((k) => (
        <View key={k} style={styles.rateRow}>
          <Text style={styles.rateLabel}>{k === 'bat' ? 'Batting' : k === 'bowl' ? 'Bowling' : 'Fielding'}</Text>
          <Stars value={shown[k]} size={22} label={k} onChange={fromMatches ? undefined : (v) => onChange({ ...p, [k]: v })} />
        </View>
      ))}
      <ToggleRow label="Keeps wicket" hint="Made keeper of whichever side picks them" value={Boolean(p.keeper)} onChange={(keeper) => onChange({ ...p, keeper })} />
    </>
  );
  const remove = (
    <>
      {removing && <Text style={styles.catHint}>They leave the squad. Their matches and stats stay.</Text>}
      <Button
        variant={removing ? 'danger' : 'ghost'}
        icon="trash-outline"
        label={removing ? `Tap again to remove ${p.name}` : 'Remove from squad'}
        onPress={() => (removing ? onRemove() : setRemoving(true))}
      />
    </>
  );
  if (wide)
    return (
      <Columns gap={space.xl}>
        <View style={{ gap: space.md }}>{who}</View>
        <View style={{ gap: space.md }}>
          {ratings}
          {remove}
        </View>
      </Columns>
    );
  return (
    <View style={styles.editor}>
      {who}
      {ratings}
      {remove}
    </View>
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
  const { wide, desk, gutter } = useLayout();
  const { squad, setSquad, renamePlayer } = useSquad();
  const setPhoto = useSetPhoto();
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

  const rowProps = (p: SquadPlayer): RowProps => ({
    p,
    shown: shownOf(p),
    r: ratings.get(p.id),
    onChange: (next) => setSquad(squad.map((x) => (x.id === p.id ? next : x))),
    onRename: (typed) => {
      const n = typed.trim().replace(/\s+/g, ' ');
      if (!n) {
        toast.show('A name can’t be empty', 'error');
        return false;
      }
      if (squad.some((x) => x.id !== p.id && x.name.trim().toLowerCase() === n.toLowerCase())) {
        toast.show(`${n} is already in the squad`, 'info');
        return false;
      }
      renamePlayer(p.name, n);
      return true;
    },
    onRemove: () => {
      setSquad(squad.filter((x) => x.id !== p.id));
      setOpen(null);
      toast.show(`${p.name} removed. Their stats stay.`, 'info');
    },
  });
  const row = (p: SquadPlayer, i: number) => (
    <FadeIn key={p.id} delay={Math.min(i, 10) * 25} style={wide && { flex: 1 }}>
      <PlayerRow
        {...rowProps(p)}
        open={admin && open === p.id}
        onToggle={() => admin && setOpen(open === p.id ? null : p.id)}
        editorBelow={wide}
      />
    </FadeIn>
  );

  const addCard = (
    <>
      {/* On a tablet or laptop it sits in a row with two buttons: the same 56 high as they are. */}
      <Card style={[styles.addCard, wide && { marginTop: 0, paddingVertical: 5 }]}>
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
    </>
  );
  const emailLinker = (
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
  );
  const importPhotos = (
    <Button
      variant="ghost"
      icon="images-outline"
      label="Import players’ photos"
      onPress={async () => {
        const text = await pickTextFile();
        if (text === null) return;
        const photos = parsePhotos(text);
        if (!photos) return toast.show('That isn’t a Crease photos file.', 'error');
        const entries = Object.entries(photos);
        if (!entries.length) return toast.show('No photos in that file.', 'info');
        toast.show(`Adding ${entries.length} photos…`, 'info');
        try {
          // Each to its player: in the club on the live app (one entry each, full quality), here anywhere else.
          for (const [key, photo] of entries) await setPhoto(squad.find((p) => photoKey(p.name) === key) ?? { name: key }, photo);
          toast.show(`${entries.length} photos added. Everyone in the club sees them.`, 'success');
        } catch {
          toast.show('Some photos didn’t save. Try the import again.', 'error');
        }
      }}
    />
  );
  const label = <SectionLabel right={admin ? <Text style={styles.hint}>Tap to edit</Text> : undefined}>Best first</SectionLabel>;
  const lead = (
    <Text style={styles.lead}>
      Your {squad.length} regulars. Every match gives each of them a rating out of 10, and their stars come from those matches: they set them up for the auction.
    </Text>
  );

  // A tablet or laptop: the squad as a grid, two or three a line, best first across each line. The player being edited
  // opens across the whole grid, just under their line, with room for its controls side by side.
  const cols = desk ? 3 : 2;
  const lines: SquadPlayer[][] = [];
  sorted.forEach((p, i) => (lines[Math.floor(i / cols)] ??= []).push(p));
  const grid = (
    <View style={{ gap: space.sm }}>
      {lines.map((line, l) => {
        const editing = admin ? line.find((p) => p.id === open) : undefined;
        return (
          <View key={line[0].id} style={{ gap: space.sm }}>
            <View style={styles.gridLine}>
              {Array.from({ length: cols }, (_, c) => (
                <View key={c} style={styles.gridCell}>
                  {line[c] ? row(line[c], l * cols + c) : null}
                </View>
              ))}
            </View>
            {editing && (
              <Card style={styles.editorWide}>
                <View style={styles.editorHead}>
                  <Text style={styles.editorTitle} numberOfLines={1}>
                    {editing.name}
                  </Text>
                  <IconButton icon="close" label="Done editing" onPress={() => setOpen(null)} />
                </View>
                <PlayerEditor key={editing.id} {...rowProps(editing)} wide />
              </Card>
            )}
          </View>
        );
      })}
    </View>
  );

  return (
    <Screen>
      {wide ? (
        // Back and the title on one line, as on every other page.
        <View style={{ paddingHorizontal: gutter, paddingTop: space.lg }}>
          <Page>
            <WideHead title="The squad" onBack={() => (router.canGoBack() ? router.back() : router.replace('/players'))} />
          </Page>
        </View>
      ) : (
        <View style={styles.header}>
          <IconButton icon="chevron-back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/players'))} />
        </View>
      )}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={
            wide
              ? { paddingHorizontal: gutter, paddingBottom: insets.bottom + space.xxl }
              : { padding: space.lg, paddingTop: 0, paddingBottom: insets.bottom + space.xxl }
          }
          keyboardShouldPersistTaps="handled"
        >
          {wide ? (
            <Page>
              <View style={styles.leadWide}>{lead}</View>
              {admin && (
                <Columns tablet={3} gap={space.sm} style={{ marginTop: space.lg }}>
                  <View>{addCard}</View>
                  <View>{emailLinker}</View>
                  <View>{importPhotos}</View>
                </Columns>
              )}
              {label}
              {grid}
              {admin && <Text style={styles.foot}>Renaming someone keeps their stats and photo under the new name.</Text>}
            </Page>
          ) : (
            <>
              <Text style={styles.title}>The squad</Text>
              {lead}

              {admin && (
                <>
                  {addCard}
                  {emailLinker}
                  {importPhotos}
                </>
              )}

              {label}
              <View style={{ gap: space.sm }}>{sorted.map(row)}</View>
              {admin && <Text style={styles.foot}>Renaming someone keeps their stats and photo under the new name.</Text>}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
      {toast.element}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', paddingHorizontal: space.lg, paddingVertical: space.sm },
  title: { fontFamily: font.posterBlack, fontSize: 38, lineHeight: 42, color: colors.text, letterSpacing: -1.4 },
  leadWide: { maxWidth: 680 },
  gridLine: { flexDirection: 'row', gap: space.sm, alignItems: 'stretch' },
  gridCell: { flex: 1, minWidth: 0 },
  editorWide: { gap: space.md, borderColor: colors.accent },
  editorHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  editorTitle: { flex: 1, color: colors.text, fontSize: 22, fontFamily: font.posterBlack, letterSpacing: -0.6 },
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
  // In the grid every card in a line is as tall as the tallest; the one being edited is ringed in the accent.
  rowGrid: { flex: 1 },
  rowOpen: { borderColor: colors.accent },
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
