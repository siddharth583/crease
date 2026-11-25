import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PlayerAvatar } from '../../components/Avatar.tsx';
import { Columns, Page, useLayout } from '../../components/layout.tsx';
import { Card, FadeIn, IconButton, inYear, matchYears, PressableScale, Screen, WideHead, YearChips, type IconName } from '../../components/ui.tsx';
import { OvalGround, SeamDivider } from '../../components/cricket.tsx';
import { Confetti, CountUp, PopIn, Rise, Sheen } from '../../components/motion.tsx';
import { BrassIcon, Figure, Medal, Plaque } from '../../components/HonoursBoard.tsx';
import { StatsNav } from '../../components/StatsNav.tsx';
import { seasonAwards, type Award } from '../../engine/awards.ts';
import { useMatches } from '../../store/matches.tsx';
import { useSquad } from '../../store/squad.ts';
import { colors, font, gradients, hero, radius, space, type } from '../../theme.ts';

// The awards ceremony: the Player of the Season in the spotlight, then a brass trophy plaque for every cap and trophy.

const openPlayer = (key: string) => () => router.push({ pathname: '/player/[key]', params: { key } });
const back = () => (router.canGoBack() ? router.back() : router.replace('/players'));

function Headline({ award }: { award: Award }) {
  const w = award.winners[0]!;
  const score = parseFloat(w.value);
  return (
    <View style={styles.hero}>
      <LinearGradient pointerEvents="none" colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <OvalGround opacity={0.07} />
      {/* The spotlight: a cone of brass light from above onto the winner. */}
      <LinearGradient pointerEvents="none" colors={[colors.goldDim, 'transparent']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.8 }} style={StyleSheet.absoluteFill} />
      <Sheen />
      <Confetti count={34} height={460} />
      <PopIn>
        <View style={styles.heroTag}>
          <Ionicons name="trophy" size={13} color={hero.gold} />
          <Text style={styles.heroTagText}>{award.title}</Text>
        </View>
      </PopIn>
      <PressableScale scaleTo={0.98} onPress={openPlayer(w.key)} accessibilityLabel={`${award.title}: ${w.name}`} style={styles.heroBody}>
        <PopIn delay={150} turn={-6}>
          <View style={styles.ring}>
            <PlayerAvatar name={w.name} size={96} />
          </View>
          <View style={styles.crown}>
            <Medal rank={1} size={30} delay={700} />
          </View>
        </PopIn>
        <Text style={styles.heroName} numberOfLines={2}>
          {w.name}
        </Text>
        <Text style={styles.heroSub}>{w.team}</Text>
        <View style={styles.heroScore}>
          <CountUp value={Number.isFinite(score) ? score : 0} delay={300} duration={1400} format={(n) => n.toFixed(1)} style={styles.heroValue} />
          <Text style={styles.heroUnit}>/ 10</Text>
        </View>
        <Text style={styles.heroWhy}>{w.sub}</Text>
      </PressableScale>
      {award.winners.length > 1 && (
        <>
          <SeamDivider color={hero.ink(0.18)} />
          <View style={styles.heroNext}>
            {award.winners.slice(1).map((x, i) => (
              <PressableScale key={x.key} scaleTo={0.97} onPress={openPlayer(x.key)} style={styles.heroChip} accessibilityLabel={`${i + 2}. ${x.name}, ${x.value}`}>
                <Medal rank={i + 2} size={20} delay={900 + i * 120} />
                <Text style={styles.heroChipName} numberOfLines={1}>
                  {x.name}
                </Text>
                <Text style={styles.heroChipValue}>{x.value}</Text>
              </PressableScale>
            ))}
          </View>
        </>
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
  const headline = awards.find((a) => a.id === 'mvp');
  const cards = awards.filter((a) => a.id !== 'mvp');
  const title = year === null ? 'Season awards' : `${year} awards`;

  const body = awards.length ? (
    <>
      {headline && (
        <FadeIn key={`h${year}`}>
          <Headline award={headline} />
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
  heroTag: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', height: 28, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: hero.inset, borderWidth: 1, borderColor: hero.gold },
  heroTagText: { ...type.label, color: hero.gold },
  heroBody: { alignItems: 'center', gap: 4 },
  ring: { padding: 4, borderRadius: 60, borderWidth: 3, borderColor: hero.gold },
  crown: { position: 'absolute', right: -4, bottom: 0 },
  heroName: { color: hero.text, fontSize: 32, lineHeight: 36, fontFamily: font.posterBlack, letterSpacing: -0.8, textAlign: 'center', marginTop: space.sm },
  heroSub: { color: hero.muted, fontSize: 13, fontFamily: font.semibold },
  heroScore: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: space.sm },
  heroValue: { color: hero.gold, fontSize: 56, lineHeight: 60, fontFamily: font.posterBlack, ...type.num },
  heroUnit: { color: hero.muted, fontSize: 14, fontFamily: font.bold },
  heroWhy: { color: hero.muted, fontSize: 13, fontFamily: font.medium, textAlign: 'center' },
  heroNext: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, justifyContent: 'center' },
  heroChip: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, height: 40, borderRadius: radius.pill, backgroundColor: hero.inset },
  heroChipName: { color: hero.text, fontFamily: font.bold, fontSize: 13, maxWidth: 140 },
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
