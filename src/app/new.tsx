import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Chip, IconButton, PressableScale, Screen, SectionLabel, Segmented, Stepper, tap, useToast } from '../components/ui.tsx';
import { TossScene, type TossResult } from '../components/TossScene.tsx';
import { auctionState, rosterPlayer, type Auction } from '../engine/auction.ts';
import { newMatch } from '../engine/engine.ts';
import { seriesState } from '../engine/stats.ts';
import type { Match, Rules, SeriesInfo, Team } from '../engine/types.ts';
import { newId, useMatches } from '../store/matches.tsx';
import { HOUSE_RULES } from '../engine/squad.ts';
import { useSquad } from '../store/squad.ts';
import { colors, radius, space, font } from '../theme.ts';

/** `captain` and `keeper` are indexes into `players`. */
type Draft = { name: string; players: string[]; captain?: number; keeper?: number };

const resize = (players: string[], n: number) =>
  players.length >= n ? players.slice(0, n) : [...players, ...Array(n - players.length).fill('')];

/** "Rohit, Virat\nSurya" → three names. Numbers and bullets people paste from WhatsApp are dropped. */
const parseNames = (text: string) =>
  text
    .split(/[,\n;]+/)
    .map((n) => n.replace(/^[\s\d.)•*-]+/, '').trim())
    .filter(Boolean)
    .slice(0, 11);

const isPlaceholderName = (n: string) => /^player \d+$/i.test(n.trim());

function draftFrom(team: Team, match?: Match): Draft {
  const own = team.players.filter((p) => !p.common);
  const at = (id?: string) => {
    const i = own.findIndex((p) => p.id === id);
    return i >= 0 ? i : undefined;
  };
  return {
    name: team.name,
    players: own.map((p) => (isPlaceholderName(p.name) ? '' : p.name)),
    captain: at(match?.captains?.[team.id] ?? team.captain),
    keeper: at(match?.keepers?.[team.id] ?? team.keeper),
  };
}

/** The two sides an auction made: captain first, the keeper marked. */
function draftsFromAuction(a: Auction): [Draft, Draft] {
  return auctionState(a).sides.map((side) => {
    const players = side.players.map((id) => rosterPlayer(a, id));
    const keeper = players.findIndex((p) => p.keeper);
    return { name: side.name, players: players.map((p) => p.name), captain: 0, keeper: keeper >= 0 ? keeper : undefined };
  }) as [Draft, Draft];
}

function TeamEditor({
  label,
  draft,
  onChange,
  onSquad,
  saved,
}: {
  label: string;
  draft: Draft;
  onChange: (d: Draft) => void;
  /** A whole squad arrived (saved team or pasted list): its size becomes the side size. */
  onSquad: (d: Draft) => void;
  saved: Team[];
}) {
  const [open, setOpen] = useState(false);
  const [paste, setPaste] = useState('');
  const pasted = parseNames(paste);
  const named = draft.players.filter((p) => p.trim()).length;

  return (
    <Card style={{ gap: space.md }}>
      <TextInput
        value={draft.name}
        onChangeText={(name) => onChange({ ...draft, name })}
        placeholder={label}
        placeholderTextColor={colors.faint}
        style={styles.teamInput}
        maxLength={28}
        autoCapitalize="words"
      />
      {saved.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
          {saved.map((t) => (
            <Chip
              key={t.id}
              icon="people-outline"
              label={t.name}
              selected={t.name === draft.name}
              onPress={() => onSquad(draftFrom(t))}
            />
          ))}
        </ScrollView>
      )}
      <Pressable
        onPress={() => {
          tap();
          setOpen(!open);
        }}
        style={styles.squadToggle}
        accessibilityRole="button"
      >
        <Ionicons name="people" size={18} color={colors.muted} />
        <Text style={styles.squadText}>
          {named === 0 ? `${draft.players.length} players · add names` : `${named} of ${draft.players.length} named`}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} />
      </Pressable>
      {open && (
        <View style={{ gap: space.sm }}>
          {draft.players.map((p, i) => (
            <View key={i} style={styles.playerRow}>
              <Text style={styles.playerNum}>{i + 1}</Text>
              <TextInput
                value={p}
                onChangeText={(v) => onChange({ ...draft, players: draft.players.map((x, j) => (j === i ? v : x)) })}
                placeholder={`Player ${i + 1}`}
                placeholderTextColor={colors.faint}
                style={styles.playerInput}
                maxLength={24}
                autoCapitalize="words"
                returnKeyType="next"
              />
              <PressableScale
                accessibilityLabel={`Make player ${i + 1} captain`}
                accessibilityState={{ selected: draft.captain === i }}
                onPress={() => onChange({ ...draft, captain: draft.captain === i ? undefined : i })}
                style={[styles.mark, draft.captain === i && styles.markOn]}
              >
                <Text style={[styles.markText, draft.captain === i && styles.markTextOn]}>C</Text>
              </PressableScale>
              <PressableScale
                accessibilityLabel={`Make player ${i + 1} wicketkeeper`}
                accessibilityState={{ selected: draft.keeper === i }}
                onPress={() => onChange({ ...draft, keeper: draft.keeper === i ? undefined : i })}
                style={[styles.mark, draft.keeper === i && styles.markOn]}
              >
                <Text style={[styles.markText, draft.keeper === i && styles.markTextOn]}>WK</Text>
              </PressableScale>
            </View>
          ))}
          <Text style={styles.help}>Leave a slot empty if the side is short: they play with the names here. Tap C for the captain, WK for the keeper.</Text>
          <View style={styles.pasteBox}>
            <TextInput
              value={paste}
              onChangeText={setPaste}
              placeholder="Or paste the whole squad: Rohit, Virat, Surya…"
              placeholderTextColor={colors.faint}
              style={styles.pasteInput}
              multiline
            />
            {pasted.length >= 2 && (
              <Button
                variant="ghost"
                icon="clipboard-outline"
                label={`Use these ${pasted.length} names`}
                onPress={() => {
                  onSquad({ ...draft, players: pasted });
                  setPaste('');
                }}
              />
            )}
          </View>
        </View>
      )}
    </Card>
  );
}

export default function NewMatch() {
  const insets = useSafeAreaInsets();
  const { rematch, series: continueSeries, auction } = useLocalSearchParams<{ rematch?: string; series?: string; auction?: string }>();
  const { savedTeams, rememberTeams, saveMatch, matches } = useMatches();
  const { auctions, saveAuction } = useSquad();
  const fromAuction = auction ? auctions.find((a) => a.id === auction) : undefined;
  const [auctionDrafts] = useState(() => (fromAuction ? draftsFromAuction(fromAuction) : null));
  const source: Match | undefined = rematch ? matches.find((m) => m.id === rematch) : undefined;
  const last: Match | undefined = matches[0];
  const [size, setSize] = useState(
    () =>
      (auctionDrafts && Math.max(auctionDrafts[0].players.length, auctionDrafts[1].players.length)) ||
      (source?.rules.playersPerSide ?? last?.rules.playersPerSide ?? 8),
  );
  const [teams, setTeams] = useState<[Draft, Draft]>(() =>
    // An auction's sides keep their own sizes: an odd squad leaves one side a player short, not padded with a blank
    // who'd count as a batter.
    auctionDrafts
      ? [auctionDrafts[0], auctionDrafts[1]]
      : source
      ? [draftFrom(source.teams[0], source), draftFrom(source.teams[1], source)]
      : [
          { name: '', players: resize([], size) },
          { name: '', players: resize([], size) },
        ],
  );
  // Only the length is chosen here; the club's house rules are the same every match.
  const [rules, setRules] = useState<Omit<Rules, 'playersPerSide'>>(() => ({ ...HOUSE_RULES, overs: (source ?? last)?.rules.overs ?? 10 }));
  // The next match of a series carries the series on; otherwise a series can be started here.
  const ongoing = continueSeries && source?.series ? seriesState(matches.filter((m) => m.series?.id === source.series!.id)) : null;
  const [kind, setKind] = useState<'single' | 'series'>('single');
  const [seriesOf, setSeriesOf] = useState<'3' | '5' | '7'>('3');
  const [seriesName, setSeriesName] = useState('');
  const [common, setCommon] = useState(source ? source.teams[0].players.find((p) => p.common)?.name ?? '' : '');
  const toast = useToast();
  // The toss happens out in the middle once the sides are set: Start match opens it.
  const [tossing, setTossing] = useState(false);

  const names = teams.map((t, i) => t.name.trim() || (i === 0 ? 'Team A' : 'Team B'));
  const setSizeAll = (n: number) => {
    setSize(n);
    setTeams(([a, b]) => [
      { ...a, players: resize(a.players, n) },
      { ...b, players: resize(b.players, n) },
    ]);
  };
  const setSquad = (side: 0 | 1, d: Draft) => {
    const n = Math.min(11, Math.max(2, d.players.length));
    setSize(n);
    setTeams((both) => {
      const next = [...both] as [Draft, Draft];
      next[side] = { ...d, players: resize(d.players, n) };
      next[1 - side] = { ...both[1 - side], players: resize(both[1 - side].players, n) };
      return next;
    });
  };

  /**
   * Each side's players: the names filled in, empty slots left out, so a side can play a player or two short. A side
   * with no names at all plays as Player 1, Player 2…, for a quick match. `slot` is where each was in the list.
   */
  const lineUps = teams.map((t) => {
    const named = t.players.map((p, slot) => ({ name: p.trim(), slot })).filter((x) => x.name);
    return named.length ? named : t.players.map((_, slot) => ({ name: `Player ${slot + 1}`, slot }));
  });
  const tooFew = lineUps.findIndex((l) => l.length < 2);

  const start = ({ winner: tossWinner, choice }: TossResult) => {
    const built = teams.map(
      (t, i): Team => ({
        id: newId(),
        name: names[i],
        players: [
          ...lineUps[i].map((x) => ({ id: newId(), name: x.name })),
          // The common player turns out for both sides.
          ...(common.trim() ? [{ id: newId(), name: common.trim(), common: true }] : []),
        ],
      }),
    ) as [Team, Team];
    // The longer side's count; the other plays short.
    const sideSize = Math.max(lineUps[0].length, lineUps[1].length);
    const match = newMatch(newId(), built, { ...rules, playersPerSide: sideSize }, {
      winner: built[Number(tossWinner)].id,
      choice,
    });
    const series: SeriesInfo | undefined = ongoing?.next
      ? { ...source!.series!, number: ongoing.next }
      : kind === 'series'
        ? { id: newId(), name: seriesName.trim() || `${names[0]} vs ${names[1]}`, of: Number(seriesOf), number: 1 }
        : undefined;
    if (series) match.series = series;
    const pick = (key: 'captain' | 'keeper') =>
      Object.fromEntries(
        built.flatMap((t, i) => {
          // The captain and keeper were marked by their slot in the list; find them among the players kept.
          const at = lineUps[i].findIndex((x) => x.slot === teams[i][key]);
          return at >= 0 ? [[t.id, t.players[at].id]] : [];
        }),
      );
    match.captains = pick('captain');
    match.keepers = pick('keeper');
    rememberTeams(
      built
        .filter((t, i) => teams[i].name.trim())
        .map((t) => ({ ...t, captain: match.captains?.[t.id], keeper: match.keepers?.[t.id] })),
    );
    saveMatch(match);
    if (fromAuction) saveAuction({ ...fromAuction, matchId: match.id });
    tap('success');
    router.replace({ pathname: '/match/[id]', params: { id: match.id } });
  };

  return (
    <Screen>
      <View style={styles.header}>
        <IconButton icon="chevron-back" label="Back" onPress={() => router.back()} />
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{ padding: space.lg, paddingBottom: 140 }}
          keyboardShouldPersistTaps="handled"
        >
          {ongoing?.next ? (
            <>
              <Text style={styles.title}>
                Match {ongoing.next}
              </Text>
              <Text style={styles.subtitle}>
                {ongoing.name} · best of {ongoing.of} · {ongoing.status}
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.title}>
                {source ? 'Rematch' : 'New match'}
              </Text>
              <Text style={styles.subtitle}>
                {fromAuction
                  ? 'The teams from the auction, captains and keepers set. Then the toss.'
                  : source
                    ? 'Same teams. Straight to the toss.'
                    : 'Two teams, then out to the middle for the toss.'}
              </Text>
              <View style={{ marginTop: space.lg, gap: space.md }}>
                <Segmented
                  value={kind}
                  onChange={setKind}
                  options={[
                    { value: 'single', label: 'One match' },
                    { value: 'series', label: 'Series' },
                  ]}
                />
                {kind === 'series' && (
                  <Card style={{ gap: space.md }}>
                    <Text style={styles.question}>How long?</Text>
                    <Segmented
                      value={seriesOf}
                      onChange={setSeriesOf}
                      options={[
                        { value: '3', label: 'Best of 3' },
                        { value: '5', label: 'Best of 5' },
                        { value: '7', label: 'Best of 7' },
                      ]}
                    />
                    <TextInput
                      value={seriesName}
                      onChangeText={setSeriesName}
                      placeholder={`Name it, e.g. ${names[0]} vs ${names[1]} Cup`}
                      placeholderTextColor={colors.faint}
                      style={styles.seriesInput}
                      maxLength={40}
                      autoCapitalize="words"
                    />
                    <Text style={styles.help}>
                      First to {Math.floor(Number(seriesOf) / 2) + 1} wins. Man of the Series is picked across every match.
                    </Text>
                  </Card>
                )}
              </View>
            </>
          )}
          <SectionLabel>Teams</SectionLabel>
          {!fromAuction && !source && (
            <PressableScale scaleTo={0.98} onPress={() => router.push('/auction/new')} style={styles.auctionLink}>
              <Ionicons name="hammer-outline" size={18} color={colors.accentInk} />
              <Text style={styles.auctionText}>Pick the teams by auction</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.faint} />
            </PressableScale>
          )}
          <View style={{ gap: space.md }}>
            <TeamEditor label="Team A" draft={teams[0]} saved={savedTeams} onChange={(d) => setTeams([d, teams[1]])} onSquad={(d) => setSquad(0, d)} />
            <View style={styles.vs} pointerEvents="none">
              <View style={styles.vsBadge}>
                <Text style={styles.vsText}>vs</Text>
              </View>
            </View>
            <TeamEditor label="Team B" draft={teams[1]} saved={savedTeams} onChange={(d) => setTeams([teams[0], d])} onSquad={(d) => setSquad(1, d)} />
          </View>

          <Card style={{ gap: space.sm, marginTop: space.md }}>
            <Text style={styles.question}>Common player (optional)</Text>
            <TextInput
              value={common}
              onChangeText={setCommon}
              placeholder="Plays for both sides, e.g. when a team is short"
              placeholderTextColor={colors.faint}
              style={styles.seriesInput}
              maxLength={24}
              autoCapitalize="words"
            />
            {common.trim() ? (
              <Text style={styles.help}>{common.trim()} bats and bowls for both teams; their stats count once.</Text>
            ) : null}
          </Card>

          <SectionLabel>Format</SectionLabel>
          <Card style={{ paddingVertical: space.sm }}>
            <Stepper label="Overs" hint="Per innings" value={rules.overs} min={1} max={50} onChange={(overs) => setRules((r) => ({ ...r, overs }))} />
            <View style={styles.divider} />
            <Stepper label="Players" hint="Per side" value={size} min={2} max={11} onChange={setSizeAll} />
            {(() => {
              // Can the side bowl the whole innings under the limit?
              const limit = rules.maxOversPerBowler ?? 0;
              const room = limit ? size * limit + Math.min(rules.extraOverBowlers ?? 0, size) : Infinity;
              return room < rules.overs ? (
                <Text style={[styles.help, { marginLeft: 0, paddingBottom: space.sm, color: colors.gold }]}>
                  {size} bowlers can only bowl {room} of the {rules.overs} overs under this limit. When everyone has bowled their share,
                  anyone can bowl the rest.
                </Text>
              ) : null;
            })()}
          </Card>

        </ScrollView>
      </KeyboardAvoidingView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}>
        <Button
          label={ongoing?.next ? `Start match ${ongoing.next}` : kind === 'series' ? 'Start the series' : 'Start match'}
          icon="play"
          onPress={() => {
            if (tooFew >= 0) {
              toast.show(`${names[tooFew]} needs at least 2 players`, 'error');
              return;
            }
            setTossing(true);
          }}
        />
      </View>
      <TossScene
        visible={tossing}
        names={[names[0], names[1]]}
        captains={[0, 1].map((i) => {
          const c = teams[i].captain;
          return c !== undefined && teams[i].players[c]?.trim() ? teams[i].players[c].trim() : null;
        }) as [string | null, string | null]}
        onClose={() => setTossing(false)}
        onDone={(result) => {
          setTossing(false);
          start(result);
        }}
      />
      {toast.element}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pasteBox: { gap: space.sm, marginTop: space.sm },
  mark: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderHi,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  markText: { color: colors.faint, fontSize: 11, fontFamily: font.heavy },
  markTextOn: { color: colors.onAccent },
  seriesInput: {
    color: colors.text,
    fontSize: 15,
    fontFamily: font.medium,
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: space.md,
    height: 46,
  },
  pasteInput: {
    color: colors.text,
    fontSize: 14,
    fontFamily: font.regular,
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderHi,
    padding: space.md,
    minHeight: 64,
    textAlignVertical: 'top',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  title: { fontFamily: font.posterBlack, fontSize: 38, lineHeight: 42, color: colors.text, letterSpacing: -1.4 },
  subtitle: { color: colors.muted, fontSize: 15, fontFamily: font.medium, marginTop: 4 },
  teamInput: { color: colors.text, fontSize: 23, fontFamily: font.posterBlack, paddingVertical: 2, letterSpacing: -0.8 },
  squadToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.surfaceHi,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    height: 46,
  },
  squadText: { color: colors.muted, fontSize: 14, fontFamily: font.semibold, flex: 1 },
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  playerNum: { color: colors.faint, width: 20, textAlign: 'right', fontFamily: font.bold },
  playerInput: {
    flex: 1,
    color: colors.text,
    fontSize: 15, fontFamily: font.regular,
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: space.md,
    height: 42,
  },
  help: { color: colors.faint, fontSize: 12, fontFamily: font.regular, marginLeft: 32 },
  vs: { alignItems: 'center', marginVertical: -26, zIndex: 2 },
  vsBadge: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: colors.bg,
  },
  vsText: { color: colors.bg, fontFamily: font.posterBlack, fontSize: 15 },
  divider: { height: 1, backgroundColor: colors.border },
  auctionLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.accentDim,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    height: 48,
    marginBottom: space.md,
  },
  auctionText: { flex: 1, color: colors.text, fontSize: 14, fontFamily: font.bold },
  question: { color: colors.muted, fontSize: 13, fontFamily: font.bold },
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
