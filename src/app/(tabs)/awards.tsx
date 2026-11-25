import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PlayerAvatar } from '../../components/Avatar.tsx';
import { Columns, Page, useLayout } from '../../components/layout.tsx';
import { Card, FadeIn, IconButton, inYear, matchYears, PitchStripes, PressableScale, Screen, WideHead, YearChips, type IconName } from '../../components/ui.tsx';
import { Jersey, SeamDivider } from '../../components/cricket.tsx';
import { Confetti, CountUp, PopIn, Rise, Sheen } from '../../components/motion.tsx';
import { BrassIcon, Figure, Medal, Plaque } from '../../components/HonoursBoard.tsx';
import { StatsNav } from '../../components/StatsNav.tsx';
import { seasonAwards, type Award } from '../../engine/awards.ts';
import { useMatches } from '../../store/matches.tsx';
import { useSquad } from '../../store/squad.ts';
import { colors, font, glass, gradients, hero, radius, space, type } from '../../theme.ts';
import { PlayerPhoto } from '../../components/MomAward.tsx';
import { crestOf, TeamCrest } from '../../components/TeamCrest.tsx';
import { photoFor } from '../../engine/photos.ts';
import { careerStats, displayName, type Career } from '../../engine/stats.ts';
import Svg, { Defs, Ellipse, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { usePhotos } from '../../store/sync.tsx';

// The awards ceremony: the Player of the Season in the spotlight, then a brass trophy plaque for every cap and trophy.

const openPlayer = (key: string) => () => router.push({ pathname: '/player/[key]', params: { key } });
const back = () => (router.canGoBack() ? router.back() : router.replace('/players'));

/** A brass laurel either side of the winner: leaves along two arcs that meet under their feet. */
function Laurel({ w = 250, h = 200 }: { w?: number; h?: number }) {
  // Two branches rising from under the winner's feet up either side, opening at the top; leaves shrink as they climb.
  const cx = w / 2;
  const cy = h * 0.5;
  const r = h * 0.46;
  const leaves: { x: number; y: number; a: number; s: number }[] = [];
  for (let i = 0; i < 8; i++) {
    const deg = 112 + i * 17; // 112° (bottom, just left of centre) up to ~231° (upper left)
    const t = (deg * Math.PI) / 180;
    const x = cx + Math.cos(t) * r;
    const y = cy + Math.sin(t) * r;
    const s = 1 - i * 0.05;
    leaves.push({ x, y, a: deg - 25, s });
    leaves.push({ x: 2 * cx - x, y, a: 180 - deg + 25, s });
  }
  return (
    <Svg width={w} height={h} style={{ position: 'absolute', top: 0 }} pointerEvents="none">
      <Defs>
        <SvgGradient id="laurel" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#F6DFA6" stopOpacity={0.9} />
          <Stop offset="1" stopColor="#B48A3C" stopOpacity={0.75} />
        </SvgGradient>
      </Defs>
      {leaves.map((l, i) => (
        <Ellipse key={i} cx={l.x} cy={l.y} rx={4.5 * l.s} ry={11 * l.s} fill="url(#laurel)" transform={`rotate(${l.a} ${l.x} ${l.y})`} />
      ))}
    </Svg>
  );
}

/** The winner as an open cut-out on the grass under a brass spotlight (their kit with initials until a photo is added). */
function Spotlit({ name, team }: { name: string; team: string }) {
  const photo = photoFor(usePhotos(), name);
  const initials = displayName(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0]!.toUpperCase())
    .join('');
  const kit = crestOf(team);
  return (
    <View style={styles.spot}>
      <View style={styles.spotGlow} />
      <View style={styles.spotShadow} />
      {photo ? (
        <PlayerPhoto uri={photo} />
      ) : (
        <View style={styles.spotKit}>
          <Jersey size={150} from={kit.from} to={kit.to} initials={initials} id={`pos${initials}`} />
        </View>
      )}
    </View>
  );
}

function Headline({ award, career }: { award: Award; career?: Career }) {
  const w = award.winners[0]!;
  const score = parseFloat(w.value);
  return (
    <View style={styles.hero}>
      <LinearGradient pointerEvents="none" colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <PitchStripes tint="255,255,255" />
      {/* The spotlight: a cone of brass light from above onto the winner. */}
      <LinearGradient pointerEvents="none" colors={['rgba(227,190,114,0.26)', 'rgba(227,190,114,0.06)', 'transparent']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.75 }} style={StyleSheet.absoluteFill} />
      <PopIn>
        <View style={styles.heroTag}>
          <Ionicons name="trophy" size={13} color={hero.gold} />
          <Text style={styles.heroTagText}>{award.title}</Text>
        </View>
      </PopIn>
      <PressableScale scaleTo={0.98} onPress={openPlayer(w.key)} accessibilityLabel={`${award.title}: ${w.name}, ${w.value} out of 10, ${w.sub}`} style={styles.heroBody}>
        <View style={{ alignItems: 'center' }}>
          <Laurel />
          <Spotlit name={w.name} team={w.team} />
          <View style={styles.crown}>
            <Medal rank={1} size={30} delay={500} />
          </View>
        </View>
        <Text style={styles.heroName} numberOfLines={2}>
          {w.name}
        </Text>
        <View style={styles.heroTeam}>
          <TeamCrest name={w.team} size={18} />
          <Text style={styles.heroSub}>{w.team}</Text>
        </View>
        <View style={styles.plate}>
          <View style={styles.heroScore}>
            <CountUp value={Number.isFinite(score) ? score : 0} delay={300} duration={1400} format={(n) => n.toFixed(1)} style={styles.heroValue} />
            <Text style={styles.heroUnit}>/ 10</Text>
          </View>
          <View style={styles.plateRule} />
          <View style={{ flexShrink: 1 }}>
            <Text style={styles.plateKey}>Average rating</Text>
            <Text style={styles.heroWhy}>{w.sub.replace(/^average rating /i, '')}</Text>
          </View>
        </View>
        {career && (
          <View style={styles.season}>
            {[
              { k: 'Runs', v: career.batting.runs },
              { k: 'Wickets', v: career.bowling.wickets },
              { k: 'Catches', v: career.fielding.catches },
              { k: 'Won', v: career.history.filter((h) => h.won === true).length },
            ].map((x, i) => (
              <View key={x.k} style={[styles.seasonCell, i > 0 && styles.seasonRule]}>
                <Text style={styles.seasonValue}>{x.v}</Text>
                <Text style={styles.plateKey}>{x.k}</Text>
              </View>
            ))}
          </View>
        )}
      </PressableScale>
      {award.winners.length > 1 && (
        <View style={styles.heroNext}>
          {award.winners.slice(1).map((x, i) => (
            <PressableScale key={x.key} scaleTo={0.97} onPress={openPlayer(x.key)} wrapStyle={{ flexBasis: '100%' }} style={styles.heroChip} accessibilityLabel={`${i + 2}. ${x.name}, ${x.value}`}>
              <Medal rank={i + 2} size={20} delay={700 + i * 120} />
              <Text style={styles.heroChipName} numberOfLines={1}>
                {x.name}
              </Text>
              <Text style={styles.heroChipValue}>{x.value}</Text>
            </PressableScale>
          ))}
        </View>
      )}
    </View>
  );
}

/** One trophy: a brass plaque with the winner large, the reason in a line and the runners-up small. */
function AwardCard({ award, compact, index }: { award: Award; compact?: boolean; index: number }) {
  const [w, ...rest] = award.winners;
  if (!w) return null;
  const d = 200 + index * 60;
  return (
    <Plaque style={{ flex: 1 }} glow>
      <View style={styles.cardHead}>
        <BrassIcon name={award.icon as IconName} size={compact ? 30 : 36} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {award.title}
          </Text>
          <Text style={styles.cardBlurb} numberOfLines={2}>
            {award.blurb}
          </Text>
        </View>
      </View>
      <PressableScale scaleTo={0.98} onPress={openPlayer(w.key)} style={[styles.champ, compact && styles.champCompact]} accessibilityLabel={`${award.title}: ${w.name}, ${w.value}`}>
        <View>
          <PlayerAvatar name={w.name} size={compact ? 48 : 56} />
          <View style={styles.champMedal}>
            <Medal rank={1} size={compact ? 20 : 22} delay={d + 300} />
          </View>
        </View>
        <View style={compact ? { alignSelf: 'stretch' } : { flex: 1, minWidth: 0, justifyContent: 'center' }}>
          <Text style={styles.champName} numberOfLines={2}>
            {w.name}
          </Text>
          <Text style={styles.champTeam} numberOfLines={1}>
            {w.team}
          </Text>
        </View>
        <Figure display={w.value} delay={d} style={[styles.champValue, compact && { fontSize: 32, lineHeight: 36 }]} />
      </PressableScale>
      <Text style={styles.why} numberOfLines={2}>
        {w.sub}
      </Text>
      {rest.length > 0 && <SeamDivider style={{ marginHorizontal: space.lg }} />}
      {rest.map((x, i) => (
        <PressableScale key={x.key} scaleTo={0.98} onPress={openPlayer(x.key)} style={styles.row} accessibilityLabel={`${i + 2}. ${x.name}, ${x.value}`}>
          <Medal rank={i + 2} size={20} delay={d + 500 + i * 100} />
          <Text style={styles.rowName} numberOfLines={1}>
            {x.name}
          </Text>
          <Text style={styles.rowValue}>{x.value}</Text>
        </PressableScale>
      ))}
      <View style={{ height: space.sm }} />
    </Plaque>
  );
}

function Trophies({ cards }: { cards: Award[] }) {
  const { wide } = useLayout();
  if (wide)
    return (
      <Columns tablet={2} laptop={3} gap={space.lg}>
        {cards.map((a, i) => (
          <Rise key={a.id} index={i} step={70} style={{ flex: 1 }}>
            <AwardCard award={a} index={i} />
          </Rise>
        ))}
      </Columns>
    );
  // A phone's bento: the first two trophies full width with the winner large, the rest in pairs.
  const big = cards.slice(0, 2);
  const pairs: Award[][] = [];
  cards.slice(2).forEach((a, i) => (pairs[Math.floor(i / 2)] ??= []).push(a));
  return (
    <View style={{ gap: space.md }}>
      {big.map((a, i) => (
        <Rise key={a.id} index={i}>
          <AwardCard award={a} index={i} />
        </Rise>
      ))}
      {pairs.map((p, r) => (
        <View key={r} style={{ flexDirection: 'row', gap: space.md, alignItems: 'stretch' }}>
          {p.map((a, i) => (
            <Rise key={a.id} index={r * 2 + i + 2} style={{ flex: 1, minWidth: 0 }}>
              <AwardCard award={a} compact index={r * 2 + i + 2} />
            </Rise>
          ))}
          {p.length === 1 && <View style={{ flex: 1 }} />}
        </View>
      ))}
    </View>
  );
}

export default function Awards() {
  const insets = useSafeAreaInsets();
  const { matches: every } = useMatches();
  const { squad } = useSquad();
  const layout = useLayout();
  const { wide } = layout;
  const years = useMemo(() => matchYears(every), [every]);
  const [year, setYear] = useState<number | null>(null);
  const awards = useMemo(() => seasonAwards(inYear(every, year)), [every, year, squad]);
  const careers = useMemo(() => careerStats(inYear(every, year)), [every, year, squad]);
  const headline = awards.find((a) => a.id === 'mvp');
  const cards = awards.filter((a) => a.id !== 'mvp');
  const title = year === null ? 'Season awards' : `${year} awards`;

  const body = awards.length ? (
    <>
      {headline && (
        <FadeIn key={`h${year}`}>
          <Headline award={headline} career={careers.find((c) => c.key === headline.winners[0]?.key)} />
        </FadeIn>
      )}
      {cards.length > 0 && (
        <View style={styles.sectionHead} accessibilityRole="header">
          <Ionicons name="ribbon" size={18} color={colors.gold} />
          <Text style={styles.sectionTitle}>The trophies</Text>
          <Text style={styles.sectionCount}>{cards.length}</Text>
        </View>
      )}
      <Trophies key={`t${year}`} cards={cards} />
    </>
  ) : (
    <Card>
      <Text style={styles.empty}>No awards yet. They’re handed out from the matches played, so score a few and come back.</Text>
    </Card>
  );

  return (
    <Screen>
      {wide ? (
        <View style={{ paddingHorizontal: layout.gutter, paddingTop: space.lg }}>
          <Page>
            <WideHead title={title} sub="The caps and trophies of the season" />
          </Page>
        </View>
      ) : (
        <View style={{ height: space.md }} />
      )}
      <ScrollView contentContainerStyle={{ padding: wide ? layout.gutter : space.lg, paddingTop: wide ? space.md : 0, paddingBottom: insets.bottom + 130, gap: space.lg }}>
        <Page style={{ gap: space.lg }}>
          <View style={wide ? { maxWidth: 420 } : null}>
            <StatsNav />
          </View>
          {!wide && (
            <View>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.titleSub}>The caps and trophies of the season</Text>
            </View>
          )}
          <YearChips years={years} value={year} onChange={setYear} />
          {body}
        </Page>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingVertical: space.sm },
  title: { fontFamily: font.posterBlack, fontSize: 36, lineHeight: 40, color: colors.text, letterSpacing: -1.3 },
  titleSub: { color: colors.muted, fontSize: 13, fontFamily: font.medium, marginTop: 2 },
  empty: { color: colors.muted, fontSize: 14, fontFamily: font.regular, lineHeight: 20 },
  hero: { borderRadius: radius.xl, padding: space.xl, overflow: 'hidden', gap: space.md, borderWidth: 1, borderColor: hero.line },
  heroTag: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', height: 28, paddingHorizontal: 14, borderRadius: radius.pill, ...glass, borderColor: 'rgba(227,190,114,0.55)' },
  heroTagText: { ...type.label, color: hero.gold },
  heroBody: { alignItems: 'center', gap: 4 },
  spot: { width: 200, height: 200, alignItems: 'center', justifyContent: 'flex-end' },
  spotGlow: { position: 'absolute', bottom: 6, width: 120, height: 4, borderRadius: 99, boxShadow: '0px 0px 40px 22px rgba(227,190,114,0.28)' } as object,
  spotShadow: { position: 'absolute', bottom: 2, width: 110, height: 8, borderRadius: 99, backgroundColor: 'rgba(0,0,0,0.35)', boxShadow: '0px 0px 16px 8px rgba(0,0,0,0.3)' } as object,
  spotKit: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 6, alignItems: 'center', justifyContent: 'flex-end' },
  heroTeam: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  plate: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.md, paddingVertical: space.sm, paddingHorizontal: space.lg, borderRadius: radius.lg, ...glass },
  plateRule: { width: 1, alignSelf: 'stretch', backgroundColor: hero.ink(0.14) },
  season: { flexDirection: 'row', alignSelf: 'stretch', marginTop: space.sm, paddingVertical: space.sm, borderRadius: radius.lg, ...glass },
  seasonCell: { flex: 1, alignItems: 'center', gap: 1 },
  seasonRule: { borderLeftWidth: 1, borderLeftColor: hero.ink(0.1) },
  seasonValue: { color: hero.text, fontFamily: font.posterBlack, fontSize: 20, lineHeight: 24, ...type.num },
  plateKey: { ...type.label, fontSize: 9, color: hero.gold },
  ring: { padding: 4, borderRadius: 60, borderWidth: 3, borderColor: hero.gold },
  crown: { position: 'absolute', right: -4, bottom: 0 },
  heroName: { color: hero.text, fontSize: 32, lineHeight: 36, fontFamily: font.posterBlack, letterSpacing: -0.8, textAlign: 'center', marginTop: space.sm },
  heroSub: { color: hero.muted, fontSize: 13, fontFamily: font.semibold },
  heroScore: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  heroValue: { color: hero.gold, fontSize: 44, lineHeight: 48, fontFamily: font.posterBlack, ...type.num },
  heroUnit: { color: hero.muted, fontSize: 14, fontFamily: font.bold },
  heroWhy: { color: hero.text, fontSize: 13, fontFamily: font.semibold },
  heroNext: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, justifyContent: 'center', alignSelf: 'stretch' },
  heroChip: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, height: 44, borderRadius: radius.pill, ...glass },
  heroChipName: { flex: 1, color: hero.text, fontFamily: font.bold, fontSize: 13 },
  heroChipValue: { color: hero.text, fontFamily: font.posterBlack, fontSize: 13, ...type.num },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm },
  sectionTitle: { flex: 1, color: colors.text, fontSize: 20, fontFamily: font.posterBlack, letterSpacing: -0.4 },
  sectionCount: { color: colors.faint, fontSize: 13, fontFamily: font.bold },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.xs },
  cardTitle: { color: colors.text, fontSize: 16, fontFamily: font.posterBlack, letterSpacing: -0.2 },
  cardBlurb: { color: colors.muted, fontSize: 11, lineHeight: 14, fontFamily: font.medium, marginTop: 1 },
  champ: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  champCompact: { flexDirection: 'column', alignItems: 'flex-start', gap: space.xs },
  champMedal: { position: 'absolute', right: -6, bottom: -6 },
  champName: { color: colors.text, fontSize: 19, lineHeight: 22, fontFamily: font.posterBlack },
  champTeam: { color: colors.faint, fontSize: 12, fontFamily: font.medium },
  champValue: { color: colors.gold, fontSize: 38, lineHeight: 42, fontFamily: font.posterBlack, ...type.num },
  why: { color: colors.muted, fontSize: 12, lineHeight: 17, fontFamily: font.medium, paddingHorizontal: space.lg, paddingBottom: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, minHeight: 36 },
  rowName: { flex: 1, color: colors.text, fontSize: 13, fontFamily: font.semibold },
  rowValue: { color: colors.muted, fontSize: 15, fontFamily: font.posterBlack, ...type.num },
});
