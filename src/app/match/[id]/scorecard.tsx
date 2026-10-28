import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, type StyleProp, type TextStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OverEditSheet } from '../../../components/OverEditSheet.tsx';
import { ExportSheet } from '../../../components/ExportSheet.tsx';
import { BallByBall, Partnerships, RunRace } from '../../../components/MatchCharts.tsx';
import { BallChip, Button, Card, IconButton, PressableScale, Screen, SectionLabel, Segmented, Sheet, useToast } from '../../../components/ui.tsx';
import { dismissal, fairBalls, matchState, oversText, playerName, renamePlayer, replaceOver, retirements, setRetirement, type InningsState } from '../../../engine/engine.ts';
import { isPlaceholder, keyFor, momChoices, playerOfTheMatch } from '../../../engine/stats.ts';
import type { BallEvent, Match, Team } from '../../../engine/types.ts';
import { useMatch, useMatches } from '../../../store/matches.tsx';
import { useMatchFiles } from '../../../store/useMatchFiles.ts';
import { colors, radius, space, type, font, edge } from '../../../theme.ts';

const econ = (runs: number, balls: number) => (balls ? ((runs * 6) / balls).toFixed(1) : '–');
const sr = (runs: number, balls: number) => (balls ? ((runs * 100) / balls).toFixed(1) : '–');

/** A player's name that opens their career profile, unless they were never named. */
function PlayerLink({ match, team, id, style }: { match: Match; team: Team; id: string; style: StyleProp<TextStyle> }) {
  const base = playerName(match, id);
  const marks = `${match.captains?.[team.id] === id ? ' (c)' : ''}${match.keepers?.[team.id] === id ? ' †' : ''}`;
  const name = base;
  if (isPlaceholder(name)) return <Text numberOfLines={1} style={style}>{name + marks}</Text>;
  return (
    <Pressable
      hitSlop={6}
      style={{ flexShrink: 1, minWidth: 0 }}
      onPress={() => router.push({ pathname: '/player/[key]', params: { key: keyFor(team, team.players.find((p) => p.id === id) ?? { name }) } })}
    >
      {({ pressed }) => (
        <Text numberOfLines={1} style={[style, pressed && { opacity: 0.6 }]}>
          {name}
          {marks}
        </Text>
      )}
    </Pressable>
  );
}

function InningsCard({ match, s }: { match: Match; s: InningsState }) {
  const extras = s.extras.wide + s.extras.noball + s.extras.bye + s.extras.legbye + s.extras.penalty;
  const yetToBat = s.battingTeam.players.filter((p) => !s.batters.some((b) => b.id === p.id));
  const atCrease = [s.striker, s.nonStriker];

  return (
    <>
      <View style={styles.totalRow}>
        <Text numberOfLines={1} style={styles.totalTeam}>
          {s.battingTeam.name}
        </Text>
        <Text style={styles.total}>
          {s.runs}/{s.wickets}
          <Text style={styles.totalOvers}>  {oversText(s.legalBalls)} ov</Text>
        </Text>
      </View>

      <SectionLabel>Batting</SectionLabel>
      <Card style={{ padding: 0 }}>
        <View style={styles.head}>
          <Text style={[styles.th, { flex: 1, textAlign: 'left' }]}>BATTER</Text>
          {['R', 'B', '4s', '6s'].map((h) => (
            <Text key={h} style={styles.th}>
              {h}
            </Text>
          ))}
          <Text style={[styles.th, { width: 58 }]}>SR</Text>
        </View>
        {s.batters.map((b) => {
          const notOut = !b.out && !b.retired;
          return (
            <View key={b.id} style={styles.row}>
              <View style={{ flex: 1, paddingRight: space.sm }}>
                <View style={styles.nameRow}>
                  <PlayerLink match={match} team={s.battingTeam} id={b.id} style={[styles.name, notOut && { color: colors.accentInk }]} />
                  {notOut && atCrease.includes(b.id) && <Text style={[styles.name, { color: colors.accentInk }]}>*</Text>}
                </View>
                <Text numberOfLines={1} style={styles.how}>
                  {dismissal(match, b)}
                </Text>
              </View>
              <Text style={[styles.td, styles.strong]}>{b.runs}</Text>
              <Text style={styles.td}>{b.balls}</Text>
              <Text style={styles.td}>{b.fours}</Text>
              <Text style={styles.td}>{b.sixes}</Text>
              <Text style={[styles.td, { width: 58 }]}>{sr(b.runs, b.balls)}</Text>
            </View>
          );
        })}
        <View style={styles.row}>
          <Text style={[styles.name, { flex: 1 }]}>Extras</Text>
          <Text style={styles.how}>
            wd {s.extras.wide}, nb {s.extras.noball}, b {s.extras.bye}, lb {s.extras.legbye}
            {s.extras.penalty ? `, pen ${s.extras.penalty}` : ''}
          </Text>
          <Text style={[styles.td, styles.strong, { width: 40 }]}>{extras}</Text>
        </View>
        {yetToBat.length > 0 && (
          <View style={[styles.row, { alignItems: 'flex-start' }]}>
            <Text style={styles.how}>
              <Text style={{ color: colors.muted, fontFamily: font.bold }}>Yet to bat  </Text>
              {yetToBat.map((p) => p.name).join(', ')}
            </Text>
          </View>
        )}
      </Card>

      {s.fallOfWickets.length > 0 && (
        <>
          <SectionLabel>Fall of wickets</SectionLabel>
          <Card>
            <Text style={styles.fow}>
              {s.fallOfWickets.map((f) => `${f.runs}-${f.wicket} (${playerName(match, f.player)}, ${f.over})`).join('   ')}
            </Text>
          </Card>
        </>
      )}

      <SectionLabel>Bowling</SectionLabel>
      <Card style={{ padding: 0 }}>
        <View style={styles.head}>
          <Text style={[styles.th, { flex: 1, textAlign: 'left' }]}>BOWLER</Text>
          {['O', 'M', 'R', 'W'].map((h) => (
            <Text key={h} style={styles.th}>
              {h}
            </Text>
          ))}
          <Text style={[styles.th, { width: 58 }]}>ECON</Text>
        </View>
        {s.bowlers.map((b) => (
          <View key={b.id} style={styles.row}>
            <View style={{ flex: 1 }}>
              <View style={styles.nameRow}>
                <PlayerLink match={match} team={s.bowlingTeam} id={b.id} style={styles.name} />
              </View>
              {(b.wides > 0 || b.noballs > 0) && (
                <Text style={styles.how}>
                  {b.wides} wd · {b.noballs} nb
                </Text>
              )}
            </View>
            <Text style={styles.td}>{oversText(b.balls)}</Text>
            <Text style={styles.td}>{b.maidens}</Text>
            <Text style={styles.td}>{b.runs}</Text>
            <Text style={[styles.td, styles.strong, b.wickets > 0 && { color: colors.accentInk }]}>{b.wickets}</Text>
            <Text style={[styles.td, { width: 58 }]}>{econ(b.runs, b.balls)}</Text>
          </View>
        ))}
        {s.bowlers.length === 0 && <Text style={[styles.how, { padding: space.lg }]}>No overs bowled yet</Text>}
      </Card>
    </>
  );
}

/** Every over with its bowlers and balls; tap one to rewrite it. */
function OversEditor({ match, s, inningsIndex, onOpen }: { match: Match; s: InningsState; inningsIndex: number; onOpen: (over: number) => void }) {
  const events = match.innings[inningsIndex].events;
  const lastOver = s.overs.reduce((n, o, i) => (o.length ? i : n), 0);
  return (
    <>
      <SectionLabel>Overs · tap one to edit it</SectionLabel>
      <Card style={{ padding: 0 }}>
        {s.overs.map((balls, o) => {
          if (balls.length === 0) return null;
          const fair = fairBalls(match.rules, balls.map((b) => events[b.event!] as BallEvent));
          const off = o !== lastOver && fair !== 6;
          return (
            <PressableScale key={o} scaleTo={0.98} accessibilityLabel={`Edit over ${o + 1}`} onPress={() => onOpen(o)} style={styles.editOver}>
              <View style={styles.editOverHead}>
                <Text style={styles.editOverTitle} numberOfLines={1}>
                  OVER {o + 1} · {(s.overBowlers[o] ?? []).map((id) => playerName(match, id)).join(' → ') || 'no bowler'} · {s.overTotals[o]?.runs ?? 0} runs
                </Text>
                <Ionicons name="create-outline" size={16} color={colors.accentInk} />
              </View>
              <View style={styles.editBalls}>
                {balls.map((b, i) => (
                  <BallChip key={i} ball={b} />
                ))}
              </View>
              {off && <Text style={styles.offNote}>{fair} fair balls: tap to make it 6</Text>}
            </PressableScale>
          );
        })}
      </Card>
    </>
  );
}

/** Every batter who retired in the innings: switch each between retired hurt and retired out. */
function RetirementsEditor({ match, inningsIndex, onChange }: { match: Match; inningsIndex: number; onChange: (eventIndex: number, out: boolean) => void }) {
  const list = retirements(match, inningsIndex);
  return (
    <>
      <SectionLabel>Retirements</SectionLabel>
      <Card style={{ gap: space.md }}>
        {list.length === 0 ? (
          <Text style={styles.namesHint}>
            Nobody retired. If a wicket was really a retirement, tap its over above, tap the ball, and pick Retired hurt or Retired out.
          </Text>
        ) : (
          <>
            <Text style={styles.namesHint}>Retired hurt isn’t a wicket and they can bat again. Retired out is a wicket, to no bowler.</Text>
            {list.map((r) => (
              <View key={r.event} style={{ gap: 6 }}>
                <Text style={styles.namesTeam}>
                  {playerName(match, r.batter)} <Text style={{ color: colors.faint }}>· after {r.over} overs</Text>
                </Text>
                <Segmented
                  value={r.out ? 'out' : 'hurt'}
                  onChange={(v) => v !== (r.out ? 'out' : 'hurt') && onChange(r.event, v === 'out')}
                  options={[
                    { value: 'hurt', label: 'Retired hurt' },
                    { value: 'out', label: 'Retired out' },
                  ]}
                />
              </View>
            ))}
          </>
        )}
      </Card>
    </>
  );
}

/** Pick the Man of the Match by hand, or leave it to Crease. Everyone who played, biggest impact first. */
function MomSheet({ match, visible, onClose, onPick }: { match: Match; visible: boolean; onClose: () => void; onPick: (id: string | undefined) => void }) {
  if (!visible) return null;
  const auto = playerOfTheMatch({ ...match, mom: undefined });
  const choices = momChoices(match);
  return (
    <Sheet visible onClose={onClose} title="Man of the Match">
      <ScrollView style={{ maxHeight: 520 }} contentContainerStyle={{ gap: space.sm, paddingBottom: space.md }}>
        <PressableScale scaleTo={0.98} onPress={() => onPick(undefined)} style={[styles.momPick, !match.mom && styles.momPickOn]}>
          <Ionicons name="sparkles" size={18} color={colors.accentInk} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.momPickName}>Let Crease pick</Text>
            <Text style={styles.momLine} numberOfLines={1}>
              {auto ? `${auto.name} · ${auto.team}` : 'Nobody yet'}
            </Text>
          </View>
          {!match.mom && <Ionicons name="checkmark-circle" size={20} color={colors.accentInk} />}
        </PressableScale>
        <Text style={styles.momHint}>
          Crease picks the biggest impact on the winning side: runs (more for scoring fast), 20 a wicket, 5 a maiden, 8 a
          catch or run out, and runs saved or given away against the match’s scoring rate. Someone on the losing side gets
          it only for half as much again.
        </Text>
        {choices.map((c) => (
          <PressableScale key={c.id} scaleTo={0.98} onPress={() => onPick(c.id)} style={[styles.momPick, match.mom === c.id && styles.momPickOn]}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.momPickName} numberOfLines={1}>
                {c.name}
              </Text>
              <Text style={styles.momLine} numberOfLines={1}>
                {c.team} · {c.summary}
              </Text>
            </View>
            {match.mom === c.id && <Ionicons name="checkmark-circle" size={20} color={colors.accentInk} />}
          </PressableScale>
        ))}
      </ScrollView>
    </Sheet>
  );
}

/** One player's name, editable: saved when they finish typing, put back if left empty. */
function NameField({ name, onSave }: { name: string; onSave: (name: string) => void }) {
  const [draft, setDraft] = useState(name);
  const save = () => {
    if (!draft.trim()) setDraft(name);
    else if (draft.trim() !== name) onSave(draft);
  };
  return (
    <TextInput
      value={draft}
      onChangeText={setDraft}
      onBlur={save}
      onSubmitEditing={save}
      returnKeyType="done"
      autoCapitalize="words"
      maxLength={28}
      style={styles.nameInput}
      placeholderTextColor={colors.faint}
      accessibilityLabel={`Rename ${name}`}
    />
  );
}

/** Every player's name in this match, both sides, to fix a spelling or put in a full name. */
function NamesEditor({ match, onRename }: { match: Match; onRename: (playerId: string, name: string) => void }) {
  return (
    <>
      <SectionLabel>Players’ names</SectionLabel>
      <Card style={{ gap: space.md }}>
        <Text style={styles.namesHint}>Tap a name to change it. Their runs and wickets stay with them, and their stats follow the new name.</Text>
        {match.teams.map((t) => (
          <View key={t.id} style={{ gap: space.sm }}>
            <Text style={styles.namesTeam}>{t.name}</Text>
            {t.players
              .filter((p) => !(p.common && t !== match.teams[0]))
              .map((p) => (
                <NameField key={p.id} name={p.name} onSave={(name) => onRename(p.id, name)} />
              ))}
          </View>
        ))}
      </Card>
    </>
  );
}

export default function Scorecard() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { match, saveMatch } = useMatch(id);
  const { deleteMatch } = useMatches();
  const [deleting, setDeleting] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingOver, setEditingOver] = useState<number | null>(null);
  const [pickingMom, setPickingMom] = useState(false);
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<string | null>(null);
  const toast = useToast();
  const { exportAs } = useMatchFiles(toast.show);
  const [exporting, setExporting] = useState<Match[] | null>(null);

  if (!match) return <Screen>{null}</Screen>;
  const state = matchState(match);
  const mom = state.result ? playerOfTheMatch(match) : null;
  const shown = tab ?? (String(state.current));
  const s = state.innings[Number(shown)];
  const started = match.innings[Number(shown)].events.length > 0;

  return (
    <Screen>
      <View style={styles.header}>
        <IconButton icon="chevron-back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        <Text style={styles.headerTitle}>Scorecard</Text>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <IconButton
            icon={editMode ? 'checkmark' : 'create-outline'}
            label={editMode ? 'Done editing' : 'Edit scorecard'}
            onPress={() => setEditMode(!editMode)}
          />
          <IconButton icon="download-outline" label="Export match" onPress={() => setExporting([match])} />
          <IconButton icon="trash-outline" label="Delete this match" onPress={() => setDeleting(true)} />
        </View>
      </View>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: space.sm, paddingBottom: insets.bottom + space.xxl }}>
        <View style={[styles.banner, state.result ? styles.bannerDone : null]}>
          <Ionicons
            name={state.result ? 'trophy' : 'radio-button-on'}
            size={16}
            color={state.result ? colors.onAccent : colors.danger}
          />
          <Text style={[styles.bannerText, state.result ? { color: colors.onAccent } : null]}>{state.result ?? 'Live · match in progress'}</Text>
        </View>
        {mom && (
          <View style={styles.mom}>
            {/* The player opens their profile; Change sits beside it (a button can't hold another). */}
            <PressableScale
              scaleTo={0.98}
              disabled={isPlaceholder(mom.name)}
              dimWhenDisabled={false}
              onPress={() => router.push({ pathname: '/player/[key]', params: { key: mom.key } })}
              wrapStyle={{ flex: 1, minWidth: 0 }}
              style={styles.momPlayer}
            >
            <View style={styles.momIcon}>
              <Ionicons name="star" size={18} color={colors.gold} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.momLabel}>Man of the Match{match.mom ? ' · picked by you' : ''}</Text>
              <Text style={styles.momName} numberOfLines={1}>
                {mom.name}
              </Text>
              <Text style={styles.momLine} numberOfLines={1}>
                {mom.team} · {mom.summary}
              </Text>
            </View>
            </PressableScale>
            <PressableScale accessibilityLabel="Change the Man of the Match" onPress={() => setPickingMom(true)} style={styles.momChange}>
              <Text style={styles.momChangeText}>Change</Text>
            </PressableScale>
          </View>
        )}
        <Segmented
          value={shown}
          onChange={setTab}
          options={state.innings.map((inn, i) => ({ value: String(i), label: i >= 2 ? `SO · ${inn.battingTeam.name}` : inn.battingTeam.name }))}
        />
        {editMode && (
          <View style={styles.editHint}>
            <Ionicons name="create-outline" size={16} color={colors.accentInk} />
            <Text style={styles.editHintText}>
              Editing. Tap any over below to change its balls, add or take some away, or say who bowled them (a new bowler
              mid-over takes over from the ball they started). Every over keeps its 6 fair balls. Retirements and
              players’ names are at the bottom.
            </Text>
          </View>
        )}
        {started && editMode ? (
          <>
            <InningsCard match={match} s={s} />
            <OversEditor match={match} s={s} inningsIndex={Number(shown)} onOpen={setEditingOver} />
            <RetirementsEditor
              match={match}
              inningsIndex={Number(shown)}
              onChange={(eventIndex, out) => {
                const fixed = setRetirement(match, Number(shown), eventIndex, out);
                if (typeof fixed === 'string') return toast.show(fixed, 'info');
                saveMatch(fixed);
                const r = retirements(fixed, Number(shown)).find((x) => x.event === eventIndex)!;
                toast.show(`${playerName(match, r.batter)} is now retired ${out ? 'out' : 'hurt'}`, 'success');
              }}
            />
            <NamesEditor
              match={match}
              onRename={(playerId, name) => {
                const renamed = renamePlayer(match, playerId, name);
                if (!renamed || renamed === match) return;
                saveMatch(renamed);
                toast.show(`${playerName(match, playerId)} is now ${playerName(renamed, playerId)}`, 'success');
              }}
            />
          </>
        ) : started ? (
          <>
            <InningsCard match={match} s={s} />
            <Partnerships match={match} s={s} />
            <RunRace state={state} />
            <BallByBall match={match} s={s} />
          </>
        ) : (
          <Text style={styles.empty}>{s.battingTeam.name} haven’t batted yet.</Text>
        )}
      </ScrollView>
      <ExportSheet
        visible={exporting !== null}
        matches={exporting ?? []}
        onClose={() => setExporting(null)}
        onExport={(format, chosen) => {
          setExporting(null);
          exportAs(format, chosen);
        }}
      />
      <OverEditSheet
        match={match}
        s={s}
        inningsIndex={Number(shown)}
        over={editingOver}
        onClose={() => setEditingOver(null)}
        onSave={(draft) => {
          if (editingOver === null) return;
          const fixed = replaceOver(match, Number(shown), editingOver, draft);
          if (typeof fixed === 'string') return fixed;
          saveMatch(fixed);
          setEditingOver(null);
          const now = matchState(fixed).result;
          if (now !== state.result) toast.show(now ? `Over saved. Result now: ${now}` : 'Over saved. The match isn’t finished any more: carry on scoring it.', 'info');
          else toast.show(`Over ${editingOver + 1} saved`, 'success');
        }}
      />
      <MomSheet
        match={match}
        visible={pickingMom}
        onClose={() => setPickingMom(false)}
        onPick={(id) => {
          saveMatch({ ...match, mom: id });
          setPickingMom(false);
          toast.show(id ? `${playerName(match, id)} is Man of the Match` : 'Crease picks the Man of the Match', 'success');
        }}
      />
      <Sheet visible={deleting} onClose={() => setDeleting(false)} title="Delete this match?">
        <View style={{ gap: space.md }}>
          <Text style={styles.deleteText}>
            {match.teams[0].name} v {match.teams[1].name}, {new Date(match.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
            {state.result ? ` · ${state.result}` : ''}. Its runs and wickets leave everyone’s stats and the record book. This can’t be undone.
          </Text>
          <Button
            variant="danger"
            icon="trash-outline"
            label="Delete the match"
            onPress={() => {
              setDeleting(false);
              router.replace('/');
              deleteMatch(match.id);
            }}
          />
          <Button variant="ghost" label="Keep it" onPress={() => setDeleting(false)} />
        </View>
      </Sheet>
      {toast.element}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingVertical: space.sm },
  headerTitle: { color: colors.text, fontSize: 21, fontFamily: font.poster },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.dangerDim,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.md,
  },
  bannerDone: { backgroundColor: colors.accent, borderColor: colors.accent, ...edge },
  mom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: space.md,
    marginBottom: space.md,
    ...edge,
  },
  momPlayer: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  momChange: { paddingHorizontal: space.md, height: 32, justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.surfaceHi, borderWidth: 1, borderColor: colors.border },
  momChangeText: { color: colors.text, fontSize: 12, fontFamily: font.bold },
  momPick: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.surfaceHi,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: space.md,
  },
  momPickOn: { borderColor: colors.accentInk },
  momPickName: { fontFamily: font.bold, fontSize: 15, color: colors.text },
  momHint: { color: colors.muted, fontSize: 12, fontFamily: font.medium, lineHeight: 18 },
  momIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.goldDim },
  momLabel: { ...type.label, fontSize: 9, color: colors.muted },
  momName: { fontFamily: font.poster, fontSize: 20, color: colors.text },
  momLine: { color: colors.muted, fontSize: 12, fontFamily: font.medium },
  bannerText: { color: colors.text, fontSize: 16, fontFamily: font.poster, flex: 1 },
  totalRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: space.xl, paddingHorizontal: space.xs },
  totalTeam: { color: colors.text, fontSize: 25, fontFamily: font.poster, flex: 1 },
  total: { color: colors.accentInk, fontSize: 39, lineHeight: 44, fontFamily: font.posterBlack, ...type.num },
  totalOvers: { color: colors.muted, fontSize: 18, fontFamily: font.poster },
  head: { flexDirection: 'row', paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.sm },
  th: { ...type.label, fontSize: 10, color: colors.faint, width: 32, textAlign: 'right' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  name: { color: colors.text, fontSize: 15, fontFamily: font.bold },
  nameRow: { flexDirection: 'row', alignItems: 'center', flexShrink: 1, minWidth: 0 },
  how: { color: colors.muted, fontSize: 12, fontFamily: font.regular, marginTop: 2, flexShrink: 1 },
  td: { width: 32, textAlign: 'right', color: colors.muted, fontSize: 18, fontFamily: font.poster, ...type.num },
  strong: { color: colors.text, fontFamily: font.posterBlack, fontSize: 16 },
  fow: { color: colors.muted, fontSize: 13, fontFamily: font.regular, lineHeight: 20 },
  editHint: {
    flexDirection: 'row',
    gap: space.sm,
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.accentInk,
    borderRadius: radius.lg,
    padding: space.md,
    marginBottom: space.md,
  },
  editHintText: { flex: 1, color: colors.text, fontSize: 13, lineHeight: 19, fontFamily: font.medium },
  namesHint: { color: colors.muted, fontSize: 13, lineHeight: 19, fontFamily: font.medium },
  namesTeam: { ...type.label, color: colors.muted },
  nameInput: {
    color: colors.text,
    fontSize: 15,
    fontFamily: font.semibold,
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: space.md,
    height: 44,
  },
  editOver: { paddingHorizontal: space.lg, paddingVertical: space.md, borderTopWidth: 1, borderTopColor: colors.border, gap: space.sm },
  editOverHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  editOverTitle: { ...type.label, fontSize: 10, color: colors.muted },
  editBalls: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  offNote: { color: colors.danger, fontSize: 12, fontFamily: font.semibold },
  deleteText: { color: colors.muted, fontSize: 14, lineHeight: 21, fontFamily: font.medium },
  empty: { color: colors.muted, textAlign: 'center', marginTop: space.xxl },
});
