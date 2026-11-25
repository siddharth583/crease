import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';
import { verdict, type Matchup, type RivalryContext } from '../engine/records.ts';
import { colors, edge, font, gradients, hero, isDay, radius, space, type } from '../theme.ts';
import { PlayerAvatar } from './Avatar.tsx';
import { OvalGround } from './cricket.tsx';
import { Tug } from './motion.tsx';
import { PressableScale } from './ui.tsx';

const openRivalry = (m: Matchup) => () => router.push({ pathname: '/rivalry', params: { bat: m.batterKey, bowl: m.bowlerKey } });

/** The VS medallion between the two players: a small brass coin. */
export function VsCoin({ size = 28 }: { size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.goldDim, borderWidth: 1.5, borderColor: colors.gold }}>
      <Text style={{ fontFamily: font.posterBlack, fontSize: size * 0.4, color: isDay ? colors.gold : hero.gold, letterSpacing: -0.3 }}>VS</Text>
    </View>
  );
}

/** Batter against bowler: both players, who's ahead as a tug of war, and what it means in a sentence. */
/** `ctx`: everyone's duels, to judge this one against how the two usually go. */
export function FaceOff({ m, big, ctx }: { m: Matchup; big?: boolean; ctx?: RivalryContext }) {
  const v = verdict(m, ctx);
  const sr = m.balls ? (m.runs * 100) / m.balls : 0;
  const tone = v.side === 'batter' ? colors.accent : v.side === 'bowler' ? colors.violet : colors.faint;
  const batInk = big ? hero.accent : colors.accentInk;
  const bowlInk = big ? hero.violet : colors.violet;
  const tag = v.early ? 'EARLY' : v.side === 'even' ? 'EVEN' : v.side === 'batter' ? 'BAT WINS' : 'BALL WINS';
  const av = big ? 52 : 38;
  const body = (
    <>
      <View style={styles.names}>
        <View style={styles.side}>
          <PlayerAvatar name={m.batter} size={av} />
          <Text style={[styles.role, big && { color: hero.muted }]}>Bats</Text>
          <Text style={[styles.name, big && styles.nameBig, { color: batInk }]} numberOfLines={2}>
            {m.batter}
          </Text>
        </View>
        <VsCoin size={big ? 34 : 28} />
        <View style={styles.side}>
          <PlayerAvatar name={m.bowler} size={av} />
          <Text style={[styles.role, big && { color: hero.muted }]}>Bowls</Text>
          <Text style={[styles.name, big && styles.nameBig, { color: bowlInk }]} numberOfLines={2}>
            {m.bowler}
          </Text>
        </View>
      </View>
      <View style={styles.barWrap}>
        <Text style={[styles.end, { color: batInk }]}>BAT</Text>
        <View style={[styles.tug, big && { backgroundColor: hero.ink(0.1) }]}>
          <Tug edge={v.edge} style={StyleSheet.absoluteFill} leftStyle={styles.tugBat} rightStyle={[styles.tugBowl, big && { backgroundColor: hero.violet }]} />
        </View>
        <Text style={[styles.end, { color: bowlInk }]}>BALL</Text>
      </View>
      <Text style={[styles.title, big && { color: hero.text, fontSize: 18 }]} numberOfLines={2}>
        {v.title}
      </Text>
      <View style={styles.foot}>
        <Text style={[styles.stats, big && { color: hero.muted }]}>
          <Text style={[styles.strong, big && { color: hero.text }]}>{m.runs}</Text> off {m.balls} · SR {sr.toFixed(0)} · {m.outs ? `out ${m.outs}×` : 'never out'}
        </Text>
        <View style={[styles.verdict, { backgroundColor: tone }]}>
          <Text style={[styles.verdictText, (v.side === 'bowler' || (isDay && tone === colors.faint)) && { color: '#FFFFFF' }]}>{tag}</Text>
        </View>
      </View>
    </>
  );
  return (
    <PressableScale scaleTo={0.98} onPress={openRivalry(m)} style={[styles.face, big && styles.faceBig]} accessibilityLabel={`${m.batter} against ${m.bowler}: ${v.title}`}>
      {big && (
        <>
          <LinearGradient pointerEvents="none" colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <OvalGround opacity={0.07} />
        </>
      )}
      {body}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  face: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: space.md, gap: space.sm, overflow: 'hidden', ...edge },
  faceBig: { borderColor: hero.line, padding: space.lg, gap: space.md, borderRadius: radius.xl },
  names: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space.sm },
  side: { flex: 1, minWidth: 0, alignItems: 'center', gap: 2 },
  role: { ...type.label, fontSize: 9, color: colors.faint, marginTop: 4 },
  name: { fontFamily: font.poster, fontSize: 16, lineHeight: 19, textAlign: 'center' },
  nameBig: { fontFamily: font.posterBlack, fontSize: 20, lineHeight: 23 },
  barWrap: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  end: { fontSize: 9, fontFamily: font.heavy, letterSpacing: 1, width: 28, textAlign: 'center' },
  tug: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: colors.border },
  tugBat: { backgroundColor: colors.accent, borderRadius: 4 },
  tugBowl: { backgroundColor: colors.violet, borderRadius: 4 },
  title: { color: colors.text, fontFamily: font.posterBlack, fontSize: 15, textAlign: 'center' },
  foot: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  stats: { flex: 1, color: colors.muted, fontSize: 13, fontFamily: font.medium },
  strong: { fontFamily: font.heavy, color: colors.text },
  verdict: { borderRadius: radius.sm, paddingHorizontal: 7, paddingVertical: 3 },
  verdictText: { color: colors.onAccent, fontSize: 10, fontFamily: font.heavy, letterSpacing: 0.8 },
});
