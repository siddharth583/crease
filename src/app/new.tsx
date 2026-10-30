import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Animated, KeyboardAvoidingView, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Chip, IconButton, PressableScale, Screen, SectionLabel, Segmented, Stepper, tap, useToast } from '../components/ui.tsx';
import { TossScene, type TossResult } from '../components/TossScene.tsx';
import { NameSuggestions } from '../components/NameSuggestions.tsx';
import { auctionState, rosterPlayer, type Auction } from '../engine/auction.ts';
import { newMatch } from '../engine/engine.ts';
import { seriesState } from '../engine/stats.ts';
import type { Match, Rules, SeriesInfo, Team } from '../engine/types.ts';
import { newId, useMatches } from '../store/matches.tsx';
import { HOUSE_RULES } from '../engine/squad.ts';
import { fillSides, strengths } from '../engine/teams.ts';
import { useSquad } from '../store/squad.ts';
import { colors, edge, radius, space, font } from '../theme.ts';

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

/** Sides from the Teams tab: `[{ name, players, captain?, keeper? }, …]`, or null when they can't be read. */
function draftsFromParam(json: string): [Draft, Draft] | null {
  try {
    const sides = JSON.parse(json) as Draft[];
    if (!Array.isArray(sides) || sides.length !== 2 || !sides.every((s) => typeof s.name === 'string' && Array.isArray(s.players))) return null;
    return sides.map((s) => ({ name: s.name, players: s.players.map(String).slice(0, 11), captain: s.captain, keeper: s.keeper })) as [Draft, Draft];
  } catch {
    return null;
  }
}

/** A player row's height and the gap under it: how far a dragged row travels to swap places with the next. */
const ROW = 42 + space.sm;

/** Where a slot ends up when the player in `from` is dragged to `to`. */
const moved = (k: number, from: number, to: number) =>
  k === from ? to : from < to && k > from && k <= to ? k - 1 : from > to && k >= to && k < from ? k + 1 : k;

/** The handle on a player row: hold it and drag the row up or down the list. */
function Grip({ index, compact, onStart, onMove, onEnd }: { index: number; compact?: boolean; onStart: (i: number) => void; onMove: (dy: number) => void; onEnd: (dy: number) => void }) {
  // The responder is made once; it calls whatever the latest props are.
  const latest = useRef({ index, onStart, onMove, onEnd });
  latest.current = { index, onStart, onMove, onEnd };
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => latest.current.onStart(latest.current.index),
      onPanResponderMove: (_, g) => latest.current.onMove(g.dy),
      onPanResponderRelease: (_, g) => latest.current.onEnd(g.dy),
      onPanResponderTerminate: (_, g) => latest.current.onEnd(g.dy),
    }),
  ).current;
  return (
    <View {...pan.panHandlers} accessibilityLabel={`Hold and drag to move player ${index + 1}`} style={styles.grip}>
      <Ionicons name="reorder-two" size={16} color={colors.faint} />
      {!compact && <Text style={styles.playerNum}>{index + 1}</Text>}
    </View>
  );
}

function TeamEditor({
  label,
  draft,
  onChange,
  onSquad,
  saved,
  onDragging,
  onSwap,
  other,
  otherNames,
}: {
  label: string;
  draft: Draft;
  onChange: (d: Draft) => void;
  /** A whole squad arrived (saved team or pasted list): its size becomes the side size. */
  onSquad: (d: Draft) => void;
  saved: Team[];
  /** A row is being dragged: the page shouldn't scroll under it. */
  onDragging: (on: boolean) => void;
  /** Send the player in this slot to the other side. */
  onSwap: (slot: number) => void;
  /** The other side's name, for the swap button. */
  other: string;
  /** The other side's players: not suggested for this one. */
  otherNames: string[];
}) {
  const [open, setOpen] = useState(false);
  // The slot being typed in, for its name suggestions. Kept a moment after it loses focus, so a suggestion can be tapped.
  const [typing, setTyping] = useState<number | null>(null);
  // A narrow phone: the slot number goes and the buttons slim down, so the name keeps room to be read.
  const compact = useWindowDimensions().width < 380;
  const mark = [styles.mark, compact && styles.markCompact];
  // The row being dragged, from its slot to where it would land, and how far it has moved.
  const [drag, setDrag] = useState<{ from: number; to: number } | null>(null);
  const dragging = useRef(drag);
  dragging.current = drag;
  const dy = useRef(new Animated.Value(0)).current;
  const [paste, setPaste] = useState('');
  const pasted = parseNames(paste);
  const named = draft.players.filter((p) => p.trim()).length;
  const landing = (from: number, d: number) => Math.max(0, Math.min(draft.players.length - 1, from + Math.round(d / ROW)));
  const startDrag = (i: number) => {
    tap();
    dy.setValue(0);
    setDrag({ from: i, to: i });
    onDragging(true);
  };
  const moveDrag = (d: number) => {
    const now = dragging.current;
    if (!now) return;
    dy.setValue(d);
    const to = landing(now.from, d);
    if (to !== now.to) {
      tap();
      setDrag({ from: now.from, to });
    }
  };
  /** The player lands in their new slot; the captain and keeper marks go with whoever they were on. */
  const endDrag = (d: number) => {
    const now = dragging.current;
    if (!now) return;
    const to = landing(now.from, d);
    if (to !== now.from) {
      const players = [...draft.players];
      players.splice(to, 0, ...players.splice(now.from, 1));
      const follow = (at?: number) => (at === undefined ? at : moved(at, now.from, to));
      onChange({ ...draft, players, captain: follow(draft.captain), keeper: follow(draft.keeper) });
    }
    setDrag(null);
    dy.setValue(0);
    onDragging(false);
  };

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
            // The row being dragged rides over the others.
            <View key={i} style={[{ gap: space.sm }, drag && i === drag.from && { zIndex: 10 }]}>
            <Animated.View
              style={[
                styles.playerRow,
                drag && i === drag.from
                  ? [styles.lifted, { transform: [{ translateY: dy }] }]
                  : drag && { transform: [{ translateY: (moved(i, drag.from, drag.to) - i) * ROW }] },
              ]}
            >
              <Grip index={i} compact={compact} onStart={startDrag} onMove={moveDrag} onEnd={endDrag} />
              <TextInput
                value={p}
                onChangeText={(v) => onChange({ ...draft, players: draft.players.map((x, j) => (j === i ? v : x)) })}
                onFocus={() => setTyping(i)}
                onBlur={() => setTimeout(() => setTyping((t) => (t === i ? null : t)), 250)}
                placeholder={`Player ${i + 1}`}
                placeholderTextColor={colors.faint}
                style={[styles.playerInput, compact && styles.playerInputCompact]}
                maxLength={24}
                autoCapitalize="words"
                returnKeyType="next"
              />
              <PressableScale
                accessibilityLabel={`Make player ${i + 1} captain`}
                accessibilityState={{ selected: draft.captain === i }}
                onPress={() => onChange({ ...draft, captain: draft.captain === i ? undefined : i })}
                style={[mark, draft.captain === i && styles.markOn]}
              >
                <Text style={[styles.markText, draft.captain === i && styles.markTextOn]}>C</Text>
              </PressableScale>
              <PressableScale
                accessibilityLabel={`Make player ${i + 1} wicketkeeper`}
                accessibilityState={{ selected: draft.keeper === i }}
                onPress={() => onChange({ ...draft, keeper: draft.keeper === i ? undefined : i })}
                style={[mark, draft.keeper === i && styles.markOn]}
              >
                <Text style={[styles.markText, draft.keeper === i && styles.markTextOn]}>WK</Text>
              </PressableScale>
              <PressableScale
                accessibilityLabel={p.trim() ? `Move ${p.trim()} to ${other}` : `Move player ${i + 1} to ${other}`}
                disabled={!p.trim()}
                onPress={() => onSwap(i)}
                style={[mark, !p.trim() && { opacity: 0.35 }]}
              >
                <Ionicons name="swap-vertical" size={16} color={colors.muted} />
              </PressableScale>
            </Animated.View>
            {typing === i && !drag && (
              <View style={styles.suggestions}>
                <NameSuggestions
                  value={p}
                  taken={[...draft.players.filter((_, j) => j !== i), ...otherNames]}
                  onPick={(name) => {
                    onChange({ ...draft, players: draft.players.map((x, j) => (j === i ? name : x)) });
                    setTyping(null);
                  }}
                />
              </View>
            )}
            </View>
          ))}
          <Text style={styles.help}>
            Hold ≡ and drag a player to change the order. Leave a slot empty if the side is short. Tap C for the captain, WK for the
            keeper, and ⇅ to send a player to {other}.
          </Text>
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
  const { rematch, series: continueSeries, auction, sides } = useLocalSearchParams<{ rematch?: string; series?: string; auction?: string; sides?: string }>();
  const { savedTeams, rememberTeams, saveMatch, matches } = useMatches();
  const { auctions, saveAuction, squad } = useSquad();
  const fromAuction = auction ? auctions.find((a) => a.id === auction) : undefined;
  // Sides made on the Teams tab arrive whole, like an auction's.
  const [auctionDrafts] = useState(() => (fromAuction ? draftsFromAuction(fromAuction) : sides ? draftsFromParam(sides) : null));
  const table = useMemo(() => strengths(matches, squad), [matches, squad]);
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
  // No scrolling while a player row is being dragged.
  const [locked, setLocked] = useState(false);

  const names = teams.map((t, i) => t.name.trim() || (i === 0 ? 'Team A' : 'Team B'));
  // A saved team picked for one side isn't offered to the other.
  const savedFor = (side: 0 | 1) => savedTeams.filter((t) => t.name.trim().toLowerCase() !== teams[1 - side].name.trim().toLowerCase());
  const setSizeAll = (n: number) => {
    const grown = teams.map((t) => resize(t.players, n)) as [string[], string[]];
    // More players a side: once the squad is being used, its players not on either side are shared out, the weaker
    // side (on form) taking the best one left each time.
    const known = (name: string) => table.has(name.trim().toLowerCase());
    const joined = n > size && teams.some((t) => t.players.some(known)) ? fillSides(grown, n, [...table.values()], table) : [[], []];
    const filled = grown.map((players, i) => {
      const add = [...joined[i]];
      return players.map((p) => (p.trim() || !add.length ? p : add.shift()!));
    });
    setSize(n);
    setTeams(([a, b]) => [
      { ...a, players: filled[0] },
      { ...b, players: filled[1] },
    ]);
    const added = joined.map((j, i) => (j.length ? `${j.join(', ')} to ${names[i]}` : '')).filter(Boolean);
    if (added.length) toast.show(`Added ${added.join(' and ')}, to keep the sides even`, 'info');
  };
  /**
   * A player changes sides: their slot here empties and they take the other side's first empty one, or join it as a
   * player more when it's full. Captain and keeper marks stay with the players they were on.
   */
  const swap = (side: 0 | 1, slot: number) => {
    const from = teams[side];
    const to = teams[1 - side];
    const name = from.players[slot].trim();
    if (!name) return;
    const left = [...from.players];
    left.splice(slot, 1);
    left.push('');
    const shift = (at?: number) => (at === undefined || at === slot ? undefined : at > slot ? at - 1 : at);
    const joined = [...to.players];
    const gap = joined.findIndex((p) => !p.trim());
    if (gap < 0 && joined.length >= 11) return toast.show(`${names[1 - side]} already have 11. Send someone the other way first.`, 'info');
    if (gap >= 0) joined[gap] = name;
    else joined.push(name);
    const n = Math.min(11, Math.max(left.length, joined.length));
    const next = [] as unknown as [Draft, Draft];
    next[side] = { ...from, players: resize(left, n), captain: shift(from.captain), keeper: shift(from.keeper) };
    next[1 - side] = { ...to, players: resize(joined, n) };
    setSize(n);
    setTeams(next);
    toast.show(`${name} moved to ${names[1 - side]}`, 'info');
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
          scrollEnabled={!locked}
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
            <TeamEditor label="Team A" draft={teams[0]} saved={savedFor(0)} onChange={(d) => setTeams([d, teams[1]])} onSquad={(d) => setSquad(0, d)} onDragging={setLocked} onSwap={(i) => swap(0, i)} other={names[1]} otherNames={teams[1].players} />
            <View style={styles.vs} pointerEvents="none">
              <View style={styles.vsBadge}>
                <Text style={styles.vsText}>vs</Text>
              </View>
            </View>
            <TeamEditor label="Team B" draft={teams[1]} saved={savedFor(1)} onChange={(d) => setTeams([teams[0], d])} onSquad={(d) => setSquad(1, d)} onDragging={setLocked} onSwap={(i) => swap(1, i)} other={names[0]} otherNames={teams[0].players} />
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
            <NameSuggestions value={common} taken={[...teams[0].players, ...teams[1].players]} onPick={setCommon} />
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
  markCompact: { width: 30 },
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
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  playerNum: { color: colors.faint, width: 18, textAlign: 'right', fontFamily: font.bold },
  grip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 42,
    paddingRight: 2,
    // On the web: a drag here moves the row, not the page, and doesn't select text.
    ...(Platform.OS === 'web' ? ({ touchAction: 'none', userSelect: 'none', cursor: 'grab' } as object) : null),
  },
  suggestions: { marginLeft: 32 },
  playerInputCompact: { paddingHorizontal: space.sm },
  lifted: { zIndex: 10, backgroundColor: colors.surfaceHi, borderRadius: radius.sm, ...edge },
  playerInput: {
    flex: 1,
    // On a narrow phone the name gives way, so the C, WK and swap buttons stay on screen.
    minWidth: 0,
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
