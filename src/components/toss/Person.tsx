import { memo, type ReactNode } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';

// A person out in the middle, drawn at 80 × 180 facing right, with joints: the head turns at the neck, the arms at
// the shoulder and elbow, the legs at the hip and knee. A captain wears whites, their side's shirt and cap; the umpire
// a long white coat, dark trousers and a wide hat. Everything is posed from outside with numbers in degrees, so the
// scene can walk them out, turn their heads after the coin and have them signal and celebrate.

export const FIGURE = { w: 80, h: 180 };

export type Look = { kind: 'captain' | 'umpire'; shirt: string; cap: string; skin: string; hair: string };

/** The joints, in degrees. 0 is hanging straight down (or the head upright); negative turns towards where they face. */
export type Pose = {
  frontShoulder: Animated.Value;
  frontElbow: Animated.Value;
  backShoulder: Animated.Value;
  backElbow: Animated.Value;
  head: Animated.Value;
  /** Strides taken while walking: each whole number is one full stride; standing still between. */
  gait: Animated.Value;
  /** A crouch, 0 to 1: knees bent, as before a jump. */
  crouch: Animated.Value;
};

export const newPose = (): Pose => ({
  frontShoulder: new Animated.Value(-4),
  frontElbow: new Animated.Value(-10),
  backShoulder: new Animated.Value(5),
  backElbow: new Animated.Value(-8),
  head: new Animated.Value(0),
  gait: new Animated.Value(0),
  crouch: new Animated.Value(0),
});

/** Strides in a walk out: the gait runs from 0 to this. */
export const STRIDES = 4;

const shade = (hex: string, by: number) => {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c * (1 + by))));
  return `#${[f(n >> 16), f((n >> 8) & 255), f(n & 255)].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
};

/** Degrees as a rotation, from a value or a sum of values. */
const deg = (v: Animated.Value | Animated.AnimatedAddition) =>
  (v as Animated.Value).interpolate({ inputRange: [-720, 720], outputRange: ['-720deg', '720deg'] });

/** The gait's pattern for one stride, repeated for every stride of the walk. */
function cycle(gait: Animated.Value, pattern: number[]) {
  const inputRange: number[] = [];
  const outputRange: number[] = [];
  for (let s = 0; s < STRIDES; s++) pattern.forEach((p, i) => (s > 0 && i === 0 ? null : (inputRange.push(s + i / (pattern.length - 1)), outputRange.push(p))));
  return gait.interpolate({ inputRange, outputRange, extrapolate: 'clamp' });
}

/** A part that turns about a point at its top middle (a shoulder, elbow, hip or knee). */
function Joint({ x, y, w, h, angle, children }: { x: number; y: number; w: number; h: number; angle: Animated.AnimatedInterpolation<string>; children: ReactNode }) {
  return (
    <Animated.View pointerEvents="none" style={[styles.joint, { left: x - w / 2, top: y, width: w, height: h, transformOrigin: 'top', transform: [{ rotate: angle }] }]}>
      {children}
    </Animated.View>
  );
}

/** A tapered limb: wide at the top, narrower at the bottom, rounded both ends. */
const limb = (w: number, h: number, top: number, bottom: number) => {
  const a = (w - top) / 2;
  const b = (w - bottom) / 2;
  return `M${a} ${top / 2} Q${a} 0 ${w / 2} 0 Q${w - a} 0 ${w - a} ${top / 2} L${w - b} ${h - bottom / 2} Q${w - b} ${h} ${w / 2} ${h} Q${b} ${h} ${b} ${h - bottom / 2} Z`;
};

function Arm({ at, shoulder, elbow, look, back }: { at: { x: number; y: number }; shoulder: Animated.AnimatedInterpolation<string>; elbow: Animated.AnimatedInterpolation<string>; look: Look; back?: boolean }) {
  const umpire = look.kind === 'umpire';
  const dim = back ? -0.16 : 0;
  const sleeve = shade(umpire ? '#F2F1EA' : look.shirt, dim);
  const skin = shade(look.skin, dim - (back ? 0.04 : 0));
  return (
    <Joint x={at.x} y={at.y} w={11} h={29} angle={shoulder}>
      <Svg width={11} height={29} style={StyleSheet.absoluteFill}>
        <Path d={limb(11, 29, 11, 8.5)} fill={skin} />
        {/* The sleeve: short for a captain, all the way down for the umpire's coat. */}
        <Path d={umpire ? limb(11, 29, 11, 9) : limb(11, 15, 11, 10.5)} fill={sleeve} />
        {!umpire && <Rect x="0.6" y="13" width="9.8" height="2.2" rx="1.1" fill={shade(look.shirt, -0.3 + dim)} />}
      </Svg>
      <Joint x={5.5} y={26} w={9} h={28} angle={elbow}>
        <Svg width={9} height={28} style={StyleSheet.absoluteFill}>
          <Path d={limb(9, 23, 8.6, 6.4)} fill={umpire ? sleeve : skin} />
          {umpire && <Rect x="1" y="18" width="7" height="3" rx="1.2" fill={shade('#D8D7CE', dim)} />}
          {/* The hand. */}
          <Ellipse cx="4.6" cy="24" rx="3.9" ry="4.3" fill={skin} />
          <Path d="M7.2 22.5 Q9 24 7.6 26.4" stroke={shade(look.skin, -0.25)} strokeWidth="0.8" fill="none" />
        </Svg>
      </Joint>
    </Joint>
  );
}

function Leg({ at, hip, knee, look, back }: { at: { x: number; y: number }; hip: Animated.AnimatedInterpolation<string>; knee: Animated.AnimatedInterpolation<string>; look: Look; back?: boolean }) {
  const umpire = look.kind === 'umpire';
  const dim = back ? -0.14 : 0;
  const trouser = shade(umpire ? '#23292A' : '#F4F3EC', dim);
  const crease = shade(umpire ? '#141819' : '#D9D8CE', dim);
  return (
    <Joint x={at.x} y={at.y} w={13} h={40} angle={hip}>
      <Svg width={13} height={40} style={StyleSheet.absoluteFill}>
        <Path d={limb(13, 40, 13, 10.5)} fill={trouser} />
        <Path d="M6.5 4 L6.6 36" stroke={crease} strokeWidth="0.7" />
      </Svg>
      <Joint x={6.5} y={36} w={11} h={42} angle={knee}>
        <Svg width={16} height={42} style={styles.overhang}>
          <Path d={limb(11, 37, 10.5, 8.6)} fill={trouser} />
          <Path d="M5.5 3 L5.6 34" stroke={crease} strokeWidth="0.6" />
          {/* The shoe, pointing the way they face. */}
          <Path d="M1 35 Q1 32 5 32 L10 32 Q15.5 33.5 15.5 37.5 Q15.5 39.5 13 39.5 L2 39.5 Q1 39.5 1 37.5 Z" fill={umpire ? shade('#121414', dim) : shade('#F7F7F2', dim)} />
          <Rect x="1" y="38.6" width="14.4" height="1.6" rx="0.8" fill={umpire ? '#050606' : shade('#BDBCB3', dim)} />
        </Svg>
      </Joint>
    </Joint>
  );
}

/** The head at 30 × 34, its neck at the bottom middle: face, hair, ear and a cap or the umpire's hat. */
function HeadArt({ look, id }: { look: Look; id: string }) {
  const umpire = look.kind === 'umpire';
  return (
    <Svg width={30} height={36} viewBox="0 0 30 36">
      <Defs>
        <LinearGradient id={`${id}face`} x1="0" y1="0" x2="1" y2="0.6">
          <Stop offset="0" stopColor={shade(look.skin, -0.14)} />
          <Stop offset="0.55" stopColor={look.skin} />
          <Stop offset="1" stopColor={shade(look.skin, 0.08)} />
        </LinearGradient>
      </Defs>
      {/* Neck, in shadow under the jaw. */}
      <Path d="M11 24 L19.5 24 L19.5 36 L11 36 Z" fill={shade(look.skin, -0.2)} />
      {/* The head: a skull with a jaw coming forward to the chin. */}
      <Path d="M5 15 Q5 4 15 4 Q24.5 4 25 13.5 L25.6 16.6 Q27.4 17.6 25.8 18.6 L25.4 21 Q24.8 26.6 19 27.4 Q12 28 8.5 24 Q5 21 5 15 Z" fill={`url(#${id}face)`} />
      {/* Hair at the back and sides. */}
      <Path d="M5 15 Q4.4 6.5 11 4.4 L16 4 Q9 7.5 9.2 13.6 L8.6 19.6 Q5.4 18.4 5 15 Z" fill={umpire ? '#9A9790' : look.hair} />
      {/* Ear. */}
      <Ellipse cx="10.6" cy="16.6" rx="2.3" ry="3.1" fill={shade(look.skin, -0.12)} />
      <Path d="M10.2 15 Q11.6 16.6 10.4 18.2" stroke={shade(look.skin, -0.3)} strokeWidth="0.7" fill="none" />
      {/* Eyebrow, eye, nose and mouth. */}
      <Path d="M18.6 11.2 Q21.2 10.2 23.4 11.1" stroke={umpire ? '#7C7972' : look.hair} strokeWidth="1.1" strokeLinecap="round" fill="none" />
      <Ellipse cx="21.4" cy="13.9" rx="1.7" ry="1.05" fill="#F4F1EA" />
      <Circle cx="22" cy="13.95" r="0.8" fill="#2A1C14" />
      <Path d="M25 13.6 Q27.6 17.4 25.2 18.4" stroke={shade(look.skin, -0.28)} strokeWidth="0.8" fill="none" />
      <Path d="M20.4 22 Q22.6 23 24.2 21.8" stroke="#8A4A3A" strokeWidth="0.85" strokeLinecap="round" fill="none" />
      {umpire ? (
        <>
          {/* A wide white hat with a dark band, its brim casting a shadow over the eyes. */}
          <Path d="M5 11.2 Q15 13.8 27 11 L26.4 12.6 Q15 15.2 5.4 12.8 Z" fill="#000" opacity="0.14" />
          <Ellipse cx="15.6" cy="10" rx="14.8" ry="3" fill="#ECEBE3" />
          <Path d="M7.6 10 Q7.6 0.6 15.6 0.6 Q23.4 0.6 23.6 10 Z" fill="#F8F7F1" />
          <Rect x="7.7" y="6.8" width="15.8" height="2.4" fill="#1B1E1C" />
        </>
      ) : (
        <>
          {/* A cricket cap in the side's colour, its peak forward. */}
          <Path d="M4.8 12.6 Q4.6 2 15 1.8 Q25 1.8 25.2 11.6 Z" fill={look.cap} />
          <Path d="M10 3 Q15 2.2 20 3.2" stroke={shade(look.cap, -0.25)} strokeWidth="0.6" fill="none" />
          <Path d="M22.6 10.2 L31 12.2 Q30.6 14.2 22.8 13 Z" fill={shade(look.cap, -0.32)} />
          <Circle cx="15" cy="2.2" r="1" fill={shade(look.cap, -0.35)} />
        </>
      )}
    </Svg>
  );
}

const Head = memo(HeadArt);

/** The body: shadow, torso and hips, with the shirt or coat. */
function TorsoArt({ look, id, facing }: { look: Look; id: string; facing: 1 | -1 }) {
  const umpire = look.kind === 'umpire';
  return (
    <Svg width={FIGURE.w} height={FIGURE.h} viewBox={`0 0 ${FIGURE.w} ${FIGURE.h}`} style={StyleSheet.absoluteFill}>
      <Defs>
        <LinearGradient id={`${id}cloth`} x1="0" y1="0" x2="1" y2="0.3">
          <Stop offset="0" stopColor={umpire ? '#DCDBD2' : shade(look.shirt, -0.22)} />
          <Stop offset="0.6" stopColor={umpire ? '#F7F6F0' : look.shirt} />
          <Stop offset="1" stopColor={umpire ? '#FFFFFF' : shade(look.shirt, 0.1)} />
        </LinearGradient>
      </Defs>
      {umpire ? (
        <>
          {/* The long coat to the knee, lapels, a tie, pockets and buttons. */}
          <Path d="M23 43 Q23 36.5 31.5 35.5 L48.5 35.5 Q57 36.5 57 43 L58.6 120 Q40 123 21.4 120 Z" fill={`url(#${id}cloth)`} />
          <Path d="M34 35.8 L40 54 L46 35.8" fill="#E3E2DA" />
          <Path d="M38.7 37.5 L41.3 37.5 L42.2 60 L40 64 L37.8 60 Z" fill="#161A19" />
          <Path d="M40 54 L40 119" stroke="#CFCEC5" strokeWidth="0.8" />
          {[70, 84, 98].map((y) => (
            <Circle key={y} cx="42" cy={y} r="1.1" fill="#A3A299" />
          ))}
          <Rect x="25.5" y="92" width="9" height="1.4" rx="0.7" fill="#C9C8BF" />
          <Rect x="45.5" y="92" width="9" height="1.4" rx="0.7" fill="#C9C8BF" />
        </>
      ) : (
        <>
          {/* Trousers at the hip, the shirt tucked in, collar open, the captain's band. */}
          <Path d="M27.5 92 L52.5 92 L54 106 L26 106 Z" fill="#F1F0E8" />
          <Path d="M24 43 Q24 36.5 32 35.5 L48 35.5 Q56 36.5 56 43 L54.6 70 Q53.6 84 53.4 95 L26.6 95 Q26.4 84 25.4 70 Z" fill={`url(#${id}cloth)`} />
          <Path d="M28 60 Q40 63 52 60" stroke={shade(look.shirt, -0.2)} strokeWidth="0.6" fill="none" opacity="0.6" />
          <Path d="M34 35.6 L40 45 L46 35.6 L43.6 35.6 L40 41.4 L36.4 35.6 Z" fill="#F4F3EC" />
          <Rect x="26.4" y="93.4" width="27" height="2.6" rx="1.3" fill="#2A2A26" />
          <Circle cx="47.5" cy="52" r="4.2" fill="#FFCB52" />
          {/* Turned back the right way when the figure is mirrored. */}
          <G transform={facing === -1 ? 'translate(95 0) scale(-1 1)' : undefined}>
            <SvgText x="47.5" y="54.6" fontSize="6.4" fontWeight="900" fill="#5A3B05" textAnchor="middle">
              C
            </SvgText>
          </G>
        </>
      )}
    </Svg>
  );
}

const Torso = memo(TorsoArt);

/** The person, posed. `facing` -1 turns them to face left. */
export function Person({ look, id, pose, facing = 1 }: { look: Look; id: string; pose: Pose; facing?: 1 | -1 }) {
  const umpire = look.kind === 'umpire';
  // The walk: legs swing from the hip with the knee bending behind, arms swing against them, the body rises a little.
  const legA = cycle(pose.gait, [0, -22, 0, 18, 0]);
  const legB = cycle(pose.gait, [0, 18, 0, -22, 0]);
  const kneeA = cycle(pose.gait, [0, 4, 6, 30, 0]);
  const kneeB = cycle(pose.gait, [0, 30, 6, 4, 0]);
  const swing = cycle(pose.gait, [0, 16, 0, -16, 0]);
  const bob = cycle(pose.gait, [0, -1.6, 0, -1.6, 0]);
  // A crouch bends the hips forward and the knees back, and drops the body.
  const hipBend = pose.crouch.interpolate({ inputRange: [0, 1], outputRange: [0, -28] });
  const kneeBend = pose.crouch.interpolate({ inputRange: [0, 1], outputRange: [0, 50] });
  const drop = pose.crouch.interpolate({ inputRange: [0, 1], outputRange: [0, 12] });

  const front = { shoulder: deg(Animated.add(pose.frontShoulder, Animated.multiply(swing, -1))), elbow: deg(pose.frontElbow) };
  const back = { shoulder: deg(Animated.add(pose.backShoulder, swing)), elbow: deg(pose.backElbow) };
  const hips = { a: deg(Animated.add(legA, hipBend)), b: deg(Animated.add(legB, hipBend)), ka: deg(Animated.add(kneeA, kneeBend)), kb: deg(Animated.add(kneeB, kneeBend)) };

  return (
    <View style={[styles.person, facing === -1 && { transform: [{ scaleX: -1 }] }]}>
      {/* A soft shadow on the grass, under the feet. */}
      <Svg width={70} height={14} style={styles.shadow}>
        <Defs>
          <RadialGradient id={`${id}shadow`} cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor="#000" stopOpacity="0.55" />
            <Stop offset="0.7" stopColor="#000" stopOpacity="0.2" />
            <Stop offset="1" stopColor="#000" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Ellipse cx="35" cy="7" rx="35" ry="7" fill={`url(#${id}shadow)`} />
      </Svg>
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateY: Animated.add(bob, drop) }] }]}>
        <Arm at={{ x: 27, y: 39 }} shoulder={back.shoulder} elbow={back.elbow} look={look} back />
        <Leg at={{ x: 34, y: 96 }} hip={hips.b} knee={hips.kb} look={look} back />
        {umpire && <Leg at={{ x: 46, y: 96 }} hip={hips.a} knee={hips.ka} look={look} />}
        <Torso look={look} id={id} facing={facing} />
        {!umpire && <Leg at={{ x: 46, y: 96 }} hip={hips.a} knee={hips.ka} look={look} />}
        <Animated.View style={[styles.head, { transformOrigin: '50% 90%', transform: [{ rotate: deg(pose.head) }] }]}>
          <Head look={look} id={id} />
        </Animated.View>
        <Arm at={{ x: 53, y: 39 }} shoulder={front.shoulder} elbow={front.elbow} look={look} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  person: { width: FIGURE.w, height: FIGURE.h },
  joint: { position: 'absolute' },
  /** Drawn wider than its joint (the shoe points forward past the shin). */
  overhang: { position: 'absolute', left: 0, top: 0 },
  head: { position: 'absolute', left: 25, top: 0, width: 30, height: 36 },
  shadow: { position: 'absolute', left: 6, top: 167 },
});
