import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState } from 'react';
import { ExportSheet } from '../components/ExportSheet.tsx';
import { Button, Card, IconButton, Screen, SectionLabel, Segmented, useToast } from '../components/ui.tsx';
import { useMatches } from '../store/matches.tsx';
import { applyTheme, usePrefs } from '../store/prefs.ts';
import { useMatchFiles } from '../store/useMatchFiles.ts';
import { colors, font, space, type } from '../theme.ts';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { prefs, setPrefs } = usePrefs();
  const { matches } = useMatches();
  const toast = useToast();
  const { exportEverything, exportAs, importFile } = useMatchFiles(toast.show);
  const [exporting, setExporting] = useState(false);

  const backedUp = prefs.lastBackup
    ? `Last backup ${new Date(prefs.lastBackup).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`
    : 'Never backed up';

  return (
    <Screen>
      <View style={styles.header}>
        <IconButton icon="chevron-back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      </View>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: 0, paddingBottom: insets.bottom + space.xxl }}>
        <Text style={styles.title}>Settings</Text>

        <SectionLabel>Look</SectionLabel>
        <Card style={{ gap: space.md }}>
          <Segmented
            value={prefs.theme}
            onChange={(theme) => {
              if (theme !== prefs.theme) applyTheme(theme);
            }}
            options={[
              { value: 'night', label: 'Night (dark)' },
              { value: 'day', label: 'Day (bright sun)' },
            ]}
          />
          <Text style={styles.note}>Day mode is easier to read outdoors in strong sunlight. The app reloads for a moment to switch.</Text>
        </Card>


        <SectionLabel>Matches</SectionLabel>
        <Card style={{ gap: space.md }}>
          <Text style={styles.body}>
            {backedUp}. A backup is one file with everything: every match ball by ball, your saved sides, the squad (roles,
            keepers, stars) and the auctions. Keep it in Google Drive or send it to yourself.
          </Text>
          <Button
            variant="ghost"
            label="Back up everything"
            icon="cloud-upload-outline"
            onPress={async () => {
              if (await exportEverything()) setPrefs({ lastBackup: Date.now() });
            }}
          />
          <Button variant="ghost" label="Export matches as PDF or file" icon="document-text-outline" disabled={!matches.length} onPress={() => setExporting(true)} />
          <Button variant="ghost" label="Import a backup or match file" icon="push-outline" onPress={() => importFile()} />
          <Text style={styles.note}>
            A backup brings everything back on any phone: the matches, and from them every scorecard, record, rating and form,
            plus the squad and auctions. It adds to what’s here: nothing is added twice, and a match only changes if the
            file’s copy is newer.
          </Text>
        </Card>
      </ScrollView>
      <ExportSheet
        visible={exporting}
        matches={matches}
        onClose={() => setExporting(false)}
        onExport={(format, chosen) => {
          setExporting(false);
          exportAs(format, chosen);
        }}
      />
      {toast.element}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', paddingHorizontal: space.lg, paddingVertical: space.sm },
  title: { fontFamily: font.posterBlack, fontSize: 38, lineHeight: 42, color: colors.text, letterSpacing: -1.4 },
  note: { color: colors.muted, fontSize: 13, fontFamily: font.regular },
  body: { color: colors.text, fontSize: 14, fontFamily: font.medium, lineHeight: 20 },
  divider: { height: 1, backgroundColor: colors.border },
  label: { ...type.label, color: colors.muted },
});
