import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { TeamCrest, TeamWash } from '../../components/TeamCrest.tsx';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { PlayerAvatar } from '../../components/Avatar.tsx';
import { OvalGround, SeamDivider } from '../../components/cricket.tsx';
import { CountUp, Rise, Sheen, Tug } from '../../components/motion.tsx';
import { FormChips, RoleIcon, ROLE_NAME, useSquadByName } from '../../components/TeamsX.tsx';
import { Stars } from '../../components/Stars.tsx';
import { NameSuggestions } from '../../components/NameSuggestions.tsx';
import { FormBadge } from '../../components/Ratings.tsx';
import { Columns, Page, useLayout, widePad } from '../../components/layout.tsx';
import { Button, Card, Chip, FadeIn, PitchStripes, PressableScale, Screen, SectionLabel, useToast, WideHead, type IconName } from '../../components/ui.tsx';
import { LINEUP_IMAGE, lineupFileName, lineupHtml } from '../../engine/lineup.ts';
import { DEFAULT_SQUAD, overall } from '../../engine/squad.ts';
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
import { isPlaceholder } from '../../engine/stats.ts';
import { teamProfile } from '../../engine/teamPage.ts';
import type { Match, Team } from '../../engine/types.ts';
import { newId, useMatches } from '../../store/matches.tsx';
import { saveReportImage } from '../../store/files.ts';
import { useSquad } from '../../store/squad.ts';
import { useAccess } from '../../store/sync.tsx';
import { colors, font, hero, ink, ownTeamTheme, radius, space, teamTheme, type } from '../../theme.ts';

// The sides: how strong each is on current form, and two even sides from whoever turns up today.

const TINTS = [colors.accentInk, colors.violet];

/** A side's colour: its own when it has one, else the usual first or second. `ink` is that colour as text. */
const tintOf = (name: string, i: number) => ownTeamTheme(name)?.accent ?? TINTS[i % 2];
const inkOf = (name: string, i: number) => ownTeamTheme(name)?.ink ?? TINTS[i % 2];

/** Changing a recommended side: rename it, pick a player to swap, or send one to the other side. */
type SideEdit = { other: string; picked: string | null; onRename: (name: string) => void; onPick: (player: string) => void; onMove: (player: string) => void };

/**
 * A side's strength in a few numbers, then its players best first. With `edit`, the side can be changed. `i` is
 * which side it is (first or second), for its colour when it has none of its own. `byTotal` leads with the players'
 * strengths added up (what the sides are evened on) rather than their average.
 */
function SideCard({
  name,
  s,
  i: side,
  byTotal,
  captain,
  note,
  edit,
  tagged = [],
  results,
  onOpen,
  fill,
}: {
  /** As tall as its row, beside the other side. */
  fill?: boolean;
  /** Opens the side's own page. */
  onOpen?: () => void;
  name: string;
  s: SideStrength;
  i: number;
  byTotal?: boolean;
  captain?: string;
  note?: string;
  edit?: SideEdit;
  /** Players Crease suggests moving to even the sides up. */
  tagged?: string[];
  /** Their last results, newest first. */
  results?: ('W' | 'L' | 'T' | 'D')[];
}) {
  const isTagged = (n: string) => tagged.some((x) => nameKey(x) === nameKey(n));
  const isCaptain = (n: string) => Boolean(captain) && nameKey(captain!) === nameKey(n);
  const tint = tintOf(name, side);
  const th = ownTeamTheme(name);
  const roster = useSquadByName();
  return (
    <Card style={[{ padding: 0, overflow: 'hidden' }, fill && { flex: 1 }]}>
      <View style={styles.sideHead}>
        <TeamWash color={tint} strength={0.16} />
        <View style={{ marginLeft: space.lg }}>
          <TeamCrest name={name} size={48} />
        </View>
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
          ) : onOpen ? (
            <PressableScale scaleTo={0.97} hitSlop={10} onPress={onOpen} accessibilityLabel={`${name} team page`} style={styles.sideLink}>
              <Text style={styles.sideName} numberOfLines={1}>
                {name}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.faint} />
            </PressableScale>
          ) : (
            <Text style={styles.sideName} numberOfLines={1}>
              {name}
            </Text>
          )}
          <Text style={styles.sideMeta}>
            {s.players.length} players{note ? ` · ${note}` : ''}
          </Text>
          {results && results.length > 0 && (
            <View style={styles.results}>
              <FormChips results={results} size={20} accent={th?.accent} onAccent={th?.onAccent} />
              <Text style={styles.sideMeta}>  last {results.length}, newest first</Text>
            </View>
          )}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          {byTotal ? (
            <>
              <CountUp value={s.total} format={(n) => n.toFixed(1)} style={[styles.power, { color: inkOf(name, side) }]} />
              <Text style={styles.sideMeta}>Total · avg {s.power.toFixed(1)}</Text>
            </>
          ) : (
            <>
              <Text style={[styles.power, { color: inkOf(name, side) }]}>
                <CountUp value={s.power} format={(n) => n.toFixed(1)} style={[styles.power, { color: inkOf(name, side) }]} />
                <Text style={styles.powerOf}>/10</Text>
              </Text>
              <Text style={styles.sideMeta}>Strength</Text>
            </>
          )}
        </View>
      </View>
      {!byTotal && <View style={styles.factsRule} />}
      <View style={styles.facts}>
        {(
          [
            ['Form', s.form === null ? '–' : s.form.toFixed(1)],
            ['Batting', `${s.bat.toFixed(1)}★`],
            ['Bowling', `${s.bowl.toFixed(1)}★`],
            ['Bowlers', String(s.bowlers)],
            ['Keepers', String(s.keepers)],
          ] as [string, string][]
        ).map(([k, v]) => (
          <View key={k} style={styles.fact}>
            <Text style={styles.factValue}>{v}</Text>
            <Text style={styles.factKey}>{k}</Text>
          </View>
        ))}
      </View>
      {[...s.players].sort((p, q) => Number(isCaptain(q.name)) - Number(isCaptain(p.name))).map((p, i) => {
        const picked = edit?.picked !== null && edit?.picked !== undefined && nameKey(edit.picked) === nameKey(p.name);
        const sq = roster.get(nameKey(p.name));
        const row = (
          <>
          <PlayerAvatar name={p.name} size={36} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.playerName} numberOfLines={1}>
              {p.name}
              {isCaptain(p.name) ? <Text style={styles.mark}>{'  '}C</Text> : null}
              {p.keeper ? <Text style={styles.mark}>{'  '}WK</Text> : null}
              {p.keepsSometimes ? <Text style={styles.markDim}>{'  '}(WK)</Text> : null}
              {p.guest ? <Text style={styles.markDim}>{'  '}GUEST</Text> : null}
            </Text>
            {isTagged(p.name) && (
              <View style={styles.tag}>
                <Ionicons name="swap-vertical" size={11} color={colors.onAccent} />
                <Text style={styles.tagText}>Suggested: to even it up</Text>
              </View>
            )}
            {p.guest ? (
              <Text style={styles.playerSub} numberOfLines={1}>Not in the squad: counted as average</Text>
            ) : (
              <View style={styles.subRow}>
                {sq && <RoleIcon role={sq.role} size={18} />}
                {sq && <Stars value={Math.max(1, Math.min(5, Math.round(overall(sq))))} size={11} />}
                <Text style={styles.playerSub} numberOfLines={1}>
                  {sq ? `${ROLE_NAME[sq.role]} · ` : ''}Bat {p.bat}★ · Bowl {p.bowl}★{p.form === null ? ' · no matches yet' : ''}
                </Text>
              </View>
            )}
          </View>
          {p.form !== null && <FormBadge form={p.form} />}
          <View style={styles.rateCol}>
            <Text style={styles.playerPower}>{p.power.toFixed(1)}</Text>
          </View>
          </>
        );
        const rowStyle = [styles.player, i === 0 && { borderTopWidth: 0 }, picked && styles.picked];
        // The row picks the player; ⇅ sits beside it (a button can't hold another).
        return (
          <Rise key={p.name} index={Math.min(i, 9)} step={35}>
            {edit ? (
              <View style={[rowStyle, { paddingVertical: 0 }]}>
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
                <PressableScale accessibilityLabel={`Move ${p.name} to ${edit.other}`} hitSlop={7} onPress={() => edit.onMove(p.name)} style={styles.move}>
                  <Ionicons name="swap-vertical" size={16} color={colors.muted} />
                </PressableScale>
              </View>
            ) : (
              <View style={rowStyle}>{row}</View>
            )}
          </Rise>
        );
      })}
    </Card>
  );
}

/** Which of two whole squads is stronger, player for player (their average: squads differ in size), and by how much. */
function verdict(names: [string, string], a: SideStrength, b: SideStrength): string {
  const d = Math.round(Math.abs(a.power - b.power) * 10) / 10;
  if (d < 0.2) return 'Dead level on form, player for player';
  return `${a.power > b.power ? names[0] : names[1]} ${d < 0.6 ? 'just ahead' : 'stronger'} by ${d.toFixed(1)} a player`;
}

/** The two usual sides (the club's own, else the last pair kept), then any other side kept from a one-off match. */
function splitSides<T extends { team: Team }>(sides: T[]): { usual: T[]; others: T[] } {
  const own = sides.filter((x) => ownTeamTheme(x.team.name));
  const usual = (own.length >= 2 ? own : [...own, ...sides.filter((x) => !own.includes(x))]).slice(0, 2);
  return { usual, others: sides.filter((x) => !usual.includes(x)) };
}

/**
 * The hero of the tab: a big badge card for each usual side in its colours, with its record, its last five results
 * and its strength. The whole card opens the side's page.
 */
function TeamDoors({ table }: { table: Map<string, Strength> }) {
  const { savedTeams, matches } = useMatches();
  const { wide } = useLayout();
  const { usual } = splitSides(savedTeams.filter((t) => t.players.length >= 2).map((team) => ({ team })));
  if (!usual.length) return null;
  return (
    <View style={styles.doors}>
      {usual.map(({ team }, i) => {
        const th = teamTheme(team.name);
        const t = teamProfile(matches, team.name);
        const power = sideStrength(team.players.filter((p) => !p.common).map((p) => strengthOf(table, p.name))).power;
        const form = recentResults(matches, team.name);
        return (
          <Rise key={team.id} index={i} step={110} style={{ flex: 1, minWidth: 0 }}>
            <PressableScale
              scaleTo={0.97}
              onPress={() => router.push({ pathname: '/team/[name]', params: { name: team.name } })}
              accessibilityRole="link"
              accessibilityLabel={`View team: ${team.name}`}
              wrapStyle={{ flex: 1, minWidth: 0 }}
              style={{ flex: 1 }}
            >
              <LinearGradient colors={th.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.door, wide && styles.doorWide]}>
                <OvalGround opacity={0.08} />
                <PitchStripes opacity={0.04} tint="255,255,255" />
                <TeamWash color={th.accent} strength={0.22} />
                <Sheen />
                <View style={styles.doorTop}>
                  <TeamCrest name={team.name} size={wide ? 92 : 68} />
                  <View style={styles.doorScore}>
                    <CountUp value={power} format={(n) => n.toFixed(1)} delay={300} style={[styles.doorPower, wide && { fontSize: 44, lineHeight: 48 }]} />
                    <Text style={styles.doorPowerKey}>Strength /10</Text>
                  </View>
                </View>
                <Text style={[styles.doorName, wide && { fontSize: 30, lineHeight: 34 }]} numberOfLines={2}>
                  {team.name}
                </Text>
                <Text style={styles.doorRecord} numberOfLines={1}>
                  {t.played ? `${t.played} played · ${t.won}W ${t.lost}L` : 'No matches yet'}
                </Text>
                {form.length > 0 && <FormChips results={form} size={wide ? 26 : 21} accent={th.accent} onAccent={th.onAccent} onDark delay={300 + i * 150} />}
                <View style={[styles.doorGo, { backgroundColor: th.accent }]}>
                  <Text style={[styles.doorGoText, { color: th.onAccent }]}>View team</Text>
                  <Ionicons name="arrow-forward" size={15} color={th.onAccent} />
                </View>
              </LinearGradient>
            </PressableScale>
          </Rise>
        );
      })}
    </View>
  );
}

/** The comparison as a tug of war: whose squad is stronger, and the sentence that says it. */
function CompareCard({ a, b }: { a: { name: string; s: SideStrength }; b: { name: string; s: SideStrength } }) {
  const total = a.s.power + b.s.power || 1;
  const ta = tintOf(a.name, 0);
  const tb = tintOf(b.name, 1);
  return (
    <Card style={styles.compare}>
      <Text style={styles.verdict}>{verdict([a.name, b.name], a.s, b.s)}</Text>
      <View style={styles.compareRow}>
        {[a, b].map((x, i) => (
          <View key={x.name} style={[styles.compareSide, i === 1 && { alignItems: 'flex-end' }]}>
            <CountUp value={x.s.power} format={(n) => n.toFixed(1)} style={[styles.comparePower, { color: inkOf(x.name, i) }]} />
            <Text style={styles.compareName} numberOfLines={1}>
              {x.name}
            </Text>
          </View>
        ))}
      </View>
      <Tug edge={a.s.power / total} style={styles.tug} leftStyle={[styles.tugSide, { backgroundColor: ta, borderTopLeftRadius: 8, borderBottomLeftRadius: 8 }]} rightStyle={[styles.tugSide, { backgroundColor: tb, borderTopRightRadius: 8, borderBottomRightRadius: 8 }]} />
      <Text style={styles.compareHint}>Strength out of 10, averaged per player.</Text>
    </Card>
  );
}

function StrengthView({ table }: { table: Map<string, Strength> }) {
  const { savedTeams, matches } = useMatches();
  const [showOthers, setShowOthers] = useState(false);
  const { wide, desk } = useLayout();
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
  // The two usual sides first; any other side kept from a one-off match waits under Other sides.
  const { usual, others } = splitSides(sides);
  const [a, b] = usual;
  const card = (x: (typeof sides)[number], i: number) => (
    <SideCard fill={wide} name={x.team.name} s={x.s} i={i} onOpen={() => router.push({ pathname: '/team/[name]', params: { name: x.team.name } })} captain={x.team.players.find((p) => p.id === x.team.captain)?.name} results={recentResults(matches, x.team.name)} />
  );
  return (
    <View style={{ gap: space.md }}>
      {b && (
        <FadeIn>
          <CompareCard a={{ name: a.team.name, s: a.s }} b={{ name: b.team.name, s: b.s }} />
        </FadeIn>
      )}
      {/* On a tablet or laptop the two usual sides stand side by side, player against player. */}
      <Columns tablet={2} gap={space.md}>
        {usual.map((x, i) => (
          <FadeIn key={x.team.id} delay={60 + i * 60} style={wide && { flex: 1 }}>
            {card(x, i)}
          </FadeIn>
        ))}
      </Columns>
      {others.length > 0 && (
        <PressableScale
          scaleTo={0.98}
          onPress={() => setShowOthers(!showOthers)}
          accessibilityState={{ selected: showOthers }}
          accessibilityLabel={showOthers ? 'Hide the other sides' : `Show the other ${others.length} sides`}
          style={styles.fold}
        >
          <Text style={styles.foldText}>Other sides ({others.length})</Text>
          <Ionicons name={showOthers ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} />
        </PressableScale>
      )}
      {showOthers &&
        (wide ? (
          <Columns tablet={2} laptop={desk ? 3 : 2} gap={space.md}>
            {others.map((x, i) => (
              <View key={x.team.id} style={{ flex: 1 }}>{card(x, i + 2)}</View>
            ))}
          </Columns>
        ) : (
          others.map((x, i) => <View key={x.team.id}>{card(x, i + 2)}</View>)
        ))}
      <Text style={styles.hint}>
        Strength is out of 10: mostly each player’s form (their last five match ratings), steadied by their stars so one
        big game doesn’t swing it. A player with no matches yet plays to their stars.
      </Text>
    </View>
  );
}
/** One action under the sides: an icon and its few words; `label` is the whole sentence for screen readers. */
function Action({ icon, text, label, onPress, armed, disabled }: { icon: IconName; text: string; label: string; onPress: () => void; armed?: boolean; disabled?: boolean }) {
  // On a tablet or laptop they share the bar's width, so each row of them ends on the bar's right edge.
  const { wide } = useLayout();
  return (
    <PressableScale
      accessibilityLabel={label}
      disabled={disabled}
      scaleTo={0.94}
      onPress={onPress}
      wrapStyle={wide && { flexGrow: 1 }}
      style={[styles.action, wide && { justifyContent: 'center' }, armed && styles.actionArmed]}
    >
      <Ionicons name={icon} size={17} color={armed ? colors.onAccent : colors.text} />
      <Text style={[styles.actionText, armed && { color: colors.onAccent }]}>{text}</Text>
    </PressableScale>
  );
}

/** How a fix reads: "send Rajeev to Copan Strikers" or "swap Rajeev and Chirag Taneja". */
function fixText(fix: Fix, names: [string, string]) {
  return fix.kind === 'move' ? `send ${fix.player} to ${names[fix.to]}` : `swap ${fix.players[0]} and ${fix.players[1]}`;
}
const fixPlayers = (fix: Fix) => (fix.kind === 'move' ? [fix.player] : fix.players);

/** One kept line-up: its sides on today's form, and what can be done with it. */
function LineupCard({
  l,
  table,
  onStart,
  onEdit,
  onShare,
  onDelete,
  onStartAllowed,
  fill,
}: {
  /** As tall as its row. */
  fill?: boolean;
  l: SavedLineup;
  table: Map<string, Strength>;
  onStart: () => void;
  onEdit: () => void;
  onShare: () => void;
  /** Left out for those who may not do it. */
  onDelete?: () => void;
  onStartAllowed: boolean;
}) {
  const [arming, setArming] = useState(false);
  const s = l.sides.map((side) => sideStrength(side.players.map((n) => strengthOf(table, n))));
  return (
    <Card style={[{ gap: space.sm }, fill && { flex: 1 }]}>
      <View style={styles.lineupHead}>
        <Text style={styles.lineupTitle} numberOfLines={1}>
          {l.sides[0].name} v {l.sides[1].name}
        </Text>
        <Text style={styles.count}>{new Date(l.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</Text>
      </View>
      {l.sides.map((side, i) => (
        <Text key={i} style={styles.hint} numberOfLines={2}>
          <Text style={{ color: inkOf(side.name, i), fontFamily: font.bold }}>
            {side.name} {s[i].total.toFixed(1)}
          </Text>
          {'  '}
          {side.players.map((n) => (side.captain && nameKey(n) === nameKey(side.captain) ? `${n} (c)` : n)).join(', ')}
        </Text>
      ))}
      <Text style={styles.playerSub}>Total strength on today’s form, so it moves as players’ form does.</Text>
      <View style={styles.wrap}>
        {onStartAllowed && <Chip icon="play" label="Start a match" onPress={onStart} />}
        <Chip icon="create-outline" label="Edit" onPress={onEdit} />
        <Chip icon="share-outline" label="Share" onPress={onShare} />
        {onDelete && (
          <Chip icon="trash-outline" tone="danger" selected={arming} label={arming ? 'Tap again to delete' : 'Delete'} onPress={() => (arming ? onDelete() : setArming(true))} />
        )}
      </View>
    </Card>
  );
}

function RecommendView({ table }: { table: Map<string, Strength> }) {
  const { savedTeams, rememberTeams, matches } = useMatches();
  // Editors start matches from here; only the admin changes the usual sides or the saved line-ups.
  const access = useAccess();
  const { squad, lineups, saveLineup, deleteLineup } = useSquad();
  const toast = useToast();
  const { wide, desk } = useLayout();
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
  // How far apart the sides are, on the measure the sides are evened on: the players' strengths added up. On the
  // average, a fair 6 v 5 (the five a little better each) would read as lopsided.
  const apart = !strength ? 0 : !edited && split ? split.gap : Math.round(Math.abs(strength[0].total - strength[1].total) * 10) / 10;
  const ahead = strength && strength[0].total > strength[1].total ? 0 : 1;
  /** Far enough apart to say they aren't even any more: about a player's worth between them. */
  const uneven = apart >= 1;
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
  /** Nobody playing: a clean start to tap today's players in. */
  const clearAll = () => {
    setOut(new Set(everyone.map((p) => nameKey(p.name))));
    setGuests([]);
    fresh();
  };
  /**
   * Whoever played the newest match with named players (one set up with blanks doesn't count), both sides; anyone the
   * squad doesn't know comes in as a guest.
   */
  const named = (m: Match) => [...new Set(m.teams.flatMap((t) => t.players.map((p) => p.name.trim())).filter((n) => n && !isPlaceholder(n)))];
  const lastMatch = useMemo(() => [...matches].sort((a, b) => b.createdAt - a.createdAt).find((m) => named(m).length >= 2), [matches]);
  const sameAsLast = () => {
    if (!lastMatch) return;
    const names = named(lastMatch);
    setOut(new Set(everyone.filter((p) => !has(names, p.name)).map((p) => nameKey(p.name))));
    setGuests(names.filter((n) => !table.has(nameKey(n)) && strengthOf(table, n).guest));
    fresh();
    toast.show(`Playing: everyone from ${lastMatch.teams[0].name} v ${lastMatch.teams[1].name}`, 'info');
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

  /** The line-up as a picture, to post in the group. */
  const share = async (sides: SideDraft[]) => {
    try {
      toast.show('Making the picture…', 'info');
      const pair = sides as [SideDraft, SideDraft];
      const result = await saveReportImage(lineupFileName(pair), lineupHtml(pair, table, new Date(), [ownTeamTheme(pair[0].name)?.accent, ownTeamTheme(pair[1].name)?.accent]), LINEUP_IMAGE);
      if (result === 'downloaded') toast.show('Line-up picture saved to your downloads', 'success');
      if (result === 'shared') toast.show('Line-up picture ready to send', 'success');
    } catch {
      toast.show('Couldn’t make the picture. Try again.', 'error');
    }
  };

  const tagged = suggestion ? fixPlayers(suggestion.fix) : [];
  return (
    <View style={{ gap: space.md }}>
      {/* A tablet or laptop: who's playing and the captains side by side, then the two sides side by side. */}
      <Columns weights={[3, 2]} gap={space.md} stretch>
      <View style={wide && { flex: 1 }}>
      <SectionLabel right={<Text style={styles.count}>{playing.length} playing</Text>}>Who’s playing today</SectionLabel>
      <Card style={[{ gap: space.sm }, wide && { flex: 1 }]}>
        <Text style={styles.hint}>Tap anyone who isn’t here to leave them out. Add anyone else as a guest: they count as an average player.</Text>
        <View style={styles.wrap}>
          {lastMatch && <Chip icon="refresh" label="Same as last match" onPress={sameAsLast} />}
          <Chip icon="close-circle-outline" label="Clear all" disabled={playing.length === 0} onPress={clearAll} />
        </View>
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
      </View>
      <View style={wide && { flex: 1 }}>
      <SectionLabel right={<Text style={styles.count}>{caps.length ? `${caps.length} of 2` : 'Optional'}</Text>}>Captains</SectionLabel>
      <Card style={[{ gap: space.sm }, wide && { flex: 1 }]}>
        <Text style={styles.hint}>Pick up to two and they lead opposite sides; the rest are shared out around them.</Text>
        <View style={styles.wrap}>
          {playing.map((p) => {
            const at = caps.findIndex((c) => nameKey(c) === nameKey(p.name));
            return <Chip key={p.name} label={at >= 0 ? `${p.name} · ${names[at]}` : p.name} tone={at === 1 ? 'violet' : 'accent'} selected={at >= 0} onPress={() => toggleCaptain(p.name)} />;
          })}
        </View>
      </Card>
      </View>
      </Columns>

      {split && lists && strength ? (
        <>
          <View>
          <SectionLabel right={edited ? <Text style={styles.count}>Edited by you</Text> : undefined}>Two even sides</SectionLabel>
          <Card style={[styles.even, { flexDirection: 'column', alignItems: 'stretch' }]}>
            <View style={{ flexDirection: 'row', gap: space.md }}>
              <Ionicons name={edited && uneven ? 'warning-outline' : 'scale-outline'} size={22} color={edited && uneven ? colors.gold : colors.accentInk} />
              <View style={{ flex: 1 }}>
                <Text style={styles.evenTitle}>
                  {strength[0].total.toFixed(1)} v {strength[1].total.toFixed(1)}
                  <Text style={styles.evenUnit}>  total strength</Text>
                </Text>
                <Text style={styles.hint}>
                  {apart < 0.5
                    ? edited
                      ? 'Still as even as they come. '
                      : 'As even as they come. '
                    : edited
                    ? `${names[ahead]} are ${apart.toFixed(1)} stronger in total${uneven ? ': not quite even any more' : ''}. `
                    : `${names[ahead]} are ${apart.toFixed(1)} stronger in total, the closest these players split. `}
                  {strength[0].keepers && strength[1].keepers ? 'A keeper each, ' : ''}
                  {strength[0].bowlers} and {strength[1].bowlers} bowlers.
                  {lists[0].length !== lists[1].length
                    ? ` ${lists[0].length > lists[1].length ? names[0] : names[1]} have ${Math.abs(lists[0].length - lists[1].length) === 1 ? 'a player' : `${Math.abs(lists[0].length - lists[1].length)} players`} more, so the other side gets the stronger players.`
                    : ''}
                </Text>
              </View>
            </View>
            <View style={{ marginTop: space.md, gap: 6 }}>
              <View style={styles.compareRow}>
                <Text style={[styles.tugName, { color: inkOf(names[0], 0) }]} numberOfLines={1}>{names[0]}</Text>
                <Text style={[styles.tugName, { color: inkOf(names[1], 1), textAlign: 'right' }]} numberOfLines={1}>{names[1]}</Text>
              </View>
              <Tug
                edge={strength[0].total / (strength[0].total + strength[1].total || 1)}
                style={styles.tug}
                leftStyle={[styles.tugSide, { backgroundColor: tintOf(names[0], 0), borderTopLeftRadius: 8, borderBottomLeftRadius: 8 }]}
                rightStyle={[styles.tugSide, { backgroundColor: tintOf(names[1], 1), borderTopRightRadius: 8, borderBottomRightRadius: 8 }]}
              />
            </View>
            {suggestion && (
              <View style={styles.suggest}>
                <Text style={styles.suggestText}>
                  To even it up, {fixText(suggestion.fix, names)}: {suggestion.strength[0].total.toFixed(1)} v {suggestion.strength[1].total.toFixed(1)} in total
                  {suggestion.fix.kind === 'move' ? ', and the sides level in numbers' : ''}. The players you moved stay where you put them.
                </Text>
                <Button icon="git-compare-outline" label="Even it up" onPress={evenUp} />
              </View>
            )}
          </Card>
          </View>
          <Text style={styles.hint}>
            {pickedNow
              ? `${pickedNow} picked: tap a player in ${names[1 - sideOf(pickedNow)]} to swap them, or ${pickedNow} again to let go.`
              : 'To change the sides, tap a player and then one on the other side to swap them, or ⇅ to send one across. Tap a side’s name to rename it.'}
          </Text>
          <Columns tablet={2} gap={space.md}>
          {lists.map((_, i) => {
            const cap = captainOf(i);
            return (
              <SideCard
                key={i}
                fill={wide}
                name={names[i]}
                s={strength[i]}
                i={i}
                byTotal
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
          </Columns>
          {/* On a tablet or laptop the actions are one bar: start across the top, the rest sharing a line under it. */}
          <View style={wide ? styles.actionBar : { gap: space.md }}>
          {access.score && <Button icon="play" label="Start a match with these sides" onPress={() => start(current())} />}
          <View style={styles.actions}>
            <Action
              icon="shuffle"
              text="Shuffle"
              label={edited ? 'Shuffle: start again from a new split' : 'Shuffle: another even split'}
              onPress={() => {
                setSeed((s) => s + 1);
                fresh();
                toast.show('Another even split', 'info');
              }}
            />
            <Action icon="arrow-undo-outline" text="Undo my changes" label="Back to the suggestion" disabled={!edited} onPress={() => (fresh(), toast.show('Back to the suggestion', 'info'))} />
            <Action icon="share-outline" text="Share picture" label="Share the line-up as a picture" onPress={() => share(current())} />
            {access.admin && <Action icon="bookmark-outline" text="Save for later" label="Save this line-up for later, under Saved line-ups" onPress={keep} />}
            {access.admin && (
            <Action
              icon="swap-horizontal"
              text={saving ? 'Tap again to replace' : 'Replace usual sides'}
              armed={saving}
              label={saving ? `Tap again: ${names[0]} and ${names[1]} change` : `Make these the new ${names[0]} and ${names[1]}`}
              onPress={() => {
                if (saving) return save();
                setSaving(true);
                toast.show(`Tap again to make these the new ${names[0]} and ${names[1]}`, 'info');
              }}
            />
            )}
          </View>
          </View>
          {access.admin && (
            <Text style={styles.hint}>
              Save for later keeps this line-up under Saved line-ups and changes nothing else. Replace usual sides makes these
              the players of {names[0]} and {names[1]} for every match from now on.
            </Text>
          )}
        </>
      ) : (
        <Card>
          <Text style={styles.hint}>Pick at least two players.</Text>
        </Card>
      )}

      {lineups.length > 0 && (
        <>
          <View>
          <SectionLabel right={<Text style={styles.count}>{lineups.length}</Text>}>Saved line-ups</SectionLabel>
          <Columns tablet={2} laptop={desk ? 3 : 2} minItem={300} gap={space.md}>
          {lineups.map((l) => (
            <LineupCard
              key={l.id}
              fill={wide}
              l={l}
              table={table}
              onStart={() => start(l.sides)}
              onEdit={() => load(l)}
              onShare={() => share(l.sides)}
              onStartAllowed={access.score}
              onDelete={
                access.admin
                  ? () => {
                      deleteLineup(l.id);
                      toast.show('Line-up deleted', 'info');
                    }
                  : undefined
              }
            />
          ))}
          </Columns>
          </View>
        </>
      )}
      {toast.element}
    </View>
  );
}

/** Strength or Recommend, said in plain words: each tool has a title and a line on what it does. */
function ToolBar({ view, onChange }: { view: 'strength' | 'recommend'; onChange: (v: 'strength' | 'recommend') => void }) {
  const tools: { value: 'strength' | 'recommend'; title: string; line: string; icon: IconName }[] = [
    { value: 'strength', title: 'Strength', line: 'Compare the two squads', icon: 'barbell-outline' },
    { value: 'recommend', title: 'Recommend', line: 'Balanced sides for the next match', icon: 'scale-outline' },
  ];
  return (
    <View style={styles.tools}>
      {tools.map((t) => {
        const on = t.value === view;
        return (
          <PressableScale
            key={t.value}
            accessibilityLabel={t.title}
            accessibilityState={{ selected: on }}
            scaleTo={0.96}
            onPress={() => onChange(t.value)}
            wrapStyle={{ flex: 1, minWidth: 0 }}
            style={[styles.tool, on && styles.toolOn]}
          >
            <View style={styles.toolHead}>
              <Ionicons name={t.icon} size={18} color={on ? colors.onAccent : colors.accentInk} />
              <Text style={[styles.toolTitle, on && { color: colors.onAccent }]}>{t.title}</Text>
            </View>
            <Text style={[styles.toolLine, on && { color: colors.onAccent, opacity: 0.8 }]} numberOfLines={2}>
              {t.line}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

/** The way into an auction: pick the two sides by bidding for players. */
function AuctionEntry() {
  const { auctions } = useSquad();
  const last = auctions[0];
  return (
    <Card style={styles.auction}>
      <View style={styles.auctionIcon}>
        <MaterialCommunityIcons name="gavel" size={24} color={colors.gold} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.auctionTitle}>Pick the sides by auction</Text>
        <Text style={styles.hint}>Two captains bid for the squad, player by player, and the sides write themselves.</Text>
        {last && (
          <PressableScale scaleTo={0.97} hitSlop={8} onPress={() => router.push({ pathname: '/auction/[id]', params: { id: last.id } })} accessibilityLabel="Open the last auction" style={{ alignSelf: 'flex-start', marginTop: 6 }}>
            <Text style={styles.auctionLast}>
              Last auction: {last.sides[0].name} v {last.sides[1].name} ›
            </Text>
          </PressableScale>
        )}
      </View>
      <PressableScale scaleTo={0.94} onPress={() => router.push('/auction/new')} accessibilityLabel="Start an auction" style={styles.auctionBtn}>
        <Text style={styles.auctionBtnText}>Start an auction</Text>
        <Ionicons name="arrow-forward" size={15} color={colors.onAccent} />
      </PressableScale>
    </Card>
  );
}

export default function TeamsScreen() {
  const { matches } = useMatches();
  const { squad } = useSquad();
  const table = useMemo(() => strengths(matches, squad), [matches, squad]);
  const [view, setView] = useState<'strength' | 'recommend'>('strength');
  const layout = useLayout();
  return (
    <Screen>
      <ScrollView
        contentContainerStyle={layout.wide ? widePad(layout.gutter) : styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Page>
        {layout.wide ? (
          <WideHead title="Teams" sub="The two sides, how strong they are, and fair teams for the next match" />
        ) : (
          <View style={styles.header}>
            <Text style={styles.title}>Teams</Text>
          </View>
        )}
        <View style={{ gap: space.md }}>
          <TeamDoors table={table} />
          <SeamDivider />
          <ToolBar view={view} onChange={setView} />
          {/* Both stay mounted: switching to Strength and back keeps the sides being worked on. */}
          <View style={view === 'strength' ? null : styles.hidden}>
            <StrengthView table={table} />
          </View>
          <View style={view === 'recommend' ? null : styles.hidden}>
            <RecommendView table={table} />
          </View>
          <AuctionEntry />
        </View>
        </Page>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sideLink: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', maxWidth: '100%' },
  content: { padding: space.lg, paddingBottom: 130 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.lg },
  title: { fontFamily: font.posterBlack, fontSize: 38, lineHeight: 42, color: colors.text, letterSpacing: -1.4 },
  hint: { color: colors.muted, fontSize: 13, fontFamily: font.regular, lineHeight: 19 },
  count: { color: colors.faint, fontSize: 12, fontFamily: font.semibold },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },

  compare: { gap: space.md },
  compareRow: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md },
  compareHint: { color: colors.faint, fontSize: 11, fontFamily: font.medium, textAlign: 'center' },
  tug: { height: 14 },
  tugSide: { height: 14 },
  tugName: { flex: 1, fontSize: 12, fontFamily: font.bold },
  compareSide: { flex: 1, minWidth: 0 },
  comparePower: { fontFamily: font.posterBlack, fontSize: 40, lineHeight: 44, ...type.num },
  compareName: { color: colors.text, fontSize: 15, fontFamily: font.bold },
  verdict: { color: colors.text, fontSize: 19, lineHeight: 24, fontFamily: font.posterBlack, letterSpacing: -0.4, textAlign: 'center' },

  sideHead: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, paddingLeft: 0, overflow: 'hidden' },
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
  doors: { flexDirection: 'row', gap: space.md },
  door: { flex: 1, borderRadius: radius.lg, padding: space.md, paddingTop: space.lg, gap: 8, overflow: 'hidden', borderWidth: 1, borderColor: hero.line, minHeight: 250 },
  doorTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  doorScore: { alignItems: 'flex-end' },
  doorPower: { color: hero.text, fontFamily: font.posterBlack, fontSize: 30, lineHeight: 34, ...type.num },
  doorPowerKey: { color: hero.muted, fontSize: 9, fontFamily: font.semibold, letterSpacing: 0.6, textTransform: 'uppercase' },
  doorWide: { padding: space.xl, minHeight: 300, gap: 10 },
  doorName: { fontFamily: font.posterBlack, fontSize: 22, lineHeight: 26, color: hero.text, letterSpacing: -0.6 },
  doorRecord: { color: hero.muted, fontSize: 13, fontFamily: font.semibold, ...type.num },
  doorGo: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', minHeight: 36, paddingHorizontal: space.md, borderRadius: radius.pill, marginTop: 'auto' },
  doorGoText: { fontSize: 14, fontFamily: font.bold },
  actionBar: { gap: space.md, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: colors.surfaceHi, borderWidth: 1, borderColor: colors.border },
  actionText: { color: colors.text, fontSize: 13, fontFamily: font.bold },
  actionArmed: { backgroundColor: colors.gold, borderColor: colors.gold },
  fold: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44, paddingHorizontal: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceHi },
  foldText: { color: colors.text, fontSize: 14, fontFamily: font.bold },
  markDim: { color: colors.faint, fontSize: 10, fontFamily: font.heavy },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginTop: 4, paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: colors.gold },
  tagText: { color: colors.onAccent, fontSize: 10, fontFamily: font.bold },
  suggest: { gap: space.sm, marginTop: space.md, paddingTop: space.md, borderTopWidth: 1, borderTopColor: colors.border },
  suggestText: { color: colors.text, fontSize: 13, fontFamily: font.semibold, lineHeight: 19 },
  results: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 3, marginTop: 6 },
  factsRule: { height: 1, backgroundColor: ink(0.08) },
  rateCol: { alignItems: 'flex-end' },
  subRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5, marginTop: 2 },
  tools: { flexDirection: 'row', gap: space.sm },
  tool: { flex: 1, gap: 4, padding: space.md, minHeight: 74, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderHi },
  toolOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  toolHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  toolTitle: { color: colors.text, fontSize: 16, fontFamily: font.posterBlack },
  toolLine: { color: colors.muted, fontSize: 12, lineHeight: 16, fontFamily: font.medium },
  auction: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.md, marginTop: space.sm },
  auctionIcon: { width: 46, height: 46, borderRadius: radius.md, backgroundColor: colors.goldDim, alignItems: 'center', justifyContent: 'center' },
  auctionTitle: { color: colors.text, fontSize: 16, fontFamily: font.posterBlack, marginBottom: 2 },
  auctionLast: { color: colors.gold, fontSize: 12, fontFamily: font.bold },
  auctionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: space.lg, borderRadius: radius.pill, backgroundColor: colors.accent },
  auctionBtnText: { color: colors.onAccent, fontSize: 14, fontFamily: font.heavy },
  result: { width: 18, height: 18, borderRadius: 4, overflow: 'hidden', textAlign: 'center', lineHeight: 18, fontSize: 10, fontFamily: font.heavy, color: colors.muted, backgroundColor: colors.surfaceHi },
  won: { backgroundColor: colors.accentDim, color: colors.accentInk },
  lost: { backgroundColor: colors.dangerDim, color: colors.danger },
  guestRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  guestInput: { flex: 1, minWidth: 0, height: 44, paddingHorizontal: space.md, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg, color: colors.text, fontSize: 14, fontFamily: font.regular },
  lineupHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  lineupTitle: { flex: 1, color: colors.text, fontSize: 16, fontFamily: font.bold },
  even: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, borderRadius: radius.lg },
  evenTitle: { color: colors.text, fontSize: 18, fontFamily: font.posterBlack, marginBottom: 2 },
  evenUnit: { color: colors.muted, fontSize: 12, fontFamily: font.semibold },
});
