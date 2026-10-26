import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { verdict, type Matchup } from '../engine/records.ts';
import { colors, edge, font, hero, radius, space, type, HERO_BG } from '../theme.ts';
import { PitchStripes, PressableScale } from './ui.tsx';

const openRivalry = (m: Matchup) => () => router.push({ pathname: '/rivalry', params: { bat: m.batterKey, bowl: m.bowlerKey } });

/** Batter against bowler: who's ahead, as a tug of war. */
export function FaceOff({ m, big }: { m: Matchup; big?: boolean }) {
  const v = verdict(m);
  const sr = m.balls ? (m.runs * 100) / m.balls : 0;
  const tone = v.side === 'batter' ? colors.accent : v.side === 'bowler' ? colors.violet : colors.faint;
  return (
    <PressableScale scaleTo={0.98} onPress={openRivalry(m)} style={[styles.face, big && styles.faceBig]} accessibilityLabel={`${m.batter} against ${m.bowler}: ${v.title}`}>
      {big && <PitchStripes opacity={0.06} tint="255,255,255" />}
      <View style={styles.faceNames}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.faceRole, big && { color: hero.muted }]}>Bats</Text>
          <Text style={[styles.faceName, big && styles.faceNameBig, { color: big ? hero.accent : colors.accentInk }]} numberOfLines={big ? 2 : 1}>
            {m.batter}
          </Text>
        </View>
        <Text style={[styles.faceVs, big && { color: hero.faint }]}>vs</Text>
        <View style={{ flex: 1, minWidth: 0, alignItems: 'flex-end' }}>
          <Text style={[styles.faceRole, big && { color: hero.muted }]}>Bowls</Text>
          <Text style={[styles.faceName, big && styles.faceNameBig, { color: colors.violet, textAlign: 'right' }]} numberOfLines={big ? 2 : 1}>
            {m.bowler}
          </Text>
        </View>
      </View>
      <View style={[styles.tug, big && { backgroundColor: hero.ink(0.1) }]}>
        <View style={[styles.tugBat, { flex: v.edge }]} />
        <View style={[styles.tugBowl, { flex: 1 - v.edge }]} />
      </View>
      <View style={styles.faceFoot}>
        <Text style={[styles.faceStats, big && { color: hero.text }]}>
          <Text style={styles.faceStrong}>{m.runs}</Text> off {m.balls} · SR {sr.toFixed(0)} · {m.outs ? `out ${m.outs}×` : 'never out'}
        </Text>
        <View style={[styles.verdict, { backgroundColor: tone }]}>
          <Text style={[styles.verdictText, v.side === 'bowler' && { color: '#FFFFFF' }]}>{v.side === 'even' ? 'EVEN' : v.side === 'batter' ? 'BAT WINS' : 'BALL WINS'}</Text>
        </View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  face: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: space.md, gap: space.sm, overflow: 'hidden', ...edge },
  faceBig: { backgroundColor: HERO_BG, borderColor: HERO_BG, padding: space.lg, gap: space.md },
  faceNames: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  faceRole: { ...type.label, fontSize: 9, color: colors.faint },
  faceName: { fontFamily: font.poster, fontSize: 19 },
  faceNameBig: { fontFamily: font.posterBlack, fontSize: 23, lineHeight: 26 },
  faceVs: { fontFamily: font.poster, fontSize: 15, color: colors.faint, paddingBottom: 3 },
  faceFoot: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  faceStats: { flex: 1, color: colors.muted, fontSize: 13, fontFamily: font.medium },
  faceStrong: { fontFamily: font.heavy },
  verdict: { borderRadius: radius.sm, paddingHorizontal: 7, paddingVertical: 3 },
  verdictText: { color: colors.onAccent, fontSize: 10, fontFamily: font.heavy, letterSpacing: 0.8 },
  tug: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', gap: 2, backgroundColor: colors.border },
  tugBat: { backgroundColor: colors.accent, borderRadius: 4 },
  tugBowl: { backgroundColor: colors.violet, borderRadius: 4 },
});
