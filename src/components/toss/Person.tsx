import { memo, useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, FeGaussianBlur, Filter, G, LinearGradient, Path, RadialGradient, Stop, Text as SvgText } from 'react-native-svg';

// The people out in the middle, drawn at 80 × 180. The umpire faces us, front on; each captain stands three-quarters
// on, turned towards the other (facing right; the scene mirrors the away captain). Rounded shapes, light from the
// floodlights on every part with soft shadows under the hat brim, the peak, the chin and the collar, and soft-edged
// hair and beards. The head turns at the neck, the arms move at the shoulder and elbow, the legs lift to walk. They
// blink and breathe.

export const FIGURE = { w: 80, h: 180 };

export type Look = {
  kind: 'captain' | 'umpire';
  shirt: string;
  /** The trim on collar and sleeves. */
  trim: string;
  cap: string;
  skin: string;
  hair: string;
  face?: 'stubble' | 'beard' | 'moustache';
  /** Their shirt number, on the sleeve. */
  number?: string;
};

/**
 * The joints, in degrees. 0 hangs straight down (or the head upright). `front` is the arm on the side they face (for
 * the umpire, the arm on our right); negative turns an arm out that way and up, positive the other way.
 */
export type Pose = {
  frontShoulder: Animated.Value;
  frontElbow: Animated.Value;
  backShoulder: Animated.Value;
  backElbow: Animated.Value;
  head: Animated.Value;
  /** How far through the walk: each whole number is one full stride (a step with each foot). */
  gait: Animated.Value;
  /** How much they're walking, 0 to 1: it rises as they set off and falls as they stop. */
  stride: Animated.Value;
  /** A crouch, 0 to 1: knees bent, as before a jump. */
  crouch: Animated.Value;
};

/** Arms hanging easy at the sides, a little out from the body. */
export const REST = { frontShoulder: -5, frontElbow: -4, backShoulder: 5, backElbow: 4 };

export const newPose = (): Pose => ({
  frontShoulder: new Animated.Value(REST.frontShoulder),
  frontElbow: new Animated.Value(REST.frontElbow),
  backShoulder: new Animated.Value(REST.backShoulder),
  backElbow: new Animated.Value(REST.backElbow),
  head: new Animated.Value(0),
  gait: new Animated.Value(0),
  stride: new Animated.Value(0),
  crouch: new Animated.Value(0),
});

/** The most strides a walk can take: the gait runs from 0 to a whole number up to this. */
export const STRIDES = 8;
/** How long a stride takes at an easy walk. */
export const STRIDE_MS = 950;

const native = Platform.OS !== 'web';

const shade = (hex: string, by: number) => {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(by >= 0 ? c + (255 - c) * by : c * (1 + by))));
  return `#${[f(n >> 16), f((n >> 8) & 255), f(n & 255)].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
};

type Num = Animated.Value | Animated.AnimatedAddition | Animated.AnimatedMultiplication;

/** Degrees as a rotation, from a value or a sum of values. */
const deg = (v: Num) => (v as Animated.Value).interpolate({ inputRange: [-720, 720], outputRange: ['-720deg', '720deg'] });

/**
 * A rounded part in the light: darker at both edges where it turns away, lightest a little towards the lit side, and
 * a thin rim of floodlight on the far edge. `turn` shifts the light for a part turned from us.
 */
function Round({ id, base, dim = 0, turn = 0 }: { id: string; base: string; dim?: number; turn?: number }) {
  return (
    <LinearGradient id={id} x1="0" y1="0" x2="1" y2="0">
      <Stop offset="0" stopColor={shade(base, -0.42 + dim)} />
      <Stop offset={`${0.18 + turn}`} stopColor={shade(base, -0.16 + dim)} />
      <Stop offset={`${0.42 + turn}`} stopColor={shade(base, 0.08 + dim)} />
      <Stop offset={`${0.62 + turn}`} stopColor={shade(base, -0.02 + dim)} />
      <Stop offset="0.9" stopColor={shade(base, -0.3 + dim)} />
      <Stop offset="1" stopColor={shade(base, 0.12 + dim)} />
    </LinearGradient>
  );
}

/** A soft blur for shadows, hair and beards. */
const Soft = ({ id, by }: { id: string; by: number }) => (
  <Filter id={id} x="-50%" y="-50%" width="200%" height="200%">
    <FeGaussianBlur stdDeviation={by} />
  </Filter>
);

/** One stride's pattern (it ends where it starts), repeated for every stride and scaled by how much they're walking. */
function cycle(pose: Pose, pattern: number[]) {
  const inputRange: number[] = [];
  const outputRange: number[] = [];
  for (let s = 0; s < STRIDES; s++) pattern.forEach((p, i) => (s > 0 && i === 0 ? null : (inputRange.push(s + i / (pattern.length - 1)), outputRange.push(p))));
  return Animated.multiply(pose.gait.interpolate({ inputRange, outputRange, extrapolate: 'clamp' }), pose.stride);
}

/** A part that turns about a point at its top middle (a shoulder or elbow). */
function Joint({ x, y, w, h, angle, children }: { x: number; y: number; w: number; h: number; angle: Animated.AnimatedInterpolation<string>; children: ReactNode }) {
  return (
    <Animated.View pointerEvents="none" style={[styles.joint, { left: x - w / 2, top: y, width: w, height: h, transformOrigin: 'top', transform: [{ rotate: angle }] }]}>
      {children}
    </Animated.View>
  );
}

/** A smooth tapering limb: shoulder at the top, wrist at the bottom, a gentle swell between. */
const limb = (w: number, h: number, top: number, bottom: number, swell = 0.8) => {
  const l1 = (w - top) / 2;
  const r1 = w - l1;
  const l2 = (w - bottom) / 2;
  const r2 = w - l2;
  return `M${l1} ${top / 2} C${l1} ${top / 4} ${w / 2 - top / 4} 0 ${w / 2} 0 C${w / 2 + top / 4} 0 ${r1} ${top / 4} ${r1} ${top / 2} C${r1 + swell} ${h * 0.35} ${r2 + swell * 0.3} ${h * 0.7} ${r2} ${h - bottom / 2} C${r2} ${h - bottom / 4} ${w / 2 + bottom / 4} ${h} ${w / 2} ${h} C${w / 2 - bottom / 4} ${h} ${l2} ${h - bottom / 4} ${l2} ${h - bottom / 2} C${l2 - swell * 0.3} ${h * 0.7} ${l1 - swell} ${h * 0.35} ${l1} ${top / 2} Z`;
};

/** A relaxed hand: palm in, fingers together, the thumb forward. */
function Hand({ fill, skin }: { fill: string; skin: string }) {
  return (
    <G>
      <Path d="M1.2 1.4 C1.2 0.4 3 0 5 0 C7 0 8.8 0.4 8.8 1.4 L9 6.6 C9 9.6 7.4 11.2 5 11.2 C2.6 11.2 1 9.6 1 6.6 Z" fill={fill} />
      <Path d="M3.4 7 L3.4 10.4 M5 7.4 L5 11 M6.6 7 L6.6 10.4" stroke={shade(skin, -0.28)} strokeWidth="0.35" opacity="0.7" />
      <Path d="M8.2 2.4 C9.8 3.6 9.8 6 8.6 7.4" stroke={shade(skin, -0.2)} strokeWidth="1.4" strokeLinecap="round" fill="none" />
    </G>
  );
}

function Arm({
  at,
  shoulder,
  elbow,
  look,
  id,
  far,
  facing = 1,
}: {
  at: { x: number; y: number };
  shoulder: Animated.AnimatedInterpolation<string>;
  elbow: Animated.AnimatedInterpolation<string>;
  look: Look;
  id: string;
  /** The arm on the side turned from us: a little slimmer and in shadow. */
  far?: boolean;
  facing?: 1 | -1;
}) {
  const umpire = look.kind === 'umpire';
  const dim = far ? -0.16 : 0;
  const sleeve = umpire ? '#F3F2EB' : look.shirt;
  const w = far ? 10.5 : 12;
  const fw = w - 1.5;
  return (
    <Joint x={at.x} y={at.y} w={w} h={31} angle={shoulder}>
      <Svg width={w} height={31} style={StyleSheet.absoluteFill}>
        <Defs>
          <Round id={`${id}us`} base={look.skin} dim={dim} />
          <Round id={`${id}uc`} base={sleeve} dim={dim} />
        </Defs>
        <Path d={limb(w, 31, w, w * 0.72)} fill={`url(#${id}us)`} />
        {umpire ? (
          <Path d={limb(w, 31, w + 0.4, w * 0.8)} fill={`url(#${id}uc)`} />
        ) : (
          <>
            {/* A short sleeve with its trim, and the number. */}
            <Path d={limb(w, 17, w + 0.6, w * 0.96)} fill={`url(#${id}uc)`} />
            <Path d={`M0.6 15.4 Q${w / 2} 17.6 ${w - 0.6} 15.4 L${w - 0.4} 17 Q${w / 2} 19.2 0.4 17 Z`} fill={shade(look.trim, dim)} />
            {look.number && !far && (
              <G transform={facing === -1 ? `translate(${w} 0) scale(-1 1)` : undefined}>
                <SvgText x={w / 2} y="12.6" fontSize="5.2" fontWeight="900" fill={shade(look.trim, -0.05)} textAnchor="middle">
                  {look.number}
                </SvgText>
              </G>
            )}
          </>
        )}
      </Svg>
      <Joint x={w / 2} y={27.5} w={fw} h={32} angle={elbow}>
        <Svg width={fw} height={32} style={StyleSheet.absoluteFill}>
          <Defs>
            <Round id={`${id}fs`} base={look.skin} dim={dim - 0.02} />
            <Round id={`${id}fc`} base={sleeve} dim={dim} />
          </Defs>
          <Path d={limb(fw, 23, fw * 0.95, fw * 0.7)} fill={umpire ? `url(#${id}fc)` : `url(#${id}fs)`} />
          {umpire && <Path d={`M1 19.4 Q${fw / 2} 21.6 ${fw - 1} 19.4 L${fw - 0.9} 22 Q${fw / 2} 24.2 1.1 22 Z`} fill={shade('#D9D8CF', dim)} />}
          <G transform={`translate(${fw / 2 - 5} 20.6)`}>
            <Hand fill={`url(#${id}fs)`} skin={look.skin} />
          </G>
        </Svg>
      </Joint>
    </Joint>
  );
}

/**
 * A leg seen from the front or three-quarters: hip to ankle in one piece, lifting as they walk (the knee bends, so the
 * leg shortens and the foot comes up), the shoe at the bottom pointing the way they face.
 */
function Leg({ x, top, lift, look, id, far, turned }: { x: number; top: number; lift: Num; look: Look; id: string; far?: boolean; turned?: boolean }) {
  const umpire = look.kind === 'umpire';
  const dim = far ? -0.12 : 0;
  const trouser = umpire ? '#252B2C' : '#F3F2EA';
  const h = 176 - top;
  const fold = shade(umpire ? '#121617' : '#CBCAC0', dim);
  const up = (lift as Animated.Value).interpolate({ inputRange: [0, 1], outputRange: [0, -6] });
  const squash = (lift as Animated.Value).interpolate({ inputRange: [0, 1], outputRange: [1, 0.93] });
  return (
    <Animated.View pointerEvents="none" style={[styles.joint, { left: x - 9, top, width: 22, height: h, transformOrigin: 'top', transform: [{ translateY: up }, { scaleY: squash }] }]}>
      <Svg width={22} height={h} viewBox={`0 0 22 ${h}`}>
        <Defs>
          <Round id={`${id}t`} base={trouser} dim={dim} turn={turned ? 0.06 : 0} />
          <LinearGradient id={`${id}shoe`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={umpire ? shade('#2C3132', dim) : shade('#FFFFFF', dim)} />
            <Stop offset="1" stopColor={umpire ? shade('#0B0D0D', dim) : shade('#CFCEC5', dim)} />
          </LinearGradient>
        </Defs>
        {/* Thigh to ankle: full at the hip, in at the knee, the calf, slim at the ankle; the crease and a knee fold. */}
        <Path
          d={`M1.4 2 C1.4 0.6 4 0 9 0 C14 0 16.6 0.6 16.6 2 C16.8 ${h * 0.25} 15.6 ${h * 0.45} 15 ${h * 0.5} C15.6 ${h * 0.62} 15.4 ${h * 0.78} 14 ${h - 8} L4 ${h - 8} C2.6 ${h * 0.78} 2.4 ${h * 0.62} 3 ${h * 0.5} C2.4 ${h * 0.45} 1.2 ${h * 0.25} 1.4 2 Z`}
          fill={`url(#${id}t)`}
        />
        <Path d={`M${turned ? 10.6 : 9} 2 C${turned ? 10.8 : 9.2} ${h * 0.3} ${turned ? 10.4 : 9} ${h * 0.6} ${turned ? 10 : 9} ${h - 9}`} stroke={fold} strokeWidth="0.5" fill="none" opacity="0.7" />
        <Path d={`M3.6 ${h * 0.5} Q9 ${h * 0.5 + 2.4} 14.4 ${h * 0.5}`} stroke={fold} strokeWidth="0.55" fill="none" opacity="0.7" />
        <Path d={`M3.4 ${h - 11} Q9 ${h - 8.4} 14.6 ${h - 11}`} stroke={fold} strokeWidth="0.55" fill="none" opacity="0.6" />
        {/* The shoe: from the front a rounded toe; turned, the toe reaches forward. A sole and laces. */}
        <Path
          d={
            turned
              ? `M2.6 ${h - 8.6} C2.6 ${h - 10} 5 ${h - 10.4} 9 ${h - 10.4} C14.6 ${h - 10.4} 21 ${h - 7.4} 21.4 ${h - 3.4} C21.6 ${h - 1.4} 20 ${h - 1} 18 ${h - 1} L4 ${h - 1} C2.4 ${h - 1} 2.2 ${h - 3} 2.6 ${h - 8.6} Z`
              : `M2.2 ${h - 7} C2.2 ${h - 10} 5 ${h - 10.6} 9 ${h - 10.6} C13 ${h - 10.6} 15.8 ${h - 10} 15.8 ${h - 7} C16.6 ${h - 4} 16 ${h - 1} 13 ${h - 1} L5 ${h - 1} C2 ${h - 1} 1.4 ${h - 4} 2.2 ${h - 7} Z`
          }
          fill={`url(#${id}shoe)`}
        />
        <Path d={turned ? `M8 ${h - 9} L14 ${h - 6.6}` : `M7 ${h - 9.4} L11 ${h - 9.4} M7 ${h - 8} L11 ${h - 8}`} stroke={umpire ? '#454A4B' : '#A6A59C'} strokeWidth="0.5" strokeDasharray={turned ? '1 0.8' : undefined} />
        <Path d={turned ? `M3 ${h - 1.4} L20.6 ${h - 1.4}` : `M3 ${h - 1.4} L15 ${h - 1.4}`} stroke={umpire ? '#030404' : shade('#9C9B92', dim)} strokeWidth="1.6" strokeLinecap="round" />
      </Svg>
    </Animated.View>
  );
}

/** Where the eyes sit: from the front either side of the middle; turned, towards the side they face, the far one narrower. */
const EYES = { front: [{ x: 15.8, w: 2.9 }, { x: 24.2, w: 2.9 }], turned: [{ x: 17.6, w: 2.9 }, { x: 25.2, w: 2 }] };

/** Eyes, brows, nose, mouth and cheeks, for a face looking at us (`turn` 0) or turned three-quarters (`turn` 1). */
function Face({ look, id, turn }: { look: Look; id: string; turn: 0 | 1 }) {
  const umpire = look.kind === 'umpire';
  const dark = shade(look.skin, -0.42);
  const brow = umpire ? '#8E8B84' : look.hair;
  const eyes = turn ? EYES.turned : EYES.front;
  const cx = turn ? 21.8 : 20;
  const half = turn ? 2.6 : 3;
  return (
    <G>
      {/* Cheeks and the cheekbones' light. */}
      <Ellipse cx={turn ? 16.4 : 14.4} cy="27.6" rx="3.4" ry="2.4" fill={`url(#${id}blush)`} />
      {!turn && <Ellipse cx="25.6" cy="27.6" rx="3.4" ry="2.4" fill={`url(#${id}blush)`} />}
      <Path d={turn ? 'M14 25.4 Q17 24.4 20 25.4' : 'M12.6 25.2 Q15 24.2 17.4 25.2 M22.6 25.2 Q25 24.2 27.4 25.2'} stroke={shade(look.skin, 0.32)} strokeWidth="0.6" fill="none" opacity="0.6" />
      {eyes.map((e, i) => (
        <G key={i}>
          {/* The socket's shadow, the white, the iris and pupil, a catch of light, the upper lid and lashes, the brow. */}
          <Ellipse cx={e.x} cy="21.8" rx={e.w + 0.8} ry="2.2" fill={dark} opacity="0.14" />
          <Path d={`M${e.x - e.w} 22.4 Q${e.x} 20.6 ${e.x + e.w} 22.2 Q${e.x} 23.6 ${e.x - e.w} 22.4 Z`} fill="#F5F2EB" />
          <Circle cx={e.x + (turn ? 0.4 : 0)} cy="22.2" r="1.05" fill="#4A3020" />
          <Circle cx={e.x + (turn ? 0.4 : 0)} cy="22.2" r="0.55" fill="#0C0806" />
          <Circle cx={e.x + (turn ? 0.75 : 0.35)} cy="21.85" r="0.28" fill="#FFFFFF" />
          <Path d={`M${e.x - e.w - 0.2} 22.4 Q${e.x} 20.3 ${e.x + e.w + 0.2} 22.1`} stroke="#22160F" strokeWidth="0.6" fill="none" strokeLinecap="round" />
          <Path d={`M${e.x - e.w + 0.6} 23.2 Q${e.x} 23.9 ${e.x + e.w - 0.4} 23.1`} stroke={dark} strokeWidth="0.3" fill="none" opacity="0.5" />
          <Path d={`M${e.x - e.w - 0.6} 19.4 Q${e.x} 18 ${e.x + e.w + 0.6} 19`} stroke={brow} strokeWidth="1.15" strokeLinecap="round" fill="none" />
        </G>
      ))}
      {/* The nose: the bridge's shadow on one side, the tip's light, the nostrils. */}
      {turn ? (
        <>
          <Path d="M22.2 21.6 C22.6 24 24 26.6 25.4 28.2 C24.6 29.2 23 29.4 21.6 28.8" stroke={shade(look.skin, -0.34)} strokeWidth="0.65" fill="none" />
          <Path d="M21 22 C21 24.6 21.2 26.6 21.6 28.2" stroke={dark} strokeWidth="1.2" opacity="0.18" fill="none" />
          <Ellipse cx="23" cy="28.5" rx="0.8" ry="0.45" fill={shade(look.skin, -0.5)} />
          <Ellipse cx="24.4" cy="27" rx="0.7" ry="0.5" fill={shade(look.skin, 0.25)} opacity="0.7" />
        </>
      ) : (
        <>
          <Path d="M18.8 22.4 C18.6 24.6 18.2 26.4 17.8 27.8" stroke={dark} strokeWidth="1.1" opacity="0.2" fill="none" />
          <Path d="M17.4 28.2 C18.4 29.2 21.6 29.2 22.6 28.2" stroke={shade(look.skin, -0.36)} strokeWidth="0.6" fill="none" />
          <Ellipse cx="18.6" cy="28.6" rx="0.75" ry="0.42" fill={shade(look.skin, -0.5)} />
          <Ellipse cx="21.4" cy="28.6" rx="0.75" ry="0.42" fill={shade(look.skin, -0.5)} />
          <Ellipse cx="20" cy="27" rx="0.9" ry="0.6" fill={shade(look.skin, 0.25)} opacity="0.7" />
        </>
      )}
      {/* The mouth: upper lip in shadow, the line, the fuller lower lip with a little light. */}
      <Path d={`M${cx - half} 31.4 Q${cx - 0.8} 30.4 ${cx} 30.9 Q${cx + 0.8} 30.4 ${cx + half} 31.4 Q${cx} 31.8 ${cx - half} 31.4 Z`} fill={shade('#A85E4C', -0.1)} />
      <Path d={`M${cx - half + 0.4} 31.5 Q${cx} 33.6 ${cx + half - 0.4} 31.5 Q${cx} 32.1 ${cx - half + 0.4} 31.5 Z`} fill="#B86A57" />
      <Path d={`M${cx - half} 31.45 Q${cx} 31.9 ${cx + half} 31.45`} stroke="#5E2A1F" strokeWidth="0.45" fill="none" />
      <Ellipse cx={cx} cy="32.5" rx="1.2" ry="0.35" fill="#FFFFFF" opacity="0.18" />
    </G>
  );
}

/** The head at 40 × 44, the neck at the bottom middle. */
function HeadArt({ look, id, turn }: { look: Look; id: string; turn: 0 | 1 }) {
  const umpire = look.kind === 'umpire';
  const hair = umpire ? '#ABA8A1' : look.hair;
  const ears = turn ? [9.8] : [9.4, 30.6];
  return (
    <Svg width={40} height={44} viewBox="0 0 40 44">
      <Defs>
        <RadialGradient id={`${id}skin`} cx={turn ? '0.6' : '0.5'} cy="0.42" r="0.62">
          <Stop offset="0" stopColor={shade(look.skin, 0.12)} />
          <Stop offset="0.55" stopColor={look.skin} />
          <Stop offset="0.85" stopColor={shade(look.skin, -0.2)} />
          <Stop offset="1" stopColor={shade(look.skin, -0.36)} />
        </RadialGradient>
        <RadialGradient id={`${id}blush`} cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor="#DB7A62" stopOpacity="0.3" />
          <Stop offset="1" stopColor="#DB7A62" stopOpacity="0" />
        </RadialGradient>
        <LinearGradient id={`${id}neck`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={shade(look.skin, -0.36)} />
          <Stop offset="0.5" stopColor={shade(look.skin, -0.14)} />
          <Stop offset="1" stopColor={shade(look.skin, -0.06)} />
        </LinearGradient>
        <RadialGradient id={`${id}cap`} cx="0.42" cy="0.3" r="0.8">
          <Stop offset="0" stopColor={shade(look.cap, 0.2)} />
          <Stop offset="0.6" stopColor={look.cap} />
          <Stop offset="1" stopColor={shade(look.cap, -0.35)} />
        </RadialGradient>
        <LinearGradient id={`${id}hat`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" />
          <Stop offset="1" stopColor="#DCDBD2" />
        </LinearGradient>
        <Soft id={`${id}soft`} by={0.7} />
        <Soft id={`${id}softer`} by={1.4} />
        <Soft id={`${id}glow`} by={1.1} />
      </Defs>
      {/* Neck, darkest under the jaw. */}
      <Path d="M15 31 C15 35 14.6 40 14 44 L26 44 C25.4 40 25 35 25 31 Z" fill={`url(#${id}neck)`} />
      {/* Ears. */}
      {ears.map((x, i) => (
        <G key={i}>
          <Ellipse cx={x} cy="24" rx="1.9" ry="3.1" fill={shade(look.skin, -0.14)} />
          <Path d={`M${x + (i ? -0.6 : 0.6)} 22.4 Q${x + (i ? -1.4 : 1.4)} 24 ${x + (i ? -0.6 : 0.6)} 25.6`} stroke={shade(look.skin, -0.4)} strokeWidth="0.5" fill="none" />
        </G>
      ))}
      {/* The head: brow, cheekbones, a jaw narrowing to the chin; turned, the face's line runs down the side it faces. */}
      <Path
        d={
          turn
            ? 'M10.4 22 C10.2 13.6 14.6 9 20.6 9 C26.6 9 30.6 13.4 30.2 20.4 C30.2 22 30.8 23.4 30.4 25 C29.8 29.6 27.8 33 24.6 35 C22.8 36 20.8 36.2 19 35.6 C15.6 34.6 12.4 31.6 11.2 27.6 C10.6 25.6 10.4 24 10.4 22 Z'
            : 'M10 22 C10 13.6 14.4 9 20 9 C25.6 9 30 13.6 30 22 C30 27.6 28.6 31.2 25.8 33.6 C24 35.1 22 35.8 20 35.8 C18 35.8 16 35.1 14.2 33.6 C11.4 31.2 10 27.6 10 22 Z'
        }
        fill={`url(#${id}skin)`}
      />
      {/* The shadow the chin throws on the neck, softened. */}
      <Ellipse cx="20" cy="36.4" rx="5.6" ry="1.8" fill={shade(look.skin, -0.55)} opacity="0.45" filter={`url(#${id}soft)`} />
      {/* Hair at the sides (and a sideburn), soft at the edges. */}
      <G filter={`url(#${id}soft)`} opacity="0.95">
        <Path d={turn ? 'M10.6 16 C10.6 12 12.6 10.6 14.6 10.6 L13 22.6 C12 23.4 11 23.2 10.8 21 Z' : 'M10.4 16.4 C10.4 12.2 12.4 10.8 14.2 10.6 L12.8 22.6 C11.8 23.2 10.6 22.6 10.4 20 Z'} fill={hair} />
        {!turn && <Path d="M29.6 16.4 C29.6 12.2 27.6 10.8 25.8 10.6 L27.2 22.6 C28.2 23.2 29.4 22.6 29.6 20 Z" fill={hair} />}
      </G>
      {/* The painter's light on the face, soft: the forehead, the cheekbone and the bridge of the nose catch the key
          light; the jaw on the far side takes the cool rim of the other floodlight; a warm glow bounces up under the chin. */}
      <G filter={`url(#${id}glow)`}>
        <Ellipse cx={turn ? 19.6 : 18} cy="17.4" rx="5.4" ry="2.4" fill="#FFF1DA" opacity="0.32" />
        <Ellipse cx={turn ? 15.6 : 14.2} cy="25.4" rx="2.8" ry="1.8" fill="#FFF1DA" opacity="0.28" />
        {!turn && <Ellipse cx="26" cy="25.4" rx="2.2" ry="1.5" fill="#FFF1DA" opacity="0.16" />}
        <Ellipse cx={turn ? 22.6 : 19.8} cy="24" rx="0.9" ry="3.2" fill="#FFF6E6" opacity="0.32" />
        <Ellipse cx="20" cy="34.4" rx="4" ry="1.2" fill="#FFB27A" opacity="0.18" />
      </G>
      <Path
        d={turn ? 'M30.4 19 C30.6 22 30.8 24 30.4 25.4 C29.6 29.8 27.6 33 24.6 35' : 'M30 21 C30 27.6 28.6 31.2 25.8 33.6'}
        stroke="#A9DCFF"
        strokeWidth="1.1"
        opacity="0.55"
        fill="none"
        filter={`url(#${id}soft)`}
      />
      {!turn && <Path d="M10 21 C10 27.6 11.4 31.2 14.2 33.6" stroke="#FFD3A0" strokeWidth="1" opacity="0.45" fill="none" filter={`url(#${id}soft)`} />}
      <Face look={look} id={id} turn={turn} />
      {/* Facial hair, soft-edged. */}
      {look.face === 'stubble' && (
        <Path
          d={turn ? 'M11.8 26 C13 31 16.4 35.2 20 35.6 C23.6 36 27.4 33.4 29.4 28.6 C27 31.4 24.4 32.8 21.6 32.6 C17.6 32.4 14 29.8 11.8 26 Z' : 'M11 26 C12.4 31.6 16 35.6 20 35.6 C24 35.6 27.6 31.6 29 26 C27.4 30.2 24 32.6 20 32.6 C16 32.6 12.6 30.2 11 26 Z'}
          fill={look.hair}
          opacity="0.3"
          filter={`url(#${id}soft)`}
        />
      )}
      {look.face === 'beard' && (
        <G filter={`url(#${id}soft)`}>
          <Path
            d={turn ? 'M11.2 23.6 C11.6 30.4 15.8 36.6 20.6 37 C25 37.4 29 33.6 30.2 26.6 C29 29.8 27 31.6 24.6 31.2 C22.6 30.2 20.8 30.4 19 31.2 C16 31.6 13 28.6 11.2 23.6 Z' : 'M10.4 24 C11 31 15 37 20 37 C25 37 29 31 29.6 24 C28 29 25.6 31.6 23.4 31 C21.6 30.4 18.4 30.4 16.6 31 C14.4 31.6 12 29 10.4 24 Z'}
            fill={look.hair}
            opacity="0.92"
          />
          <Path d={turn ? 'M19.2 30.6 C20.8 29.6 23.6 29.6 25.6 30.4 C24 31 21.2 31.2 19.2 30.6 Z' : 'M16.4 30.6 C18 29.4 22 29.4 23.6 30.6 C22 31.2 18 31.2 16.4 30.6 Z'} fill={look.hair} />
        </G>
      )}
      {look.face === 'moustache' && (
        <Path d={turn ? 'M19.2 30.4 C20.6 29.2 23.6 29.2 25.2 30.4 C23.8 31.2 21 31.4 19.2 30.4 Z' : 'M16.2 30.4 C17.6 29 22.4 29 23.8 30.4 C22.4 31.4 17.6 31.4 16.2 30.4 Z'} fill="#C2BFB7" filter={`url(#${id}soft)`} />
      )}
      {umpire ? (
        <>
          {/* A wide white hat from the front: the crown, a dark band, the brim across, its shadow on the brow. */}
          <Ellipse cx="20" cy="17.6" rx="12" ry="2.6" fill="#000" opacity="0.32" filter={`url(#${id}softer)`} />
          <Path d="M11 14.6 C11 6.4 14.6 2 20 2 C25.4 2 29 6.4 29 14.6 Z" fill={`url(#${id}hat)`} />
          <Path d="M11.2 11.4 C14 12.2 26 12.2 28.8 11.4 L29 14.4 C26 15 14 15 11 14.4 Z" fill="#1D2120" />
          <Path d="M0.6 15.4 C0.6 12.6 9 11.8 20 11.8 C31 11.8 39.4 12.6 39.4 15.4 C39.4 17.4 31 18.4 20 18.4 C9 18.4 0.6 17.4 0.6 15.4 Z" fill={`url(#${id}hat)`} />
          <Path d="M2 16 C8 17.6 32 17.6 38 16" stroke="#C4C3BA" strokeWidth="0.7" fill="none" />
          <Path d="M13.4 10 C13.8 6.6 15.6 4.4 18.4 3.6" stroke="#FFFFFF" strokeWidth="1" fill="none" opacity="0.9" />
        </>
      ) : (
        <>
          {/* A cricket cap, turned with the head: the dome's panels, the button, the badge, the peak forward with its
              shadow over the eyes. */}
          <Ellipse cx="22" cy="18.6" rx="9.6" ry="2.4" fill="#000" opacity="0.32" filter={`url(#${id}softer)`} />
          <Path d="M10 17.4 C9.6 8.6 14 3.6 20.2 3.6 C26.6 3.6 30.6 8.4 30.4 16.6 C25 15.8 15.4 15.8 10 17.4 Z" fill={`url(#${id}cap)`} />
          <Path d="M20.4 3.8 C21.6 7.8 22.2 12 22.2 15.8 M14.4 6 C15.2 9.4 15.6 12.6 15.6 16.4" stroke={shade(look.cap, -0.3)} strokeWidth="0.45" fill="none" />
          <Circle cx="20.4" cy="4" r="1" fill={shade(look.cap, -0.35)} />
          <Circle cx="18.6" cy="11" r="2" fill={look.trim} />
          <Circle cx="18.6" cy="11" r="1" fill={shade(look.trim, 0.4)} />
          <Path d="M15 16.2 C21 15.2 29 15.6 34.6 17.6 C33.8 19.6 31 20.4 27 20 C22.6 19.6 18 18.4 15 16.2 Z" fill={shade(look.cap, -0.28)} />
          <Path d="M16 16.4 C22 15.8 29 16.2 34 17.8" stroke={shade(look.cap, 0.22)} strokeWidth="0.5" fill="none" />
        </>
      )}
    </Svg>
  );
}

const Head = memo(HeadArt);

/** The body from the front (the umpire) or turned three-quarters (a captain): torso, hips, the clothes, lit. */
function TorsoArt({ look, id, facing }: { look: Look; id: string; facing: 1 | -1 }) {
  const umpire = look.kind === 'umpire';
  return (
    <Svg width={FIGURE.w} height={FIGURE.h} viewBox={`0 0 ${FIGURE.w} ${FIGURE.h}`} style={StyleSheet.absoluteFill}>
      <Defs>
        <Round id={`${id}cloth`} base={umpire ? '#F4F3EC' : look.shirt} turn={umpire ? 0 : 0.08} />
        <Round id={`${id}hips`} base="#F3F2EA" turn={0.08} />
        <Soft id={`${id}ao`} by={1.6} />
        <Soft id={`${id}paint`} by={2.4} />
        <Soft id={`${id}rim`} by={0.7} />
      </Defs>
      {umpire ? (
        <>
          {/* The coat from the front: shoulders, chest and the skirt to the knee. */}
          <Path d="M21 48 C21 42 25 38.6 31 37.6 L36.4 36.8 L43.6 36.8 L49 37.6 C55 38.6 59 42 59 48 L59.6 90 L61 124 C52 127.6 28 127.6 19 124 L20.4 90 Z" fill={`url(#${id}cloth)`} />
          {/* The shirt and tie in the V, the shadow under the collar, the lapels over them. */}
          <Path d="M33 37 L40 58 L47 37 Z" fill="#FFFFFF" />
          <Path d="M38.2 38.4 L41.8 38.4 L41.2 41.8 L38.8 41.8 Z" fill="#111414" />
          <Path d="M38.8 41.8 L41.2 41.8 L42.4 60 L40 63.6 L37.6 60 Z" fill="#1C2020" />
          <Ellipse cx="40" cy="39" rx="7" ry="2.2" fill="#000" opacity="0.18" filter={`url(#${id}ao)`} />
          <Path d="M32.4 37 L39.6 59 L36 60 L29.6 44.4 L31 39.4 Z" fill="#E4E3DA" />
          <Path d="M47.6 37 L40.4 59 L44 60 L50.4 44.4 L49 39.4 Z" fill="#DEDDD4" />
          {/* Buttons down the middle, the breast pocket with a pen, the side pockets, folds. */}
          <Path d="M40 60 L40 124" stroke="#CBCAC1" strokeWidth="0.8" />
          {[70, 84, 98, 112].map((y) => (
            <Circle key={y} cx="41.6" cy={y} r="1.1" fill="#A6A59C" />
          ))}
          <Path d="M45 48 L52.4 48 L52.6 54 L45.2 54 Z" fill="none" stroke="#C9C8BF" strokeWidth="0.6" />
          <Path d="M49 44.4 L49 50" stroke="#1E3A8A" strokeWidth="1.2" strokeLinecap="round" />
          <Path d="M24.4 96 L34.6 96 M45.4 96 L55.6 96" stroke="#B9B8AF" strokeWidth="1.1" strokeLinecap="round" />
          <Path d="M27 64 C29 80 27.6 100 26 120 M53 64 C51 80 52.4 100 54 120" stroke="#D3D2C9" strokeWidth="0.7" fill="none" />
        </>
      ) : (
        <>
          {/* Hips in whites; the shirt over a chest turned towards the other captain: the near side broad, the far
              side narrow, the side of the body in shade. Collar, placket and badge sit off the middle, towards them. */}
          <Path d="M27.6 90 L52.6 90 C54 98 53.4 103 52.4 107 L28 107 C26.6 103 26.4 98 27.6 90 Z" fill={`url(#${id}hips)`} />
          <Path d="M21.4 48 C21.4 42 25.4 38.6 31.4 37.6 L37.6 36.8 L45.4 36.8 L50.4 37.8 C55 39 57.6 42.6 57.4 47.6 L55.6 70 C55 82 54.6 90 54.8 95 L26.6 95 C26.4 88 25.4 80 24 70 C22.6 60 21.4 54 21.4 48 Z" fill={`url(#${id}cloth)`} />
          <Path d="M24 70 C25.4 80 26.4 88 26.6 95 L30.6 95 C29.8 86 28.6 76 27 66 C25.6 58 24.2 52 22.4 47 C22 54 22.8 62 24 70 Z" fill={shade(look.shirt, -0.32)} opacity="0.55" />
          <Ellipse cx="42" cy="40" rx="8" ry="2.4" fill="#000" opacity="0.2" filter={`url(#${id}ao)`} />
          <Path d="M36 36.4 L43.4 47 L50.6 37.4 L47 36.4 L43.4 42 L39.4 36.4 Z" fill="#F4F3EC" />
          <Path d="M36 36.4 L43.4 47 L50.6 37.4" stroke={look.trim} strokeWidth="1.1" fill="none" strokeLinejoin="round" />
          <Path d="M43.4 47 L44.2 60" stroke={shade(look.shirt, -0.26)} strokeWidth="0.6" />
          {[51, 56.4].map((y) => (
            <Circle key={y} cx="44.6" cy={y} r="0.65" fill="#F4F3EC" />
          ))}
          <Path d="M28 62 C36 65 46 65 54 61 M27.4 78 C36 81 46 80.6 54.4 77 M32 88 C37 91.6 42 91.4 47 88.6" stroke={shade(look.shirt, -0.24)} strokeWidth="0.6" fill="none" opacity="0.5" />
          <Path d="M26.4 92.6 L54.8 92.6 L54.8 95.4 L26.6 95.4 Z" fill="#26261F" />
          <Path d="M45.6 92.2 L50 92.2 L50 95.8 L45.6 95.8 Z" fill="#BAB9B0" />
          <Circle cx="33" cy="53" r="4" fill="#FFCB52" />
          <Circle cx="33" cy="53" r="4" fill="none" stroke="#B9851A" strokeWidth="0.6" />
          <G transform={facing === -1 ? 'translate(66 0) scale(-1 1)' : undefined}>
            <SvgText x="33" y="55.5" fontSize="6" fontWeight="900" fill="#5A3B05" textAnchor="middle">
              C
            </SvgText>
          </G>
        </>
      )}
      {/* The painter's pass, all soft-edged: the warm key light on the chest, the cloth gathering in shadow under the
          arms and at the waist, and the two floodlights' rims, warm on one edge and cool on the other. */}
      <G filter={`url(#${id}paint)`}>
        <Path d={umpire ? 'M27 46 C32 42 38 42 40 46 C39 56 33 62 28 60 Z' : 'M29 44 C35 40.6 44 40.6 49 44 C47 53 38 58 31 55 Z'} fill="#FFF4D6" opacity={umpire ? 0.35 : 0.24} />
        <Path d={umpire ? 'M23 54 C24 62 24 70 23 78' : 'M25 52 C26 60 27 68 28 76'} stroke="#000" strokeWidth="3" opacity="0.16" fill="none" />
        <Path d={umpire ? 'M57 54 C56 62 56 70 57 78' : 'M54 52 C53.4 60 53 68 53 76'} stroke="#000" strokeWidth="3" opacity="0.16" fill="none" />
        <Path d={umpire ? 'M30 70 C34 76 35 88 33 100 M50 72 C47 80 46 92 48 104' : 'M32 66 C36 72 38 80 37 88 M47 68 C45 74 45 82 46 89'} stroke="#000" strokeWidth="1.6" opacity="0.1" fill="none" />
      </G>
      <G filter={`url(#${id}rim)`}>
        <Path d={umpire ? 'M21.6 48 C21.4 60 21 90 19.8 122' : 'M22 48 C22.2 56 23.6 64 25 72 C26 80 26.8 88 27 94'} stroke="#FFD9A0" strokeWidth="1.2" opacity="0.55" fill="none" />
        <Path d={umpire ? 'M58.4 48 C58.6 60 59 90 60.2 122' : 'M56.8 48 C56.6 56 55.6 66 55 76 C54.6 84 54.6 90 54.6 94'} stroke="#9ED8FF" strokeWidth="1.4" opacity="0.7" fill="none" />
        <Path d={umpire ? 'M24 41.6 C27 39 31 38 35 37.6' : 'M24 42 C27 39.4 31 38.2 36 37.6'} stroke="#FFE7BF" strokeWidth="1.2" opacity="0.6" fill="none" />
        <Path d={umpire ? 'M45 37.6 C49 38 53 39 56 41.6' : 'M45.6 37.2 C49.4 37.8 53 39.4 55.4 42'} stroke="#BFE6FF" strokeWidth="1.2" opacity="0.6" fill="none" />
      </G>
    </Svg>
  );
}

const Torso = memo(TorsoArt);

/** Blinks every few seconds, each person at their own rhythm. */
function Blink({ skin, every, eyes }: { skin: string; every: number; eyes: { x: number; w: number }[] }) {
  const lid = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(every),
        Animated.timing(lid, { toValue: 1, duration: 70, easing: Easing.in(Easing.quad), useNativeDriver: native }),
        Animated.timing(lid, { toValue: 0, duration: 120, easing: Easing.out(Easing.quad), useNativeDriver: native }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [lid, every]);
  return (
    <>
      {eyes.map((e, i) => (
        <Animated.View
          key={i}
          pointerEvents="none"
          style={[styles.lid, { left: e.x - e.w - 0.6, width: e.w * 2 + 1.2, backgroundColor: shade(skin, -0.08), transformOrigin: 'top', transform: [{ scaleY: lid }] }]}
        />
      ))}
    </>
  );
}

/** The person, posed. `facing` -1 turns a captain to face left. */
export function Person({ look, id, pose, facing = 1 }: { look: Look; id: string; pose: Pose; facing?: 1 | -1 }) {
  const umpire = look.kind === 'umpire';
  const turn: 0 | 1 = umpire ? 0 : 1;
  // Breathing: the chest rises and falls, a little out of step between people.
  const breath = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, { toValue: 1, duration: 1700 + id.length * 90, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
        Animated.timing(breath, { toValue: 0, duration: 1900 + id.length * 70, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [breath, id]);
  const chest = breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.016] });

  // Walking towards us: each leg lifts in turn (the knee bending), the arms swing a little against the legs, the body
  // rises over each step and sways onto the standing leg.
  const crouchLift = pose.crouch.interpolate({ inputRange: [0, 1], outputRange: [0, 0.9] });
  const liftA = Animated.add(cycle(pose, [0, 1, 0, 0, 0]), crouchLift);
  const liftB = Animated.add(cycle(pose, [0, 0, 0, 1, 0]), crouchLift);
  const frontSwing = cycle(pose, [0, 9, 0, -9, 0]);
  const backSwing = cycle(pose, [0, -9, 0, 9, 0]);
  const bob = cycle(pose, [0, -1.6, 0, -1.6, 0]);
  const sway = cycle(pose, [0, 1.2, 0, -1.2, 0]);
  const drop = pose.crouch.interpolate({ inputRange: [0, 1], outputRange: [0, 10] });

  const front = { shoulder: deg(Animated.add(pose.frontShoulder, frontSwing)), elbow: deg(pose.frontElbow) };
  const back = { shoulder: deg(Animated.add(pose.backShoulder, backSwing)), elbow: deg(pose.backElbow) };
  // Shoulders: the umpire's square to us; a captain's, the near one wide, the far one in from the edge.
  const shoulders = umpire ? { back: { x: 22.6, y: 41 }, front: { x: 57.4, y: 41 } } : { back: { x: 23.4, y: 41 }, front: { x: 55, y: 41.4 } };
  const frontArm = <Arm at={shoulders.front} shoulder={front.shoulder} elbow={front.elbow} look={look} id={`${id}af`} far={!umpire} facing={facing} />;

  return (
    <View style={[styles.person, facing === -1 && { transform: [{ scaleX: -1 }] }]}>
      {/* A soft shadow on the grass, under the feet. */}
      {/* Shadows on the grass: one long and faint from each floodlight, crossing under the feet, and a dark one
          where they stand. */}
      <Svg width={160} height={30} style={styles.shadow}>
        <Defs>
          <Soft id={`${id}gs`} by={2.2} />
          <Soft id={`${id}gl`} by={3} />
        </Defs>
        <Ellipse cx="50" cy="17" rx="38" ry="4" fill="#000" opacity="0.22" transform="rotate(-9 80 15)" filter={`url(#${id}gl)`} />
        <Ellipse cx="110" cy="17" rx="38" ry="4" fill="#000" opacity="0.22" transform="rotate(9 80 15)" filter={`url(#${id}gl)`} />
        <Ellipse cx="80" cy="15" rx="26" ry="3.6" fill="#000" opacity="0.6" filter={`url(#${id}gs)`} />
      </Svg>
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX: sway }, { translateY: Animated.add(bob, drop) }] }]}>
        {/* A captain's far arm (the one towards the other captain) is behind the body. */}
        {!umpire && frontArm}
        {/* The legs start under the hips (a captain) or under the coat (the umpire), so there's no gap at the top. */}
        <Leg x={umpire ? 33 : 34} top={umpire ? 112 : 100} lift={liftB} look={look} id={`${id}lb`} far={!umpire} turned={!umpire} />
        <Leg x={umpire ? 47 : 46} top={umpire ? 112 : 100} lift={liftA} look={look} id={`${id}lf`} turned={!umpire} />
        <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: '50% 55%', transform: [{ scaleY: chest }, { scaleX: chest }] }]}>
          <Torso look={look} id={id} facing={facing} />
        </Animated.View>
        {/* Looking up lifts the chin a touch with only a hint of tilt (they face us, so the head doesn't swing). */}
        <Animated.View
          style={[
            styles.head,
            {
              left: umpire ? 20 : 21,
              transformOrigin: '50% 92%',
              transform: [{ translateY: pose.head.interpolate({ inputRange: [-30, 30], outputRange: [-2, 2] }) }, { rotate: pose.head.interpolate({ inputRange: [-30, 30], outputRange: ['-9deg', '9deg'] }) }],
            },
          ]}
        >
          <Head look={look} id={id} turn={turn} />
          <Blink skin={look.skin} every={2600 + id.length * 700} eyes={turn ? EYES.turned : EYES.front} />
        </Animated.View>
        <Arm at={shoulders.back} shoulder={back.shoulder} elbow={back.elbow} look={look} id={`${id}ab`} facing={facing} />
        {/* The umpire's arms both hang at the sides of the coat, in front of it. */}
        {umpire && frontArm}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  person: { width: FIGURE.w, height: FIGURE.h },
  joint: { position: 'absolute' },
  head: { position: 'absolute', top: -6, width: 40, height: 44 },
  /** An eyelid, over an eye on the head. */
  lid: { position: 'absolute', top: 20.4, height: 3, borderRadius: 1.5 },
  shadow: { position: 'absolute', left: -40, top: 161 },
});
