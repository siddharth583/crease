import { useRef, useState, type ComponentRef } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { matchState, oversText, playerName, type InningsState } from '../engine/engine.ts';
import { playerOfTheMatch, seriesState } from '../engine/stats.ts';
import type { Match } from '../engine/types.ts';
import { shareImage } from '../store/files.ts';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, font, ownTeamTheme } from '../theme.ts';
import { OvalGround } from './cricket.tsx';
import { Rise } from './motion.tsx';
import { TeamCrest } from './TeamCrest.tsx';
import { Button, PitchStripes, Sheet, type ToastTone } from './ui.tsx';
import { pictureFileName } from '../engine/backup.ts';
import { AppMark } from './AppMark.tsx';

// The poster people actually send round the group: always in the night colours, whatever the app theme, so
// every card looks the same in the chat. Outfield green, ivory, champagne brass.
const C = {
  bg: '#07120C',
  text: '#F4F1E6',
  muted: '#9DB3A5',
  jade: '#D7FF3A',
  brass: '#DDB66E',
  brassDeep: '#B8923F',
  ink: '#1B1405',
  line: 'rgba(244,241,230,0.14)',
};

function bestBat(s: InningsState) {
  return [...s.batters].sort((a, b) => b.runs - a.runs || a.balls - b.balls)[0];
}
function bestBowl(s: InningsState) {
  return [...s.bowlers].filter((b) => b.balls).sort((a, b) => b.wickets - a.wickets || a.runs - b.runs)[0];
}

function Card({ match, all }: { match: Match; all: Match[] }) {
  const state = matchState(match);
  const mom = playerOfTheMatch(match);
  const series = match.series ? seriesState(all.filter((m) => m.series?.id === match.series!.id)) : null;
  const winner = match.teams.find((t) => t.id === state.winner);
  const date = new Date(match.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  // The winners' own colours when they have them (the card is always dark, so their bright accent reads); else jade.
  const win = ownTeamTheme(winner?.name);
  const lit = win?.accent ?? C.jade;
  const margin = winner && state.result ? state.result.replace(`${winner.name} won `, '').replace(`${winner.name} `, '') : '';

  return (
    <View style={styles.card}>
      <LinearGradient colors={['#17402B', '#0D2418', '#07120C']} style={StyleSheet.absoluteFill} />
      <PitchStripes opacity={0.05} tint="255,255,255" />
      <OvalGround opacity={0.08} drift={false} />
      <View style={styles.top}>
        <AppMark size={24} />
        <Text style={styles.brand}>CREASE</Text>
        <Text style={styles.date}>{date}</Text>
      </View>
      {series && (
        <Text style={styles.series}>
          {series.name.toUpperCase()} · MATCH {match.series!.number} OF {series.of}
        </Text>
      )}
      <Text style={[styles.kicker, { color: lit }]}>{winner ? 'RESULT' : 'FULL TIME'}</Text>
      <Text style={styles.headline} numberOfLines={2}>
        {winner ? `${winner.name} win` : state.result ?? 'Match tied'}
      </Text>
      {winner && margin ? <Text style={[styles.margin, { color: C.brass }]}>{margin}</Text> : null}

      <View style={styles.scores}>
        {state.innings.slice(0, 2).map((inn, i) => {
          const bat = bestBat(inn);
          const bowl = bestBowl(state.innings[1 - i]);
          const won = state.winner === inn.battingTeam.id;
          return (
            <View key={i} style={[styles.team, won && { borderColor: lit }]}>
              <TeamCrest name={inn.battingTeam.name} size={38} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.teamName, won && { color: lit }]} numberOfLines={1}>
                  {inn.battingTeam.name}
                </Text>
                {bat && (
                  <Text style={styles.perf} numberOfLines={1}>
                    {playerName(match, bat.id)} {bat.runs}
                    {bat.out ? '' : '*'} ({bat.balls}){bowl ? `  ·  ${playerName(match, bowl.id)} ${bowl.wickets}/${bowl.runs}` : ''}
                  </Text>
                )}
              </View>
              <Text style={styles.teamScore}>
                {inn.runs}/{inn.wickets}
                <Text style={styles.overs}> {oversText(inn.legalBalls)}</Text>
              </Text>
            </View>
          );
        })}
      </View>

      {mom && (
        <LinearGradient colors={[C.brass, C.brassDeep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.mom}>
          <Ionicons name="star" size={20} color={C.ink} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.momLabel}>MAN OF THE MATCH</Text>
            <Text style={styles.momName} numberOfLines={1}>
              {mom.name}
            </Text>
            <Text style={styles.momLine} numberOfLines={1}>
              {mom.summary}
            </Text>
          </View>
        </LinearGradient>
      )}
      {series && <Text style={styles.footer}>{series.status}</Text>}
    </View>
  );
}

/** Preview the poster and share it as a picture. */
export function ShareCardSheet({
  match,
  all,
  visible,
  onClose,
  notify,
}: {
  match: Match;
  all: Match[];
  visible: boolean;
  onClose: () => void;
  notify: (text: string, tone?: ToastTone) => void;
}) {
  const ref = useRef<ComponentRef<typeof View>>(null);
  const [busy, setBusy] = useState(false);
  const share = async () => {
    if (!ref.current) return;
    setBusy(true);
    try {
      const uri = await captureRef(ref, { format: 'png', quality: 1, result: Platform.OS === 'web' ? 'data-uri' : 'tmpfile' });
      const result = await shareImage(uri, pictureFileName(match));
      if (result === 'downloaded') notify('Picture saved to your downloads');
      onClose();
    } catch {
      notify('Couldn’t make the picture. Try again.', 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet visible={visible} onClose={onClose} title="Share card">
      <View style={{ alignItems: 'center', gap: 16, paddingBottom: 12 }}>
        <Text style={styles.sheetNote}>This is the picture that gets sent. Post it straight into the WhatsApp group.</Text>
        <Rise>
          <View style={styles.frame}>
            <View ref={ref} collapsable={false}>
              <Card match={match} all={all} />
            </View>
          </View>
        </Rise>
        <View style={{ alignSelf: 'stretch' }}>
          <Button label={busy ? 'Making it…' : 'Share picture'} icon="share-social-outline" disabled={busy} onPress={share} />
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  frame: { borderRadius: 20, padding: 3, backgroundColor: 'rgba(221,182,110,0.35)', boxShadow: '0px 18px 40px rgba(0,0,0,0.35)' },
  sheetNote: { color: colors.muted, fontSize: 13, fontFamily: font.medium, textAlign: 'center' },
  card: { width: 320, height: 420, backgroundColor: C.bg, borderRadius: 18, padding: 20, overflow: 'hidden' },
  brassEdge: { position: 'absolute', left: 0, right: 0, top: 0, height: 3, backgroundColor: C.brass },
  top: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  brand: { fontFamily: font.posterBlack, fontSize: 16, letterSpacing: 2.5, color: C.text },
  date: { marginLeft: 'auto', color: C.muted, fontFamily: font.semibold, fontSize: 11 },
  series: { color: C.brass, fontFamily: font.bold, fontSize: 10, letterSpacing: 1.2, marginTop: 12 },
  kicker: { fontFamily: font.bold, fontSize: 10, letterSpacing: 2, marginTop: 14 },
  headline: { fontFamily: font.posterBlack, fontSize: 34, lineHeight: 38, color: C.text, marginTop: 2, letterSpacing: -0.8 },
  margin: { fontFamily: font.poster, fontSize: 15 },
  scores: { marginTop: 14, gap: 8 },
  team: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: C.line, backgroundColor: 'rgba(0,0,0,0.28)', borderRadius: 14, paddingVertical: 8, paddingHorizontal: 10 },
  teamName: { fontFamily: font.bold, fontSize: 14, color: C.text },
  teamScore: { fontFamily: font.posterBlack, fontSize: 24, color: C.text, fontVariant: ['tabular-nums'] },
  overs: { fontFamily: font.poster, fontSize: 12, color: C.muted },
  perf: { color: C.muted, fontFamily: font.semibold, fontSize: 10, marginTop: 1 },
  mom: { marginTop: 'auto', borderRadius: 12, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  momLabel: { fontFamily: font.bold, fontSize: 8, letterSpacing: 1.4, color: C.ink, opacity: 0.7 },
  momName: { fontFamily: font.posterBlack, fontSize: 18, lineHeight: 20, color: C.ink },
  momLine: { fontFamily: font.bold, fontSize: 11, color: C.ink },
  footer: { color: C.muted, fontFamily: font.bold, fontSize: 10, textAlign: 'center', marginTop: 8, textTransform: 'uppercase', letterSpacing: 1 },
});
