import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Modal, Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Ellipse, RadialGradient, Rect, Stop } from 'react-native-svg';
import { font, hero, radius, space, type } from '../theme.ts';
import { Confetti, useReducedMotion } from './motion.tsx';
import { PressableScale, tap } from './ui.tsx';
import { FIGURE, newPose, Person, REST, STRIDE_MS, type Look, type Pose } from './toss/Person.tsx';
import { STAGE, Stadium } from './toss/Stadium.tsx';

// The toss, out in the middle under the lights, shot like television. It opens high on the floodlights and the crowd
// and cranes down as the captains and the umpire walk out from the far end. The away captain calls; the home captain
// flicks the coin. Everyone's eyes follow it up; it rises and slows, falls faster, bounces, wobbles flat, and the camera
// shakes with the landing and closes right in on the coin. Then it pulls back to the winner, the umpire points, the
// winner crouches and jumps with a fist in the air, the cameras in the crowd flash, and they choose to bat or bowl.

const native = Platform.OS !== 'web';
type Face = 'heads' | 'tails';
type Phase = 'intro' | 'call' | 'ready' | 'flight' | 'reveal' | 'result' | 'choose' | 'manual';
export type TossResult = { winner: '0' | '1'; choice: 'bat' | 'bowl' };

/** Where everyone stands on the 360 × 420 stage: their middle, their feet, and how near they are. */
const SPOTS = {
  home: { cx: 100, feet: 360, s: 1 },
  umpire: { cx: 180, feet: 340, s: 0.92 },
  away: { cx: 260, feet: 360, s: 1 },
};
type Spot = (typeof SPOTS)['home'];
/** Strides from the far end of the pitch to their spot, at an easy pace. */
const WALK_STRIDES = 3;
/** The coin's path: from the home captain's raised hand, high over the umpire, onto the pitch in front of them. */
const COIN = 26;
const PATH = {
  t: [0, 0.42, 0.78, 0.84, 0.9, 0.94, 1],
  x: [129, 162, 184, 186, 188, 189, 190],
  y: [168, 6, 366, 350, 366, 362, 366],
};
const LANDED = { x: 190, y: 366 };
/** The stage is drawn a little larger than the screen, so the camera can pull back without showing an edge. */
const SLACK = 1.12;

const run = (v: Animated.Value, to: number, duration: number, easing = Easing.out(Easing.cubic), delay = 0) =>
  Animated.timing(v, { toValue: to, duration, easing, delay, useNativeDriver: native });

/** A figure that walks out from the far end of the pitch towards us, to their spot, and can jump. */
function Walker({ spot, walk, hop, children }: { spot: Spot; walk: Animated.Value; hop: Animated.Value; children: ReactNode }) {
  // The box sits so that, scaled by `s` about its middle, the feet land on the spot.
  const top = spot.feet - FIGURE.h / 2 - (FIGURE.h / 2) * spot.s;
  // From the far end: small and near the middle of the pitch, growing as they come nearer.
  const far = { x: 180 + (spot.cx - 180) * 0.22, feet: 204, s: spot.s * 0.34 };
  const dx = far.x - spot.cx;
  const dy = far.feet - FIGURE.h / 2 - (FIGURE.h / 2) * far.s - top;
  // Perspective: the nearer they come, the faster they grow and the further they seem to travel.
  const ease = Easing.in(Easing.quad);
  const translateX = walk.interpolate({ inputRange: [0, 1], outputRange: [dx, 0], easing: ease });
  const translateY = Animated.add(
    walk.interpolate({ inputRange: [0, 1], outputRange: [dy, 0], easing: ease }),
    hop.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -30, 0], easing: Easing.inOut(Easing.sin) }),
  );
  const scale = walk.interpolate({ inputRange: [0, 1], outputRange: [far.s, spot.s], easing: ease });
  const opacity = walk.interpolate({ inputRange: [0, 0.08, 1], outputRange: [0, 1, 1] });
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
        <MaterialCommunityIcons name={face === 'heads' ? 'crown' : 'cricket'} size={14} color="#6B4708" />
      </LinearGradient>
    </View>
  );
}

/** Camera flashes popping in the stands. */
function Flashes({ on }: { on: Animated.Value }) {
  // Each pops at its own moment in the loop, kept clear of the loop's ends.
  const dots = useMemo(() => Array.from({ length: 16 }, (_, i) => ({ x: 14 + ((i * 97) % 332), y: 100 + ((i * 37) % 44), at: 0.06 + ((i * 0.137) % 1) * 0.88 })), []);
  return (
    <>
      {dots.map((d, i) => {
        const a = d.at - 0.04;
        const b = d.at + 0.04;
        return (
          <Animated.View
            key={i}
            pointerEvents="none"
            style={[styles.flash, { left: d.x, top: d.y, opacity: on.interpolate({ inputRange: [0, a, d.at, b, 1], outputRange: [0, 0, 1, 0, 0] }) }]}
          />
        );
      })}
    </>
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
  const ms = (n: number) => (still ? 1 : n);

  // Everything that moves: the people's joints, where they are, the coin and the camera.
  const v = useRef({
    title: new Animated.Value(0),
    walk: [new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)],
    hop: [new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)],
    pose: { home: newPose(), umpire: newPose(), away: newPose() } as Record<'home' | 'umpire' | 'away', Pose>,
    flight: new Animated.Value(0),
    settle: new Animated.Value(0),
    reveal: new Animated.Value(0),
    spot: new Animated.Value(0),
    flashes: new Animated.Value(0),
    cam: { s: new Animated.Value(1), x: new Animated.Value(0), y: new Animated.Value(0) },
  }).current;
  const poses = [v.pose.home, v.pose.umpire, v.pose.away];

  /** Move the camera: scale about the stage's middle, then shift (in stage units). */
  const camTo = (s: number, x: number, y: number, duration: number, easing = Easing.inOut(Easing.cubic)) =>
    Animated.parallel([run(v.cam.s, s, duration, easing), run(v.cam.x, x, duration, easing), run(v.cam.y, y, duration, easing)]);
  /** The shift that puts a point on the stage at a place on screen, at a scale. */
  const frame = (p: { x: number; y: number }, at: { x: number; y: number }, s: number) => ({
    x: at.x - (STAGE.w / 2 + (p.x - STAGE.w / 2) * s),
    y: at.y - (STAGE.h / 2 + (p.y - STAGE.h / 2) * s),
  });

  const short = (i: 0 | 1) => (captains[i] ? captains[i]!.trim().split(/\s+/)[0] : names[i]);
  const winner: '0' | '1' | null = face && call ? (face === call ? '1' : '0') : null;

  // The opening: high on the lights and the crowd, craning down as they walk out from the far end.
  useEffect(() => {
    if (!visible) return;
    setPhase('intro');
    setCall(null);
    setFace(null);
    for (const x of [v.flight, v.settle, v.reveal, v.spot, v.flashes, ...v.hop]) x.setValue(0);
    // The camera stands still: it only moves to follow the coin.
    v.cam.s.setValue(1);
    v.cam.x.setValue(0);
    v.cam.y.setValue(0);
    for (const p of poses) {
      p.frontShoulder.setValue(REST.frontShoulder);
      p.frontElbow.setValue(REST.frontElbow);
      p.backShoulder.setValue(REST.backShoulder);
      p.backElbow.setValue(REST.backElbow);
      p.head.setValue(0);
      p.gait.setValue(0);
      p.stride.setValue(0);
      p.crouch.setValue(0);
    }
    for (const x of v.walk) x.setValue(still ? 1 : 0);
    v.title.setValue(0);
    if (still) {
      setPhase('call');
      return;
    }
    Animated.sequence([run(v.title, 1, 600), Animated.delay(1100), run(v.title, 2, 600)]).start();
    // A steady walk towards us: whole strides at an easy pace, easing in as they set off and out as they stop.
    const walkOut = (i: number, delay: number) => {
      const strides = WALK_STRIDES;
      const duration = strides * STRIDE_MS;
      return Animated.parallel([
        run(v.walk[i], 1, duration, Easing.linear, delay),
        Animated.timing(poses[i].gait, { toValue: strides, duration, delay, easing: Easing.linear, useNativeDriver: native }),
        // Into the walk over the first half step, out of it over the last, feet together at the end.
        Animated.sequence([Animated.delay(delay), run(poses[i].stride, 1, 280, Easing.out(Easing.quad)), Animated.delay(duration - 560), run(poses[i].stride, 0, 280, Easing.in(Easing.quad))]),
      ]);
    };
    Animated.parallel([walkOut(1, 0), walkOut(0, 350), walkOut(2, 350)]).start(() => setPhase('call'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, still]);

  const pick = (f: Face) => {
    tap('light');
    setCall(f);
    setPhase('ready');
    // The away captain calls with a nod; the home captain readies the coin on the thumb.
    Animated.sequence([run(v.pose.away.head, 6, ms(160)), run(v.pose.away.head, 0, ms(220))]).start();
    Animated.parallel([run(v.pose.home.frontShoulder, -40, ms(380)), run(v.pose.home.frontElbow, -70, ms(380))]).start();
  };

  const flip = () => {
    if (phase !== 'ready' || !call) return;
    const landed: Face = Math.random() < 0.5 ? 'heads' : 'tails';
    const won = landed === call ? 2 : 0;
    setPhase('flight');
    tap('medium');
    const home = v.pose.home;
    // The flick: the arm snaps up and through, then comes back down.
    Animated.sequence([
      Animated.parallel([run(home.frontShoulder, -150, ms(170), Easing.out(Easing.quad)), run(home.frontElbow, -25, ms(170), Easing.out(Easing.quad))]),
      Animated.delay(ms(380)),
      Animated.parallel([run(home.frontShoulder, REST.frontShoulder, ms(600)), run(home.frontElbow, REST.frontElbow, ms(600))]),
    ]).start();
    // Every eye follows the coin: up as it rises, down as it falls, on it where it lands.
    for (const p of poses) Animated.sequence([run(p.head, -14, ms(700), Easing.out(Easing.quad), ms(150)), run(p.head, 8, ms(560), Easing.in(Easing.quad))]).start();
    // The coin rises and slows, falls faster, bounces; the camera pulls back to keep it in, then comes down with it.
    Animated.parallel([
      Animated.sequence([
        Animated.delay(ms(150)),
        Animated.timing(v.flight, { toValue: 0.42, duration: ms(820), easing: Easing.out(Easing.quad), useNativeDriver: native }),
        Animated.timing(v.flight, { toValue: 0.78, duration: ms(600), easing: Easing.in(Easing.quad), useNativeDriver: native }),
        Animated.timing(v.flight, { toValue: 1, duration: ms(520), easing: Easing.out(Easing.quad), useNativeDriver: native }),
      ]),
      // The camera's only move: it closes in on the coin and follows it up, then down to where it lands.
      (() => {
        const up = frame({ x: 160, y: 6 }, { x: STAGE.w / 2, y: 150 }, 1.3);
        const down = frame(LANDED, { x: STAGE.w / 2, y: 262 }, 1.7);
        return Animated.sequence([
          Animated.delay(ms(150)),
          camTo(1.3, up.x, up.y, ms(820), Easing.out(Easing.quad)),
          camTo(1.7, down.x, down.y, ms(600), Easing.in(Easing.quad)),
        ]);
      })(),
    ]).start(() => {
      setFace(landed);
      tap('light');
      // The coin wobbles flat and the camera closes right in on it.
      const close = frame(LANDED, { x: STAGE.w / 2, y: 238 }, 2.5);
      Animated.sequence([
        Animated.parallel([
          Animated.timing(v.settle, { toValue: 1, duration: ms(1100), easing: Easing.out(Easing.quad), useNativeDriver: native }),
          camTo(2.4, close.x, close.y, ms(900), Easing.inOut(Easing.cubic)),
          run(v.reveal, 1, ms(500), Easing.out(Easing.back(1.6)), ms(700)),
        ]),
      ]).start(() => {
        setPhase('reveal');
        tap('success');
        setTimeout(() => {
          // Back to the still shot of all three.
          Animated.parallel([camTo(1, 0, 0, ms(900)), run(v.reveal, 2, ms(400))]).start(() => {
            setPhase('result');
            const ump = v.pose.umpire;
            const pose = poses[won];
            const loser = poses[2 - won];
            // The umpire turns and points, arm straight.
            Animated.parallel([
              run(won === 2 ? ump.frontShoulder : ump.backShoulder, won === 2 ? -92 : 92, ms(420), Easing.out(Easing.back(1.3))),
              run(won === 2 ? ump.frontElbow : ump.backElbow, 0, ms(420)),
              run(ump.head, 0, ms(300)),
            ]).start();
            // The winner crouches, jumps with a fist up, twice; the other captain's head drops.
            Animated.parallel([run(pose.head, -4, ms(300)), run(loser.head, 6, ms(500), Easing.out(Easing.quad), ms(300))]).start();
            const jump = Animated.sequence([
              run(pose.crouch, 1, ms(170), Easing.out(Easing.quad)),
              Animated.parallel([run(pose.crouch, 0, ms(160), Easing.out(Easing.quad)), run(v.hop[won], 1, ms(520), Easing.linear)]),
              Animated.timing(v.hop[won], { toValue: 0, duration: 0, useNativeDriver: native }),
            ]);
            Animated.sequence([
              Animated.parallel([run(pose.frontShoulder, -168, ms(260), Easing.out(Easing.back(1.6))), run(pose.frontElbow, -12, ms(260)), run(pose.backShoulder, -30, ms(260)), run(pose.backElbow, -90, ms(260))]),
              jump,
              jump,
            ]).start();
            run(v.spot, 1, ms(700), Easing.out(Easing.quad), ms(150)).start();
            if (!still) Animated.loop(run(v.flashes, 1, 2400, Easing.linear)).start();
            setTimeout(() => setPhase('choose'), ms(1400));
          });
        }, ms(1400));
      });
    });
  };

  // The stage is drawn at 360 × 420, scaled to the screen's width (up to a tablet's), with room to pull back.
  const fit = Math.min(screenW, 520);
  const k = (fit / STAGE.w) * SLACK;
  const stageH = (STAGE.h * fit) / STAGE.w;
  const camX = v.cam.x;
  const camY = v.cam.y;

  const along = (key: 'x' | 'y', delay = 0) =>
    v.flight.interpolate({ inputRange: PATH.t.map((t) => t + delay), outputRange: PATH[key].map((p) => p - COIN / 2), extrapolate: 'clamp' });
  const spin = v.flight.interpolate({ inputRange: [0, 0.78, 1], outputRange: ['0deg', '3240deg', '3330deg'] });
  const wobbleX = v.settle.interpolate({
    inputRange: [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1],
    outputRange: ['0deg', '-34deg', '-12deg', '-28deg', '-17deg', '-25deg', '-21deg', '-22deg'],
  });
  const wobbleZ = v.settle.interpolate({ inputRange: [0, 0.3, 0.6, 1], outputRange: ['0deg', '160deg', '260deg', '300deg'] });
  const grow = v.flight.interpolate({ inputRange: [0, 0.42, 0.78, 1], outputRange: [0.8, 1.2, 1, 1] });
  const ghost = (n: number) => v.flight.interpolate({ inputRange: [0, 0.04, 0.74, 0.78], outputRange: [0, 0.3 / n, 0.3 / n, 0], extrapolate: 'clamp' });
  const shadowOpacity = v.flight.interpolate({ inputRange: [0, 0.42, 0.78, 1], outputRange: [0.1, 0.03, 0.32, 0.32] });
  const shadowScale = v.flight.interpolate({ inputRange: [0, 0.42, 0.78, 1], outputRange: [0.6, 0.25, 1, 1] });

  const winnerSpot = winner === null ? null : winner === '0' ? SPOTS.home : SPOTS.away;
  const look = useMemo(
    () => ({
      home: { kind: 'captain', shirt: '#B8E22A', trim: '#1F3A12', cap: '#8DB116', skin: '#C38E68', hair: '#2A1D16', face: 'stubble', number: '7' } satisfies Look,
      away: { kind: 'captain', shirt: '#4FC3E8', trim: '#0E2F4A', cap: '#2286AB', skin: '#A8714E', hair: '#16100C', face: 'beard', number: '18' } satisfies Look,
      umpire: { kind: 'umpire', shirt: '#FFFFFF', trim: '#1B1E1C', cap: '#FFFFFF', skin: '#D3A685', hair: '#9A9790', face: 'moustache' } satisfies Look,
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
              { transform: [{ scale: k }, { translateX: camX }, { translateY: camY }, { scale: v.cam.s }] },
            ]}
          >
            <Stadium />
            <Flashes on={v.flashes} />

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
              <Person look={look.umpire} id="ump" pose={v.pose.umpire} />
            </Walker>
            <Walker spot={SPOTS.home} walk={v.walk[0]} hop={v.hop[0]}>
              <Person look={look.home} id="home" pose={v.pose.home} />
            </Walker>
            <Walker spot={SPOTS.away} walk={v.walk[2]} hop={v.hop[2]}>
              <Person look={look.away} id="away" pose={v.pose.away} facing={-1} />
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

            {/* Before the flick the coin rests on the home captain's thumb. */}
            {phase === 'ready' && (
              <View pointerEvents="none" style={[styles.coin, { left: 159 - COIN / 2, top: 232 - COIN / 2, transform: [{ scale: 0.55 }] }]}>
                <Coin face="heads" />
              </View>
            )}

            {/* Who's saying what. */}
            {phase === 'call' && (
              <Bubble x={SPOTS.away.cx} y={SPOTS.away.feet - 214}>
                Heads or tails…
              </Bubble>
            )}
            {(phase === 'ready' || phase === 'flight') && call && (
              <>
                <Bubble x={SPOTS.away.cx} y={SPOTS.away.feet - 214}>
                  {call === 'heads' ? 'Heads!' : 'Tails!'}
                </Bubble>
                <Bubble x={SPOTS.home.cx} y={SPOTS.home.feet - 214}>
                  Here goes!
                </Bubble>
              </>
            )}
            {(phase === 'result' || phase === 'choose') && face && (
              <Bubble x={SPOTS.umpire.cx} y={SPOTS.umpire.feet - 200} volt>
                {`It's ${face}!`}
              </Bubble>
            )}
          </Animated.View>

          {/* A vignette, as through a lens. */}
          <Svg pointerEvents="none" width="100%" height="100%" style={StyleSheet.absoluteFill}>
            <Defs>
              <RadialGradient id="vignette" cx="0.5" cy="0.5" r="0.75">
                <Stop offset="0.55" stopColor="#000" stopOpacity="0" />
                <Stop offset="1" stopColor="#000" stopOpacity="0.55" />
              </RadialGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#vignette)" />
          </Svg>

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
  flash: { position: 'absolute', width: 3, height: 3, borderRadius: 2, backgroundColor: '#FFFFFF' },
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
  reveal: { position: 'absolute', left: 0, right: 0, top: '14%', alignItems: 'center' },
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
