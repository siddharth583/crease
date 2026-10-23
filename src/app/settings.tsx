import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, IconButton, Screen, SectionLabel, Segmented, useToast } from '../components/ui.tsx';
import { useMatches } from '../store/matches.tsx';
import { restartApp, startupPrefs, usePrefs, type Prefs } from '../store/prefs.ts';
import { useMatchFiles } from '../store/useMatchFiles.ts';
import { colors, font, space, type } from '../theme.ts';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { prefs, setPrefs } = usePrefs();
  const { matches } = useMatches();
  const toast = useToast();
  const { exportMatches } = useMatchFiles(toast.show);
  // The theme applies on the next start, so remember what the person picked here.
  const [needsRestart, setNeedsRestart] = useState(false);
  const pick = (patch: Partial<Prefs>) => {
    setPrefs(patch);
    const next = { ...prefs, ...patch };
    setNeedsRestart(next.theme !== startupPrefs.theme);
  };

  const backedUp = prefs.lastBackup
    ? `Last backup ${new Date(prefs.lastBackup).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`
    : 'Never backed up';

  return (
    <Screen>
      <View style={styles.header}>
        <IconButton icon="chevron-back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      </View>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: 0, paddingBottom: insets.bottom + space.xxl }}>
        <Text style={styles.title}>{'Settings'.toUpperCase()}</Text>

        <SectionLabel>Look</SectionLabel>
        <Card style={{ gap: space.md }}>
          <Segmented
            value={prefs.theme}
            onChange={(theme) => pick({ theme })}
            options={[
              { value: 'night', label: 'Night (dark)' },
              { value: 'day', label: 'Day (bright sun)' },
            ]}
          />
          <Text style={styles.note}>Day mode is easier to read outdoors in strong sunlight.</Text>
        </Card>

        {needsRestart && (
          <Button
            label="Restart to apply"
            icon="refresh"
            onPress={() => {
              if (!restartApp()) toast.show('Close Crease and open it again to see the change', 'info');
            }}
            style={{ marginTop: space.lg }}
          />
        )}

        <SectionLabel>Backup</SectionLabel>
        <Card style={{ gap: space.md }}>
          <Text style={styles.body}>{backedUp}. A backup is one match file with every match; keep it in Google Drive or send it to yourself.</Text>
          <Button
            variant="ghost"
            label="Back up all matches"
            icon="cloud-upload-outline"
            disabled={!matches.length}
            onPress={async () => {
              await exportMatches(matches);
              setPrefs({ lastBackup: Date.now() });
            }}
          />
        </Card>
      </ScrollView>
      {toast.element}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', paddingHorizontal: space.lg, paddingVertical: space.sm },
  title: { fontFamily: font.posterBlack, fontSize: 54, lineHeight: 54, color: colors.text, letterSpacing: -1 },
  note: { color: colors.muted, fontSize: 13, fontFamily: font.regular },
  body: { color: colors.text, fontSize: 14, fontFamily: font.medium, lineHeight: 20 },
  divider: { height: 1, backgroundColor: colors.border },
  label: { ...type.label, color: colors.muted },
});
