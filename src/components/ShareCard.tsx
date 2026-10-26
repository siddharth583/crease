import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRef, useState, type ComponentRef } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { matchState, oversText, playerName, type InningsState } from '../engine/engine.ts';
import { playerOfTheMatch, seriesState } from '../engine/stats.ts';
import type { Match } from '../engine/types.ts';
import { shareImage } from '../store/files.ts';
import { font } from '../theme.ts';
import { Button, GhostWord, PitchStripes, Sheet, type ToastTone } from './ui.tsx';
import { pictureFileName } from '../engine/backup.ts';

// The poster people actually send round the group: always in the night colours, whatever the app theme, so
// every card looks the same in the chat.
const C = {
  bg: '#060606',
  card: '#111111',
  text: '#F4F4EE',
  muted: '#9C9C94',
  volt: '#D7FF3A',
  ink: '#0A0A0A',
  line: 'rgba(255,255,255,0.12)',
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

  return (
    <View style={styles.card}>
      <PitchStripes opacity={0.035} />
      <GhostWord size={220} style={{ right: -30, bottom: 40, color: 'rgba(255,255,255,0.04)' }}>
        {winner ? 'WIN' : 'TIE'}
      </GhostWord>
      <View style={styles.top}>
        <View style={styles.logo}>
          <MaterialCommunityIcons name="cricket" size={14} color={C.ink} />
        </View>
        <Text style={styles.brand}>CREASE</Text>
        <Text style={styles.date}>{date}</Text>
      </View>
      {series && (
        <Text style={styles.series}>
          {series.name.toUpperCase()} · MATCH {match.series!.number} OF {series.of}
        </Text>
      )}
      <Text style={styles.headline} numberOfLines={2}>
        {winner ? `${winner.name} win` : state.result ?? 'Match tied'}
      </Text>
      {winner && <Text style={styles.margin}>{state.result!.replace(`${winner.name} won `, '').replace(`${winner.name} `, '')}</Text>}

      <View style={styles.scores}>
        {state.innings.slice(0, 2).map((inn, i) => {
          const bat = bestBat(inn);
          const bowl = bestBowl(state.innings[1 - i]);
          return (
            <View key={i} style={styles.team}>
              <View style={styles.teamRow}>
                <Text style={[styles.teamName, state.winner === inn.battingTeam.id && { color: C.volt }]} numberOfLines={1}>
                  {inn.battingTeam.name}
                </Text>
                <Text style={styles.teamScore}>
                  {inn.runs}/{inn.wickets}
                  <Text style={styles.overs}> {oversText(inn.legalBalls)}</Text>
                </Text>
              </View>
              {bat && (
                <Text style={styles.perf} numberOfLines={1}>
                  🏏 {playerName(match, bat.id)} {bat.runs}
                  {bat.out ? '' : '*'} ({bat.balls})
                </Text>
              )}
              {bowl && (
                <Text style={styles.perf} numberOfLines={1}>
                  🎯 {playerName(match, bowl.id)} {bowl.wickets}/{bowl.runs}
                </Text>
              )}
            </View>
          );
        })}
      </View>

      {mom && (
        <View style={styles.mom}>
          <Text style={styles.momLabel}>MAN OF THE MATCH</Text>
          <Text style={styles.momName} numberOfLines={1}>
            {mom.name}
          </Text>
          <Text style={styles.momLine}>{mom.summary}</Text>
        </View>
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
        <View ref={ref} collapsable={false}>
          <Card match={match} all={all} />
        </View>
        <View style={{ alignSelf: 'stretch' }}>
          <Button label={busy ? 'Making it…' : 'Share picture'} icon="image-outline" disabled={busy} onPress={share} />
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  card: { width: 320, height: 400, backgroundColor: C.bg, borderRadius: 18, padding: 22, overflow: 'hidden' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  logo: { width: 22, height: 22, borderRadius: 5, backgroundColor: C.volt, alignItems: 'center', justifyContent: 'center' },
  brand: { fontFamily: font.posterBlack, fontSize: 18, color: C.text },
  date: { marginLeft: 'auto', color: C.muted, fontFamily: font.semibold, fontSize: 11 },
  series: { color: C.volt, fontFamily: font.bold, fontSize: 10, letterSpacing: 1.2, marginTop: 16 },
  headline: { fontFamily: font.posterBlack, fontSize: 38, lineHeight: 43, color: C.text, marginTop: 6 },
  margin: { fontFamily: font.poster, fontSize: 16, color: C.volt },
  scores: { marginTop: 16, gap: 10 },
  team: { borderTopWidth: 1, borderTopColor: C.line, paddingTop: 8 },
  teamRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  teamName: { fontFamily: font.bold, fontSize: 14, color: C.text, flex: 1 },
  teamScore: { fontFamily: font.posterBlack, fontSize: 21, color: C.text },
  overs: { fontFamily: font.poster, fontSize: 14, color: C.muted },
  perf: { color: C.muted, fontFamily: font.semibold, fontSize: 11, marginTop: 1 },
  mom: { marginTop: 'auto', backgroundColor: C.volt, borderRadius: 10, padding: 10 },
  momLabel: { fontFamily: font.bold, fontSize: 8, letterSpacing: 1.2, color: C.ink, opacity: 0.65 },
  momName: { fontFamily: font.posterBlack, fontSize: 18, lineHeight: 20, color: C.ink },
  momLine: { fontFamily: font.bold, fontSize: 11, color: C.ink },
  footer: { color: C.muted, fontFamily: font.bold, fontSize: 10, textAlign: 'center', marginTop: 8, textTransform: 'uppercase', letterSpacing: 1 },
});
