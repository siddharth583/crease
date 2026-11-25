import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stars } from '../../components/Stars.tsx';
import { Columns, Page, useLayout } from '../../components/layout.tsx';
import { Button, Card, FadeIn, GhostWord, IconButton, PitchStripes, PopText, PressableScale, Screen, SectionLabel, tap, useToast, WideHead } from '../../components/ui.tsx';
import { TeamCrest, TeamWash } from '../../components/TeamCrest.tsx';
import { auctionState, money, nextBid, passPlayer, rosterPlayer, sell, undoAuction, type Auction, type AuctionState } from '../../engine/auction.ts';
import { CATEGORY_LABEL, categoryOf, overall, ROLE_LABEL } from '../../engine/squad.ts';
import { careerStats, playerKey } from '../../engine/stats.ts';
import { plural } from '../../engine/text.ts';
import { Confetti, CountUp, PopIn, Pulse, Rise, Sheen, useReducedMotion } from '../../components/motion.tsx';
import { OvalGround, SeamDivider } from '../../components/cricket.tsx';
import { PlayerAvatar } from '../../components/Avatar.tsx';
import { useMatches } from '../../store/matches.tsx';
import { useSquad } from '../../store/squad.ts';
import { colors, edge, font, gradients, hero, ownTeamTheme, radius, space, type, HERO_BG } from '../../theme.ts';

/**
 * Each side's colour: its own team colours when it has them, else volt and the light violet. Both are bright, so they
 * read on the dark panels and carry dark type as a fill, in day or night.
 */
const tintOf = (name: string, i: number) => ownTeamTheme(name)?.accent ?? [colors.accent, hero.violet][i];
const onTintOf = (name: string) => ownTeamTheme(name)?.onAccent ?? colors.onAccent;

/** What is left of a purse, as a bar that eases to its new length. */
function PurseBar({ fraction, color }: { fraction: number; color: string }) {
  const v = useRef(new Animated.Value(fraction)).current;
  useEffect(() => {
    Animated.spring(v, { toValue: fraction, useNativeDriver: false, speed: 10, bounciness: 4 }).start();
  }, [fraction, v]);
  return (
    <View style={styles.purseTrack}>
      <Animated.View style={[styles.purseFill, { backgroundColor: color, width: v.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'], extrapolate: 'clamp' }) }]} />
    </View>
  );
}

/** A captain's purse and side so far, as a scoreboard panel. */
function SidePanel({ s, i, leading, total, size }: { s: AuctionState['sides'][number]; i: 0 | 1; leading: boolean; total: number; size: number }) {
  const tint = tintOf(s.name, i);
  return (
    <View style={[styles.side, leading && { borderColor: tint }]} accessibilityLabel={`${s.name}: ${money(s.left)} left, ${s.players.length} of ${size} players`}>
      <LinearGradient pointerEvents="none" colors={gradients.hero} style={StyleSheet.absoluteFill} />
      <TeamWash color={tint} strength={leading ? 0.34 : 0.16} />
      <View style={styles.sideTitle}>
        <TeamCrest name={s.name} size={30} />
        <Text style={styles.sideName} numberOfLines={1}>
          {s.name}
        </Text>
        {leading && <Pulse color={tint} />}
      </View>
      <Text style={styles.purseLabel}>PURSE LEFT</Text>
      <CountUp value={s.left} format={money} style={styles.purse} duration={800} />
      <PurseBar fraction={total ? s.left / total : 0} color={tint} />
      {/* Two lines if it needs them: on a phone the max bid was cut off at the card's edge. */}
      <Text style={styles.sideMeta} numberOfLines={2}>
        {s.players.length} of {size} players · {s.slots ? `max bid ${money(s.maxBid)}` : 'full'}
      </Text>
    </View>
  );
}

/** Both sides as they came out of the auction. */
function Results({ a, s }: { a: Auction; s: AuctionState }) {
  // Side by side on a tablet or laptop, both as tall as the bigger side.
  const { wide } = useLayout();
  return (
    <Columns tablet={2} gap={space.md}>
      {s.sides.map((side, i) => (
        <FadeIn key={i} delay={i * 80} style={wide && { flex: 1 }}>
          <Card style={[{ padding: 0, overflow: 'hidden' }, wide && { flex: 1 }]}>
            <View style={styles.resultHead}>
              <TeamWash color={tintOf(side.name, i)} strength={0.2} />
              <View style={{ marginRight: space.md }}>
                <TeamCrest name={side.name} size={40} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.resultTeam} numberOfLines={1}>
                  {side.name}
                </Text>
                <Text style={styles.resultMeta}>
                  {side.players.length} players · spent {money(side.spent)} · {money(side.left)} left
                </Text>
              </View>
            </View>
            {side.players.map((id, j) => {
              const p = rosterPlayer(a, id);
              const buy = side.bought.find((b) => b.player === id);
              return (
                <View key={id} style={styles.resultRow}>
                  <Text style={styles.resultNo}>{j + 1}</Text>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.resultName} numberOfLines={1}>
                      {p.name}
                      {j === 0 ? <Text style={styles.cap}>{'\u00A0\u00A0'}CAPTAIN</Text> : null}
                      {p.keeper ? <Text style={styles.wk}>{'\u00A0\u00A0'}{p.keeper === 'sometimes' ? '(WK)' : 'WK'}</Text> : null}
                    </Text>
                    <Text style={styles.resultRole}>{ROLE_LABEL[p.role]}</Text>
                  </View>
                  <Text style={styles.price}>{j === 0 ? '–' : money(buy?.price ?? 0)}</Text>
                </View>
              );
            })}
          </Card>
        </FadeIn>
      ))}
    </Columns>
  );
}

export default function AuctionScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { auctions, saveAuction } = useSquad();
  const { matches } = useMatches();
  const toast = useToast('top');
  const a = auctions.find((x) => x.id === id);
  const s = useMemo(() => (a ? auctionState(a) : null), [a]);
  // The bidding on the current player lives here until the hammer falls.
  const [bid, setBid] = useState<{ side: 0 | 1; amount: number } | null>(null);
  // The hammer comes down: a "Sold!" stamp lands over the lot for a moment.
  const [sold, setSold] = useState<{ name: string; to: string; price: number; side: 0 | 1; key: number } | null>(null);
  useEffect(() => {
    if (!sold) return;
    const t = setTimeout(() => setSold(null), 1500);
    return () => clearTimeout(t);
  }, [sold]);
  useEffect(() => setBid(null), [s?.current]);
  const careers = useMemo(() => careerStats(matches), [matches]);
  const layout = useLayout();
  const { wide } = layout;

  if (!a || !s) {
    return (
      <Screen>
        <View style={styles.header}>
          <IconButton icon="chevron-back" label="Back" onPress={() => router.replace('/')} />
        </View>
        <Text style={[styles.lead, { padding: space.lg }]}>This auction isn’t on this phone.</Text>
      </Screen>
    );
  }

  const p = s.current ? rosterPlayer(a, s.current) : null;
  const career = p ? careers.find((c) => c.key === playerKey({ id: '', name: '', players: [] }, p.name)) : undefined;
  const lot = a.order.length - s.queue.length + 1;
  const amount = nextBid(a, bid?.amount ?? null);

  const sidesN = (
    <View style={styles.sides}>
      {s.sides.map((side, i) => (
        <SidePanel key={i} s={side} i={i as 0 | 1} leading={bid?.side === i} total={a.settings.purse} size={s.sideSize} />
      ))}
    </View>
  );

  const raise = (side: 0 | 1) => {
    tap('medium');
    setBid({ side, amount });
  };
  const hammer = () => {
    if (!bid || !p) return;
    saveAuction(sell(a, bid.side, bid.amount));
    tap('success');
    setSold({ name: p.name, to: s.sides[bid.side].name, price: bid.amount, side: bid.side, key: Date.now() });
  };
  const pass = () => {
    if (!p) return;
    saveAuction(passPlayer(a));
    toast.show(`${p.name} unsold. They’ll come up again at the end.`, 'info');
  };
  const undo = () => {
    if (bid) setBid(null);
    else if (a.events.length) saveAuction(undoAuction(a));
  };

  return (
    <Screen>
      {wide ? (
        // Back, the title and Undo on one line, as on every other page.
        <View style={{ paddingHorizontal: layout.gutter, paddingTop: space.lg }}>
          <Page>
            <WideHead
              title={s.done ? 'Teams' : `Lot ${lot} of ${a.order.length}`}
              sub={`${a.sides[0].name} v ${a.sides[1].name} · the auction`}
              onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
              right={<IconButton icon="arrow-undo" label="Undo" disabled={!bid && !a.events.length} onPress={undo} />}
            />
          </Page>
        </View>
      ) : (
        <View style={styles.header}>
          <IconButton icon="chevron-back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
          <Text style={styles.headerTitle}>{s.done ? 'Teams' : `Lot ${lot} of ${a.order.length}`}</Text>
          <IconButton icon="arrow-undo" label="Undo" disabled={!bid && !a.events.length} onPress={undo} />
        </View>
      )}
      <ScrollView contentContainerStyle={{ padding: wide ? layout.gutter : space.lg, paddingTop: wide ? 0 : space.sm, paddingBottom: insets.bottom + 120 }}>
        <Page>
        {!wide && sidesN}

        {p ? (
          // A tablet or laptop: the lot and the bidding on the left; the purses and who's next beside them.
          <Columns weights={[3, 2]} gap={wide ? space.lg : 0}>
          <View>
            <View style={[styles.lot, wide && { marginTop: 0, padding: space.xxl }]}>
              <LinearGradient pointerEvents="none" colors={gradients.hero} style={StyleSheet.absoluteFill} />
              <OvalGround opacity={0.09} />
              <PitchStripes opacity={0.05} tint="255,255,255" />
              <Sheen />
              <View style={styles.lotTop}>
                <Text style={styles.lotKicker}>LOT {lot} OF {a.order.length}</Text>
                {s.lastCall ? (
                  <View style={styles.lastCall}>
                    <Text style={styles.lastCallText}>LAST CALL</Text>
                  </View>
                ) : (
                  <Text style={styles.overall}>★ {overall(p).toFixed(1)} overall</Text>
                )}
              </View>
              <View key={p.id} style={styles.lotBody}>
                <PopIn turn={-6} style={styles.photoRing}>
                  <PlayerAvatar name={p.name} size={wide ? 104 : 84} />
                </PopIn>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.lotRole}>
                    {CATEGORY_LABEL[categoryOf(p)]} · {ROLE_LABEL[p.role]}
                    {p.keeper ? ' · keeps' : ''}
                  </Text>
                  <Text style={[styles.lotName, wide && { fontSize: 46, lineHeight: 50 }]} numberOfLines={2}>
                    {p.name}
                  </Text>
                </View>
              </View>
              <View style={styles.ratings}>
                {(['bat', 'bowl', 'field'] as const).map((k) => (
                  <View key={k} style={styles.rating}>
                    <Text style={styles.ratingLabel}>{k === 'bat' ? 'BATTING' : k === 'bowl' ? 'BOWLING' : 'FIELDING'}</Text>
                    <Stars value={p[k]} size={14} label={k} />
                  </View>
                ))}
              </View>
              <Text style={styles.career}>
                {career
                  ? `${career.matches} match${career.matches === 1 ? '' : 'es'} · ${plural(career.batting.runs, 'run')} · ${plural(career.bowling.wickets, 'wicket')} · best ${career.batting.highest}${career.batting.highestNotOut ? '*' : ''}`
                  : 'No matches on record yet'}
              </Text>
              <SeamDivider color={hero.ink(0.18)} style={{ marginTop: space.md }} />
              <View style={styles.bidBox}>
                <Text style={styles.bidLabel}>{bid ? `${s.sides[bid.side].name} bids` : `Base price · ${CATEGORY_LABEL[categoryOf(p)]}`}</Text>
                <PopText value={money(bid ? bid.amount : s.opening)} style={[styles.bidValue, bid && { color: tintOf(s.sides[bid.side].name, bid.side) }]} />
              </View>
            </View>

            <View style={styles.bidRow}>
              {s.sides.map((side, i) => {
                const k = i as 0 | 1;
                const ok = side.slots > 0 && amount <= side.maxBid && bid?.side !== k;
                return (
                  <PressableScale
                    key={i}
                    disabled={!ok}
                    onPress={() => raise(k)}
                    wrapStyle={{ flex: 1 }}
                    accessibilityLabel={`${side.name} bids ${money(amount)}`}
                    style={[styles.bidButton, { backgroundColor: tintOf(side.name, i) }]}
                  >
                    <Text style={[styles.bidWho, { color: onTintOf(side.name) }]} numberOfLines={2}>
                      {side.name}
                    </Text>
                    <Text style={[styles.bidAmount, { color: onTintOf(side.name) }]}>{bid?.side === k ? 'LEADING' : `BID ${money(amount)}`}</Text>
                    {!ok && bid?.side !== k && <Text style={[styles.bidWhy, { color: onTintOf(side.name) }]}>{side.slots <= 0 ? 'side is full' : 'over the limit'}</Text>}
                  </PressableScale>
                );
              })}
            </View>
            <Button
              label={bid ? `Sold to ${s.sides[bid.side].name} for ${money(bid.amount)}` : 'Waiting for a bid'}
              icon="hammer"
              disabled={!bid}
              onPress={hammer}
              style={{ marginTop: space.md }}
            />
            {!s.lastCall ? (
              <Button variant="ghost" label="Unsold" icon="arrow-redo-outline" disabled={Boolean(bid)} onPress={pass} style={{ marginTop: space.sm }} />
            ) : (
              <Text style={styles.help}>Nobody took {p.name} the first time. One of the captains has to now, at {money(s.opening)} or more.</Text>
            )}
          </View>

          <View>
            {wide && sidesN}
            {s.queue.length > 1 && (
              <>
                <SectionLabel right={<Text style={styles.count}>{s.queue.length - 1} to come</Text>}>Up next</SectionLabel>
                <Card style={{ gap: space.sm }}>
                  {s.queue.slice(1, 6).map((qid) => {
                    const q = rosterPlayer(a, qid);
                    return (
                      <View key={qid} style={styles.next}>
                        <Text style={styles.nextName} numberOfLines={1}>
                          {q.name}
                          {s.unsold.includes(qid) ? <Text style={styles.again}>{'\u00A0\u00A0'}again</Text> : null}
                        </Text>
                        <Text style={styles.nextRole}>{ROLE_LABEL[q.role]}</Text>
                      </View>
                    );
                  })}
                </Card>
              </>
            )}
          </View>
          </Columns>
        ) : (
          <>
            {wide && sidesN}
            <View style={styles.doneHead}>
              <LinearGradient pointerEvents="none" colors={gradients.hero} style={StyleSheet.absoluteFill} />
              <OvalGround opacity={0.1} />
              <Confetti count={30} height={420} />
              <PopIn style={styles.doneIcon}>
                <Ionicons name="trophy" size={24} color={hero.gold} />
              </PopIn>
              <View style={{ flex: 1 }}>
                <Text style={styles.doneKicker}>THE HAMMER’S DOWN</Text>
                <Text style={styles.doneText}>Auction done. Here are the teams.</Text>
              </View>
            </View>
            <Results a={a} s={s} />
          </>
        )}
        </Page>
      </ScrollView>
      {s.done && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }, wide && { paddingHorizontal: layout.gutter }]}>
          {wide ? (
            // As on New match: the teams on the left, the start at the right.
            <Page style={styles.footWide}>
              <Text style={styles.footSummary} numberOfLines={1}>
                <Text style={styles.footStrong}>
                  {s.sides[0].name} v {s.sides[1].name}
                </Text>
                {`  ·  ${s.sides[0].players.length} and ${s.sides[1].players.length} players`}
              </Text>
              <Button style={styles.startWide} label="Start a match with these teams" icon="play" onPress={() => router.push({ pathname: '/new', params: { auction: a.id } })} />
            </Page>
          ) : (
            <Button label="Start a match with these teams" icon="play" onPress={() => router.push({ pathname: '/new', params: { auction: a.id } })} />
          )}
        </View>
      )}
      {sold && (
        <View pointerEvents="none" style={styles.stampWrap}>
          <Confetti count={40} height={700} />
          <PopIn key={sold.key} turn={-18} style={[styles.stamp, { borderColor: tintOf(s.sides[sold.side].name, sold.side) }]}>
            <TeamCrest name={sold.to} size={44} />
            <Text style={[styles.stampWord, { color: tintOf(s.sides[sold.side].name, sold.side) }]}>Sold!</Text>
            <Text style={styles.stampName} numberOfLines={1}>
              {sold.name}
            </Text>
            <Text style={styles.stampTo} numberOfLines={1}>
              to {sold.to} · {money(sold.price)}
            </Text>
          </PopIn>
        </View>
      )}
      {toast.element}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingVertical: space.sm },
  footWide: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  footSummary: { flex: 1, minWidth: 0, color: colors.muted, fontSize: 15, fontFamily: font.medium },
  footStrong: { color: colors.text, fontFamily: font.bold },
  startWide: { width: 340 },
  headerTitle: { color: colors.text, fontSize: 20, fontFamily: font.poster },
  lead: { color: colors.muted, fontSize: 15, fontFamily: font.medium },
  sides: { flexDirection: 'row', gap: space.sm },
  side: {
    flex: 1,
    backgroundColor: HERO_BG,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: space.md,
    paddingTop: space.md + 4,
    overflow: 'hidden',
    ...edge,
  },
  sideTitle: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  sideName: { color: hero.text, fontSize: 15, fontFamily: font.poster, flexShrink: 1 },
  purseLabel: { ...type.label, fontSize: 9, color: hero.muted, marginTop: space.sm },
  purseTrack: { height: 4, borderRadius: 2, backgroundColor: hero.ink(0.12), marginVertical: 6, overflow: 'hidden' },
  purseFill: { height: 4, borderRadius: 2 },
  lotKicker: { ...type.label, color: hero.gold, letterSpacing: 2 },
  lotBody: { flexDirection: 'row', alignItems: 'center', gap: space.lg, marginTop: space.md },
  photoRing: { borderRadius: 60, borderWidth: 2, borderColor: hero.gold, padding: 3 },
  bidWhy: { fontSize: 11, fontFamily: font.semibold, opacity: 0.8 },
  purse: { fontFamily: font.posterBlack, fontSize: 28, lineHeight: 32, color: hero.text, ...type.num },
  sideMeta: { color: hero.muted, fontSize: 11, fontFamily: font.semibold },
  lot: { backgroundColor: HERO_BG, borderRadius: radius.xl, padding: space.xl, marginTop: space.md, overflow: 'hidden' },
  lotTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lotRole: { ...type.label, color: hero.accent, fontSize: 10 },
  overall: { color: hero.muted, fontSize: 13, fontFamily: font.bold },
  lastCall: { backgroundColor: colors.danger, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3 },
  lastCallText: { color: '#FFFFFF', fontSize: 11, fontFamily: font.heavy, letterSpacing: 1 },
  lotName: { fontFamily: font.posterBlack, fontSize: 38, lineHeight: 43, color: hero.text, marginTop: space.sm },
  ratings: { flexDirection: 'row', gap: space.lg, marginTop: space.md, flexWrap: 'wrap' },
  rating: { gap: 3 },
  ratingLabel: { ...type.label, fontSize: 9, color: hero.muted },
  career: { color: hero.muted, fontSize: 12, fontFamily: font.medium, marginTop: space.md },
  bidBox: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: space.lg, paddingTop: space.md, borderTopWidth: 1, borderTopColor: hero.ink(0.1) },
  bidLabel: { color: hero.muted, fontSize: 13, fontFamily: font.bold, flex: 1 },
  bidValue: { fontFamily: font.posterBlack, fontSize: 46, lineHeight: 52, color: hero.text, ...type.num },
  bidRow: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  bidButton: { borderRadius: radius.lg, padding: space.md, alignItems: 'center', minHeight: 92, justifyContent: 'center', ...edge },
  bidWho: { color: colors.onAccent, fontSize: 13, fontFamily: font.bold },
  bidAmount: { color: colors.onAccent, fontSize: 22, fontFamily: font.posterBlack, ...type.num },
  help: { color: colors.muted, fontSize: 13, fontFamily: font.medium, textAlign: 'center', marginTop: space.md, lineHeight: 18 },
  count: { color: colors.faint, fontSize: 12, fontFamily: font.medium },
  next: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  nextName: { flex: 1, color: colors.text, fontSize: 14, fontFamily: font.semibold },
  again: { color: colors.danger, fontSize: 11, fontFamily: font.bold },
  nextRole: { color: colors.faint, fontSize: 12, fontFamily: font.medium },
  doneHead: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: HERO_BG, borderRadius: radius.xl, padding: space.lg, marginVertical: space.md, overflow: 'hidden' },
  doneIcon: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: hero.gold, alignItems: 'center', justifyContent: 'center' },
  doneKicker: { ...type.label, color: hero.gold, fontSize: 10, letterSpacing: 2 },
  doneText: { color: hero.text, fontSize: 19, fontFamily: font.posterBlack, letterSpacing: -0.4 },
  resultHead: { flexDirection: 'row', alignItems: 'center', padding: space.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  resultTeam: { color: colors.text, fontSize: 21, fontFamily: font.posterBlack },
  resultMeta: { color: colors.muted, fontSize: 12, fontFamily: font.medium },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md, paddingVertical: space.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  resultNo: { width: 18, color: colors.gold, fontFamily: font.posterBlack, fontSize: 16 },
  resultName: { color: colors.text, fontSize: 15, fontFamily: font.bold },
  resultRole: { color: colors.muted, fontSize: 12, fontFamily: font.regular },
  cap: { color: colors.accentInk, fontSize: 10, fontFamily: font.heavy },
  wk: { color: colors.cyan, fontSize: 10, fontFamily: font.heavy },
  price: { fontFamily: font.posterBlack, fontSize: 18, color: colors.text, ...type.num },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  stampWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.scrim, zIndex: 60 },
  stamp: {
    alignItems: 'center',
    backgroundColor: HERO_BG,
    borderWidth: 3,
    borderRadius: radius.xl,
    paddingHorizontal: space.xl,
    paddingVertical: space.lg,
    maxWidth: 320,
  },
  stampWord: { fontFamily: font.posterBlack, fontSize: 64, lineHeight: 72, letterSpacing: -2.5 },
  stampName: { color: hero.text, fontFamily: font.poster, fontSize: 22, letterSpacing: -0.4 },
  stampTo: { color: hero.muted, fontFamily: font.semibold, fontSize: 13, marginTop: 4 },
});
