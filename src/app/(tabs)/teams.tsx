import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { NameSuggestions } from '../../components/NameSuggestions.tsx';
import { FormBadge } from '../../components/Ratings.tsx';
import { Button, Card, Chip, FadeIn, PressableScale, Screen, SectionLabel, Segmented, useToast } from '../../components/ui.tsx';
import { DEFAULT_SQUAD } from '../../engine/squad.ts';
import {
  applyFix,
  evenSides,
  nameKey,
  rebalance,
  recentResults,
  sideStrength,
  strengthOf,
  strengths,
  type Fix,
  type SavedLineup,
  type SideStrength,
  type Strength,
} from '../../engine/teams.ts';
import type { Team } from '../../engine/types.ts';
import { newId, useMatches } from '../../store/matches.tsx';
import { useSquad } from '../../store/squad.ts';
import { colors, font, radius, space, type } from '../../theme.ts';

// The sides: how strong each is on current form, and two even sides from whoever turns up today.

const TINTS = [colors.accentInk, colors.violet];

/** Changing a recommended side: rename it, pick a player to swap, or send one to the other side. */
type SideEdit = { other: string; picked: string | null; onRename: (name: string) => void; onPick: (player: string) => void; onMove: (player: string) => void };

/** A side's strength in a few numbers, then its players best first. With `edit`, the side can be changed. */
function SideCard({
  name,
  s,
  tint,
  captain,
  note,
  edit,
  tagged = [],
  results,
}: {
  name: string;
  s: SideStrength;
  tint: string;
  captain?: string;
  note?: string;
  edit?: SideEdit;
  /** Players Crease suggests moving to even the sides up. */
  tagged?: string[];
  /** Their last results, newest first. */
  results?: ('W' | 'L' | 'T')[];
}) {
  const isTagged = (n: string) => tagged.some((x) => nameKey(x) === nameKey(n));
  const isCaptain = (n: string) => Boolean(captain) && nameKey(captain!) === nameKey(n);
  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <View style={styles.sideHead}>
        <View style={[styles.sideBar, { backgroundColor: tint }]} />
        <View style={{ flex: 1, minWidth: 0 }}>
          {edit ? (
            <TextInput
              value={name}
              onChangeText={edit.onRename}
              style={[styles.sideName, styles.sideNameInput]}
              maxLength={28}
              autoCapitalize="words"
              accessibilityLabel={`Rename ${name}`}
            />
          ) : (
            <Text style={styles.sideName} numberOfLines={1}>
              {name}
            </Text>
          )}
          <Text style={styles.sideMeta}>
            {s.players.length} players{note ? ` · ${note}` : ''}
          </Text>
          {results && results.length > 0 && (
            <View style={styles.results} accessibilityLabel={`Last ${results.length} results, newest first: ${results.join(' ')}`}>
              {results.map((r, k) => (
                <Text key={k} style={[styles.result, r === 'W' ? styles.won : r === 'L' ? styles.lost : null]}>
                  {r}
                </Text>
              ))}
              <Text style={styles.sideMeta}>  last {results.length}, newest first</Text>
            </View>
          )}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.power, { color: tint }]}>
            {s.power.toFixed(1)}
            <Text style={styles.powerOf}>/10</Text>
          </Text>
          <Text style={styles.sideMeta}>Strength</Text>
        </View>
      </View>
      <View style={styles.facts}>
        {[
          ['Form', s.form === null ? '–' : s.form.toFixed(1)],
          ['Batting', `${s.bat.toFixed(1)}★`],
          ['Bowling', `${s.bowl.toFixed(1)}★`],
          ['Bowlers', String(s.bowlers)],
          ['Keepers', String(s.keepers)],
        ].map(([k, v]) => (
          <View key={k} style={styles.fact}>
            <Text style={styles.factValue}>{v}</Text>
            <Text style={styles.factKey}>{k}</Text>
          </View>
        ))}
      </View>
      {[...s.players].sort((p, q) => Number(isCaptain(q.name)) - Number(isCaptain(p.name))).map((p, i) => {
        const picked = edit?.picked !== null && edit?.picked !== undefined && nameKey(edit.picked) === nameKey(p.name);
        const row = (
          <>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.playerName} numberOfLines={1}>
              {p.name}
              {isCaptain(p.name) ? <Text style={styles.mark}>{'\u00A0\u00A0'}C</Text> : null}
              {p.keeper ? <Text style={styles.mark}>{'\u00A0\u00A0'}WK</Text> : null}
              {p.guest ? <Text style={styles.markDim}>{'\u00A0\u00A0'}GUEST</Text> : null}
            </Text>
            {isTagged(p.name) && (
              <View style={styles.tag}>
                <Ionicons name="swap-vertical" size={11} color={colors.onAccent} />
                <Text style={styles.tagText}>Suggested: to even it up</Text>
              </View>
            )}
            <Text style={styles.playerSub} numberOfLines={1}>
              {p.guest ? 'Not in the squad: counted as average' : `Bat ${p.bat}★ · Bowl ${p.bowl}★${p.form === null ? ' · no matches yet' : ''}`}
            </Text>
          </View>
          {p.form !== null && <FormBadge form={p.form} />}
          <Text style={styles.playerPower}>{p.power.toFixed(1)}</Text>
          </>
        );
        const rowStyle = [styles.player, i === 0 && { borderTopWidth: 0 }, picked && styles.picked];
        // The row picks the player; ⇅ sits beside it (a button can't hold another).
        return edit ? (
          <View key={p.name} style={[rowStyle, { paddingVertical: 0 }]}>
            <PressableScale
              scaleTo={0.99}
              accessibilityLabel={picked ? `${p.name}, picked: tap a player in ${edit.other} to swap` : `Pick ${p.name} to swap`}
              accessibilityState={{ selected: picked }}
              onPress={() => edit.onPick(p.name)}
              wrapStyle={{ flex: 1, minWidth: 0 }}
              style={styles.pickArea}
            >
              {row}
            </PressableScale>
            <PressableScale accessibilityLabel={`Move ${p.name} to ${edit.other}`} hitSlop={6} onPress={() => edit.onMove(p.name)} style={styles.move}>
              <Ionicons name="swap-vertical" size={16} color={colors.muted} />
            </PressableScale>
          </View>
        ) : (
          <View key={p.name} style={rowStyle}>
            {row}
          </View>
        );
      })}
    </Card>
  );
}

/** Which of two sides is stronger, and by how much. */
function verdict(names: [string, string], a: SideStrength, b: SideStrength): string {
  const d = Math.round(Math.abs(a.power - b.power) * 10) / 10;
  if (d < 0.2) return 'Dead level on form';
  return `${a.power > b.power ? names[0] : names[1]} ${d < 0.6 ? 'just ahead' : 'stronger'} by ${d.toFixed(1)}`;
}

function StrengthView({ table }: { table: Map<string, Strength> }) {
  const { savedTeams, matches } = useMatches();
  const sides = savedTeams
    .map((t) => ({ team: t, s: sideStrength(t.players.filter((p) => !p.common).map((p) => strengthOf(table, p.name))) }))
    .filter((x) => x.team.players.length >= 2);
  if (!sides.length) {
    return (
      <Card>
        <Text style={styles.hint}>No saved sides yet. Start a match and its two sides are kept here, or make two even ones in Recommend.</Text>
      </Card>
    );
  }
  const [a, b] = sides;
  return (
    <View style={{ gap: space.md }}>
      {b && (
        <FadeIn>
          <Card style={styles.compare}>
            {[a, b].map((x, i) => (
              <View key={x.team.id} style={[styles.compareSide, i === 1 && { alignItems: 'flex-end' }]}>
                <Text style={[styles.comparePower, { color: TINTS[i] }]}>{x.s.power.toFixed(1)}</Text>
                <Text style={styles.compareName} numberOfLines={1}>
                  {x.team.name}
                </Text>
              </View>
            ))}
          </Card>
          <Text style={styles.verdict}>{verdict([a.team.name, b.team.name], a.s, b.s)}</Text>
        </FadeIn>
      )}
      {sides.map((x, i) => (
        <FadeIn key={x.team.id} delay={60 + i * 60}>
          <SideCard name={x.team.name} s={x.s} tint={TINTS[i % 2]} captain={x.team.players.find((p) => p.id === x.team.captain)?.name} results={recentResults(matches, x.team.name)} />
        </FadeIn>
      ))}
      <Text style={styles.hint}>
        Strength is out of 10: mostly each player’s form (their last five match ratings), steadied by their stars so one
        big game doesn’t swing it. A player with no matches yet plays to their stars.
      </Text>
    </View>
  );
}

/** How a fix reads: "send Rajeev to Copan Strikers" or "swap Rajeev and Chirag Taneja". */
function fixText(fix: Fix, names: [string, string]) {
  return fix.kind === 'move' ? `send ${fix.player} to ${names[fix.to]}` : `swap ${fix.players[0]} and ${fix.players[1]}`;
}
const fixPlayers = (fix: Fix) => (fix.kind === 'move' ? [fix.player] : fix.players);

/** One kept line-up: its sides on today's form, and what can be done with it. */
function LineupCard({ l, table, onStart, onEdit, onDelete }: { l: SavedLineup; table: Map<string, Strength>; onStart: () => void; onEdit: () => void; onDelete: () => void }) {
  const [arming, setArming] = useState(false);
  const s = l.sides.map((side) => sideStrength(side.players.map((n) => strengthOf(table, n))));
  return (
    <Card style={{ gap: space.sm }}>
      <View style={styles.lineupHead}>
        <Text style={styles.lineupTitle} numberOfLines={1}>
          {l.sides[0].name} v {l.sides[1].name}
        </Text>
        <Text style={styles.count}>{new Date(l.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</Text>
      </View>
      {l.sides.map((side, i) => (
        <Text key={i} style={styles.hint} numberOfLines={2}>
          <Text style={{ color: TINTS[i], fontFamily: font.bold }}>
            {side.name} {s[i].power.toFixed(1)}
          </Text>
          {'  '}
          {side.players.map((n) => (side.captain && nameKey(n) === nameKey(side.captain) ? `${n} (c)` : n)).join(', ')}
        </Text>
      ))}
      <Text style={styles.playerSub}>Strength on today’s form, so it moves as players’ form does.</Text>
      <View style={styles.wrap}>
        <Chip icon="play" label="Start a match" onPress={onStart} />
        <Chip icon="create-outline" label="Edit" onPress={onEdit} />
        <Chip icon="trash-outline" tone="danger" selected={arming} label={arming ? 'Tap again to delete' : 'Delete'} onPress={() => (arming ? onDelete() : setArming(true))} />
      </View>
    </Card>
  );
}

function RecommendView({ table }: { table: Map<string, Strength> }) {
  const { savedTeams, rememberTeams } = useMatches();
  const { squad, lineups, saveLineup, deleteLineup } = useSquad();
  const toast = useToast();
  const everyone = useMemo(() => [...table.values()].sort((a, b) => a.name.localeCompare(b.name)), [table]);
  const [out, setOut] = useState<Set<string>>(new Set());
  const [guests, setGuests] = useState<string[]>([]);
  const [guestDraft, setGuestDraft] = useState('');
  const [captains, setCaptains] = useState<string[]>([]);
  const [seed, setSeed] = useState(1);
  const [saving, setSaving] = useState(false);
  // The sides as changed by hand, until who's playing, the captains or the shuffle change.
  const [edit, setEdit] = useState<[string[], string[]] | null>(null);
  // Players moved by hand: a suggestion to even things up leaves them where they were put.
  const [kept, setKept] = useState<string[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [renamed, setRenamed] = useState<[string?, string?]>([]);
  const playing = useMemo(
    () => [...everyone.filter((p) => !out.has(nameKey(p.name))), ...guests.map((g) => strengthOf(table, g))],
    [everyone, out, guests, table],
  );
  const caps = useMemo(() => captains.filter((c) => playing.some((p) => nameKey(p.name) === nameKey(c))), [captains, playing]);
  // Worked out again only when who's playing, the captains or the shuffle change: not on every redraw.
  const split = useMemo(() => (playing.length >= 2 ? evenSides(playing, seed, [caps[0], caps[1]]) : null), [playing, seed, caps]);
  const names: [string, string] = [renamed[0] ?? savedTeams[0]?.name ?? 'Team A', renamed[1] ?? savedTeams[1]?.name ?? 'Team B'];
  const lists: [string[], string[]] | null = useMemo(
    () => edit ?? (split ? [split.sides[0].map((p) => p.name), split.sides[1].map((p) => p.name)] : null),
    [edit, split],
  );
  const edited = edit !== null;
  const strength = lists ? (lists.map((l) => sideStrength(l.map((n) => strengthOf(table, n)))) as [SideStrength, SideStrength]) : null;
  // How far apart the sides are, on the same out-of-10 strength the cards show.
  const apart = strength ? Math.round(Math.abs(strength[0].power - strength[1].power) * 10) / 10 : 0;
  const ahead = strength && strength[0].power > strength[1].power ? 0 : 1;
  const has = (list: string[], name: string) => list.some((n) => nameKey(n) === nameKey(name));
  // A pick only counts while that player is still on a side.
  const pickedNow = picked && lists && (has(lists[0], picked) || has(lists[1], picked)) ? picked : null;
  // After a change by hand: the one change that would even it up again, leaving the hand-moved players be.
  const suggestion = useMemo(() => (edited && lists ? rebalance(lists, table, kept) : null), [edited, lists, table, kept]);
  /** Each side's captain: whichever picked captain is on it now. */
  const captainOf = (i: number) => caps.find((c) => lists && has(lists[i], c));
  const sideOf = (name: string) => (lists && has(lists[0], name) ? 0 : 1);

  /** Anything that changes who's playing or how they're led starts a fresh suggestion. */
  const fresh = () => {
    setEdit(null);
    setKept([]);
    setPicked(null);
    setSaving(false);
  };
  const change = (next: [string[], string[]], moved: string[]) => {
    setEdit(next);
    setKept((k) => [...k.filter((x) => !moved.some((m) => nameKey(m) === nameKey(x))), ...moved]);
    setPicked(null);
    setSaving(false);
  };
  /** Send one player to the other side. */
  const move = (name: string) => {
    const from = sideOf(name);
    const next = applyFix(lists!, { kind: 'move', player: name, to: (1 - from) as 0 | 1 });
    if (!next[from].length) return toast.show('A side needs at least one player.', 'info');
    if (next[1 - from].length > 11) return toast.show(`${names[1 - from]} already have 11. Swap two players instead.`, 'info');
    change(next, [name]);
    toast.show(`${name} moved to ${names[1 - from]}`, 'info');
  };
  /** Pick a player, then one on the other side: they change places. */
  const pick = (name: string) => {
    if (!pickedNow || sideOf(pickedNow) === sideOf(name)) return setPicked(pickedNow && nameKey(pickedNow) === nameKey(name) ? null : name);
    const [a, b] = sideOf(pickedNow) === 0 ? [pickedNow, name] : [name, pickedNow];
    change(applyFix(lists!, { kind: 'swap', players: [a, b] }), [a, b]);
    toast.show(`${pickedNow} and ${name} swapped`, 'info');
  };
  const evenUp = () => {
    if (!suggestion) return;
    change(applyFix(lists!, suggestion.fix), fixPlayers(suggestion.fix));
    toast.show(`Done: ${fixText(suggestion.fix, names)}`, 'success');
  };

  const toggle = (name: string) => {
    const k = nameKey(name);
    setOut((s) => {
      const next = new Set(s);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
    fresh();
  };
  const toggleCaptain = (name: string) => {
    setCaptains((c) => (c.includes(name) ? c.filter((x) => x !== name) : [...c, name].slice(-2)));
    fresh();
  };
  const addGuest = () => {
    const name = guestDraft.trim().replace(/\s+/g, ' ');
    if (!name) return;
    if (playing.some((p) => nameKey(p.name) === nameKey(name))) return toast.show(`${name} is already playing.`, 'info');
    // Someone in the squad who was left out comes back in instead of joining as a guest.
    if (table.has(nameKey(name))) setOut((s) => new Set([...s].filter((k) => k !== nameKey(name))));
    else setGuests((g) => [...g, name]);
    setGuestDraft('');
    fresh();
  };

  type SideDraft = { name: string; players: string[]; captain?: string };
  /** Two sides as the match setup takes them: captain first, the first keeper keeping. */
  const draftsOf = (sides: SideDraft[]) =>
    sides.map((side, i) => {
      const cap = side.captain && has(side.players, side.captain) ? side.captain : undefined;
      const players = cap ? [cap, ...side.players.filter((n) => nameKey(n) !== nameKey(cap))] : side.players;
      const keeper = players.findIndex((n) => strengthOf(table, n).keeper);
      return { name: side.name.trim() || (i ? 'Team B' : 'Team A'), players, captain: cap ? 0 : undefined, keeper: keeper >= 0 ? keeper : undefined };
    });
  const current = (): SideDraft[] => lists!.map((players, i) => ({ name: names[i], players, captain: captainOf(i) }));
  const start = (sides: SideDraft[]) => router.push({ pathname: '/new', params: { sides: JSON.stringify(draftsOf(sides)) } });

  /** Save them as the two usual sides. A side keeps its id and its players' ids only while it keeps its name. */
  const save = () => {
    const teams = draftsOf(current()).map((d, i): Team => {
      const was = savedTeams.find((t) => nameKey(t.name) === nameKey(d.name));
      const side = d.players.map((n) => strengthOf(table, n));
      const players = side.map((p) => ({
        id: was?.players.find((x) => nameKey(x.name) === nameKey(p.name))?.id ?? newId(),
        name: p.name,
        role: squad.find((s) => nameKey(s.name) === nameKey(p.name))?.role ?? DEFAULT_SQUAD.find((s) => nameKey(s.name) === nameKey(p.name))?.role,
      }));
      const idOf = (name?: string) => players.find((p) => name && nameKey(p.name) === nameKey(name))?.id;
      return { id: was?.id ?? newId(), name: d.name, players, captain: idOf(captainOf(i)), keeper: idOf(side.find((p) => p.keeper)?.name) };
    });
    rememberTeams(teams);
    setSaving(false);
    toast.show(`${names[0]} and ${names[1]} saved with these players`, 'success');
  };
  /** Keep the line-up for later, unless the very same one is already kept. */
  const keep = () => {
    const sides = current().map((s) => ({ ...s, players: [...s.players] })) as SavedLineup['sides'];
    const key = (s: SideDraft) => `${nameKey(s.name)}|${s.players.map(nameKey).sort().join()}`;
    if (lineups.some((l) => l.sides.every((s, i) => key(s) === key(sides[i])))) return toast.show('That line-up is already saved.', 'info');
    saveLineup({ id: newId(), createdAt: Date.now(), sides });
    toast.show('Line-up saved. It’s under Saved line-ups below.', 'success');
  };
  /** A saved line-up back in the editor: its players playing, its captains leading, its names on the sides. */
  const load = (l: SavedLineup) => {
    const all = [...l.sides[0].players, ...l.sides[1].players];
    setOut(new Set(everyone.filter((p) => !has(all, p.name)).map((p) => nameKey(p.name))));
    setGuests(all.filter((n) => !table.has(nameKey(n))));
    setCaptains(l.sides.map((s) => s.captain).filter((c): c is string => Boolean(c)));
    setRenamed([l.sides[0].name, l.sides[1].name]);
    setEdit([[...l.sides[0].players], [...l.sides[1].players]]);
    setKept(all);
    setPicked(null);
    setSaving(false);
    toast.show('Line-up loaded: change it below.', 'info');
  };

  const tagged = suggestion ? fixPlayers(suggestion.fix) : [];
  return (
    <View style={{ gap: space.md }}>
      <SectionLabel right={<Text style={styles.count}>{playing.length} playing</Text>}>Who’s playing today</SectionLabel>
      <Card style={{ gap: space.sm }}>
        <Text style={styles.hint}>Tap anyone who isn’t here to leave them out. Add anyone else as a guest: they count as an average player.</Text>
        <View style={styles.wrap}>
          {everyone.map((p) => (
            <Chip key={p.name} label={p.name} selected={!out.has(nameKey(p.name))} onPress={() => toggle(p.name)} />
          ))}
          {guests.map((g) => (
            <Chip key={`guest-${g}`} icon="close" tone="violet" selected label={`${g} · guest`} onPress={() => (setGuests((x) => x.filter((n) => n !== g)), fresh())} />
          ))}
        </View>
        <View style={styles.guestRow}>
          <TextInput
            value={guestDraft}
            onChangeText={setGuestDraft}
            onSubmitEditing={addGuest}
            placeholder="Add a guest"
            placeholderTextColor={colors.faint}
            style={styles.guestInput}
            maxLength={24}
            autoCapitalize="words"
            returnKeyType="done"
          />
          <Chip icon="person-add-outline" label="Add" disabled={!guestDraft.trim()} onPress={addGuest} />
        </View>
        <NameSuggestions value={guestDraft} taken={playing.map((p) => p.name)} onPick={setGuestDraft} />
      </Card>

      <SectionLabel right={<Text style={styles.count}>{caps.length ? `${caps.length} of 2` : 'Optional'}</Text>}>Captains</SectionLabel>
      <Card style={{ gap: space.sm }}>
        <Text style={styles.hint}>Pick up to two and they lead opposite sides; the rest are shared out around them.</Text>
        <View style={styles.wrap}>
          {playing.map((p) => {
            const at = caps.findIndex((c) => nameKey(c) === nameKey(p.name));
            return <Chip key={p.name} label={at >= 0 ? `${p.name} · ${names[at]}` : p.name} tone={at === 1 ? 'violet' : 'accent'} selected={at >= 0} onPress={() => toggleCaptain(p.name)} />;
          })}
        </View>
      </Card>

      {split && lists && strength ? (
        <>
          <SectionLabel right={edited ? <Text style={styles.count}>Edited by you</Text> : undefined}>Two even sides</SectionLabel>
          <Card style={[styles.even, { flexDirection: 'column', alignItems: 'stretch' }]}>
            <View style={{ flexDirection: 'row', gap: space.md }}>
              <Ionicons name={edited && apart >= 0.4 ? 'warning-outline' : 'scale-outline'} size={22} color={edited && apart >= 0.4 ? colors.gold : colors.accentInk} />
              <View style={{ flex: 1 }}>
                <Text style={styles.evenTitle}>
                  {strength[0].power.toFixed(1)} v {strength[1].power.toFixed(1)}
                </Text>
                <Text style={styles.hint}>
                  {apart < 0.2
                    ? edited
                      ? 'Still as even as they come. '
                      : 'As even as they come. '
                    : edited
                    ? `${names[ahead]} are ${apart.toFixed(1)} stronger${apart >= 0.4 ? ': not quite even any more' : ''}. `
                    : `${names[ahead]} are ${apart.toFixed(1)} stronger, the closest these players split. `}
                  {strength[0].keepers && strength[1].keepers ? 'A keeper each, ' : ''}
                  {strength[0].bowlers} and {strength[1].bowlers} bowlers.
                  {lists[0].length !== lists[1].length
                    ? ` ${lists[0].length > lists[1].length ? names[0] : names[1]} have ${Math.abs(lists[0].length - lists[1].length) === 1 ? 'a player' : `${Math.abs(lists[0].length - lists[1].length)} players`} more.`
                    : ''}
                </Text>
              </View>
            </View>
            {suggestion && (
              <View style={styles.suggest}>
                <Text style={styles.suggestText}>
                  To even it up, {fixText(suggestion.fix, names)}: {suggestion.strength[0].power.toFixed(1)} v {suggestion.strength[1].power.toFixed(1)}
                  {suggestion.fix.kind === 'move' ? ', and the sides level in numbers' : ''}. The players you moved stay where you put them.
                </Text>
                <Button icon="git-compare-outline" label="Even it up" onPress={evenUp} />
              </View>
            )}
          </Card>
          <Text style={styles.hint}>
            {pickedNow
              ? `${pickedNow} picked: tap a player in ${names[1 - sideOf(pickedNow)]} to swap them, or ${pickedNow} again to let go.`
              : 'To change the sides, tap a player and then one on the other side to swap them, or ⇅ to send one across. Tap a side’s name to rename it.'}
          </Text>
          {lists.map((_, i) => {
            const cap = captainOf(i);
            return (
              <SideCard
                key={i}
                name={names[i]}
                s={strength[i]}
                tint={TINTS[i]}
                captain={cap}
                note={cap ? `led by ${cap}` : undefined}
                tagged={tagged}
                edit={{
                  other: names[1 - i],
                  picked: pickedNow,
                  onRename: (name) => setRenamed((r) => (i ? [r[0], name] : [name, r[1]])),
                  onPick: pick,
                  onMove: move,
                }}
              />
            );
          })}
          <Button icon="play" label="Start a match with these sides" onPress={() => start(current())} />
          <Button variant="ghost" icon="bookmark-outline" label="Save this line-up for later" onPress={keep} />
          {edited && <Button variant="ghost" icon="arrow-undo-outline" label="Back to the suggestion" onPress={fresh} />}
          <Button variant="ghost" icon="shuffle" label={edited ? 'Shuffle: start again from a new split' : 'Shuffle: another even split'} onPress={() => (setSeed((s) => s + 1), fresh())} />
          <Button
            variant="ghost"
            icon="save-outline"
            label={saving ? `Tap again: ${names[0]} and ${names[1]} change` : `Make these the new ${names[0]} and ${names[1]}`}
            onPress={() => (saving ? save() : setSaving(true))}
          />
        </>
      ) : (
        <Card>
          <Text style={styles.hint}>Pick at least two players.</Text>
        </Card>
      )}

      {lineups.length > 0 && (
        <>
          <SectionLabel right={<Text style={styles.count}>{lineups.length}</Text>}>Saved line-ups</SectionLabel>
          {lineups.map((l) => (
            <LineupCard
              key={l.id}
              l={l}
              table={table}
              onStart={() => start(l.sides)}
              onEdit={() => load(l)}
              onDelete={() => {
                deleteLineup(l.id);
                toast.show('Line-up deleted', 'info');
              }}
            />
          ))}
        </>
      )}
      {toast.element}
    </View>
  );
}

export default function TeamsScreen() {
  const { matches } = useMatches();
  const { squad } = useSquad();
  const table = useMemo(() => strengths(matches, squad), [matches, squad]);
  const [view, setView] = useState<'strength' | 'recommend'>('strength');
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>Teams</Text>
        </View>
        <View style={{ gap: space.md }}>
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: 'strength', label: 'Strength' },
              { value: 'recommend', label: 'Recommend' },
            ]}
          />
          {/* Both stay mounted: switching to Strength and back keeps the sides being worked on. */}
          <View style={view === 'strength' ? null : styles.hidden}>
            <StrengthView table={table} />
          </View>
          <View style={view === 'recommend' ? null : styles.hidden}>
            <RecommendView table={table} />
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: 130 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.lg },
  title: { fontFamily: font.posterBlack, fontSize: 38, lineHeight: 42, color: colors.text, letterSpacing: -1.4 },
  hint: { color: colors.muted, fontSize: 13, fontFamily: font.regular, lineHeight: 19 },
  count: { color: colors.faint, fontSize: 12, fontFamily: font.semibold },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },

  compare: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md },
  compareSide: { flex: 1, minWidth: 0 },
  comparePower: { fontFamily: font.posterBlack, fontSize: 40, lineHeight: 44, ...type.num },
  compareName: { color: colors.text, fontSize: 15, fontFamily: font.bold },
  verdict: { color: colors.text, fontSize: 14, fontFamily: font.semibold, textAlign: 'center', marginTop: space.sm },

  sideHead: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, paddingLeft: 0 },
  sideBar: { width: 4, alignSelf: 'stretch', borderTopRightRadius: 2, borderBottomRightRadius: 2 },
  sideName: { color: colors.text, fontSize: 20, fontFamily: font.posterBlack },
  sideNameInput: { padding: 0, borderBottomWidth: 1, borderBottomColor: colors.borderHi },
  picked: { backgroundColor: colors.accentDim },
  pickArea: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 10 },
  move: { width: 30, height: 30, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.borderHi, alignItems: 'center', justifyContent: 'center' },
  sideMeta: { color: colors.faint, fontSize: 12, fontFamily: font.medium, marginTop: 2 },
  power: { fontFamily: font.posterBlack, fontSize: 30, lineHeight: 32, ...type.num },
  powerOf: { fontSize: 14, color: colors.faint },
  facts: { flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceHi },
  fact: { flex: 1, alignItems: 'center', paddingVertical: space.sm },
  factValue: { color: colors.text, fontSize: 15, fontFamily: font.bold, ...type.num },
  factKey: { color: colors.faint, fontSize: 10, fontFamily: font.semibold, letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 2 },
  player: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 10, paddingHorizontal: space.lg, borderTopWidth: 1, borderTopColor: colors.border },
  playerName: { color: colors.text, fontSize: 14, fontFamily: font.semibold },
  playerSub: { color: colors.faint, fontSize: 11, fontFamily: font.medium, marginTop: 1 },
  playerPower: { width: 34, textAlign: 'right', color: colors.text, fontSize: 15, fontFamily: font.posterBlack, ...type.num },
  mark: { color: colors.accentInk, fontSize: 10, fontFamily: font.heavy },

  hidden: { display: 'none' },
  markDim: { color: colors.faint, fontSize: 10, fontFamily: font.heavy },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginTop: 4, paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: colors.gold },
  tagText: { color: colors.onAccent, fontSize: 10, fontFamily: font.bold },
  suggest: { gap: space.sm, marginTop: space.md, paddingTop: space.md, borderTopWidth: 1, borderTopColor: colors.border },
  suggestText: { color: colors.text, fontSize: 13, fontFamily: font.semibold, lineHeight: 19 },
  results: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 6 },
  result: { width: 18, height: 18, borderRadius: 4, overflow: 'hidden', textAlign: 'center', lineHeight: 18, fontSize: 10, fontFamily: font.heavy, color: colors.muted, backgroundColor: colors.surfaceHi },
  won: { backgroundColor: colors.accentDim, color: colors.accentInk },
  lost: { backgroundColor: colors.dangerDim, color: colors.danger },
  guestRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  guestInput: { flex: 1, minWidth: 0, height: 38, paddingHorizontal: space.md, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg, color: colors.text, fontSize: 14, fontFamily: font.regular },
  lineupHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  lineupTitle: { flex: 1, color: colors.text, fontSize: 16, fontFamily: font.bold },
  even: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, borderRadius: radius.lg },
  evenTitle: { color: colors.text, fontSize: 18, fontFamily: font.posterBlack, marginBottom: 2 },
});
