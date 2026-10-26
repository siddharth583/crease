import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stars } from '../../components/Stars.tsx';
import { Button, Card, FadeIn, GhostWord, IconButton, PitchStripes, PopText, PressableScale, Screen, SectionLabel, tap, useToast } from '../../components/ui.tsx';
import { auctionState, money, nextBid, passPlayer, rosterPlayer, sell, undoAuction, type Auction, type AuctionState } from '../../engine/auction.ts';
import { CATEGORY_LABEL, categoryOf, overall, ROLE_LABEL } from '../../engine/squad.ts';
import { careerStats, playerKey } from '../../engine/stats.ts';
import { plural } from '../../engine/text.ts';
import { useMatches } from '../../store/matches.tsx';
import { useSquad } from '../../store/squad.ts';
import { colors, edge, font, hero, radius, space, type } from '../../theme.ts';

const HERO_BG = '#101010';
const SIDE_TINT = [colors.accent, colors.violet];

/** A captain's purse and side so far. */
function SidePanel({ s, i, leading }: { s: AuctionState['sides'][number]; i: 0 | 1; leading: boolean }) {
  return (
    <View style={[styles.side, leading && { borderColor: SIDE_TINT[i] }]}>
      <View style={[styles.sideBar, { backgroundColor: SIDE_TINT[i] }]} />
      <Text style={styles.sideName} numberOfLines={1}>
        {s.name}
      </Text>
      <Text style={styles.purse}>
        {money(s.left)}
      </Text>
      <Text style={styles.sideMeta} numberOfLines={1}>
        {plural(s.players.length, 'player')} · {s.slots ? `max bid ${money(s.maxBid)}` : 'full'}
      </Text>
    </View>
  );
}

/** Both sides as they came out of the auction. */
function Results({ a, s }: { a: Auction; s: AuctionState }) {
  return (
    <View style={{ gap: space.md }}>
      {s.sides.map((side, i) => (
        <FadeIn key={i} delay={i * 80}>
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <View style={[styles.resultHead, { borderLeftColor: SIDE_TINT[i] }]}>
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
                      {p.keeper ? <Text style={styles.wk}>{'\u00A0\u00A0'}WK</Text> : null}
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
    </View>
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
  useEffect(() => setBid(null), [s?.current]);
  const careers = useMemo(() => careerStats(matches), [matches]);

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

  const raise = (side: 0 | 1) => {
    tap('medium');
    setBid({ side, amount });
  };
  const hammer = () => {
    if (!bid || !p) return;
    saveAuction(sell(a, bid.side, bid.amount));
    tap('success');
    toast.show(`SOLD! ${p.name} to ${s.sides[bid.side].name} for ${money(bid.amount)}`, 'success');
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
      <View style={styles.header}>
        <IconButton icon="chevron-back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        <Text style={styles.headerTitle}>{s.done ? 'Teams' : `Lot ${lot} of ${a.order.length}`}</Text>
        <IconButton icon="arrow-undo" label="Undo" disabled={!bid && !a.events.length} onPress={undo} />
      </View>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: space.sm, paddingBottom: insets.bottom + 120 }}>
        <View style={styles.sides}>
          {s.sides.map((side, i) => (
            <SidePanel key={i} s={side} i={i as 0 | 1} leading={bid?.side === i} />
          ))}
        </View>

        {p ? (
          <>
            <View style={styles.lot}>
              <PitchStripes opacity={0.06} tint="255,255,255" />
              <GhostWord size={130} style={{ color: hero.ink(0.05) }}>
                {String(lot)}
              </GhostWord>
              <View style={styles.lotTop}>
                <Text style={styles.lotRole}>
                  {CATEGORY_LABEL[categoryOf(p)]} · {ROLE_LABEL[p.role]}
                  {p.keeper ? ' · keeps' : ''}
                </Text>
                {s.lastCall ? (
                  <View style={styles.lastCall}>
                    <Text style={styles.lastCallText}>LAST CALL</Text>
                  </View>
                ) : (
                  <Text style={styles.overall}>★ {overall(p).toFixed(1)}</Text>
                )}
              </View>
              <Text style={styles.lotName} numberOfLines={2}>
                {p.name}
              </Text>
              <View style={styles.ratings}>
                {(['bat', 'bowl', 'field'] as const).map((k) => (
                  <View key={k} style={styles.rating}>
                    <Text style={styles.ratingLabel}>{k === 'bat' ? 'BAT' : k === 'bowl' ? 'BOWL' : 'FIELD'}</Text>
                    <Stars value={p[k]} size={13} label={k} />
                  </View>
                ))}
              </View>
              <Text style={styles.career}>
                {career
                  ? `${career.matches} match${career.matches === 1 ? '' : 'es'} · ${plural(career.batting.runs, 'run')} · ${plural(career.bowling.wickets, 'wicket')} · best ${career.batting.highest}${career.batting.highestNotOut ? '*' : ''}`
                  : 'No matches on record yet'}
              </Text>
              <View style={styles.bidBox}>
                <Text style={styles.bidLabel}>{bid ? `${s.sides[bid.side].name} bids` : `Base price · ${CATEGORY_LABEL[categoryOf(p)]}`}</Text>
                <PopText value={money(bid ? bid.amount : s.opening)} style={[styles.bidValue, bid && { color: SIDE_TINT[bid.side] }]} />
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
                    style={[styles.bidButton, { backgroundColor: SIDE_TINT[i] }]}
                  >
                    <Text style={styles.bidWho} numberOfLines={1}>
                      {side.name}
                    </Text>
                    <Text style={styles.bidAmount}>{bid?.side === k ? 'LEADING' : `BID ${money(amount)}`}</Text>
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
          </>
        ) : (
          <>
            <View style={styles.doneHead}>
              <Ionicons name="trophy" size={22} color={colors.onAccent} />
              <Text style={styles.doneText}>Auction done. Here are the teams.</Text>
            </View>
            <Results a={a} s={s} />
          </>
        )}
      </ScrollView>
      {s.done && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}>
          <Button label="Start a match with these teams" icon="play" onPress={() => router.push({ pathname: '/new', params: { auction: a.id } })} />
        </View>
      )}
      {toast.element}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingVertical: space.sm },
  headerTitle: { color: colors.text, fontSize: 24, fontFamily: font.poster, textTransform: 'uppercase' },
  lead: { color: colors.muted, fontSize: 15, fontFamily: font.medium },
  sides: { flexDirection: 'row', gap: space.sm },
  side: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: space.md,
    paddingTop: space.md + 4,
    overflow: 'hidden',
    ...edge,
  },
  sideBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 4 },
  sideName: { color: colors.text, fontSize: 15, fontFamily: font.poster, textTransform: 'uppercase' },
  purse: { fontFamily: font.posterBlack, fontSize: 30, lineHeight: 34, color: colors.text, ...type.num },
  sideMeta: { color: colors.muted, fontSize: 11, fontFamily: font.semibold },
  lot: { backgroundColor: HERO_BG, borderRadius: radius.xl, padding: space.xl, marginTop: space.md, overflow: 'hidden' },
  lotTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lotRole: { ...type.label, color: hero.accent },
  overall: { color: hero.muted, fontSize: 13, fontFamily: font.bold },
  lastCall: { backgroundColor: colors.danger, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3 },
  lastCallText: { color: '#FFFFFF', fontSize: 11, fontFamily: font.heavy, letterSpacing: 1 },
  lotName: { fontFamily: font.posterBlack, fontSize: 46, lineHeight: 46, color: hero.text, textTransform: 'uppercase', marginTop: space.sm },
  ratings: { flexDirection: 'row', gap: space.lg, marginTop: space.md, flexWrap: 'wrap' },
  rating: { gap: 3 },
  ratingLabel: { ...type.label, fontSize: 9, color: hero.muted },
  career: { color: hero.muted, fontSize: 12, fontFamily: font.medium, marginTop: space.md },
  bidBox: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: space.lg, paddingTop: space.md, borderTopWidth: 1, borderTopColor: hero.ink(0.1) },
  bidLabel: { color: hero.muted, fontSize: 13, fontFamily: font.bold, flex: 1 },
  bidValue: { fontFamily: font.posterBlack, fontSize: 56, lineHeight: 58, color: hero.text, ...type.num },
  bidRow: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  bidButton: { borderRadius: radius.lg, padding: space.md, alignItems: 'center', minHeight: 76, justifyContent: 'center', ...edge },
  bidWho: { color: colors.onAccent, fontSize: 13, fontFamily: font.bold },
  bidAmount: { color: colors.onAccent, fontSize: 22, fontFamily: font.posterBlack, ...type.num },
  help: { color: colors.muted, fontSize: 13, fontFamily: font.medium, textAlign: 'center', marginTop: space.md, lineHeight: 18 },
  count: { color: colors.faint, fontSize: 12, fontFamily: font.medium },
  next: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  nextName: { flex: 1, color: colors.text, fontSize: 14, fontFamily: font.semibold },
  again: { color: colors.danger, fontSize: 11, fontFamily: font.bold },
  nextRole: { color: colors.faint, fontSize: 12, fontFamily: font.medium },
  doneHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: colors.accent, borderRadius: radius.md, padding: space.md, marginVertical: space.md, ...edge },
  doneText: { color: colors.onAccent, fontSize: 18, fontFamily: font.poster, textTransform: 'uppercase', flex: 1 },
  resultHead: { flexDirection: 'row', alignItems: 'center', padding: space.md, borderLeftWidth: 4, borderBottomWidth: 1, borderBottomColor: colors.border },
  resultTeam: { color: colors.text, fontSize: 26, fontFamily: font.posterBlack, textTransform: 'uppercase' },
  resultMeta: { color: colors.muted, fontSize: 12, fontFamily: font.medium },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md, paddingVertical: space.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  resultNo: { width: 18, color: colors.faint, fontFamily: font.posterBlack, fontSize: 16 },
  resultName: { color: colors.text, fontSize: 15, fontFamily: font.bold },
  resultRole: { color: colors.muted, fontSize: 12, fontFamily: font.regular },
  cap: { color: colors.accentInk, fontSize: 10, fontFamily: font.heavy },
  wk: { color: colors.cyan, fontSize: 10, fontFamily: font.heavy },
  price: { fontFamily: font.posterBlack, fontSize: 22, color: colors.text, ...type.num },
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
});
