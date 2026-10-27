import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Modal, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Ellipse, RadialGradient, Rect, Stop } from 'react-native-svg';
import { font, hero, radius, space, type } from '../theme.ts';
import { Confetti, useReducedMotion } from './motion.tsx';
import { PressableScale, tap } from './ui.tsx';
import { FIGURE, newPose, Person, REST, STRIDE_MS, type Look, type Pose } from './toss/Person.tsx';
import { STAGE, Stadium } from './toss/Stadium.tsx';

// The toss, out in the middle under the lights, shot like television. The captains and the umpire walk out from the
// far end; the umpire asks who's calling, that captain calls and the other tosses. The coin goes up, the picture drops
// into super slow motion at the top of its flight, it falls, bounces, wobbles flat, and the camera closes in on it.
// Then a replay of the landing, close up, before the umpire points to the winner, who celebrates, and the two captains
// meet in the middle and shake hands. The winner chooses, and the result goes up as a broadcast graphic.
// Every step can be skipped, and a quick toss settles it at once.

const native = Platform.OS !== 'web';
type Face = 'heads' | 'tails';
type Side = 0 | 1;
type Phase = 'intro' | 'who' | 'call' | 'ready' | 'flight' | 'reveal' | 'replay' | 'result' | 'choose' | 'banner' | 'manual';
export type TossResult = { winner: '0' | '1'; choice: 'bat' | 'bowl' };

/** Where everyone stands on the 360 × 420 stage: their middle, their feet, and how near they are. */
const SPOTS = {
  home: { cx: 100, feet: 360, s: 1 },
  umpire: { cx: 180, feet: 340, s: 0.92 },
  away: { cx: 260, feet: 360, s: 1 },
};
type Spot = (typeof SPOTS)['home'];
const spotOf = (side: Side) => (side === 0 ? SPOTS.home : SPOTS.away);
/** How far each captain steps in to shake hands. */
const MEET = 20;
/** Strides from the far end of the pitch to their spot, at an easy pace. */
const WALK_STRIDES = 3;
const COIN = 26;
/** The stage is drawn a little larger than the screen, so the camera can pull back without showing an edge. */
const SLACK = 1.12;
/** Where in the flight it reaches the top, hits the pitch, and the stretch shown in slow motion. */
const TOP = 0.42;
const HIT = 0.78;
const SLOW = [0.32, 0.52];

/**
 * The coin's path from the tosser's raised hand, high over the umpire, onto the pitch in front of them: a true arc up
 * and down (so the clock alone sets the speed, and slowing it is slow motion), then a few small bounces.
 */
function flightPath(tosser: Side, apex: number) {
  const m = (x: number) => (tosser === 0 ? x : STAGE.w - x);
  const start = { x: 129, y: 168 };
  const t: number[] = [];
  const x: number[] = [];
  const y: number[] = [];
  for (let i = 0; i <= 13; i++) {
    const at = (i / 13) * HIT;
    t.push(at);
    x.push(m(start.x + (184 - start.x) * (at / HIT)));
    y.push(at <= TOP ? apex + (start.y - apex) * ((TOP - at) / TOP) ** 2 : apex + (366 - apex) * ((at - TOP) / (HIT - TOP)) ** 2);
  }
  const bounce = { t: [0.81, 0.84, 0.87, 0.9, 0.93, 0.95, 0.97, 1], x: [185, 186, 187, 188, 188.6, 189, 189.4, 190], y: [354, 350, 354, 366, 362, 361, 362, 366] };
  return { t: [...t, ...bounce.t], x: [...x, ...bounce.x.map(m)], y: [...y, ...bounce.y], top: { x: m(start.x + (184 - start.x) * (TOP / HIT)), y: apex }, landed: { x: m(190), y: 366 } };
}

const run = (v: Animated.Value, to: number, duration: number, easing = Easing.out(Easing.cubic), delay = 0) =>
  Animated.timing(v, { toValue: to, duration, easing, delay, useNativeDriver: native });

/** A figure that walks out from the far end of the pitch towards us, to their spot, can jump, and step in to meet. */
function Walker({ spot, walk, hop, meet, children }: { spot: Spot; walk: Animated.Value; hop: Animated.Value; meet?: Animated.Value; children: ReactNode }) {
  // The box sits so that, scaled by `s` about its middle, the feet land on the spot.
  const top = spot.feet - FIGURE.h / 2 - (FIGURE.h / 2) * spot.s;
  // From the far end: small and near the middle of the pitch, growing as they come nearer.
  const far = { x: 180 + (spot.cx - 180) * 0.22, feet: 204, s: spot.s * 0.34 };
  const dx = far.x - spot.cx;
  const dy = far.feet - FIGURE.h / 2 - (FIGURE.h / 2) * far.s - top;
  // Perspective: the nearer they come, the faster they grow and the further they seem to travel.
  const ease = Easing.in(Easing.quad);
  const walkX = walk.interpolate({ inputRange: [0, 1], outputRange: [dx, 0], easing: ease });
  const translateX = meet ? Animated.add(walkX, meet.interpolate({ inputRange: [0, 1], outputRange: [0, spot.cx < 180 ? MEET : -MEET] })) : walkX;
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

/** The coin: gold, with a rim for its edge, a crown on heads and bat and ball on tails, and a glint across it. */
function Coin({ face }: { face: Face }) {
  return (
    <View style={styles.coinBody}>
      <View style={styles.coinRim} />
      <LinearGradient colors={['#FFF0B0', '#F2C14E', '#B9851A', '#F7D477']} locations={[0, 0.35, 0.7, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.coinFace}>
        <View style={styles.coinRing} />
        <MaterialCommunityIcons name={face === 'heads' ? 'crown' : 'cricket'} size={14} color="#6B4708" />
        <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
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

/** A broadcast tag in the corner of the picture: a live dot and a word. */
function OnAir({ show, label, color, right }: { show: Animated.Value | Animated.AnimatedInterpolation<number>; label: string; color: string; right?: boolean }) {
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.onAir,
        right ? { right: space.lg } : { left: space.lg + 48 },
        { opacity: show, transform: [{ translateY: (show as Animated.Value).interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }] },
      ]}
    >
      <View style={[styles.onAirDot, { backgroundColor: color }]} />
      <Text style={styles.onAirText}>{label}</Text>
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
  /** The two sides: the first stands on the left. */
  names: [string, string];
  /** Each side's captain, when one was picked. */
  captains: [string | null, string | null];
  onClose: () => void;
  onDone: (result: TossResult) => void;
}) {
  const insets = useSafeAreaInsets();
  const still = useReducedMotion();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const [phase, setPhase] = useState<Phase>('intro');
  const [tosser, setTosser] = useState<Side>(0);
  const [call, setCall] = useState<Face | null>(null);
  const [face, setFace] = useState<Face | null>(null);
  const [choice, setChoice] = useState<'bat' | 'bowl' | null>(null);
  const [throwOf, setThrowOf] = useState({ apex: 0, turns: 9 });
  const [manualWinner, setManualWinner] = useState<Side>(0);
  const ms = (n: number) => (still ? 1 : n);
  // Each run of the toss has its own number: a skip moves it on, and anything still waiting from before stops there.
  const take = useRef(0);
  const landedFace = useRef<Face>('heads');

  // Everything that moves: the people's joints, where they are, the coin, the camera and the broadcast graphics.
  const v = useRef({
    title: new Animated.Value(0),
    walk: [new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)],
    hop: [new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)],
    meet: new Animated.Value(0),
    pose: { home: newPose(), umpire: newPose(), away: newPose() } as Record<'home' | 'umpire' | 'away', Pose>,
    flight: new Animated.Value(0),
    settle: new Animated.Value(0),
    impact: new Animated.Value(0),
    reveal: new Animated.Value(0),
    spot: new Animated.Value(0),
    flashes: new Animated.Value(0),
    bars: new Animated.Value(0),
    slomo: new Animated.Value(0),
    replay: new Animated.Value(0),
    wipe: new Animated.Value(0),
    banner: new Animated.Value(0),
    cam: { s: new Animated.Value(1), x: new Animated.Value(0), y: new Animated.Value(0) },
  }).current;
  const poses = [v.pose.home, v.pose.umpire, v.pose.away];
  /** A side's captain's pose: home on the left, away on the right. */
  const poseOf = (side: Side) => (side === 0 ? v.pose.home : v.pose.away);
  const path = useMemo(() => flightPath(tosser, throwOf.apex), [tosser, throwOf.apex]);

  /** Move the camera: scale about the stage's middle, then shift (in stage units). */
  const camTo = (s: number, x: number, y: number, duration: number, easing = Easing.inOut(Easing.cubic)) =>
    Animated.parallel([run(v.cam.s, s, duration, easing), run(v.cam.x, x, duration, easing), run(v.cam.y, y, duration, easing)]);
  /** The shift that puts a point on the stage at a place on screen, at a scale. */
  const frame = (p: { x: number; y: number }, at: { x: number; y: number }, s: number) => ({
    x: at.x - (STAGE.w / 2 + (p.x - STAGE.w / 2) * s),
    y: at.y - (STAGE.h / 2 + (p.y - STAGE.h / 2) * s),
  });

  const full = (i: Side) => captains[i] ?? names[i];
  const short = (i: Side) => (captains[i] ? captains[i]!.trim().split(/\s+/)[0] : names[i]);
  const caller: Side = tosser === 0 ? 1 : 0;
  const winner: Side | null = face && call ? (face === call ? caller : tosser) : null;

  const resetPose = (p: Pose) => {
    p.frontShoulder.setValue(REST.frontShoulder);
    p.frontElbow.setValue(REST.frontElbow);
    p.backShoulder.setValue(REST.backShoulder);
    p.backElbow.setValue(REST.backElbow);
    p.head.setValue(0);
    p.gait.setValue(0);
    p.stride.setValue(0);
    p.crouch.setValue(0);
  };
  const stopAll = () => {
    for (const x of [v.title, v.meet, v.flight, v.settle, v.impact, v.reveal, v.spot, v.bars, v.slomo, v.replay, v.wipe, v.banner, v.cam.s, v.cam.x, v.cam.y, ...v.walk, ...v.hop])
      x.stopAnimation();
    for (const p of poses) for (const x of Object.values(p)) x.stopAnimation();
  };

  // The opening: the title over the ground as they walk out from the far end.
  useEffect(() => {
    if (!visible) return;
    take.current += 1;
    stopAll();
    setPhase('intro');
    setCall(null);
    setFace(null);
    setChoice(null);
    for (const x of [v.meet, v.flight, v.settle, v.impact, v.reveal, v.spot, v.flashes, v.bars, v.slomo, v.replay, v.wipe, v.banner, ...v.hop]) x.setValue(0);
    v.cam.s.setValue(1);
    v.cam.x.setValue(0);
    v.cam.y.setValue(0);
    for (const p of poses) resetPose(p);
    for (const x of v.walk) x.setValue(still ? 1 : 0);
    v.title.setValue(0);
    if (still) {
      setPhase('who');
      return;
    }
    const id = take.current;
    Animated.sequence([run(v.title, 1, 600), Animated.delay(1100), run(v.title, 2, 600)]).start();
    // A steady walk towards us: whole strides at an easy pace, easing in as they set off and out as they stop.
    const walkOut = (i: number, delay: number) => {
      const duration = WALK_STRIDES * STRIDE_MS;
      return Animated.parallel([
        run(v.walk[i], 1, duration, Easing.linear, delay),
        Animated.timing(poses[i].gait, { toValue: WALK_STRIDES, duration, delay, easing: Easing.linear, useNativeDriver: native }),
        Animated.sequence([Animated.delay(delay), run(poses[i].stride, 1, 280, Easing.out(Easing.quad)), Animated.delay(duration - 560), run(poses[i].stride, 0, 280, Easing.in(Easing.quad))]),
      ]);
    };
    Animated.parallel([walkOut(1, 0), walkOut(0, 350), walkOut(2, 350)]).start(({ finished }) => finished && take.current === id && setPhase('who'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, still]);

  /** Skip the walk out: everyone's at their spot at once. */
  const skipWalk = () => {
    take.current += 1;
    stopAll();
    v.title.setValue(2);
    for (const x of v.walk) x.setValue(1);
    for (const p of poses) resetPose(p);
    setPhase('who');
  };

  const chooseCaller = (side: Side) => {
    tap('light');
    setTosser(side === 0 ? 1 : 0);
    setPhase('call');
    // The umpire turns to the one calling.
    run(v.pose.umpire.head, side === 0 ? -5 : 5, ms(300)).start();
  };

  const pick = (f: Face) => {
    tap('light');
    setCall(f);
    setPhase('ready');
    const callerPose = poseOf(tosser === 0 ? 1 : 0);
    const tosserPose = poseOf(tosser);
    // The caller calls with a nod; the tosser readies the coin on the thumb; the umpire looks to the coin.
    Animated.sequence([run(callerPose.head, 6, ms(160)), run(callerPose.head, 0, ms(220))]).start();
    Animated.parallel([run(tosserPose.frontShoulder, -40, ms(380)), run(tosserPose.frontElbow, -70, ms(380)), run(v.pose.umpire.head, 0, ms(300))]).start();
  };

  /** The coin comes down: the replay, then the result. Shared by the full toss and the skip. */
  const toResult = (won: Side, quick = false) => {
    const id = take.current;
    setPhase('result');
    tap('success');
    const ump = v.pose.umpire;
    const winPose = poseOf(won);
    const losePose = poseOf(won === 0 ? 1 : 0);
    // The umpire points to the winner, arm straight.
    Animated.parallel([
      run(won === 1 ? ump.frontShoulder : ump.backShoulder, won === 1 ? -92 : 92, ms(420), Easing.out(Easing.back(1.3))),
      run(won === 1 ? ump.frontElbow : ump.backElbow, 0, ms(420)),
      run(ump.head, 0, ms(300)),
    ]).start();
    Animated.parallel([run(winPose.head, -4, ms(300)), run(losePose.head, 6, ms(500), Easing.out(Easing.quad), ms(300))]).start();
    run(v.spot, 1, ms(700), Easing.out(Easing.quad), ms(150)).start();
    if (!still) Animated.loop(run(v.flashes, 1, 2400, Easing.linear)).start();
    // The winner crouches and jumps with a fist up.
    const hop = v.hop[won === 0 ? 0 : 2];
    const celebrate = Animated.sequence([
      Animated.parallel([run(winPose.frontShoulder, -168, ms(260), Easing.out(Easing.back(1.6))), run(winPose.frontElbow, -12, ms(260)), run(winPose.backShoulder, -30, ms(260)), run(winPose.backElbow, -90, ms(260))]),
      run(winPose.crouch, 1, ms(170), Easing.out(Easing.quad)),
      Animated.parallel([run(winPose.crouch, 0, ms(160), Easing.out(Easing.quad)), run(hop, 1, ms(520), Easing.linear)]),
      Animated.timing(hop, { toValue: 0, duration: 0, useNativeDriver: native }),
      Animated.delay(ms(250)),
      Animated.parallel([
        run(winPose.frontShoulder, REST.frontShoulder, ms(320)),
        run(winPose.frontElbow, REST.frontElbow, ms(320)),
        run(winPose.backShoulder, REST.backShoulder, ms(320)),
        run(winPose.backElbow, REST.backElbow, ms(320)),
        run(ump.frontShoulder, REST.frontShoulder, ms(420)),
        run(ump.frontElbow, REST.frontElbow, ms(420)),
        run(ump.backShoulder, REST.backShoulder, ms(420)),
        run(ump.backElbow, REST.backElbow, ms(420)),
        run(losePose.head, 0, ms(320)),
      ]),
    ]);
    if (quick) {
      setPhase('choose');
      celebrate.start();
      return;
    }
    // Then the captains step in to each other and shake hands, while the winner makes up their mind.
    const home = v.pose.home;
    const away = v.pose.away;
    const step = (p: Pose) =>
      Animated.parallel([
        Animated.timing(p.gait, { toValue: 1, duration: ms(STRIDE_MS), easing: Easing.linear, useNativeDriver: native }),
        Animated.sequence([run(p.stride, 1, ms(200), Easing.out(Easing.quad)), Animated.delay(ms(STRIDE_MS - 400)), run(p.stride, 0, ms(200), Easing.in(Easing.quad))]),
      ]);
    const reach = (to: number, elbow: number, d: number) =>
      Animated.parallel([run(home.frontShoulder, to, d), run(home.frontElbow, elbow, d), run(away.frontShoulder, to, d), run(away.frontElbow, elbow, d)]);
    const shake = (n: number) =>
      Animated.sequence(
        Array.from({ length: n }, () =>
          Animated.sequence([
            Animated.parallel([run(home.frontElbow, -32, ms(150), Easing.inOut(Easing.sin)), run(away.frontElbow, -32, ms(150), Easing.inOut(Easing.sin))]),
            Animated.parallel([run(home.frontElbow, -52, ms(150), Easing.inOut(Easing.sin)), run(away.frontElbow, -52, ms(150), Easing.inOut(Easing.sin))]),
          ]),
        ),
      );
    celebrate.start(({ finished }) => {
      if (!finished || take.current !== id) return;
      setPhase('choose');
      home.gait.setValue(0);
      away.gait.setValue(0);
      Animated.sequence([
        Animated.parallel([run(v.meet, 1, ms(STRIDE_MS), Easing.inOut(Easing.quad)), step(home), step(away)]),
        reach(-35, -45, ms(320)),
        shake(3),
        Animated.delay(ms(200)),
        reach(REST.frontShoulder, REST.frontElbow, ms(380)),
      ]).start();
    });
  };

  /** The toss itself. `quick` settles it at once, with no flight. */
  const toss = (quick = false) => {
    if (phase !== 'ready' || !call) return;
    const id = (take.current += 1);
    const landed: Face = Math.random() < 0.5 ? 'heads' : 'tails';
    landedFace.current = landed;
    const won: Side = landed === call ? caller : tosser;
    const tosserPose = poseOf(tosser);
    if (quick || still) {
      v.flight.setValue(1);
      v.settle.setValue(1);
      setFace(landed);
      setPhase('flight');
      Animated.parallel([run(tosserPose.frontShoulder, REST.frontShoulder, ms(300)), run(tosserPose.frontElbow, REST.frontElbow, ms(300))]).start();
      Animated.sequence([run(v.reveal, 1, ms(380), Easing.out(Easing.back(1.6))), Animated.delay(ms(700)), run(v.reveal, 2, ms(300))]).start();
      toResult(won, true);
      return;
    }
    // Each toss goes up its own height, with its own number of turns: no two look the same.
    const apex = -40 + Math.random() * 60;
    const turns = 8 + Math.floor(Math.random() * 4);
    setThrowOf({ apex, turns });
    const p = flightPath(tosser, apex);
    setPhase('flight');
    tap('medium');
    // The flick: the arm snaps up and through, then comes back down.
    Animated.sequence([
      Animated.parallel([run(tosserPose.frontShoulder, -150, 170, Easing.out(Easing.quad)), run(tosserPose.frontElbow, -25, 170, Easing.out(Easing.quad))]),
      Animated.delay(380),
      Animated.parallel([run(tosserPose.frontShoulder, REST.frontShoulder, 600), run(tosserPose.frontElbow, REST.frontElbow, 600)]),
    ]).start();
    // Every eye follows the coin: up as it rises, held at the top, down as it falls.
    for (const pose of poses) Animated.sequence([run(pose.head, -14, 700, Easing.out(Easing.quad), 150), Animated.delay(1000), run(pose.head, 8, 520, Easing.in(Easing.quad))]).start();
    const up = frame(p.top, { x: STAGE.w / 2, y: 150 }, 1.3);
    const down = frame(p.landed, { x: STAGE.w / 2, y: 262 }, 1.7);
    const at = (to: number, duration: number) => Animated.timing(v.flight, { toValue: to, duration, easing: Easing.linear, useNativeDriver: native });
    Animated.parallel([
      run(v.bars, 1, 500, Easing.out(Easing.cubic)),
      // Up quickly, then slow motion over the top, then down at full speed.
      Animated.sequence([
        Animated.delay(150),
        at(SLOW[0], 560),
        Animated.parallel([at(SLOW[1], 1300), Animated.sequence([run(v.slomo, 1, 200), Animated.delay(900), run(v.slomo, 0, 200)])]),
        at(HIT, 470),
        at(1, 560),
      ]),
      // The camera's only move: in on the coin as it rises, holding at the top, then down to where it lands.
      Animated.sequence([Animated.delay(150), camTo(1.3, up.x, up.y, 760, Easing.out(Easing.quad)), Animated.delay(1100), camTo(1.7, down.x, down.y, 520, Easing.in(Easing.quad))]),
    ]).start(({ finished }) => {
      if (!finished || take.current !== id) return;
      setFace(landed);
      tap('light');
      // It lands: a ripple on the pitch; the coin wobbles flat and the camera closes right in on it.
      const close = frame(p.landed, { x: STAGE.w / 2, y: 238 }, 2.5);
      run(v.impact, 1, 700, Easing.out(Easing.quad)).start();
      Animated.parallel([
        Animated.timing(v.settle, { toValue: 1, duration: 1100, easing: Easing.out(Easing.quad), useNativeDriver: native }),
        camTo(2.4, close.x, close.y, 900, Easing.inOut(Easing.cubic)),
        run(v.reveal, 1, 500, Easing.out(Easing.back(1.6)), 700),
      ]).start(({ finished: done }) => {
        if (!done || take.current !== id) return;
        setPhase('reveal');
        tap('success');
        // The replay: a wipe, the landing again in slow motion, a wipe back to the wide shot.
        Animated.sequence([Animated.delay(900), run(v.reveal, 2, 300), run(v.wipe, 0.5, 320, Easing.in(Easing.quad))]).start(({ finished: wiped }) => {
          if (!wiped || take.current !== id) return;
          setPhase('replay');
          v.flight.setValue(0.6);
          v.settle.setValue(0);
          v.impact.setValue(0);
          v.replay.setValue(1);
          const closer = frame(p.landed, { x: STAGE.w / 2, y: 250 }, 2.2);
          v.cam.s.setValue(2.2);
          v.cam.x.setValue(closer.x);
          v.cam.y.setValue(closer.y);
          Animated.sequence([
            run(v.wipe, 1, 320, Easing.out(Easing.quad)),
            Animated.parallel([
              Animated.timing(v.flight, { toValue: 1, duration: 1500, easing: Easing.linear, useNativeDriver: native }),
              Animated.sequence([Animated.delay(560), run(v.impact, 1, 1000, Easing.out(Easing.quad))]),
              Animated.sequence([Animated.delay(560), Animated.timing(v.settle, { toValue: 1, duration: 1700, easing: Easing.out(Easing.quad), useNativeDriver: native })]),
            ]),
            Animated.delay(250),
            Animated.parallel([run(v.wipe, 0, 0), run(v.replay, 0, 250)]),
            Animated.parallel([camTo(1, 0, 0, 900), run(v.bars, 0, 600)]),
          ]).start(({ finished: over }) => over && take.current === id && toResult(won));
        });
      });
    });
  };

  /** Straight to the result from anywhere in the flight or the replay. */
  const skipToResult = () => {
    if (!(phase === 'flight' || phase === 'reveal' || phase === 'replay') || !call) return;
    take.current += 1;
    stopAll();
    v.flight.setValue(1);
    v.settle.setValue(1);
    v.impact.setValue(0);
    v.reveal.setValue(2);
    v.wipe.setValue(0);
    v.replay.setValue(0);
    v.slomo.setValue(0);
    v.bars.setValue(0);
    v.cam.s.setValue(1);
    v.cam.x.setValue(0);
    v.cam.y.setValue(0);
    for (const p of poses) resetPose(p);
    const landed = landedFace.current;
    setFace(landed);
    toResult(landed === call ? caller : tosser, true);
  };

  const decide = (c: 'bat' | 'bowl') => {
    if (winner === null) return;
    tap('success');
    setChoice(c);
    setPhase('banner');
    const id = take.current;
    v.banner.setValue(0);
    // It stays up a moment once it's all in, then the match starts (or sooner, with a tap).
    run(v.banner, 1, ms(900), Easing.out(Easing.cubic)).start(() => setTimeout(() => take.current === id && finish(winner, c), ms(2300)));
  };
  const finish = (w: Side, c: 'bat' | 'bowl') => {
    take.current += 1;
    onDone({ winner: w === 0 ? '0' : '1', choice: c });
  };

  // The stage is drawn at 360 × 420, scaled to the screen's width (up to a tablet's), with room to pull back.
  const fit = Math.min(screenW, 520);
  const k = (fit / STAGE.w) * SLACK;
  const stageH = (STAGE.h * fit) / STAGE.w;

  const along = (key: 'x' | 'y', delay = 0) =>
    v.flight.interpolate({ inputRange: path.t.map((t) => t + delay), outputRange: path[key].map((n) => n - COIN / 2), extrapolate: 'clamp' });
  const turn = throwOf.turns * 360;
  const spin = v.flight.interpolate({ inputRange: [0, HIT, 1], outputRange: ['0deg', `${turn}deg`, `${turn + 90}deg`] });
  const wobbleX = v.settle.interpolate({
    inputRange: [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1],
    outputRange: ['0deg', '-34deg', '-12deg', '-28deg', '-17deg', '-25deg', '-21deg', '-22deg'],
  });
  const wobbleZ = v.settle.interpolate({ inputRange: [0, 0.3, 0.6, 1], outputRange: ['0deg', '160deg', '260deg', '300deg'] });
  const grow = v.flight.interpolate({ inputRange: [0, TOP, HIT, 1], outputRange: [0.8, 1.2, 1, 1] });
  const ghost = (n: number) => v.flight.interpolate({ inputRange: [0, 0.04, HIT - 0.04, HIT], outputRange: [0, 0.3 / n, 0.3 / n, 0], extrapolate: 'clamp' });
  const shadowOpacity = v.flight.interpolate({ inputRange: [0, TOP, HIT, 1], outputRange: [0.1, 0.03, 0.32, 0.32] });
  const shadowScale = v.flight.interpolate({ inputRange: [0, TOP, HIT, 1], outputRange: [0.6, 0.25, 1, 1] });

  const winnerSpot = winner === null ? null : spotOf(winner);
  const look = useMemo(
    () => ({
      home: { kind: 'captain', shirt: '#B8E22A', trim: '#1F3A12', cap: '#8DB116', skin: '#C38E68', hair: '#2A1D16', face: 'stubble', number: '7' } satisfies Look,
      away: { kind: 'captain', shirt: '#4FC3E8', trim: '#0E2F4A', cap: '#2286AB', skin: '#A8714E', hair: '#16100C', face: 'beard', number: '18' } satisfies Look,
      umpire: { kind: 'umpire', shirt: '#FFFFFF', trim: '#1B1E1C', cap: '#FFFFFF', skin: '#D3A685', hair: '#9A9790', face: 'moustache' } satisfies Look,
    }),
    [],
  );
  const coinFlying = phase === 'flight' || phase === 'reveal' || phase === 'replay' || phase === 'result' || phase === 'choose' || phase === 'banner';
  const skippable = phase === 'flight' || phase === 'reveal' || phase === 'replay';
  const thumb = { x: tosser === 0 ? 159 : STAGE.w - 159, y: 232 };
  const barH = stageH * 0.09;

  return (
    <Modal visible={visible} animationType={still ? 'none' : 'fade'} onRequestClose={onClose}>
      <View style={styles.screen}>
        <Pressable disabled={!skippable} onPress={skipToResult} style={{ height: stageH, overflow: 'hidden' }} accessibilityLabel={skippable ? 'Skip to the result' : undefined}>
          <Animated.View
            style={[
              styles.stage,
              { left: (screenW - STAGE.w) / 2, top: (stageH - STAGE.h) / 2 },
              { transform: [{ scale: k }, { translateX: v.cam.x }, { translateY: v.cam.y }, { scale: v.cam.s }] },
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

            {/* Where it lands: a ring of light spreading on the pitch. */}
            {coinFlying && (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.impact,
                  {
                    left: path.landed.x - 30,
                    top: path.landed.y - 8,
                    opacity: v.impact.interpolate({ inputRange: [0, 0.1, 1], outputRange: [0, 0.9, 0] }),
                    transform: [{ scaleX: v.impact.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1.6] }) }, { scaleY: v.impact.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1.3] }) }],
                  },
                ]}
              />
            )}

            <Walker spot={SPOTS.home} walk={v.walk[0]} hop={v.hop[0]} meet={v.meet}>
              <Person look={look.home} id="home" pose={v.pose.home} />
            </Walker>
            <Walker spot={SPOTS.away} walk={v.walk[2]} hop={v.hop[2]} meet={v.meet}>
              <Person look={look.away} id="away" pose={v.pose.away} facing={-1} />
            </Walker>

            {/* The coin, its shadow and its blur. */}
            {coinFlying && (
              <>
                <Animated.View
                  pointerEvents="none"
                  style={[styles.shadow, { opacity: shadowOpacity, transform: [{ translateX: along('x') }, { translateY: path.landed.y - 1 }, { scaleX: shadowScale }] }]}
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

            {/* Before the toss the coin rests on the tosser's thumb. */}
            {phase === 'ready' && (
              <View pointerEvents="none" style={[styles.coin, { left: thumb.x - COIN / 2, top: thumb.y - COIN / 2, transform: [{ scale: 0.55 }] }]}>
                <Coin face="heads" />
              </View>
            )}

            {/* Who's saying what. */}
            {phase === 'who' && (
              <Bubble x={SPOTS.umpire.cx} y={SPOTS.umpire.feet - 200}>
                Who's calling?
              </Bubble>
            )}
            {phase === 'call' && (
              <Bubble x={spotOf(caller).cx} y={spotOf(caller).feet - 214}>
                Heads or tails…
              </Bubble>
            )}
            {(phase === 'ready' || phase === 'flight') && call && (
              <>
                <Bubble x={spotOf(caller).cx} y={spotOf(caller).feet - 214}>
                  {call === 'heads' ? 'Heads!' : 'Tails!'}
                </Bubble>
                {phase === 'ready' && (
                  <Bubble x={spotOf(tosser).cx} y={spotOf(tosser).feet - 214}>
                    Here goes!
                  </Bubble>
                )}
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

          {/* The picture goes wide for the flight: bars top and bottom. */}
          <Animated.View pointerEvents="none" style={[styles.bar, { top: 0, height: barH, transform: [{ translateY: v.bars.interpolate({ inputRange: [0, 1], outputRange: [-barH, 0] }) }] }]} />
          <Animated.View pointerEvents="none" style={[styles.bar, { bottom: 0, height: barH, transform: [{ translateY: v.bars.interpolate({ inputRange: [0, 1], outputRange: [barH, 0] }) }] }]} />

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

          <OnAir show={v.slomo} label="SUPER SLO-MO" color="#FF3B30" right />
          <OnAir show={v.replay} label="REPLAY" color={hero.accent} right />

          {/* The replay's wipe: a volt band sweeping across the picture. */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.wipe,
              {
                width: screenW * 1.6,
                left: -screenW * 0.3,
                transform: [{ translateX: v.wipe.interpolate({ inputRange: [0, 0.5, 1], outputRange: [-screenW * 1.7, 0, screenW * 1.7] }) }, { skewX: '-18deg' }],
              },
            ]}
          >
            <View style={[styles.wipeEdge, { backgroundColor: hero.accent }]} />
            <View style={styles.wipeBody}>
              <Text style={styles.wipeText}>REPLAY</Text>
            </View>
            <View style={[styles.wipeEdge, { backgroundColor: hero.accent }]} />
          </Animated.View>

          <LinearGradient pointerEvents="none" colors={['rgba(4,8,6,0)', 'rgba(4,8,6,1)']} style={styles.fade} />
          <PressableScale accessibilityLabel="Back to the teams" onPress={onClose} style={[styles.close, { top: insets.top + space.sm }]}>
            <MaterialCommunityIcons name="close" size={20} color={hero.text} />
          </PressableScale>
          {(phase === 'intro' || skippable) && (
            <PressableScale onPress={phase === 'intro' ? skipWalk : skipToResult} style={[styles.skip, { top: insets.top + space.sm }]}>
              <Text style={styles.skipText}>Skip</Text>
              <MaterialCommunityIcons name="chevron-double-right" size={16} color={hero.text} />
            </PressableScale>
          )}
        </Pressable>

        <View style={[styles.panel, { paddingBottom: insets.bottom + space.lg }]}>
          {phase === 'intro' && <Text style={styles.line}>Out to the middle…</Text>}

          {phase === 'who' && (
            <>
              <Text style={styles.line}>Who calls the toss?</Text>
              <View style={styles.choices}>
                {([0, 1] as Side[]).map((s) => (
                  <PressableScale key={s} scaleTo={0.95} wrapStyle={{ flex: 1 }} onPress={() => chooseCaller(s)} style={[styles.choice, styles.tall]}>
                    <Text style={styles.choiceText} numberOfLines={1}>
                      {full(s)}
                    </Text>
                    {captains[s] && (
                      <Text style={styles.choiceSub} numberOfLines={1}>
                        {names[s]}
                      </Text>
                    )}
                  </PressableScale>
                ))}
              </View>
            </>
          )}

          {phase === 'call' && (
            <>
              <Text style={styles.line}>
                <Text style={styles.strong}>{short(caller)}</Text> calls it
              </Text>
              <View style={styles.choices}>
                {(['heads', 'tails'] as Face[]).map((f) => (
                  <PressableScale key={f} scaleTo={0.95} wrapStyle={{ flex: 1 }} onPress={() => pick(f)} style={styles.choice}>
                    <MaterialCommunityIcons name={f === 'heads' ? 'crown' : 'cricket'} size={18} color={hero.gold} />
                    <Text style={styles.choiceText}>{f === 'heads' ? 'Heads' : 'Tails'}</Text>
                  </PressableScale>
                ))}
              </View>
              <PressableScale onPress={() => setPhase('who')} style={styles.manualLink}>
                <Text style={styles.manualText}>Someone else calls</Text>
              </PressableScale>
            </>
          )}

          {phase === 'ready' && (
            <>
              <Text style={styles.line}>
                <Text style={styles.strong}>{short(caller)}</Text> called {call}. Over to <Text style={styles.strong}>{short(tosser)}</Text>.
              </Text>
              <PressableScale scaleTo={0.96} wrapStyle={{ alignSelf: 'stretch' }} onPress={() => toss()} style={[styles.choice, styles.primary]} accessibilityLabel="Toss the coin">
                <MaterialCommunityIcons name="hand-coin" size={20} color="#0A0D06" />
                <Text style={[styles.choiceText, { color: '#0A0D06' }]}>Toss the coin</Text>
              </PressableScale>
              <PressableScale onPress={() => toss(true)} style={styles.manualLink}>
                <Text style={styles.manualText}>Quick toss, no replay</Text>
              </PressableScale>
            </>
          )}

          {(phase === 'flight' || phase === 'reveal' || phase === 'replay') && (
            <Text style={styles.line}>{phase === 'flight' ? 'Up it goes…' : phase === 'reveal' ? 'And it’s…' : 'Once more, as it landed'}</Text>
          )}

          {(phase === 'result' || phase === 'choose') && winner !== null && (
            <>
              <Text style={styles.won}>{names[winner]} win the toss</Text>
              {phase === 'choose' && (
                <>
                  <Text style={styles.line}>
                    <Text style={styles.strong}>{short(winner)}</Text> chooses to
                  </Text>
                  <View style={styles.choices}>
                    {(['bat', 'bowl'] as const).map((c) => (
                      <PressableScale key={c} scaleTo={0.95} wrapStyle={{ flex: 1 }} onPress={() => decide(c)} style={[styles.choice, c === 'bat' && styles.primary]}>
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
                {([0, 1] as Side[]).map((w) => (
                  <PressableScale key={w} scaleTo={0.95} wrapStyle={{ flex: 1 }} onPress={() => setManualWinner(w)} style={[styles.choice, manualWinner === w && styles.primary]}>
                    <Text style={[styles.choiceText, manualWinner === w && { color: '#0A0D06' }]} numberOfLines={1}>
                      {names[w]}
                    </Text>
                  </PressableScale>
                ))}
              </View>
              <Text style={styles.line}>and they chose to</Text>
              <View style={styles.choices}>
                {(['bat', 'bowl'] as const).map((c) => (
                  <PressableScale key={c} scaleTo={0.95} wrapStyle={{ flex: 1 }} onPress={() => finish(manualWinner, c)} style={styles.choice}>
                    <Text style={styles.choiceText}>{c === 'bat' ? 'Bat first' : 'Bowl first'}</Text>
                  </PressableScale>
                ))}
              </View>
            </>
          )}

          {(phase === 'intro' || phase === 'who' || phase === 'call' || phase === 'ready') && (
            <PressableScale onPress={() => (take.current += 1, stopAll(), setPhase('manual'))} style={styles.manualLink}>
              <Text style={styles.manualText}>Done the toss on the field? Set it here</Text>
            </PressableScale>
          )}
        </View>
        {(phase === 'result' || phase === 'choose' || phase === 'banner') && <Confetti height={520} />}

        {/* The result as television puts it up: the winner's name across the screen and what they chose. */}
        {phase === 'banner' && winner !== null && choice && (
          <Pressable style={StyleSheet.absoluteFill} onPress={() => finish(winner, choice)} accessibilityLabel="Start the match">
            <Animated.View style={[StyleSheet.absoluteFill, styles.bannerShade, { opacity: v.banner.interpolate({ inputRange: [0, 0.4], outputRange: [0, 1], extrapolate: 'clamp' }) }]} />
            <View style={[styles.bannerWrap, { top: screenH * 0.3 }]}>
              <Animated.View
                style={[
                  styles.bannerStripe,
                  { transform: [{ translateX: v.banner.interpolate({ inputRange: [0, 0.5], outputRange: [-screenW, 0], extrapolate: 'clamp' }) }, { skewX: '-14deg' }] },
                ]}
              />
              <Animated.View
                style={{
                  opacity: v.banner.interpolate({ inputRange: [0.25, 0.6], outputRange: [0, 1], extrapolate: 'clamp' }),
                  transform: [{ translateX: v.banner.interpolate({ inputRange: [0.25, 0.8], outputRange: [40, 0], extrapolate: 'clamp' }) }],
                }}
              >
                <Text style={styles.bannerEyebrow}>THE TOSS</Text>
                <Text style={styles.bannerTeam} numberOfLines={2} adjustsFontSizeToFit>
                  {names[winner].toUpperCase()}
                </Text>
              </Animated.View>
              <Animated.View
                style={[
                  styles.bannerCall,
                  {
                    opacity: v.banner.interpolate({ inputRange: [0.5, 0.85], outputRange: [0, 1], extrapolate: 'clamp' }),
                    transform: [{ translateY: v.banner.interpolate({ inputRange: [0.5, 1], outputRange: [16, 0], extrapolate: 'clamp' }) }],
                  },
                ]}
              >
                <MaterialCommunityIcons name={choice === 'bat' ? 'cricket' : 'baseball'} size={22} color="#0A0D06" />
                <Text style={styles.bannerCallText}>WON THE TOSS AND WILL {choice === 'bat' ? 'BAT' : 'BOWL'}</Text>
              </Animated.View>
              {captains[winner] && (
                <Animated.Text style={[styles.bannerCaptain, { opacity: v.banner.interpolate({ inputRange: [0.7, 1], outputRange: [0, 1], extrapolate: 'clamp' }) }]}>
                  {`Captain ${captains[winner]} · ${face === 'heads' ? 'Heads' : 'Tails'} it was`}
                </Animated.Text>
              )}
            </View>
            <Text style={[styles.bannerTap, { bottom: insets.bottom + space.xl }]}>Tap to start the match</Text>
          </Pressable>
        )}
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
  impact: { position: 'absolute', width: 60, height: 16, borderRadius: 30, borderWidth: 1.5, borderColor: '#FFF3C2' },
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
  bar: { position: 'absolute', left: 0, right: 0, backgroundColor: '#000' },
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
  onAir: {
    position: 'absolute',
    top: '12%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  onAirDot: { width: 7, height: 7, borderRadius: 4 },
  onAirText: { fontFamily: font.heavy, fontSize: 11, letterSpacing: 2, color: '#FFFFFF' },
  wipe: { position: 'absolute', top: -40, bottom: -40, flexDirection: 'row' },
  wipeEdge: { width: 14 },
  wipeBody: { flex: 1, backgroundColor: '#07100A', alignItems: 'center', justifyContent: 'center' },
  wipeText: { fontFamily: font.posterBlack, fontSize: 44, letterSpacing: 6, color: hero.accent, transform: [{ skewX: '18deg' }] },
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 60 },
  close: { position: 'absolute', left: space.lg, width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.45)' },
  skip: {
    position: 'absolute',
    right: space.lg,
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  skipText: { fontFamily: font.bold, fontSize: 13, color: hero.text },
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
  tall: { flexDirection: 'column', gap: 0, height: 64, borderRadius: radius.lg },
  primary: { backgroundColor: hero.accent, borderColor: hero.accent },
  choiceText: { fontFamily: font.bold, fontSize: 16, color: hero.text },
  choiceSub: { fontFamily: font.semibold, fontSize: 12, color: hero.faint, marginTop: 2 },
  manualLink: { alignSelf: 'center', padding: space.sm },
  manualText: { fontFamily: font.semibold, fontSize: 13, color: hero.faint, textDecorationLine: 'underline' },
  bannerShade: { backgroundColor: 'rgba(2,5,3,0.78)' },
  bannerWrap: { position: 'absolute', left: 0, right: 0, paddingHorizontal: space.lg },
  bannerStripe: { position: 'absolute', left: -40, right: -40, top: 14, height: 92, backgroundColor: hero.ink(0.06), borderLeftWidth: 10, borderLeftColor: hero.accent },
  bannerEyebrow: { ...type.label, color: hero.accent, letterSpacing: 4, marginLeft: space.md },
  bannerTeam: { fontFamily: font.posterBlack, fontSize: 52, lineHeight: 58, color: hero.text, letterSpacing: -1, marginLeft: space.md, marginTop: 4 },
  bannerCall: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: space.sm,
    marginTop: space.lg,
    paddingHorizontal: space.md,
    paddingVertical: 10,
    backgroundColor: hero.accent,
    transform: [{ skewX: '-10deg' }],
  },
  bannerCallText: { fontFamily: font.heavy, fontSize: 15, letterSpacing: 1.5, color: '#0A0D06' },
  bannerCaptain: { fontFamily: font.semibold, fontSize: 14, color: hero.muted, marginTop: space.md, marginLeft: space.md },
  bannerTap: { position: 'absolute', left: 0, right: 0, textAlign: 'center', fontFamily: font.semibold, fontSize: 13, color: hero.faint },
});
