import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Modal, Platform, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { font, gradients, hero, radius, space, type } from '../theme.ts';
import { Confetti, useReducedMotion } from './motion.tsx';
import { PitchStripes, PressableScale, tap } from './ui.tsx';

// The toss, out in the middle: the two captains and the umpire walk out, the away captain calls, the home captain
// spins the coin, and whoever wins it chooses to bat or bowl. Always at night, on the pitch.

const native = Platform.OS !== 'web';
type Face = 'heads' | 'tails';
type Phase = 'walk' | 'call' | 'flight' | 'landed' | 'choose' | 'manual';
export type TossResult = { winner: '0' | '1'; choice: 'bat' | 'bowl' };

/** A figure on the pitch: a cap, a head and a shirt in their side's colour, their name beneath. */
function Figure({ name, role, shirt, cap, umpire, jump, from, delay }: { name: string; role: string; shirt: string; cap: string; umpire?: boolean; jump: Animated.Value; from: number; delay: number }) {
  const still = useReducedMotion();
  const walk = useRef(new Animated.Value(still ? 1 : 0)).current;
  const breathe = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (still) return;
    Animated.timing(walk, { toValue: 1, duration: 900, delay, easing: Easing.out(Easing.back(1.2)), useNativeDriver: native }).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
        Animated.timing(breathe, { toValue: 0, duration: 1300, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [still, walk, breathe, delay]);
  const translateX = walk.interpolate({ inputRange: [0, 1], outputRange: [from, 0] });
  const bob = breathe.interpolate({ inputRange: [0, 1], outputRange: [0, -3] });
  const hop = jump.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -26, 0] });
  return (
    <Animated.View style={[styles.figure, { opacity: walk, transform: [{ translateX }, { translateY: Animated.add(bob, hop) }] }]}>
      <View style={[styles.cap, { backgroundColor: cap }, umpire && styles.umpireHat]} />
      <View style={styles.head} />
      <View style={[styles.shirt, { backgroundColor: shirt }]}>
        {umpire ? <View style={styles.umpireTie} /> : <Text style={styles.shirtMark}>C</Text>}
      </View>
      <View style={styles.legs}>
        <View style={styles.leg} />
        <View style={styles.leg} />
      </View>
      <Text style={styles.figureName} numberOfLines={1}>
        {name}
      </Text>
      <Text style={styles.figureRole} numberOfLines={1}>
        {role}
      </Text>
    </Animated.View>
  );
}

/** A speech bubble above a figure. */
function Bubble({ children, tone = 'light' }: { children: ReactNode; tone?: 'light' | 'volt' }) {
  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(pop, { toValue: 1, useNativeDriver: native, speed: 14, bounciness: 10 }).start();
  }, [pop]);
  return (
    <Animated.View style={[styles.bubble, tone === 'volt' && { backgroundColor: hero.accent }, { opacity: pop, transform: [{ scale: pop }] }]}>
      {typeof children === 'string' ? <Text style={styles.bubbleText}>{children}</Text> : children}
    </Animated.View>
  );
}

export function TossScene({
  visible,
  names,
  captains,
  onClose,
  onDone,
}: {
  visible: boolean;
  /** The two sides: the first is at home and tosses, the second calls. */
  names: [string, string];
  /** Each side's captain, when one was picked. */
  captains: [string | null, string | null];
  onClose: () => void;
  onDone: (result: TossResult) => void;
}) {
  const insets = useSafeAreaInsets();
  const still = useReducedMotion();
  const [phase, setPhase] = useState<Phase>('walk');
  const [call, setCall] = useState<Face | null>(null);
  const [face, setFace] = useState<Face | null>(null);
  const [width, setWidth] = useState(360);
  const [manualWinner, setManualWinner] = useState<'0' | '1'>('0');
  const flight = useRef(new Animated.Value(0)).current;
  const jumps = useRef([new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]).current;

  const home = captains[0] ?? `${names[0]} captain`;
  const away = captains[1] ?? `${names[1]} captain`;
  // A captain by first name; with no captain picked, their side.
  const callName = (i: 0 | 1) => (captains[i] ? captains[i]!.trim().split(/\s+/)[0] : names[i]);
  const winner: '0' | '1' | null = face && call ? (face === call ? '1' : '0') : null;

  useEffect(() => {
    if (!visible) return;
    setPhase('walk');
    setCall(null);
    setFace(null);
    flight.setValue(0);
    const t = setTimeout(() => setPhase('call'), still ? 0 : 1300);
    return () => clearTimeout(t);
  }, [visible, still, flight]);

  const toss = () => {
    if (!call || phase !== 'call') return;
    const landed: Face = Math.random() < 0.5 ? 'heads' : 'tails';
    setPhase('flight');
    tap('medium');
    flight.setValue(0);
    Animated.timing(flight, { toValue: 1, duration: still ? 1 : 1800, easing: Easing.linear, useNativeDriver: native }).start(() => {
      setFace(landed);
      setPhase('landed');
      tap('success');
      const won = landed === call ? 2 : 0;
      Animated.sequence([
        Animated.timing(jumps[won], { toValue: 1, duration: 420, easing: Easing.out(Easing.quad), useNativeDriver: native }),
        Animated.timing(jumps[won], { toValue: 0, duration: 0, useNativeDriver: native }),
        Animated.timing(jumps[won], { toValue: 1, duration: 420, easing: Easing.out(Easing.quad), useNativeDriver: native }),
        Animated.timing(jumps[won], { toValue: 0, duration: 0, useNativeDriver: native }),
      ]).start();
      setTimeout(() => setPhase('choose'), still ? 0 : 1100);
    });
  };

  // The coin's path: from the home captain's hand, up over the umpire, down onto the pitch in front of them.
  const stage = 320;
  const startX = width * 0.18;
  const landX = width * 0.5;
  const x = flight.interpolate({ inputRange: [0, 1], outputRange: [startX - 18, landX - 18] });
  const y = flight.interpolate({ inputRange: [0, 0.1, 0.45, 0.8, 0.88, 0.94, 1], outputRange: [150, 110, -20, 272, 252, 272, 272] });
  const spin = flight.interpolate({ inputRange: [0, 0.8, 1], outputRange: ['0deg', '2520deg', '2520deg'] });
  const grow = flight.interpolate({ inputRange: [0, 0.45, 0.8, 1], outputRange: [0.8, 1.5, 1, 1] });
  const shadow = flight.interpolate({ inputRange: [0, 0.45, 0.8, 1], outputRange: [0.15, 0.08, 0.4, 0.4] });
  const shadowScale = flight.interpolate({ inputRange: [0, 0.45, 0.8, 1], outputRange: [0.5, 0.3, 1, 1] });
  const shadowX = flight.interpolate({ inputRange: [0, 1], outputRange: [startX - 18, landX - 18] });

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  return (
    <Modal visible={visible} animationType={still ? 'none' : 'fade'} onRequestClose={onClose}>
      <LinearGradient colors={gradients.hero} style={[styles.screen, { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.lg }]}>
        <PitchStripes opacity={0.05} tint="255,255,255" />
        <View style={styles.top}>
          <PressableScale accessibilityLabel="Back to the teams" onPress={onClose} style={styles.close}>
            <MaterialCommunityIcons name="close" size={20} color={hero.text} />
          </PressableScale>
          <Text style={styles.eyebrow}>THE TOSS</Text>
          <View style={{ width: 40 }} />
        </View>
        <Text style={styles.title} numberOfLines={2}>
          {names[0]} <Text style={{ color: hero.faint }}>v</Text> {names[1]}
        </Text>

        <View style={[styles.stage, { height: stage }]} onLayout={onLayout}>
          {/* The strip: a lighter cut of grass with the popping crease across it. */}
          <View style={styles.strip}>
            <View style={styles.crease} />
            <View style={[styles.crease, { top: undefined, bottom: 34 }]} />
          </View>

          <View style={styles.row}>
            <View style={styles.slot}>
              {((phase === 'call' && call) || phase === 'flight') && <Bubble>Here goes!</Bubble>}
              <Figure name={home} role={`${names[0]} · tosses`} shirt={hero.accent} cap={hero.accent} jump={jumps[0]} from={-width / 2} delay={0} />
            </View>
            <View style={[styles.slot, { marginTop: -40 }]}>
              {(phase === 'landed' || phase === 'choose') && face && <Bubble tone="volt">{`It's ${face}!`}</Bubble>}
              <Figure name="Umpire" role="In the middle" shirt="#F4F4EF" cap="#16191A" umpire jump={jumps[1]} from={0} delay={250} />
            </View>
            <View style={styles.slot}>
              {phase === 'call' && !call && <Bubble>Your call…</Bubble>}
              {call && phase !== 'choose' && phase !== 'landed' && <Bubble>{call === 'heads' ? 'Heads!' : 'Tails!'}</Bubble>}
              <Figure name={away} role={`${names[1]} · calls`} shirt={hero.cyan} cap={hero.cyan} jump={jumps[2]} from={width / 2} delay={120} />
            </View>
          </View>

          {/* The coin and its shadow on the pitch. */}
          {phase !== 'walk' && phase !== 'manual' && (
            <>
              <Animated.View pointerEvents="none" style={[styles.shadow, { opacity: shadow, transform: [{ translateX: shadowX }, { translateY: 300 }, { scaleX: shadowScale }] }]} />
              <Animated.View pointerEvents="none" style={[styles.coinWrap, { transform: [{ translateX: x }, { translateY: y }, { scale: grow }] }]}>
                <Animated.View style={[styles.coin, { transform: [{ perspective: 400 }, { rotateX: spin }] }]}>
                  <LinearGradient colors={['#FFE38A', hero.gold, '#C9901C']} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={StyleSheet.absoluteFill} />
                  <Text style={styles.coinFace}>{face === 'tails' ? 'T' : face === 'heads' ? 'H' : '★'}</Text>
                </Animated.View>
              </Animated.View>
            </>
          )}
        </View>

        <View style={styles.panel}>
          {phase === 'walk' && <Text style={styles.line}>Out to the middle…</Text>}

          {phase === 'call' && (
            <>
              <Text style={styles.line}>{call ? `${callName(1)} called ${call}. Over to ${callName(0)}.` : `${callName(1)} calls it:`}</Text>
              {!call ? (
                <View style={styles.choices}>
                  {(['heads', 'tails'] as Face[]).map((f) => (
                    <PressableScale key={f} scaleTo={0.95} wrapStyle={{ flex: 1 }} onPress={() => (tap('light'), setCall(f))} style={styles.choice}>
                      <Text style={styles.choiceText}>{f === 'heads' ? 'Heads' : 'Tails'}</Text>
                    </PressableScale>
                  ))}
                </View>
              ) : (
                <PressableScale scaleTo={0.96} wrapStyle={{ alignSelf: 'stretch' }} onPress={toss} style={[styles.choice, styles.primary]} accessibilityLabel="Toss the coin">
                  <MaterialCommunityIcons name="hand-coin" size={20} color="#0A0D06" />
                  <Text style={[styles.choiceText, { color: '#0A0D06' }]}>Toss the coin</Text>
                </PressableScale>
              )}
            </>
          )}

          {phase === 'flight' && <Text style={styles.line}>Up it goes…</Text>}

          {(phase === 'landed' || phase === 'choose') && winner !== null && (
            <>
              <Text style={styles.won}>{names[Number(winner)]} win the toss</Text>
              {phase === 'choose' && (
                <>
                  <Text style={styles.line}>{callName(Number(winner) as 0 | 1)} chooses to</Text>
                  <View style={styles.choices}>
                    {(['bat', 'bowl'] as const).map((c) => (
                      <PressableScale key={c} scaleTo={0.95} wrapStyle={{ flex: 1 }} onPress={() => (tap('success'), onDone({ winner, choice: c }))} style={[styles.choice, c === 'bat' && styles.primary]}>
                        <MaterialCommunityIcons name={c === 'bat' ? 'cricket' : 'baseball'} size={18} color={c === 'bat' ? '#0A0D06' : hero.text} />
                        <Text style={[styles.choiceText, c === 'bat' && { color: '#0A0D06' }]}>{c === 'bat' ? 'Bat first' : 'Bowl first'}</Text>
                      </PressableScale>
                    ))}
                  </View>
                </>
              )}
            </>
          )}

          {phase === 'manual' && (
            <>
              <Text style={styles.line}>Who won the toss on the field?</Text>
              <View style={styles.choices}>
                {(['0', '1'] as const).map((w) => (
                  <PressableScale key={w} scaleTo={0.95} wrapStyle={{ flex: 1 }} onPress={() => setManualWinner(w)} style={[styles.choice, manualWinner === w && styles.primary]}>
                    <Text style={[styles.choiceText, manualWinner === w && { color: '#0A0D06' }]} numberOfLines={1}>
                      {names[Number(w)]}
                    </Text>
                  </PressableScale>
                ))}
              </View>
              <Text style={styles.line}>And they chose to</Text>
              <View style={styles.choices}>
                {(['bat', 'bowl'] as const).map((c) => (
                  <PressableScale key={c} scaleTo={0.95} wrapStyle={{ flex: 1 }} onPress={() => onDone({ winner: manualWinner, choice: c })} style={styles.choice}>
                    <Text style={styles.choiceText}>{c === 'bat' ? 'Bat first' : 'Bowl first'}</Text>
                  </PressableScale>
                ))}
              </View>
            </>
          )}

          {(phase === 'call' || phase === 'walk') && (
            <PressableScale onPress={() => setPhase('manual')} style={styles.manualLink}>
              <Text style={styles.manualText}>Done the toss on the field? Set it here</Text>
            </PressableScale>
          )}
        </View>
        {(phase === 'landed' || phase === 'choose') && <Confetti height={520} />}
      </LinearGradient>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: space.lg, overflow: 'hidden' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  close: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: hero.ink(0.08) },
  eyebrow: { ...type.label, color: hero.accent, letterSpacing: 2 },
  title: { fontFamily: font.posterBlack, fontSize: 32, lineHeight: 37, color: hero.text, textAlign: 'center', marginTop: space.md, letterSpacing: -0.8 },
  stage: { marginTop: space.lg, justifyContent: 'flex-end' },
  strip: {
    position: 'absolute',
    left: '30%',
    right: '30%',
    top: 30,
    bottom: 0,
    backgroundColor: 'rgba(214,196,140,0.14)',
    borderTopLeftRadius: 60,
    borderTopRightRadius: 60,
    transform: [{ perspective: 500 }, { rotateX: '35deg' }],
  },
  crease: { position: 'absolute', left: 8, right: 8, top: 40, height: 3, backgroundColor: hero.ink(0.55), borderRadius: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: 18 },
  slot: { width: '33%', alignItems: 'center' },
  figure: { alignItems: 'center' },
  cap: { width: 34, height: 12, borderTopLeftRadius: 16, borderTopRightRadius: 16, marginBottom: -4, zIndex: 1 },
  umpireHat: { width: 46, height: 10, borderRadius: 3 },
  head: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#C99A76' },
  shirt: { width: 54, height: 58, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderBottomLeftRadius: 8, borderBottomRightRadius: 8, marginTop: 3, alignItems: 'center', justifyContent: 'center' },
  shirtMark: { fontFamily: font.posterBlack, fontSize: 18, color: 'rgba(10,13,6,0.55)' },
  umpireTie: { width: 7, height: 26, backgroundColor: '#16191A', borderRadius: 2 },
  legs: { flexDirection: 'row', gap: 6 },
  leg: { width: 14, height: 26, backgroundColor: '#F1F1EC', borderBottomLeftRadius: 4, borderBottomRightRadius: 4 },
  figureName: { fontFamily: font.bold, fontSize: 13, color: hero.text, marginTop: 8, maxWidth: 110 },
  figureRole: { fontFamily: font.medium, fontSize: 10, color: hero.muted, marginTop: 1 },
  bubble: { backgroundColor: '#F4F4EF', borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 8, maxWidth: 120 },
  bubbleText: { fontFamily: font.heavy, fontSize: 12, color: '#0A0D06', textAlign: 'center' },
  coinWrap: { position: 'absolute', left: 0, top: 0, width: 36, height: 36 },
  coin: { width: 36, height: 36, borderRadius: 18, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#8A5F0E' },
  coinFace: { fontFamily: font.posterBlack, fontSize: 16, color: '#5A3B05' },
  shadow: { position: 'absolute', left: 0, top: 0, width: 36, height: 8, borderRadius: 4, backgroundColor: '#000' },
  panel: { flex: 1, justifyContent: 'center', gap: space.md, alignItems: 'stretch', marginTop: space.lg },
  line: { fontFamily: font.semibold, fontSize: 16, color: hero.muted, textAlign: 'center' },
  won: { fontFamily: font.posterBlack, fontSize: 30, lineHeight: 34, color: hero.accent, textAlign: 'center' },
  choices: { flexDirection: 'row', gap: space.md },
  choice: {
    flexDirection: 'row',
    gap: space.sm,
    height: 56,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: hero.ink(0.08),
    borderWidth: 1,
    borderColor: hero.line,
    paddingHorizontal: space.md,
  },
  primary: { backgroundColor: hero.accent, borderColor: hero.accent },
  choiceText: { fontFamily: font.bold, fontSize: 16, color: hero.text },
  manualLink: { alignSelf: 'center', padding: space.sm },
  manualText: { fontFamily: font.semibold, fontSize: 13, color: hero.faint, textDecorationLine: 'underline' },
});
