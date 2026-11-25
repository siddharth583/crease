import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppMark } from '../components/AppMark.tsx';
import { ClubSyncSettings, GroupHeader, SignOutButton } from '../components/ClubSync.tsx';
import { OvalGround, SeamDivider } from '../components/cricket.tsx';
import { ExportSheet } from '../components/ExportSheet.tsx';
import { Columns, Page, useLayout } from '../components/layout.tsx';
import { Rise, useReducedMotion } from '../components/motion.tsx';
import { Button, Card, Chip, IconButton, PressableScale, Screen, ToggleRow, useToast, WideHead, type IconName } from '../components/ui.tsx';
import { useMatches } from '../store/matches.tsx';
import { applyTheme, usePrefs } from '../store/prefs.ts';
import { useMatchFiles } from '../store/useMatchFiles.ts';
import { useAccess, useClubSync } from '../store/sync.tsx';
import { colors, font, radius, space } from '../theme.ts';

/** When this copy was built: stamped into the web page at build time (scripts/base-path.mjs); none on the dev server. */
function builtOn() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return null;
  const at = Date.parse(document.querySelector('meta[name="crease-built"]')?.getAttribute('content') ?? '');
  return Number.isNaN(at) ? null : new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

// The two preview tiles always show their own theme's colours, whichever one the app is in now.
const PREVIEW = {
  night: { page: '#050D09', card: '#13241A', hero: ['#17402B', '#07120C'] as const, text: '#F4F1E6', line: 'rgba(244,241,230,0.25)', accent: '#D7FF3A' },
  day: { page: '#F4F2EA', card: '#FFFFFF', hero: ['#17402B', '#0D2418'] as const, text: '#0F1A13', line: 'rgba(15,26,19,0.2)', accent: '#D4FF3A' },
};

/** A miniature of the app in one theme: tap to wear it. It springs when picked. */
function ThemeTile({ mode, selected, onPress }: { mode: 'night' | 'day'; selected: boolean; onPress: () => void }) {
  const p = PREVIEW[mode];
  const still = useReducedMotion();
  const v = useRef(new Animated.Value(selected ? 1 : 0)).current;
  useEffect(() => {
    if (still) return v.setValue(selected ? 1 : 0);
    Animated.spring(v, { toValue: selected ? 1 : 0, useNativeDriver: false, speed: 14, bounciness: 14 }).start();
  }, [selected, still, v]);
  const scale = v.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] });
  return (
    <View style={{ flex: 1 }}>
      <PressableScale accessibilityLabel={mode === 'night' ? 'Night (dark)' : 'Day (bright sun)'} accessibilityState={{ selected }} onPress={onPress} scaleTo={0.94}>
        <Animated.View style={[styles.tile, { transform: [{ scale }], borderColor: selected ? colors.accent : colors.border, borderWidth: selected ? 2 : 1 }]}>
          <View style={[styles.mini, { backgroundColor: p.page }]}>
            <LinearGradient colors={p.hero} style={styles.miniHero}>
              <View style={[styles.miniBar, { width: '50%', backgroundColor: 'rgba(244,241,230,0.9)' }]} />
              <Text style={styles.miniScore}>148/4</Text>
            </LinearGradient>
            <View style={[styles.miniCard, { backgroundColor: p.card, borderColor: p.line }]}>
              <View style={[styles.miniBar, { width: '70%', backgroundColor: p.text, opacity: 0.8 }]} />
              <View style={[styles.miniBar, { width: '40%', backgroundColor: p.text, opacity: 0.35 }]} />
            </View>
            <View style={[styles.miniBtn, { backgroundColor: p.accent }]} />
          </View>
          <View style={styles.tileFoot}>
            <Ionicons name={mode === 'night' ? 'moon' : 'sunny'} size={16} color={selected ? colors.accentInk : colors.muted} />
            <Text style={[styles.tileTitle, selected && { color: colors.text }]}>{mode === 'night' ? 'Night' : 'Day'}</Text>
            {selected && <Ionicons name="checkmark-circle" size={18} color={colors.accent} style={{ marginLeft: 'auto' }} />}
          </View>
          <Text style={styles.tileHint}>{mode === 'night' ? 'Dark, easy on the eyes' : 'Bright, readable in strong sun'}</Text>
        </Animated.View>
      </PressableScale>
    </View>
  );
}

/** One thing you can do with your data: what it is, in a sentence, and the button. */
function DataRow({ icon, title, body, children }: { icon: IconName; title: string; body: string; children: ReactNode }) {
  return (
    <View style={styles.dataRow}>
      <View style={styles.dataHead}>
        <Ionicons name={icon} size={20} color={colors.accentInk} />
        <Text style={styles.dataTitle}>{title}</Text>
      </View>
      <Text style={styles.note}>{body}</Text>
      {children}
    </View>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { wide, gutter } = useLayout();
  const { prefs, setPrefs } = usePrefs();
  const { matches } = useMatches();
  const toast = useToast();
  const { exportEverything, exportAs, exportRecordBook, importFile } = useMatchFiles(toast.show);
  const [exporting, setExporting] = useState(false);
  const { admin } = useAccess();
  const { user } = useClubSync();
  const [built] = useState(builtOn);
  const [backing, setBacking] = useState(false);

  const backedUp = prefs.lastBackup
    ? `Last backup ${new Date(prefs.lastBackup).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}`
    : 'Never backed up';

  const look = (
    <>
      <GroupHeader icon="color-palette-outline" title="Appearance" hint="Pick the look. The app reloads for a moment to switch." />
      <Card style={{ gap: space.md }}>
        <View style={styles.tiles} accessibilityRole="radiogroup">
          {(['night', 'day'] as const).map((mode) => (
            <ThemeTile
              key={mode}
              mode={mode}
              selected={prefs.theme === mode}
              onPress={() => {
                if (mode !== prefs.theme) applyTheme(mode);
              }}
            />
          ))}
        </View>
      </Card>
    </>
  );
  const scoring = (
    <>
      <GroupHeader icon="tennisball-outline" title="Scoring" hint="How the scorer feels while you play" />
      <Card>
        <ToggleRow
          label="Celebrations"
          hint="The flash for a four, a six, a wicket or a fifty while scoring"
          value={prefs.celebrate}
          onChange={(celebrate) => setPrefs({ celebrate })}
        />
      </Card>
    </>
  );
  const data = (
    <>
      <GroupHeader icon="archive-outline" title="Data" hint="Your matches belong to you: keep a copy, move them, print them" />
      <Card style={{ gap: space.md }}>
        <DataRow
          icon="cloud-upload-outline"
          title="Back up all matches"
          body="One file with everything: every match ball by ball, your saved sides, the squad and the auctions. Keep it in Google Drive or send it to yourself."
        >
          <View style={styles.backupLine}>
            <Ionicons name={prefs.lastBackup ? 'checkmark-circle' : 'alert-circle-outline'} size={16} color={prefs.lastBackup ? colors.accent : colors.gold} />
            <Text style={[styles.note, { color: prefs.lastBackup ? colors.muted : colors.gold }]}>{backedUp}</Text>
          </View>
          <Button
            variant="ghost"
            label={backing ? 'Making the backup…' : 'Back up everything'}
            icon="cloud-upload-outline"
            disabled={backing}
            onPress={async () => {
              setBacking(true);
              try {
                if (await exportEverything()) setPrefs({ lastBackup: Date.now() });
              } finally {
                setBacking(false);
              }
            }}
          />
        </DataRow>
        <SeamDivider />
        <DataRow icon="document-text-outline" title="Share matches" body="Pick matches and send them as a PDF scorecard, a picture for the group chat, or a match file.">
          <Button variant="ghost" label="Export matches as PDF, picture or file" icon="share-social-outline" disabled={!matches.length} onPress={() => setExporting(true)} />
        </DataRow>
        <SeamDivider />
        <DataRow icon="trophy-outline" title="Record book" body="Every record, best figures and partnership from all your matches, in one handy book.">
          <View style={styles.chips}>
            <Chip icon="document-text-outline" label="PDF" disabled={!matches.length} onPress={() => void exportRecordBook('pdf')} />
            <Chip icon="image-outline" label="Picture" disabled={!matches.length} onPress={() => void exportRecordBook('image')} />
            <Chip icon="swap-horizontal" label="File" disabled={!matches.length} onPress={() => void exportRecordBook('file')} />
          </View>
        </DataRow>
        {admin && (
          <>
            <SeamDivider />
            <DataRow
              icon="push-outline"
              title="Import a backup or match file"
              body="Brings matches, the squad and auctions back on any phone. It only adds: nothing is added twice, and a match changes only if the file’s copy is newer."
            >
              <Button variant="ghost" label="Import a backup or match file" icon="push-outline" onPress={() => importFile()} />
            </DataRow>
          </>
        )}
      </Card>
    </>
  );
  const about = (
    <>
      <GroupHeader icon="information-circle-outline" title="About" />
      <View style={styles.about}>
        <LinearGradient colors={['#17402B', '#0D2418', '#07120C']} style={StyleSheet.absoluteFill} />
        <OvalGround opacity={0.08} />
        <AppMark size={52} />
        <View style={{ flex: 1 }}>
          <Text style={styles.aboutName}>CREASE</Text>
          <Text style={styles.aboutSub}>A scorer for the club, from the first ball to the last.</Text>
          <Text style={styles.version}>
            Version {Constants.expoConfig?.version ?? ''}
            {built ? ` · built ${built}` : ''}
          </Text>
        </View>
      </View>
    </>
  );
  const danger = user ? (
    <>
      <GroupHeader icon="warning-outline" title="Danger zone" hint="Careful: these ask you to confirm first" />
      <Card style={[{ gap: space.sm }, styles.dangerCard]}>
        <Text style={styles.note}>Sign out of the club on this phone. Matches stay safe in the club; sign in again to bring them back.</Text>
        <SignOutButton />
      </Card>
    </>
  ) : null;

  const groups = wide
    ? null
    : [<ClubSyncSettings key="c" />, look, scoring, data, about, danger];

  return (
    <Screen>
      {wide ? (
        // Back and the title on one line, lined up with the page's centred column.
        <View style={{ paddingHorizontal: gutter, paddingTop: space.lg }}>
          <Page max={1040}>
            <WideHead title="Settings" onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
          </Page>
        </View>
      ) : (
        <View style={styles.header}>
          <IconButton icon="chevron-back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        </View>
      )}
      <ScrollView
        contentContainerStyle={
          wide
            ? { paddingHorizontal: gutter, paddingBottom: insets.bottom + space.xxl }
            : { padding: space.lg, paddingTop: 0, paddingBottom: insets.bottom + space.xxl }
        }
      >
        {wide ? (
          // A tablet or laptop: the club on one side, this device's look and the data on the other.
          <Page max={1040}>
            <Columns gap={space.xl}>
              <View>
                <Rise>
                  <ClubSyncSettings />
                </Rise>
                <Rise index={1}>{about}</Rise>
                <Rise index={2}>{danger}</Rise>
              </View>
              <View>
                <Rise index={1}>{look}</Rise>
                <Rise index={2}>{scoring}</Rise>
                <Rise index={3}>{data}</Rise>
              </View>
            </Columns>
          </Page>
        ) : (
          <>
            <Text style={styles.title}>Settings</Text>
            {groups!.map((g, i) => (
              <Rise key={i} index={i}>
                {g}
              </Rise>
            ))}
          </>
        )}
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
  note: { color: colors.muted, fontSize: 13, fontFamily: font.regular, lineHeight: 19 },
  tiles: { flexDirection: 'row', gap: space.md },
  tile: { borderRadius: radius.lg, padding: space.sm, backgroundColor: colors.surfaceHi, gap: 6 },
  mini: { height: 96, borderRadius: radius.sm, padding: 8, gap: 6, overflow: 'hidden' },
  miniHero: { borderRadius: 8, padding: 7, gap: 5 },
  miniScore: { color: '#F4F1E6', fontFamily: font.posterBlack, fontSize: 13 },
  miniCard: { borderRadius: 8, borderWidth: 1, padding: 7, gap: 4 },
  miniBar: { height: 5, borderRadius: 3 },
  miniBtn: { height: 10, borderRadius: 5, width: '60%' },
  tileFoot: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 },
  tileTitle: { color: colors.muted, fontSize: 15, fontFamily: font.bold },
  tileHint: { color: colors.faint, fontSize: 11, fontFamily: font.medium, paddingHorizontal: 4, paddingBottom: 4 },
  dataRow: { gap: space.sm },
  dataHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dataTitle: { color: colors.text, fontSize: 15, fontFamily: font.bold },
  backupLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chips: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  about: { flexDirection: 'row', alignItems: 'center', gap: space.lg, padding: space.xl, borderRadius: radius.xl, overflow: 'hidden', borderWidth: 1, borderColor: colors.borderHi },
  aboutName: { color: '#F4F1E6', fontFamily: font.posterBlack, fontSize: 22, letterSpacing: 3 },
  aboutSub: { color: '#94AB9D', fontSize: 13, fontFamily: font.regular, marginTop: 2 },
  version: { color: '#DDB66E', fontSize: 12, fontFamily: font.semibold, marginTop: 6 },
  dangerCard: { borderColor: colors.dangerDim },
});
