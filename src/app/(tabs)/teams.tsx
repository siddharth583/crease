import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { FormBadge } from '../../components/Ratings.tsx';
import { Button, Card, Chip, FadeIn, Screen, SectionLabel, Segmented, useToast } from '../../components/ui.tsx';
import { DEFAULT_SQUAD } from '../../engine/squad.ts';
import { evenSides, nameKey, sideStrength, strengthOf, strengths, type SideStrength, type Strength } from '../../engine/teams.ts';
import type { Team } from '../../engine/types.ts';
import { newId, useMatches } from '../../store/matches.tsx';
import { useSquad } from '../../store/squad.ts';
import { colors, font, radius, space, type } from '../../theme.ts';

// The sides: how strong each is on current form, and two even sides from whoever turns up today.

const TINTS = [colors.accentInk, colors.violet];

/** A side's strength in a few numbers, then its players best first. */
function SideCard({ name, s, tint, captain, note }: { name: string; s: SideStrength; tint: string; captain?: string; note?: string }) {
  const isCaptain = (n: string) => Boolean(captain) && nameKey(captain!) === nameKey(n);
  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <View style={styles.sideHead}>
        <View style={[styles.sideBar, { backgroundColor: tint }]} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.sideName} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.sideMeta}>
            {s.players.length} players{note ? ` · ${note}` : ''}
          </Text>
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
      {[...s.players].sort((p, q) => Number(isCaptain(q.name)) - Number(isCaptain(p.name))).map((p, i) => (
        <View key={p.name} style={[styles.player, i === 0 && { borderTopWidth: 0 }]}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.playerName} numberOfLines={1}>
              {p.name}
              {isCaptain(p.name) ? <Text style={styles.mark}>{'  '}C</Text> : null}
              {p.keeper ? <Text style={styles.mark}>{'  '}WK</Text> : null}
            </Text>
            <Text style={styles.playerSub} numberOfLines={1}>
              {p.guest ? 'Not in the squad: counted as average' : `Bat ${p.bat}★ · Bowl ${p.bowl}★${p.form === null ? ' · no matches yet' : ''}`}
            </Text>
          </View>
          {p.form !== null && <FormBadge form={p.form} />}
          <Text style={styles.playerPower}>{p.power.toFixed(1)}</Text>
        </View>
      ))}
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
  const { savedTeams } = useMatches();
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
          <SideCard name={x.team.name} s={x.s} tint={TINTS[i % 2]} captain={x.team.players.find((p) => p.id === x.team.captain)?.name} />
        </FadeIn>
      ))}
      <Text style={styles.hint}>
        Strength is out of 10: mostly each player’s form (their last five match ratings), steadied by their stars so one
        big game doesn’t swing it. A player with no matches yet plays to their stars.
      </Text>
    </View>
  );
}

function RecommendView({ table }: { table: Map<string, Strength> }) {
  const { savedTeams, rememberTeams } = useMatches();
  const { squad } = useSquad();
  const toast = useToast();
  const everyone = useMemo(() => [...table.values()].sort((a, b) => a.name.localeCompare(b.name)), [table]);
  const [out, setOut] = useState<Set<string>>(new Set());
  const [captains, setCaptains] = useState<string[]>([]);
  const [seed, setSeed] = useState(1);
  const [saving, setSaving] = useState(false);
  const playing = everyone.filter((p) => !out.has(nameKey(p.name)));
  const caps = captains.filter((c) => playing.some((p) => nameKey(p.name) === nameKey(c)));
  const split = useMemo(() => (playing.length >= 2 ? evenSides(playing, seed, [caps[0], caps[1]]) : null), [playing, seed, caps]);
  const names: [string, string] = [savedTeams[0]?.name ?? 'Team A', savedTeams[1]?.name ?? 'Team B'];

  const toggle = (name: string) => {
    const k = nameKey(name);
    setOut((s) => {
      const next = new Set(s);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
    setSaving(false);
  };
  const toggleCaptain = (name: string) => {
    setCaptains((c) => (c.includes(name) ? c.filter((x) => x !== name) : [...c, name].slice(-2)));
    setSaving(false);
  };

  /** The sides as the match setup takes them: captain first, the first keeper keeping. */
  const drafts = () =>
    split!.sides.map((side, i) => {
      const keeper = side.findIndex((p) => p.keeper);
      return { name: names[i], players: side.map((p) => p.name), captain: caps[i] ? 0 : undefined, keeper: keeper >= 0 ? keeper : undefined };
    });

  /** Save them as the two usual sides, keeping each side's and each player's id where they were already there. */
  const save = () => {
    const teams = split!.sides.map((side, i): Team => {
      const was = savedTeams.find((t) => nameKey(t.name) === nameKey(names[i]));
      const players = side.map((p) => ({
        id: was?.players.find((x) => nameKey(x.name) === nameKey(p.name))?.id ?? newId(),
        name: p.name,
        role: squad.find((s) => nameKey(s.name) === nameKey(p.name))?.role ?? DEFAULT_SQUAD.find((s) => nameKey(s.name) === nameKey(p.name))?.role,
      }));
      const idOf = (name?: string) => players.find((p) => name && nameKey(p.name) === nameKey(name))?.id;
      return { id: was?.id ?? newId(), name: names[i], players, captain: idOf(caps[i]), keeper: idOf(side.find((p) => p.keeper)?.name) };
    });
    rememberTeams(teams);
    setSaving(false);
    toast.show(`${names[0]} and ${names[1]} saved with these players`, 'success');
  };

  return (
    <View style={{ gap: space.md }}>
      <SectionLabel right={<Text style={styles.count}>{playing.length} playing</Text>}>Who’s playing today</SectionLabel>
      <Card style={{ gap: space.sm }}>
        <Text style={styles.hint}>Tap anyone who isn’t here to leave them out.</Text>
        <View style={styles.wrap}>
          {everyone.map((p) => (
            <Chip key={p.name} label={p.name} selected={!out.has(nameKey(p.name))} onPress={() => toggle(p.name)} />
          ))}
        </View>
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

      {split ? (
        <>
          <SectionLabel>Two even sides</SectionLabel>
          <Card style={styles.even}>
            <Ionicons name="scale-outline" size={22} color={colors.accentInk} />
            <View style={{ flex: 1 }}>
              <Text style={styles.evenTitle}>
                {split.strength[0].power.toFixed(1)} v {split.strength[1].power.toFixed(1)}
              </Text>
              <Text style={styles.hint}>
                {split.gap < 0.5 ? 'As even as they come.' : `${split.gap.toFixed(1)} apart in strength altogether: the closest split there is.`}{' '}
                {split.strength[0].keepers && split.strength[1].keepers ? 'A keeper each, ' : ''}
                {split.strength[0].bowlers} and {split.strength[1].bowlers} bowlers.
                {playing.length % 2 ? ` ${names[0]} have a player more, so their players are a little weaker.` : ''}
              </Text>
            </View>
          </Card>
          {split.sides.map((side, i) => (
            <SideCard key={i} name={names[i]} s={split.strength[i]} tint={TINTS[i]} captain={caps[i]} note={caps[i] ? `led by ${caps[i]}` : undefined} />
          ))}
          <Button variant="ghost" icon="shuffle" label="Shuffle: another even split" onPress={() => setSeed((s) => s + 1)} />
          <Button icon="play" label="Start a match with these sides" onPress={() => router.push({ pathname: '/new', params: { sides: JSON.stringify(drafts()) } })} />
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
          {view === 'strength' ? <StrengthView table={table} /> : <RecommendView table={table} />}
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

  even: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, borderRadius: radius.lg },
  evenTitle: { color: colors.text, fontSize: 18, fontFamily: font.posterBlack, marginBottom: 2 },
});
