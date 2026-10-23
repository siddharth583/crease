import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Chip, IconButton, PressableScale, Screen, SectionLabel, Segmented, tap } from '../../components/ui.tsx';
import { auctionState, money, moneyShort, newAuction, type AuctionSettings } from '../../engine/auction.ts';
import { overall, type SquadPlayer } from '../../engine/squad.ts';
import { newId } from '../../store/matches.tsx';
import { useSquad } from '../../store/squad.ts';
import { colors, edge, font, radius, space, type } from '../../theme.ts';

const first = (name: string) => name.trim().split(/\s+/)[0];
const day = (ms: number) => new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

/** Pick one of the day's players as a captain. */
function CaptainPicker({ label, players, value, other, onChange }: { label: string; players: SquadPlayer[]; value: string | null; other: string | null; onChange: (id: string) => void }) {
  return (
    <View style={{ gap: space.sm }}>
      <Text style={styles.question}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
        {players
          .filter((p) => p.id !== other)
          .map((p) => (
            <Chip key={p.id} icon="ribbon-outline" label={p.name} selected={p.id === value} onPress={() => onChange(p.id)} />
          ))}
      </ScrollView>
    </View>
  );
}

export default function NewAuction() {
  const insets = useSafeAreaInsets();
  const { squad, auctions, saveAuction } = useSquad();
  const best = [...squad].sort((a, b) => overall(b) - overall(a));
  const [guests, setGuests] = useState<SquadPlayer[]>([]);
  const [playing, setPlaying] = useState<Set<string>>(() => new Set(squad.map((p) => p.id)));
  const [guest, setGuest] = useState('');
  const [captains, setCaptains] = useState<[string | null, string | null]>([best[0]?.id ?? null, best[1]?.id ?? null]);
  const [names, setNames] = useState<[string, string]>(['', '']);
  const [purse, setPurse] = useState<'50000' | '100000' | '200000'>('100000');
  const [base, setBase] = useState<'1000' | '2000' | '5000' | '10000'>('5000');
  const [step, setStep] = useState<'500' | '1000' | '2000' | '5000'>('1000');

  const everyone = [...squad, ...guests];
  const today = everyone.filter((p) => playing.has(p.id));
  const capOf = (i: 0 | 1) => everyone.find((p) => p.id === captains[i]) ?? null;
  const teamName = (i: 0 | 1) => names[i].trim() || (capOf(i) ? `Team ${first(capOf(i)!.name)}` : i ? 'Team B' : 'Team A');
  const perSide = Math.ceil(today.length / 2);
  const settings: AuctionSettings = { purse: Number(purse), base: Number(base), step: Number(step) };
  // Every captain has to be able to fill their side at the base price.
  const affordable = settings.base * (perSide - 1) <= settings.purse;
  const ready = today.length >= 4 && captains[0] && captains[1] && playing.has(captains[0]) && playing.has(captains[1]) && affordable;

  const toggle = (id: string) => {
    const next = new Set(playing);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPlaying(next);
    setCaptains(([a, b]) => [a && next.has(a) ? a : null, b && next.has(b) ? b : null]);
  };
  const addGuest = () => {
    const n = guest.trim();
    if (!n) return;
    const p: SquadPlayer = { id: newId(), name: n, role: 'ar', bat: 2, bowl: 2, field: 2 };
    setGuests([...guests, p]);
    setPlaying(new Set([...playing, p.id]));
    setGuest('');
  };
  const start = () => {
    if (!ready) return;
    const a = newAuction(newId(), today, [
      { name: teamName(0), captain: captains[0]! },
      { name: teamName(1), captain: captains[1]! },
    ], settings);
    saveAuction(a);
    tap('success');
    router.replace({ pathname: '/auction/[id]', params: { id: a.id } });
  };

  return (
    <Screen>
      <View style={styles.header}>
        <IconButton icon="chevron-back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        <IconButton icon="people-outline" label="Edit the squad" onPress={() => router.push('/squad')} />
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: 0, paddingBottom: 140 }} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>
            THE <Text style={{ color: colors.accentInk }}>AUCTION</Text>
          </Text>
          <Text style={styles.lead}>Two captains, a wallet of ₹1 lakh each. Players come up one at a time and go to the highest bid.</Text>

          {auctions.length > 0 && (
            <>
              <SectionLabel>Recent auctions</SectionLabel>
              <View style={{ gap: space.sm }}>
                {auctions.slice(0, 3).map((a) => {
                  const s = auctionState(a);
                  return (
                    <PressableScale key={a.id} scaleTo={0.98} onPress={() => router.push({ pathname: '/auction/[id]', params: { id: a.id } })} style={styles.past}>
                      <Ionicons name="hammer-outline" size={18} color={colors.accentInk} />
                      <Text style={styles.pastText} numberOfLines={1}>
                        <Text style={styles.pastStrong}>{a.sides[0].name}</Text> vs <Text style={styles.pastStrong}>{a.sides[1].name}</Text>
                      </Text>
                      <Text style={styles.pastMeta}>{s.done ? day(a.createdAt) : 'In progress'}</Text>
                    </PressableScale>
                  );
                })}
              </View>
            </>
          )}

          <SectionLabel right={<Text style={styles.count}>{today.length} playing · {perSide} a side</Text>}>Who’s playing today</SectionLabel>
          <Card style={{ gap: space.md }}>
            <View style={styles.chips}>
              {everyone.map((p) => (
                <Chip key={p.id} label={p.name} selected={playing.has(p.id)} onPress={() => toggle(p.id)} />
              ))}
            </View>
            <View style={styles.guestRow}>
              <TextInput
                value={guest}
                onChangeText={setGuest}
                onSubmitEditing={addGuest}
                placeholder="Add a guest for today"
                placeholderTextColor={colors.faint}
                style={[styles.input, { flex: 1 }]}
                maxLength={24}
                autoCapitalize="words"
                returnKeyType="done"
              />
              <IconButton icon="add" label="Add guest" active={Boolean(guest.trim())} disabled={!guest.trim()} onPress={addGuest} />
            </View>
          </Card>

          <SectionLabel>Captains</SectionLabel>
          <Card style={{ gap: space.lg }}>
            {([0, 1] as const).map((i) => (
              <View key={i} style={{ gap: space.sm }}>
                <CaptainPicker
                  label={i ? 'Second captain' : 'First captain'}
                  players={today}
                  value={captains[i]}
                  other={captains[1 - i]}
                  onChange={(id) => setCaptains(i ? [captains[0], id] : [id, captains[1]])}
                />
                <TextInput
                  value={names[i]}
                  onChangeText={(v) => setNames(i ? [names[0], v] : [v, names[1]])}
                  placeholder={`Team name: ${teamName(i)}`}
                  placeholderTextColor={colors.faint}
                  style={styles.input}
                  maxLength={28}
                  autoCapitalize="words"
                />
              </View>
            ))}
            <Text style={styles.help}>Captains lead their side for free and aren’t auctioned.</Text>
          </Card>

          <SectionLabel>Wallet</SectionLabel>
          <Card style={{ gap: space.md }}>
            <Text style={styles.question}>Wallet for each captain</Text>
            <Segmented
              value={purse}
              onChange={setPurse}
              options={[
                { value: '50000', label: '₹50,000' },
                { value: '100000', label: '₹1 lakh' },
                { value: '200000', label: '₹2 lakh' },
              ]}
            />
            <Text style={styles.question}>Base price</Text>
            <Segmented value={base} onChange={setBase} options={(['1000', '2000', '5000', '10000'] as const).map((v) => ({ value: v, label: moneyShort(Number(v)) }))} />
            <Text style={styles.question}>Each bid adds</Text>
            <Segmented value={step} onChange={setStep} options={(['500', '1000', '2000', '5000'] as const).map((v) => ({ value: v, label: `+${moneyShort(Number(v))}` }))} />
            <Text style={[styles.help, !affordable && { color: colors.danger }]}>
              {affordable
                ? `Each side buys ${perSide - 1} players. A captain always keeps ${money(settings.base)} a place for the rest of their side.`
                : `A wallet of ${money(settings.purse)} can’t buy ${perSide - 1} players at ${money(settings.base)} each. Raise the wallet or lower the base price.`}
            </Text>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}>
        <Button
          label={today.length < 4 ? 'Pick at least 4 players' : !captains[0] || !captains[1] ? 'Pick two captains' : 'Start the auction'}
          icon="hammer"
          disabled={!ready}
          onPress={start}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingVertical: space.sm },
  title: { fontFamily: font.posterBlack, fontSize: 52, lineHeight: 52, color: colors.text, letterSpacing: -1 },
  lead: { color: colors.muted, fontSize: 14, fontFamily: font.medium, marginTop: 4, lineHeight: 20 },
  count: { color: colors.faint, fontSize: 12, fontFamily: font.medium, ...type.num },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  guestRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
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
  question: { color: colors.muted, fontSize: 13, fontFamily: font.bold },
  help: { color: colors.faint, fontSize: 12, fontFamily: font.regular, lineHeight: 17 },
  past: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: space.md,
    height: 52,
    ...edge,
  },
  pastText: { flex: 1, color: colors.muted, fontSize: 14, fontFamily: font.medium },
  pastStrong: { color: colors.text, fontFamily: font.bold },
  pastMeta: { color: colors.faint, fontSize: 12, fontFamily: font.medium },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
