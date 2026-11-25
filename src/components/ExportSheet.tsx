import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { matchState } from '../engine/engine.ts';
import type { Match } from '../engine/types.ts';
import { colors, font, radius, space, type, edge } from '../theme.ts';
import { backupFileName } from '../engine/backup.ts';
import { Button, PressableScale, Sheet, type IconName } from './ui.tsx';
import { Rise } from './motion.tsx';
import { SeamDivider } from './cricket.tsx';

type Format = 'pdf' | 'image' | 'file';

const FORMATS: { value: Format; icon: IconName; title: string; body: string }[] = [
  { value: 'pdf', icon: 'document-text', title: 'PDF report', body: 'Full scorecards to print, email or keep' },
  { value: 'image', icon: 'image', title: 'Picture', body: 'One image to post in the group chat' },
  { value: 'file', icon: 'swap-horizontal', title: 'Match file', body: 'To load the match on another phone' },
];

/** Pick a format, then the matches: all of them, a few, or the one you're looking at. */
export function ExportSheet({
  visible,
  matches,
  preselected,
  onClose,
  onExport,
}: {
  visible: boolean;
  /** The matches to choose from; with only one there's nothing to pick. */
  matches: Match[];
  /** Ticked when the sheet opens; everything if left out. */
  preselected?: string[];
  onClose: () => void;
  onExport: (format: Format, chosen: Match[]) => void;
}) {
  const [format, setFormat] = useState<Format>('pdf');
  const [chosen, setChosen] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (visible) setChosen(new Set(preselected ?? matches.map((m) => m.id)));
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps -- reset only when it opens

  const toggle = (id: string) =>
    setChosen((c) => {
      const next = new Set(c);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const all = chosen.size === matches.length;
  const picked = matches.filter((m) => chosen.has(m.id));
  const n = picked.length;
  const fileName = n ? backupFileName(picked, new Date(), format === 'pdf' ? 'pdf' : format === 'image' ? 'png' : 'json') : '';

  return (
    <Sheet visible={visible} onClose={onClose} title="Share or export">
      <Text style={styles.step}>1 · What kind of file?</Text>
      <View style={styles.formats}>
        {FORMATS.map((f) => {
          const on = f.value === format;
          return (
            <View key={f.value} style={{ flex: 1 }}>
              <PressableScale
                accessibilityLabel={f.title}
                accessibilityState={{ selected: on }}
                scaleTo={0.94}
                onPress={() => setFormat(f.value)}
                style={[styles.format, on && styles.formatOn]}
              >
                <Ionicons name={f.icon} size={22} color={on ? colors.onAccent : colors.accentInk} />
                <Text style={[styles.formatTitle, on && { color: colors.onAccent }]}>{f.title}</Text>
                <Text style={[styles.formatBody, on && { color: colors.onAccent }]}>{f.body}</Text>
              </PressableScale>
            </View>
          );
        })}
      </View>

      {matches.length > 1 && (
        <>
          <Text style={[styles.step, { marginTop: space.lg }]}>2 · Which matches?</Text>
          <View style={styles.listHead}>
            <Text style={styles.listTitle}>
              MATCHES <Text style={{ color: colors.accentInk }}>{n}</Text>/{matches.length}
            </Text>
            <PressableScale onPress={() => setChosen(new Set(all ? [] : matches.map((m) => m.id)))} hitSlop={7} style={styles.allButton}>
              <Text style={styles.allText}>{all ? 'Select none' : 'Select all'}</Text>
            </PressableScale>
          </View>
          <ScrollView style={styles.list} contentContainerStyle={{ gap: 6 }}>
            {matches.map((m) => {
              const on = chosen.has(m.id);
              const state = matchState(m);
              const d = new Date(m.createdAt);
              return (
                <PressableScale
                  key={m.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  scaleTo={0.98}
                  onPress={() => toggle(m.id)}
                  style={[styles.row, on && styles.rowOn]}
                >
                  <View style={[styles.check, on && styles.checkOn]}>
                    {on && <Ionicons name="checkmark" size={16} color={colors.onAccent} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {m.teams[0].name} <Text style={{ color: colors.faint }}>vs</Text> {m.teams[1].name}
                    </Text>
                    <Text style={styles.rowSub} numberOfLines={1}>
                      {d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} · {state.result ?? 'In progress'}
                    </Text>
                  </View>
                </PressableScale>
              );
            })}
          </ScrollView>
        </>
      )}

      <SeamDivider style={{ marginTop: space.lg }} />
      <Text style={[styles.step, { marginTop: space.md }]}>{matches.length > 1 ? '3 · What you will get' : '2 · What you will get'}</Text>
      <Rise key={format + n}>
        <View style={styles.preview}>
          <View style={styles.previewIcon}>
            <Ionicons name={FORMATS.find((f) => f.value === format)!.icon} size={26} color={colors.onAccent} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.previewTitle} numberOfLines={1}>
              {n === 0 ? 'Nothing picked yet' : fileName}
            </Text>
            <Text style={styles.previewSub}>
              {n === 0
                ? 'Tick at least one match above.'
                : format === 'pdf'
                  ? `A PDF with ${n === 1 ? 'the scorecard' : `${n} scorecards, a page per match`}.`
                  : format === 'image'
                    ? n === 1 ? 'A picture of the scorecard.' : `${n} pictures, one per match.`
                    : `A file with ${n === 1 ? 'this match' : `${n} matches`}, ball by ball.`}
            </Text>
          </View>
        </View>
      </Rise>
      <Button
        label={n === 0 ? 'Pick a match' : `Share ${n === 1 ? (matches.length === 1 ? 'this match' : '1 match') : `${n} matches`} as ${format === 'pdf' ? 'PDF' : format === 'image' ? (n > 1 ? 'pictures' : 'a picture') : 'file'}`}
        icon="share-social-outline"
        disabled={n === 0}
        onPress={() => onExport(format, picked)}
        style={{ marginTop: space.md }}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  step: { ...type.label, color: colors.muted, marginBottom: space.sm },
  preview: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.gold, ...edge },
  previewIcon: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  previewTitle: { color: colors.text, fontSize: 14, fontFamily: font.bold },
  previewSub: { color: colors.muted, fontSize: 12, fontFamily: font.medium, marginTop: 2 },
  formats: { flexDirection: 'row', gap: space.sm },
  format: {
    backgroundColor: colors.surfaceHi,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderHi,
    padding: space.md,
    gap: 4,
    minHeight: 118,
    ...edge,
  },
  formatOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  formatTitle: { fontFamily: font.poster, fontSize: 18, color: colors.text, marginTop: space.sm },
  formatBody: { color: colors.muted, fontSize: 12, fontFamily: font.medium },
  listHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.sm },
  listTitle: { ...type.label, color: colors.muted },
  allButton: { paddingHorizontal: space.md, height: 30, justifyContent: 'center', borderRadius: radius.sm, backgroundColor: colors.surfaceHi },
  allText: { color: colors.text, fontSize: 12, fontFamily: font.bold },
  list: { maxHeight: 260 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.md,
    ...edge,
  },
  rowOn: { borderColor: colors.accent },
  check: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.borderHi,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  rowTitle: { color: colors.text, fontSize: 15, fontFamily: font.bold },
  rowSub: { color: colors.muted, fontSize: 12, fontFamily: font.medium, marginTop: 1 },
  hint: { color: colors.faint, fontSize: 12, fontFamily: font.regular, textAlign: 'center', marginTop: space.sm },
});
