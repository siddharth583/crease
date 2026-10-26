import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stars } from '../components/Stars.tsx';
import { Button, Card, FadeIn, IconButton, PressableScale, Screen, SectionLabel, Segmented, ToggleRow, useToast } from '../components/ui.tsx';
import { CATEGORIES, CATEGORY_LABEL, categoryOf, overall, ROLE_LABEL, type Category, type SquadPlayer } from '../engine/squad.ts';
import type { Role } from '../engine/types.ts';
import { newId } from '../store/matches.tsx';
import { useSquad } from '../store/squad.ts';
import { colors, font, radius, space, type } from '../theme.ts';

const ROLES: { value: Role; label: string }[] = [
  { value: 'bat', label: 'Bat' },
  { value: 'bowl', label: 'Bowl' },
  { value: 'ar', label: 'All-round' },
  { value: 'wk', label: 'Keeper' },
];

function PlayerRow({ p, open, onToggle, onChange, onRemove }: { p: SquadPlayer; open: boolean; onToggle: () => void; onChange: (p: SquadPlayer) => void; onRemove: () => void }) {
  return (
    <Card style={styles.row}>
      <PressableScale scaleTo={0.98} onPress={onToggle} style={styles.rowHead} accessibilityLabel={`${p.name}, ${ROLE_LABEL[p.role]}`}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{overall(p).toFixed(1)}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.name} numberOfLines={1}>
            {p.name}
            {p.keeper ? <Text style={styles.wk}>{'\u00A0\u00A0'}WK</Text> : null}
          </Text>
          <View style={styles.mini}>
            <View style={styles.cat}>
              <Text style={styles.catText}>{CATEGORY_LABEL[categoryOf(p)]}</Text>
            </View>
            <Text style={styles.miniText}>Bat {p.bat}</Text>
            <Text style={styles.miniText}>Bowl {p.bowl}</Text>
            <Text style={styles.miniText}>Field {p.field}</Text>
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
          {(['bat', 'bowl', 'field'] as const).map((k) => (
            <View key={k} style={styles.rateRow}>
              <Text style={styles.rateLabel}>{k === 'bat' ? 'Batting' : k === 'bowl' ? 'Bowling' : 'Fielding'}</Text>
              <Stars value={p[k]} size={22} label={k} onChange={(v) => onChange({ ...p, [k]: v })} />
            </View>
          ))}
          <ToggleRow label="Keeps wicket" hint="Made keeper of whichever side picks them" value={Boolean(p.keeper)} onChange={(keeper) => onChange({ ...p, keeper })} />
          <Button variant="ghost" icon="trash-outline" label="Remove from squad" onPress={onRemove} />
        </View>
      )}
    </Card>
  );
}

export default function SquadScreen() {
  const insets = useSafeAreaInsets();
  const { squad, setSquad } = useSquad();
  const toast = useToast();
  const [open, setOpen] = useState<string | null>(null);
  const [name, setName] = useState('');
  const sorted = [...squad].sort((a, b) => overall(b) - overall(a) || a.name.localeCompare(b.name));

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
            Your {squad.length} regulars. Their stats follow them whichever side they play for, and the ratings set them up for the auction.
          </Text>

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

          <SectionLabel right={<Text style={styles.hint}>Tap to edit</Text>}>Best first</SectionLabel>
          <View style={{ gap: space.sm }}>
            {sorted.map((p, i) => (
              <FadeIn key={p.id} delay={Math.min(i, 10) * 25}>
                <PlayerRow
                  p={p}
                  open={open === p.id}
                  onToggle={() => setOpen(open === p.id ? null : p.id)}
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
