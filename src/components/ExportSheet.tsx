import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { matchState } from '../engine/engine.ts';
import type { Match } from '../engine/types.ts';
import { colors, font, radius, space, type } from '../theme.ts';
import { Button, PressableScale, Sheet, type IconName } from './ui.tsx';

type Format = 'pdf' | 'file';

const FORMATS: { value: Format; icon: IconName; title: string; body: string }[] = [
  { value: 'pdf', icon: 'document-text', title: 'PDF scorecard', body: 'To print, or send to anyone' },
  { value: 'file', icon: 'swap-horizontal', title: 'Match file', body: 'To import into Crease on another phone' },
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

  return (
    <Sheet visible={visible} onClose={onClose} title="Export">
      <View style={styles.formats}>
        {FORMATS.map((f) => {
          const on = f.value === format;
          return (
            <View key={f.value} style={{ flex: 1 }}>
              <PressableScale
                accessibilityState={{ selected: on }}
                scaleTo={0.96}
                onPress={() => setFormat(f.value)}
                style={[styles.format, on && styles.formatOn]}
              >
                <Ionicons name={f.icon} size={22} color={on ? colors.onAccent : colors.accent} />
                <Text style={[styles.formatTitle, on && { color: colors.onAccent }]}>{f.title}</Text>
                <Text style={[styles.formatBody, on && { color: colors.onAccent }]}>{f.body}</Text>
              </PressableScale>
            </View>
          );
        })}
      </View>

      {matches.length > 1 && (
        <>
          <View style={styles.listHead}>
            <Text style={styles.listTitle}>
              MATCHES <Text style={{ color: colors.accent }}>{n}</Text>/{matches.length}
            </Text>
            <PressableScale onPress={() => setChosen(new Set(all ? [] : matches.map((m) => m.id)))} style={styles.allButton}>
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

      <Button
        label={
          n === 0
            ? 'Pick a match'
            : `Export ${n === 1 ? (matches.length === 1 ? 'this match' : '1 match') : `${n} matches`} as ${format === 'pdf' ? 'PDF' : 'file'}`
        }
        icon={format === 'pdf' ? 'document-text-outline' : 'download-outline'}
        disabled={n === 0}
        onPress={() => onExport(format, picked)}
        style={{ marginTop: space.lg }}
      />
      {format === 'pdf' && n > 1 && <Text style={styles.hint}>One PDF, a page per match.</Text>}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  formats: { flexDirection: 'row', gap: space.sm },
  format: {
    backgroundColor: colors.surfaceHi,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderHi,
    padding: space.md,
    gap: 4,
    minHeight: 118,
  },
  formatOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  formatTitle: { fontFamily: font.poster, fontSize: 22, color: colors.text, textTransform: 'uppercase', marginTop: space.sm },
  formatBody: { color: colors.muted, fontSize: 12, fontFamily: font.medium },
  listHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.lg, marginBottom: space.sm },
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
