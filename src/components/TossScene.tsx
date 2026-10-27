import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, font, radius, space } from '../theme.ts';
import { useReducedMotion } from './motion.tsx';
import { Button, IconButton, PressableScale, Segmented, tap } from './ui.tsx';

// The toss. Most of the time it was done with a real coin out on the field, so the quickest way is to say who won.
// Without a coin, one is tossed here: someone calls, it spins up and comes down, and the winner chooses.

const native = Platform.OS !== 'web';
type Face = 'heads' | 'tails';
type Side = 0 | 1;
type Phase = 'start' | 'call' | 'flight' | 'choose';
export type TossResult = { winner: '0' | '1'; choice: 'bat' | 'bowl' };

const COIN = 132;
const FLIGHT_MS = 1700;
/** How high the coin goes, in points. */
const RISE = 230;

const FACE_ICON: Record<Face, 'crown' | 'cricket'> = { heads: 'crown', tails: 'cricket' };

/** One side of the coin: gold, a ring inside the rim, a crown on heads and bat and ball on tails. */
function CoinFace({ face }: { face: Face }) {
  return (
    <LinearGradient
      colors={['#FFF0B0', '#F2C14E', '#B9851A', '#F7D477']}
      locations={[0, 0.35, 0.7, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.coinFace}
    >
      <View style={styles.coinRing} />
      <MaterialCommunityIcons name={FACE_ICON[face]} size={58} color="#6B4708" />
    </LinearGradient>
  );
}

/**
 * The coin's flight as interpolations of one clock: up and down on an arc, a little bigger at the top, and spinning
 * end over end (squashed flat and back), heads or tails showing by which way up it is. It always starts heads up; it
 * turns a whole number of times to land heads, and half a turn more to land tails.
 */
function flight(t: Animated.Value, turns: number) {
  const steps = 48;
  const at = Array.from({ length: steps + 1 }, (_, i) => i / steps);
  const angle = (x: number) => 2 * Math.PI * turns * x;
  const translateY = t.interpolate({ inputRange: at, outputRange: at.map((x) => -RISE * 4 * x * (1 - x)) });
  const scale = t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.18, 1] });
  const scaleY = t.interpolate({ inputRange: at, outputRange: at.map((x) => Math.max(0.06, Math.abs(Math.cos(angle(x))))) });
  // Heads shows while the coin faces us: it flips over each time it passes edge-on.
  const flips = Math.round(turns * 2);
  const inputRange = [0];
  const outputRange = [1];
  for (let k = 0; k < flips; k++) {
    const edge = (k + 0.5) / (2 * turns);
    inputRange.push(edge - 0.0005, edge);
    outputRange.push(k % 2 === 0 ? 1 : 0, k % 2 === 0 ? 0 : 1);
  }
  inputRange.push(1);
  outputRange.push(flips % 2 === 0 ? 1 : 0);
  const heads = t.interpolate({ inputRange, outputRange });
  const shadow = t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.35, 1] });
  return { translateY, scale, scaleY, heads, tails: Animated.subtract(1, heads), shadow };
}

export function TossScene({
  visible,
  names,
  onClose,
  onDone,
}: {
  visible: boolean;
  names: [string, string];
  onClose: () => void;
  onDone: (result: TossResult) => void;
}) {
  const insets = useSafeAreaInsets();
  const still = useReducedMotion();
  const [phase, setPhase] = useState<Phase>('start');
  const [caller, setCaller] = useState<Side>(1);
  const [face, setFace] = useState<Face | null>(null);
  const [winner, setWinner] = useState<Side>(0);
  const [turns, setTurns] = useState(6);
  const t = useRef(new Animated.Value(0)).current;
  const land = useRef(new Animated.Value(1)).current;
  const result = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    setPhase('start');
    setFace(null);
    setTurns(6);
    t.setValue(0);
    result.setValue(0);
  }, [visible, t, result]);

  const showResult = () => {
    result.setValue(0);
    Animated.timing(result, { toValue: 1, duration: still ? 0 : 320, easing: Easing.out(Easing.cubic), useNativeDriver: native }).start();
  };

  const toss = (call: Face) => {
    const landed: Face = Math.random() < 0.5 ? 'heads' : 'tails';
    const won = (landed === call ? caller : 1 - caller) as Side;
    setTurns(5 + Math.floor(Math.random() * 3) + (landed === 'tails' ? 0.5 : 0));
    setWinner(won);
    setFace(null);
    setPhase('flight');
    tap('medium');
    const done = () => {
      setFace(landed);
      setPhase('choose');
      tap('success');
      showResult();
      land.setValue(0.9);
      Animated.spring(land, { toValue: 1, useNativeDriver: native, speed: 20, bounciness: 14 }).start();
    };
    t.setValue(0);
    if (still) {
      t.setValue(1);
      done();
      return;
    }
    Animated.timing(t, { toValue: 1, duration: FLIGHT_MS, easing: Easing.linear, useNativeDriver: native }).start(({ finished }) => finished && done());
  };

  const wonOnField = (side: Side) => {
    setWinner(side);
    setFace(null);
    setTurns(6);
    t.setValue(0);
    setPhase('choose');
    showResult();
  };

  const path = flight(t, turns);
  const rise = result.interpolate({ inputRange: [0, 1], outputRange: [12, 0] });

  return (
    <Modal visible={visible} animationType={still ? 'none' : 'slide'} onRequestClose={onClose}>
      <View style={[styles.screen, { paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + space.lg }]}>
        <View style={styles.head}>
          <IconButton icon="close" label="Back to the teams" onPress={onClose} />
          <Text style={styles.title}>The toss</Text>
          <View style={{ width: 44 }} />
        </View>

        <View style={styles.stage}>
          <Animated.View style={[styles.shadow, { opacity: path.shadow, transform: [{ scaleX: path.shadow }] }]} />
          <Animated.View style={{ transform: [{ translateY: path.translateY }, { scale: Animated.multiply(path.scale, land) }] }}>
            <Animated.View style={[styles.coin, { transform: [{ scaleY: path.scaleY }] }]}>
              <View style={styles.coinEdge} />
              <Animated.View style={[StyleSheet.absoluteFill, { opacity: path.heads }]}>
                <CoinFace face="heads" />
              </Animated.View>
              <Animated.View style={[StyleSheet.absoluteFill, { opacity: path.tails }]}>
                <CoinFace face="tails" />
              </Animated.View>
            </Animated.View>
          </Animated.View>
        </View>

        <View style={styles.panel}>
          {phase === 'start' && (
            <>
              <Text style={styles.question}>Who won the toss?</Text>
              <View style={styles.row}>
                {([0, 1] as Side[]).map((s) => (
                  <PressableScale key={s} scaleTo={0.96} wrapStyle={{ flex: 1 }} onPress={() => wonOnField(s)} style={styles.choice}>
                    <Text style={styles.choiceText} numberOfLines={1}>
                      {names[s]}
                    </Text>
                  </PressableScale>
                ))}
              </View>
              <Text style={styles.or}>No coin? Toss one here</Text>
              <Button variant="ghost" icon="sync-outline" label="Toss the coin" onPress={() => setPhase('call')} />
            </>
          )}

          {phase === 'call' && (
            <>
              <Text style={styles.question}>Who calls?</Text>
              <Segmented
                value={String(caller) as '0' | '1'}
                onChange={(v) => setCaller(Number(v) as Side)}
                options={[
                  { value: '0', label: names[0] },
                  { value: '1', label: names[1] },
                ]}
              />
              <Text style={styles.question}>
                <Text style={styles.strong}>{names[caller]}</Text> calls…
              </Text>
              <View style={styles.row}>
                {(['heads', 'tails'] as Face[]).map((f) => (
                  <PressableScale key={f} scaleTo={0.96} wrapStyle={{ flex: 1 }} onPress={() => toss(f)} style={styles.choice} accessibilityLabel={`${f}, and toss`}>
                    <MaterialCommunityIcons name={FACE_ICON[f]} size={18} color={colors.gold} />
                    <Text style={styles.choiceText}>{f === 'heads' ? 'Heads' : 'Tails'}</Text>
                  </PressableScale>
                ))}
              </View>
              <PressableScale onPress={() => setPhase('start')} style={styles.link}>
                <Text style={styles.linkText}>Back</Text>
              </PressableScale>
            </>
          )}

          {phase === 'flight' && <Text style={styles.question}>In the air…</Text>}

          {phase === 'choose' && (
            <Animated.View style={{ gap: space.md, opacity: result, transform: [{ translateY: rise }] }}>
              {face && <Text style={styles.face}>{face === 'heads' ? 'Heads' : 'Tails'}!</Text>}
              <Text style={styles.won}>
                <Text style={styles.strong}>{names[winner]}</Text> won the toss and chose to
              </Text>
              <View style={styles.row}>
                {(['bat', 'bowl'] as const).map((c) => (
                  <PressableScale
                    key={c}
                    scaleTo={0.96}
                    wrapStyle={{ flex: 1 }}
                    onPress={() => {
                      tap('success');
                      onDone({ winner: String(winner) as '0' | '1', choice: c });
                    }}
                    style={[styles.choice, styles.primary]}
                  >
                    <Text style={[styles.choiceText, { color: colors.onAccent }]}>{c === 'bat' ? 'Bat first' : 'Bowl first'}</Text>
                  </PressableScale>
                ))}
              </View>
              <PressableScale onPress={() => setPhase('start')} style={styles.link}>
                <Text style={styles.linkText}>Change the toss</Text>
              </PressableScale>
            </Animated.View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: space.lg },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: font.posterBlack, fontSize: 22, color: colors.text, letterSpacing: -0.5 },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: space.xl, minHeight: COIN + RISE * 0.6 },
  shadow: {
    position: 'absolute',
    bottom: space.xl - 14,
    width: COIN * 0.8,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  coin: { width: COIN, height: COIN },
  coinEdge: { position: 'absolute', left: 0, top: 5, width: COIN, height: COIN, borderRadius: COIN / 2, backgroundColor: '#8A5F0E' },
  coinFace: {
    width: COIN,
    height: COIN,
    borderRadius: COIN / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#A87517',
  },
  coinRing: { position: 'absolute', left: 10, top: 10, right: 10, bottom: 10, borderRadius: COIN, borderWidth: 2, borderColor: 'rgba(107,71,8,0.4)' },
  panel: { gap: space.md, minHeight: 250 },
  question: { color: colors.muted, fontSize: 15, fontFamily: font.semibold, textAlign: 'center' },
  strong: { color: colors.text, fontFamily: font.bold },
  row: { flexDirection: 'row', gap: space.sm },
  choice: {
    height: 58,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderHi,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: space.md,
  },
  primary: { backgroundColor: colors.accent, borderColor: colors.accent },
  choiceText: { color: colors.text, fontSize: 16, fontFamily: font.bold },
  or: { color: colors.faint, fontSize: 13, fontFamily: font.medium, textAlign: 'center', marginTop: space.md },
  face: { fontFamily: font.posterBlack, fontSize: 40, color: colors.gold, textAlign: 'center', letterSpacing: -1 },
  won: { color: colors.muted, fontSize: 16, fontFamily: font.medium, textAlign: 'center' },
  link: { alignSelf: 'center', paddingVertical: space.sm, paddingHorizontal: space.md },
  linkText: { color: colors.muted, fontSize: 14, fontFamily: font.semibold, textDecorationLine: 'underline' },
});
