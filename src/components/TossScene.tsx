import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Modal, Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { font, hero, radius, space, type } from '../theme.ts';
import { Confetti, useReducedMotion } from './motion.tsx';
import { PressableScale, tap } from './ui.tsx';
import { FIGURE, Person, type Look } from './toss/Person.tsx';
import { STAGE, Stadium } from './toss/Stadium.tsx';

// The toss, out in the middle under the lights. The captains and the umpire walk out from the far end, the away
// captain calls, the home captain flicks the coin up, it spins high over the umpire, bounces and wobbles flat, the
// camera closes in on it, and the umpire points to the winner, who chooses to bat or bowl.

const native = Platform.OS !== 'web';
type Face = 'heads' | 'tails';
type Phase = 'intro' | 'call' | 'ready' | 'flight' | 'reveal' | 'result' | 'choose' | 'manual';
export type TossResult = { winner: '0' | '1'; choice: 'bat' | 'bowl' };

/** Where everyone stands on the 360 × 420 stage: their middle, their feet, and how near they are. */
const SPOTS = {
  home: { cx: 96, feet: 356, s: 1 },
  umpire: { cx: 180, feet: 332, s: 0.9 },
  away: { cx: 264, feet: 356, s: 1 },
};
/** The coin's path: from the home captain's raised hand, high over the umpire, onto the pitch in front of them. */
const COIN = 28;
const PATH = {
  t: [0, 0.42, 0.78, 0.84, 0.9, 0.94, 1],
  x: [129, 168, 184, 186, 188, 189, 190],
  y: [192, 18, 364, 348, 364, 360, 364],
};
const LANDED = { x: 190, y: 364 };

const deg = (v: Animated.Value) => v.interpolate({ inputRange: [-360, 360], outputRange: ['-360deg', '360deg'] });
const run = (v: Animated.Value, to: number, duration: number, easing = Easing.out(Easing.cubic), delay = 0) =>
  Animated.timing(v, { toValue: to, duration, easing, delay, useNativeDriver: native });

/** A figure that walks out from the far end of the pitch to their spot, and can hop. */
function Walker({ spot, walk, hop, children }: { spot: { cx: number; feet: number; s: number }; walk: Animated.Value; hop: Animated.Value; children: ReactNode }) {
  // The box sits so that, scaled by `s` about its middle, the feet land on the spot.
  const top = spot.feet - FIGURE.h / 2 - (FIGURE.h / 2) * spot.s;
  // From the far end: small, near the middle of the pitch.
  const far = { x: 180 + (spot.cx - 180) * 0.15, feet: 198, s: spot.s * 0.32 };
  const dx = far.x - spot.cx;
  const dy = far.feet - FIGURE.h / 2 - (FIGURE.h / 2) * far.s - top;
  const steps = Array.from({ length: 13 }, (_, i) => i / 12);
  const stride = walk.interpolate({ inputRange: steps, outputRange: steps.map((t, i) => (t === 1 ? 0 : i % 2 ? -3 : 0)) });
  const translateX = walk.interpolate({ inputRange: [0, 1], outputRange: [dx, 0] });
  const translateY = Animated.add(
    walk.interpolate({ inputRange: [0, 1], outputRange: [dy, 0], easing: Easing.out(Easing.quad) }),
    Animated.add(stride, hop.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -24, 0] })),
  );
  const scale = walk.interpolate({ inputRange: [0, 1], outputRange: [far.s, spot.s], easing: Easing.out(Easing.quad) });
  const opacity = walk.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 1] });
  return (
    <Animated.View pointerEvents="none" style={[styles.walker, { left: spot.cx - FIGURE.w / 2, top, opacity, transform: [{ translateX }, { translateY }, { scale }] }]}>
      {children}
    </Animated.View>
  );
}

/** A speech bubble over someone's head. */
function Bubble({ x, y, children, volt }: { x: number; y: number; children: ReactNode; volt?: boolean }) {
  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(pop, { toValue: 1, useNativeDriver: native, speed: 16, bounciness: 12 }).start();
  }, [pop]);
  return (
    <Animated.View pointerEvents="none" style={[styles.bubble, volt && { backgroundColor: hero.accent }, { left: x - 60, top: y, opacity: pop, transform: [{ scale: pop }] }]}>
      <Text style={styles.bubbleText} numberOfLines={1}>
        {children}
      </Text>
      <View style={[styles.bubbleTail, volt && { borderTopColor: hero.accent }]} />
    </Animated.View>
  );
}

/** The coin: gold, with a rim for its edge, a crown on heads and bat and ball on tails. */
function Coin({ face }: { face: Face }) {
  return (
    <View style={styles.coinBody}>
      <View style={styles.coinRim} />
      <LinearGradient colors={['#FFF0B0', '#F2C14E', '#B9851A', '#F7D477']} locations={[0, 0.35, 0.7, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.coinFace}>
        <View style={styles.coinRing} />
        <MaterialCommunityIcons name={face === 'heads' ? 'crown' : 'cricket'} size={15} color="#6B4708" />
      </LinearGradient>
    </View>
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
  const { width: screenW } = useWindowDimensions();
  const [phase, setPhase] = useState<Phase>('intro');
  const [call, setCall] = useState<Face | null>(null);
  const [face, setFace] = useState<Face | null>(null);
  const [manualWinner, setManualWinner] = useState<'0' | '1'>('0');

  // Everything that moves.
  const v = useRef({
    title: new Animated.Value(0),
    walk: [new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)],
    hop: [new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)],
    homeFront: new Animated.Value(-12),
    homeBack: new Animated.Value(10),
    awayFront: new Animated.Value(-12),
    awayBack: new Animated.Value(10),
    umpFront: new Animated.Value(-6),
    umpBack: new Animated.Value(6),
    flight: new Animated.Value(0),
    settle: new Animated.Value(0),
    zoom: new Animated.Value(0),
    reveal: new Animated.Value(0),
    spot: new Animated.Value(0),
  }).current;

  const short = (i: 0 | 1) => (captains[i] ? captains[i]!.trim().split(/\s+/)[0] : names[i]);
  const winner: '0' | '1' | null = face && call ? (face === call ? '1' : '0') : null;

  // Walk out from the far end, once the scene opens.
  useEffect(() => {
    if (!visible) return;
    setPhase('intro');
    setCall(null);
    setFace(null);
    for (const x of [v.flight, v.settle, v.zoom, v.reveal, v.spot, ...v.hop]) x.setValue(0);
    for (const x of v.walk) x.setValue(still ? 1 : 0);
    [v.homeFront, v.awayFront].forEach((x) => x.setValue(-12));
    [v.homeBack, v.awayBack].forEach((x) => x.setValue(10));
    v.umpFront.setValue(-6);
    v.umpBack.setValue(6);
    v.title.setValue(0);
    if (still) {
      setPhase('call');
      return;
    }
    Animated.sequence([run(v.title, 1, 500), Animated.delay(900), run(v.title, 2, 500)]).start();
    Animated.stagger(220, [
      run(v.walk[1], 1, 2000, Easing.out(Easing.quad), 300),
      run(v.walk[0], 1, 2000, Easing.out(Easing.quad), 300),
      run(v.walk[2], 1, 2000, Easing.out(Easing.quad), 300),
    ]).start(() => setPhase('call'));
  }, [visible, still, v]);

  const pick = (f: Face) => {
    tap('light');
    setCall(f);
    setPhase('ready');
  };

  const flip = () => {
    if (phase !== 'ready' || !call) return;
    const landed: Face = Math.random() < 0.5 ? 'heads' : 'tails';
    const won = landed === call ? 2 : 0;
    const ms = (n: number) => (still ? 1 : n);
    setPhase('flight');
    tap('medium');
    // The flick: the arm snaps up, the coin leaves the thumb, the arm comes back down.
    Animated.sequence([run(v.homeFront, -160, ms(200), Easing.out(Easing.back(2))), Animated.delay(ms(420)), run(v.homeFront, -12, ms(500))]).start();
    Animated.timing(v.flight, { toValue: 1, duration: ms(2100), delay: ms(160), easing: Easing.linear, useNativeDriver: native }).start(() => {
      setFace(landed);
      tap('light');
      // It wobbles flat like a spun coin, the camera closes in, and the face is read out.
      Animated.sequence([
        Animated.timing(v.settle, { toValue: 1, duration: ms(1100), easing: Easing.out(Easing.quad), useNativeDriver: native }),
        Animated.parallel([run(v.zoom, 1, ms(750), Easing.inOut(Easing.cubic)), run(v.reveal, 1, ms(500), Easing.out(Easing.back(1.6)), ms(450))]),
      ]).start(() => {
        setPhase('reveal');
        tap('success');
        setTimeout(() => {
          Animated.parallel([run(v.zoom, 0, ms(650), Easing.inOut(Easing.cubic)), run(v.reveal, 2, ms(400))]).start(() => {
            setPhase('result');
            // The umpire points to the winner; the winning captain punches the air and jumps; the light finds them.
            run(won === 2 ? v.umpFront : v.umpBack, won === 2 ? -95 : 95, ms(420), Easing.out(Easing.back(1.4))).start();
            run(won === 2 ? v.awayFront : v.homeFront, -172, ms(360), Easing.out(Easing.back(1.8)), ms(300)).start();
            run(v.spot, 1, ms(600), Easing.out(Easing.quad), ms(200)).start();
            const hop = v.hop[won];
            Animated.sequence([
              Animated.delay(ms(320)),
              run(hop, 1, ms(460), Easing.linear),
              Animated.timing(hop, { toValue: 0, duration: 0, useNativeDriver: native }),
              run(hop, 1, ms(460), Easing.linear),
              Animated.timing(hop, { toValue: 0, duration: 0, useNativeDriver: native }),
            ]).start();
            setTimeout(() => setPhase('choose'), ms(1200));
          });
        }, ms(1300));
      });
    });
  };

  // The camera: it follows the coin up a little, then closes in on it where it lands.
  const zoomTo = 2.3;
  const camX = v.zoom.interpolate({ inputRange: [0, 1], outputRange: [0, STAGE.w / 2 - (STAGE.w / 2 + (LANDED.x - STAGE.w / 2) * zoomTo)] });
  const follow = v.flight.interpolate({ inputRange: [0, 0.42, 0.78, 1], outputRange: [0, 46, 0, 0] });
  const camY = Animated.add(follow, v.zoom.interpolate({ inputRange: [0, 1], outputRange: [0, 236 - (STAGE.h / 2 + (LANDED.y - STAGE.h / 2) * zoomTo)] }));
  const camS = v.zoom.interpolate({ inputRange: [0, 1], outputRange: [1, zoomTo] });

  const along = (key: 'x' | 'y', delay = 0) =>
    v.flight.interpolate({ inputRange: PATH.t.map((t) => t + delay), outputRange: PATH[key].map((p) => p - COIN / 2), extrapolate: 'clamp' });
  const spin = v.flight.interpolate({ inputRange: [0, 0.78, 1], outputRange: ['0deg', '3240deg', '3330deg'] });
  const wobbleX = v.settle.interpolate({
    inputRange: [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1],
    outputRange: ['0deg', '-34deg', '-12deg', '-28deg', '-17deg', '-25deg', '-21deg', '-22deg'],
  });
  const wobbleZ = v.settle.interpolate({ inputRange: [0, 0.3, 0.6, 1], outputRange: ['0deg', '160deg', '260deg', '300deg'] });
  const grow = v.flight.interpolate({ inputRange: [0, 0.42, 0.78, 1], outputRange: [0.8, 1.25, 1, 1] });
  const ghost = (k: number) => v.flight.interpolate({ inputRange: [0, 0.04, 0.74, 0.78], outputRange: [0, 0.32 / k, 0.32 / k, 0], extrapolate: 'clamp' });
  const shadowOpacity = v.flight.interpolate({ inputRange: [0, 0.42, 0.78, 1], outputRange: [0.1, 0.03, 0.32, 0.32] });
  const shadowScale = v.flight.interpolate({ inputRange: [0, 0.42, 0.78, 1], outputRange: [0.6, 0.25, 1, 1] });

  // The stage is drawn at 360 × 420 and scaled to the screen's width (up to a tablet's).
  const fit = Math.min(screenW, 520);
  const k = fit / STAGE.w;
  const stageH = STAGE.h * k;
  const winnerSpot = winner === null ? null : winner === '0' ? SPOTS.home : SPOTS.away;
  const look = useMemo(
    () => ({
      home: { kind: 'captain', shirt: '#C6EE2A', cap: '#9CC41A', skin: '#C99A76' } as Look,
      away: { kind: 'captain', shirt: '#5FCFEF', cap: '#2E9FC2', skin: '#B9845F' } as Look,
      umpire: { kind: 'umpire', shirt: '#FFFFFF', cap: '#FFFFFF', skin: '#D2A684' } as Look,
    }),
    [],
  );
  const coinFlying = phase === 'flight' || phase === 'reveal' || phase === 'result' || phase === 'choose';

  return (
    <Modal visible={visible} animationType={still ? 'none' : 'fade'} onRequestClose={onClose}>
      <View style={styles.screen}>
        <View style={{ height: stageH, overflow: 'hidden' }}>
          <Animated.View
            style={[
              styles.stage,
              { left: (screenW - STAGE.w) / 2, top: (stageH - STAGE.h) / 2 },
              { transform: [{ scale: k }, { translateX: camX }, { translateY: camY }, { scale: camS }] },
            ]}
          >
            <Stadium />

            {/* The light swings onto the winner. */}
            {winnerSpot && (
              <Animated.View pointerEvents="none" style={[styles.spot, { left: winnerSpot.cx - 90, top: winnerSpot.feet - 150, opacity: v.spot }]}>
                <Svg width={180} height={170}>
                  <Defs>
                    <RadialGradient id="spotGlow" cx="0.5" cy="0.62" r="0.5">
                      <Stop offset="0" stopColor="#FFF8D6" stopOpacity="0.32" />
                      <Stop offset="1" stopColor="#FFF8D6" stopOpacity="0" />
                    </RadialGradient>
                  </Defs>
                  <Ellipse cx="90" cy="110" rx="90" ry="60" fill="url(#spotGlow)" />
                </Svg>
              </Animated.View>
            )}

            <Walker spot={SPOTS.umpire} walk={v.walk[1]} hop={v.hop[1]}>
              <Person look={look.umpire} id="ump" front={deg(v.umpFront)} back={deg(v.umpBack)} />
            </Walker>
            <Walker spot={SPOTS.home} walk={v.walk[0]} hop={v.hop[0]}>
              <Person look={look.home} id="home" front={deg(v.homeFront)} back={deg(v.homeBack)} />
            </Walker>
            <Walker spot={SPOTS.away} walk={v.walk[2]} hop={v.hop[2]}>
              <Person look={look.away} id="away" front={deg(v.awayFront)} back={deg(v.awayBack)} facing={-1} />
            </Walker>

            {/* The coin, its shadow and its blur. */}
            {coinFlying && (
              <>
                <Animated.View
                  pointerEvents="none"
                  style={[styles.shadow, { opacity: shadowOpacity, transform: [{ translateX: along('x') }, { translateY: LANDED.y - 1 }, { scaleX: shadowScale }] }]}
                />
                {[2, 1].map((g) => (
                  <Animated.View
                    key={g}
                    pointerEvents="none"
                    style={[styles.coin, { opacity: ghost(g + 1), transform: [{ translateX: along('x', g * 0.025) }, { translateY: along('y', g * 0.025) }, { scale: grow }] }]}
                  >
                    <Animated.View style={{ transform: [{ perspective: 300 }, { rotateX: spin }] }}>
                      <Coin face="heads" />
                    </Animated.View>
                  </Animated.View>
                ))}
                <Animated.View pointerEvents="none" style={[styles.coin, { transform: [{ translateX: along('x') }, { translateY: along('y') }, { scale: grow }] }]}>
                  <Animated.View style={{ transform: [{ perspective: 300 }, { rotateX: spin }, { rotateX: wobbleX }, { rotateZ: wobbleZ }] }}>
                    <Coin face={face ?? 'heads'} />
                  </Animated.View>
                </Animated.View>
              </>
            )}
            {/* Before the toss the coin is in the home captain's hand. */}
            {(phase === 'call' || phase === 'ready') && (
              <View pointerEvents="none" style={[styles.coin, { left: SPOTS.home.cx + 18 - COIN / 2, top: SPOTS.home.feet - 66 - COIN / 2, transform: [{ scale: 0.7 }] }]}>
                <Coin face="heads" />
              </View>
            )}

            {/* Who's saying what. */}
            {phase === 'call' && (
              <Bubble x={SPOTS.away.cx} y={SPOTS.away.feet - 206}>
                Heads or tails…
              </Bubble>
            )}
            {(phase === 'ready' || phase === 'flight') && call && (
              <>
                <Bubble x={SPOTS.away.cx} y={SPOTS.away.feet - 206}>
                  {call === 'heads' ? 'Heads!' : 'Tails!'}
                </Bubble>
                <Bubble x={SPOTS.home.cx} y={SPOTS.home.feet - 206}>
                  Here goes!
                </Bubble>
              </>
            )}
            {(phase === 'result' || phase === 'choose') && face && (
              <Bubble x={SPOTS.umpire.cx} y={SPOTS.umpire.feet - 196} volt>
                {`It's ${face}!`}
              </Bubble>
            )}
          </Animated.View>

          {/* The opening title, over the ground. */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.titleCard,
              {
                opacity: v.title.interpolate({ inputRange: [0, 1, 2], outputRange: [0, 1, 0] }),
                transform: [{ translateY: v.title.interpolate({ inputRange: [0, 1, 2], outputRange: [16, 0, -10] }) }],
              },
            ]}
          >
            <Text style={styles.titleEyebrow}>THE TOSS</Text>
            <Text style={styles.titleNames} numberOfLines={2}>
              {names[0]} <Text style={{ color: hero.accent }}>v</Text> {names[1]}
            </Text>
          </Animated.View>

          {/* The face, read out big as the camera closes in. */}
          {face && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.reveal,
                {
                  opacity: v.reveal.interpolate({ inputRange: [0, 1, 2], outputRange: [0, 1, 0] }),
                  transform: [{ scale: v.reveal.interpolate({ inputRange: [0, 1, 2], outputRange: [0.4, 1, 1.15] }) }],
                },
              ]}
            >
              <Text style={styles.revealText}>{face.toUpperCase()}</Text>
            </Animated.View>
          )}

          <LinearGradient pointerEvents="none" colors={['rgba(4,8,6,0)', 'rgba(4,8,6,1)']} style={styles.fade} />
          <PressableScale accessibilityLabel="Back to the teams" onPress={onClose} style={[styles.close, { top: insets.top + space.sm }]}>
            <MaterialCommunityIcons name="close" size={20} color={hero.text} />
          </PressableScale>
        </View>

        <View style={[styles.panel, { paddingBottom: insets.bottom + space.lg }]}>
          {phase === 'intro' && <Text style={styles.line}>Out to the middle…</Text>}

          {phase === 'call' && (
            <>
              <Text style={styles.line}>
                <Text style={styles.strong}>{short(1)}</Text> calls it
              </Text>
              <View style={styles.choices}>
                {(['heads', 'tails'] as Face[]).map((f) => (
                  <PressableScale key={f} scaleTo={0.95} wrapStyle={{ flex: 1 }} onPress={() => pick(f)} style={styles.choice}>
                    <MaterialCommunityIcons name={f === 'heads' ? 'crown' : 'cricket'} size={18} color={hero.gold} />
                    <Text style={styles.choiceText}>{f === 'heads' ? 'Heads' : 'Tails'}</Text>
                  </PressableScale>
                ))}
              </View>
            </>
          )}

          {phase === 'ready' && (
            <>
              <Text style={styles.line}>
                <Text style={styles.strong}>{short(1)}</Text> called {call}. Over to <Text style={styles.strong}>{short(0)}</Text>.
              </Text>
              <PressableScale scaleTo={0.96} wrapStyle={{ alignSelf: 'stretch' }} onPress={flip} style={[styles.choice, styles.primary]} accessibilityLabel="Flip the coin">
                <MaterialCommunityIcons name="hand-coin" size={20} color="#0A0D06" />
                <Text style={[styles.choiceText, { color: '#0A0D06' }]}>Flip the coin</Text>
              </PressableScale>
            </>
          )}

          {(phase === 'flight' || phase === 'reveal') && <Text style={styles.line}>{phase === 'flight' ? 'Up it goes…' : 'And it’s…'}</Text>}

          {(phase === 'result' || phase === 'choose') && winner !== null && (
            <>
              <Text style={styles.won}>{names[Number(winner)]} win the toss</Text>
              {phase === 'choose' && (
                <>
                  <Text style={styles.line}>
                    <Text style={styles.strong}>{short(Number(winner) as 0 | 1)}</Text> chooses to
                  </Text>
                  <View style={styles.choices}>
                    {(['bat', 'bowl'] as const).map((c) => (
                      <PressableScale
                        key={c}
                        scaleTo={0.95}
                        wrapStyle={{ flex: 1 }}
                        onPress={() => (tap('success'), onDone({ winner, choice: c }))}
                        style={[styles.choice, c === 'bat' && styles.primary]}
                      >
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
              <Text style={styles.line}>and they chose to</Text>
              <View style={styles.choices}>
                {(['bat', 'bowl'] as const).map((c) => (
                  <PressableScale key={c} scaleTo={0.95} wrapStyle={{ flex: 1 }} onPress={() => onDone({ winner: manualWinner, choice: c })} style={styles.choice}>
                    <Text style={styles.choiceText}>{c === 'bat' ? 'Bat first' : 'Bowl first'}</Text>
                  </PressableScale>
                ))}
              </View>
            </>
          )}

          {(phase === 'intro' || phase === 'call' || phase === 'ready') && (
            <PressableScale onPress={() => setPhase('manual')} style={styles.manualLink}>
              <Text style={styles.manualText}>Done the toss on the field? Set it here</Text>
            </PressableScale>
          )}
        </View>
        {(phase === 'result' || phase === 'choose') && <Confetti height={520} />}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#040806', overflow: 'hidden' },
  stage: { position: 'absolute', width: STAGE.w, height: STAGE.h },
  walker: { position: 'absolute', width: FIGURE.w, height: FIGURE.h },
  spot: { position: 'absolute', width: 180, height: 170 },
  coin: { position: 'absolute', left: 0, top: 0, width: COIN, height: COIN },
  coinBody: { width: COIN, height: COIN },
  coinRim: { position: 'absolute', left: 0, top: 2.5, width: COIN, height: COIN, borderRadius: COIN / 2, backgroundColor: '#8A5F0E' },
  coinFace: { width: COIN, height: COIN, borderRadius: COIN / 2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1.5, borderColor: '#A87517' },
  coinRing: { position: 'absolute', left: 3, top: 3, right: 3, bottom: 3, borderRadius: COIN, borderWidth: 1, borderColor: 'rgba(107,71,8,0.45)' },
  shadow: { position: 'absolute', left: 0, top: 0, width: COIN, height: 9, borderRadius: COIN, backgroundColor: '#000' },
  bubble: { position: 'absolute', width: 120, alignItems: 'center', backgroundColor: '#F4F4EF', borderRadius: radius.md, paddingHorizontal: 8, paddingVertical: 5 },
  bubbleText: { fontFamily: font.heavy, fontSize: 11, color: '#0A0D06' },
  bubbleTail: {
    position: 'absolute',
    bottom: -6,
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#F4F4EF',
  },
  titleCard: { position: 'absolute', left: space.lg, right: space.lg, top: '30%', alignItems: 'center' },
  titleEyebrow: { ...type.label, color: hero.accent, letterSpacing: 3 },
  titleNames: { fontFamily: font.posterBlack, fontSize: 38, lineHeight: 42, color: hero.text, textAlign: 'center', marginTop: space.sm, letterSpacing: -1 },
  reveal: { position: 'absolute', left: 0, right: 0, top: '16%', alignItems: 'center' },
  revealText: {
    fontFamily: font.posterBlack,
    fontSize: 64,
    lineHeight: 70,
    color: '#FFE38A',
    letterSpacing: 2,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 16,
  },
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 60 },
  close: { position: 'absolute', left: space.lg, width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.45)' },
  panel: { flex: 1, justifyContent: 'center', gap: space.md, paddingHorizontal: space.lg },
  line: { fontFamily: font.semibold, fontSize: 16, color: hero.muted, textAlign: 'center' },
  strong: { fontFamily: font.heavy, color: hero.text },
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
