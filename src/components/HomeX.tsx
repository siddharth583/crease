import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';
import { matchState, oversText } from '../engine/engine.ts';
import { playerOfTheMatch, type SeriesState } from '../engine/stats.ts';
import type { Match } from '../engine/types.ts';
import { colors, edge, font, hero, ownTeamTheme, radius, space, type } from '../theme.ts';
import { PlayerAvatar } from './Avatar.tsx';
import { SeamDivider } from './cricket.tsx';
import { Pulse, PopIn } from './motion.tsx';
import { crestOf, TeamCrest, TeamWash } from './TeamCrest.tsx';
import { IconButton, PressableScale, type IconName } from './ui.tsx';

// Pieces shared by the Home and Series screens: the match ticket, the quick-action tile and the trophy race.

/** The colour a side's wins are drawn in: its own theme, else the app's two inks. */
export const sideInk = (name: string, index: 0 | 1, onHero?: boolean) =>
  ownTeamTheme(name)?.accent ?? (index === 0 ? colors.accent : onHero ? hero.text : colors.text);

const shortDate = (t: number) => {
  const d = new Date(t);
  return `${d.getDate()} ${d.toLocaleDateString(undefined, { month: 'short' })}`;
};

/**
 * A finished (or running) match as a ticket: both sides with their badges and scores, a perforated tear line, then the
 * result and the Man of the Match. `label` replaces the date line; `onMore` adds the ... button.
 */
export function MatchTicket({
  match,
  onPress,
  onLongPress,
  onMore,
  fill,
  label,
  accessibilityLabel,
}: {
  match: Match;
  onPress: () => void;
  onLongPress?: () => void;
  onMore?: () => void;
  fill?: boolean;
  label?: string;
  accessibilityLabel?: string;
}) {
  const state = matchState(match);
  const mom = state.result ? playerOfTheMatch(match) : null;
  const top = label ?? `${shortDate(match.createdAt)} · ${match.rules.overs} overs${match.series ? ` · ${match.series.name} ${match.series.number}` : ''}`;
  return (
    <View style={[styles.wrap, fill && { flex: 1 }]}>
      <PressableScale
        scaleTo={0.98}
        onPress={onPress}
        onLongPress={onLongPress}
        accessibilityLabel={accessibilityLabel}
        wrapStyle={fill ? { flex: 1 } : undefined}
        style={[styles.ticket, fill && { flex: 1 }]}
      >
        <View style={styles.top}>
          <Text style={styles.date} numberOfLines={1}>
            {top}
          </Text>
          {!state.result && (
            <View style={styles.liveTag}>
              <Pulse color={colors.danger} size={6} />
              <Text style={styles.liveTagText}>In progress</Text>
            </View>
          )}
        </View>
        {state.innings.slice(0, 2).map((inn, i) => {
          const won = state.winner === inn.battingTeam.id;
          const c = crestOf(inn.battingTeam.name);
          return (
            <View key={i} style={styles.line}>
              {won && <TeamWash color={c.ring} strength={0.22} />}
              <TeamCrest name={inn.battingTeam.name} size={36} />
              <Text numberOfLines={2} style={[styles.team, won && { color: colors.text, fontFamily: font.bold }]}>
                {inn.battingTeam.name}
              </Text>
              {won && <Ionicons name="trophy" size={13} color={colors.gold} />}
              <Text style={[styles.score, won && { color: colors.text }]}>
                {inn.runs}
                <Text style={styles.wkts}>/{inn.wickets}</Text>
              </Text>
              <Text style={styles.overs}>{oversText(inn.legalBalls)}</Text>
            </View>
          );
        })}
        {/* The tear line: a seam, with a notch punched out of each edge. */}
        <View style={styles.tear}>
          <View style={[styles.notch, { left: -10 }]} />
          <View style={[styles.notch, { right: -10 }]} />
          <SeamDivider />
        </View>
        <View style={[styles.foot, onMore && { paddingRight: 48 }]}>
          <Text numberOfLines={2} style={styles.resultText}>
            {state.result ?? 'Not finished yet'}
          </Text>
          {mom && (
            <View style={styles.mom}>
              <PlayerAvatar name={mom.name} size={20} />
              <Ionicons name="star" size={11} color={colors.gold} />
              <Text numberOfLines={1} style={styles.momText}>
                <Text style={styles.momName}>{mom.name}</Text>
                {mom.summary ? ` · ${mom.summary}` : ''}
              </Text>
            </View>
          )}
        </View>
      </PressableScale>
      {onMore && (
        <View style={styles.more}>
          <IconButton icon="ellipsis-horizontal" label="More for this match" onPress={onMore} />
        </View>
      )}
    </View>
  );
}

/** An icon and a word: one of the things you do from Home. `primary` is the one filled in jade. */
export function QuickTile({ icon, label, onPress, primary, accessibilityLabel }: { icon: IconName; label: string; onPress: () => void; primary?: boolean; accessibilityLabel?: string }) {
  return (
    <PressableScale accessibilityLabel={accessibilityLabel ?? label} onPress={onPress} wrapStyle={{ flex: 1, minWidth: 0 }} style={[styles.tile, primary && styles.tilePrimary]}>
      {primary && <LinearGradient pointerEvents="none" colors={['rgba(255,255,255,0.28)', 'rgba(255,255,255,0)']} style={StyleSheet.absoluteFill} />}
      <View style={[styles.tileIcon, primary && { backgroundColor: 'rgba(0,0,0,0.12)' }]}>
        <Ionicons name={icon} size={20} color={primary ? colors.onAccent : colors.accentInk} />
      </View>
      <Text style={[styles.tileText, primary && { color: colors.onAccent }]} numberOfLines={2}>
        {label}
      </Text>
    </PressableScale>
  );
}

/**
 * The race to the trophy: a row per side, one box per win it needs, filled as it wins. Reads at a glance who is ahead
 * and how far each is from taking the series.
 */
export function TrophyRace({ series, onHero }: { series: SeriesState; onHero?: boolean }) {
  const need = Math.floor(series.of / 2) + 1;
  const textColor = onHero ? hero.text : colors.text;
  const dim = onHero ? hero.muted : colors.muted;
  return (
    <View style={{ gap: space.sm }}>
      {series.teams.map((name, i) => {
        const wins = series.wins[i];
        const ink = sideInk(name, i as 0 | 1, onHero);
        const leading = series.played > 0 && wins > series.wins[1 - i];
        return (
          <View key={i} style={styles.raceRow} accessibilityLabel={`${name}: ${wins} of ${need} wins needed`}>
            <TeamCrest name={name} size={24} />
            <Text numberOfLines={1} style={[styles.raceName, { color: leading ? textColor : dim }]}>
              {name}
            </Text>
            <View style={{ flexDirection: 'row', gap: 5 }}>
              {Array.from({ length: need }, (_, k) => {
                const filled = k < wins;
                return (
                  <PopIn key={k} delay={200 + k * 90} turn={0}>
                    <View
                      style={[
                        styles.raceBox,
                        filled
                          ? { backgroundColor: ink, borderColor: ink }
                          : { borderColor: onHero ? hero.ink(0.26) : colors.borderHi, borderStyle: 'dashed' },
                      ]}
                    >
                      {filled && <Ionicons name="checkmark" size={11} color={colors.onAccent} />}
                    </View>
                  </PopIn>
                );
              })}
            </View>
            <Text style={[styles.raceCount, { color: leading ? textColor : dim }]}>
              {wins}
              <Text style={{ color: onHero ? hero.faint : colors.faint }}>/{need}</Text>
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { justifyContent: 'center' },
  ticket: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.sm,
    gap: 6,
    overflow: 'hidden',
    ...edge,
  },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  date: { ...type.label, fontSize: 10, color: colors.faint, flexShrink: 1 },
  liveTag: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 20, paddingHorizontal: 8, borderRadius: radius.pill, backgroundColor: colors.dangerDim },
  liveTagText: { color: colors.danger, fontSize: 10, fontFamily: font.bold },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 48, paddingHorizontal: 8, marginHorizontal: -8, borderRadius: radius.md, overflow: 'hidden' },
  team: { flex: 1, minWidth: 0, color: colors.muted, fontSize: 15, lineHeight: 19, fontFamily: font.semibold },
  score: { color: colors.muted, fontSize: 30, lineHeight: 34, fontFamily: font.posterBlack, letterSpacing: -1, ...type.num },
  wkts: { fontSize: 18, fontFamily: font.poster, color: colors.faint, letterSpacing: 0 },
  overs: { width: 34, textAlign: 'right', color: colors.faint, fontSize: 12, fontFamily: font.medium, ...type.num },
  tear: { marginHorizontal: -space.lg, paddingHorizontal: space.lg, justifyContent: 'center', marginTop: 2 },
  notch: { position: 'absolute', top: -1, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border },
  foot: { minHeight: 42, justifyContent: 'center', gap: 4, paddingBottom: 2 },
  resultText: { color: colors.accentInk, fontSize: 13, fontFamily: font.bold },
  mom: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  momText: { flex: 1, color: colors.muted, fontSize: 12, fontFamily: font.medium },
  momName: { color: colors.text, fontFamily: font.semibold },
  more: { position: 'absolute', right: 6, bottom: 4 },

  tile: {
    minHeight: 92,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: space.md,
    paddingHorizontal: 6,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...edge,
  },
  tilePrimary: { backgroundColor: colors.accent, borderColor: colors.accent },
  tileIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentDim },
  tileText: { color: colors.text, fontSize: 12, lineHeight: 15, fontFamily: font.bold, textAlign: 'center' },

  raceRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 30 },
  raceName: { flex: 1, minWidth: 0, fontSize: 14, fontFamily: font.bold },
  raceBox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', transform: [{ skewX: '-10deg' }] },
  raceCount: { width: 38, textAlign: 'right', fontFamily: font.posterBlack, fontSize: 18, ...type.num },
});
