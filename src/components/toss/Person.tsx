import { memo, useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';

// A person out in the middle, drawn at 80 × 180 facing right, with joints: the head turns at the neck, the arms at
// the shoulder and elbow, the legs at the hip and knee. A captain wears whites, their side's shirt and cap; the umpire
// a long white coat, dark trousers and a wide hat. Every part is lit by the floodlights (a shadow side, a highlight
// and a rim of light on the edge), and they blink and breathe. Everything is posed from outside with numbers in
// degrees, so the scene can walk them out, turn their heads after the coin and have them signal and celebrate.

export const FIGURE = { w: 80, h: 180 };

export type Look = {
  kind: 'captain' | 'umpire';
  shirt: string;
  /** The trim on collar and sleeves. */
  trim: string;
  cap: string;
  skin: string;
  hair: string;
  /** Stubble, a short beard, a moustache, or clean-shaven. */
  face?: 'stubble' | 'beard' | 'moustache';
  /** Their shirt number, on the sleeve. */
  number?: string;
};

/** The joints, in degrees. 0 is hanging straight down (or the head upright); negative turns towards where they face. */
export type Pose = {
  frontShoulder: Animated.Value;
  frontElbow: Animated.Value;
  backShoulder: Animated.Value;
  backElbow: Animated.Value;
  head: Animated.Value;
  /** How far through the walk: each whole number is one full stride (a step with each foot). */
  gait: Animated.Value;
  /** How much they're walking, 0 to 1: it rises as they set off and falls as they stop, so the feet come together. */
  stride: Animated.Value;
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
  stride: new Animated.Value(0),
  crouch: new Animated.Value(0),
});

/** The most strides a walk can take: the gait runs from 0 to a whole number up to this. */
export const STRIDES = 8;
/** How far one stride (a step with each foot) carries a person on the stage, at full size. */
export const STRIDE_LENGTH = 84;
/** How long a stride takes at an easy walk. */
export const STRIDE_MS = 1050;

const native = Platform.OS !== 'web';

const shade = (hex: string, by: number) => {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(by >= 0 ? c + (255 - c) * by : c * (1 + by))));
  return `#${[f(n >> 16), f((n >> 8) & 255), f(n & 255)].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
};

/** Degrees as a rotation, from a value or a sum of values. */
const deg = (v: Animated.Value | Animated.AnimatedAddition) =>
  (v as Animated.Value).interpolate({ inputRange: [-720, 720], outputRange: ['-720deg', '720deg'] });

/**
 * Light across a rounded part, back to front: in shadow at the back, the colour itself, a highlight, and a thin rim of
 * floodlight on the very edge.
 */
function Lit({ id, base, dim = 0 }: { id: string; base: string; dim?: number }) {
  return (
    <LinearGradient id={id} x1="0" y1="0" x2="1" y2="0">
      <Stop offset="0" stopColor={shade(base, -0.34 + dim)} />
      <Stop offset="0.35" stopColor={shade(base, -0.08 + dim)} />
      <Stop offset="0.7" stopColor={shade(base, 0.06 + dim)} />
      <Stop offset="0.9" stopColor={shade(base, -0.04 + dim)} />
      <Stop offset="1" stopColor={shade(base, 0.32 + dim)} />
    </LinearGradient>
  );
}

/**
 * One stride's pattern (it ends where it starts), repeated for every stride and scaled by how much they're walking.
 */
function cycle(pose: Pose, pattern: number[]) {
  const inputRange: number[] = [];
  const outputRange: number[] = [];
  for (let s = 0; s < STRIDES; s++) pattern.forEach((p, i) => (s > 0 && i === 0 ? null : (inputRange.push(s + i / (pattern.length - 1)), outputRange.push(p))));
  return Animated.multiply(pose.gait.interpolate({ inputRange, outputRange, extrapolate: 'clamp' }), pose.stride);
}

/** A part that turns about a point at its top middle (a shoulder, elbow, hip or knee). */
function Joint({ x, y, w, h, angle, children }: { x: number; y: number; w: number; h: number; angle: Animated.AnimatedInterpolation<string>; children: ReactNode }) {
  return (
    <Animated.View pointerEvents="none" style={[styles.joint, { left: x - w / 2, top: y, width: w, height: h, transformOrigin: 'top', transform: [{ rotate: angle }] }]}>
      {children}
    </Animated.View>
  );
}

/** A tapered limb with a little swell: wide at the top, narrower at the bottom, rounded both ends. */
const limb = (w: number, h: number, top: number, bottom: number, swell = 0) => {
  const a = (w - top) / 2;
  const b = (w - bottom) / 2;
  const m = h * 0.4;
  return `M${a} ${top / 2} Q${a} 0 ${w / 2} 0 Q${w - a} 0 ${w - a} ${top / 2} Q${w - a + swell} ${m} ${w - b} ${h - bottom / 2} Q${w - b} ${h} ${w / 2} ${h} Q${b} ${h} ${b} ${h - bottom / 2} Q${a - swell} ${m} ${a} ${top / 2} Z`;
};

/** A relaxed hand, fingers curled under, the thumb along the front. */
function Hand({ id, skin, dim }: { id: string; skin: string; dim: number }) {
  return (
    <G>
      <Path d="M1 1.5 Q1 0 4.5 0 Q8 0 8.2 1.6 L8.6 6.4 Q8.8 9.6 6 10.4 Q2.6 11 1.4 8.6 Q0.6 6.8 1 1.5 Z" fill={`url(#${id})`} />
      {/* Fingers curled in, and the thumb. */}
      <Path d="M1.6 6.2 Q4 7.4 7.4 6.4" stroke={shade(skin, -0.32 + dim)} strokeWidth="0.55" fill="none" />
      <Path d="M1.8 8.2 Q4.2 9.2 6.8 8.4" stroke={shade(skin, -0.32 + dim)} strokeWidth="0.5" fill="none" />
      <Path d="M7.4 1.8 Q9.6 3.4 8.8 6.2" stroke={shade(skin, -0.22 + dim)} strokeWidth="1.3" strokeLinecap="round" fill="none" />
      <Path d="M7.6 2.2 Q9.2 3.6 8.6 5.6" stroke={shade(skin, 0.2 + dim)} strokeWidth="0.4" strokeLinecap="round" fill="none" />
    </G>
  );
}

function Arm({
  at,
  shoulder,
  elbow,
  look,
  id,
  back,
  facing = 1,
}: {
  at: { x: number; y: number };
  shoulder: Animated.AnimatedInterpolation<string>;
  elbow: Animated.AnimatedInterpolation<string>;
  look: Look;
  id: string;
  back?: boolean;
  facing?: 1 | -1;
}) {
  const umpire = look.kind === 'umpire';
  const dim = back ? -0.16 : 0;
  const sleeve = umpire ? '#F2F1EA' : look.shirt;
  return (
    <Joint x={at.x} y={at.y} w={12} h={30} angle={shoulder}>
      <Svg width={12} height={30} style={StyleSheet.absoluteFill}>
        <Defs>
          <Lit id={`${id}u-skin`} base={look.skin} dim={dim} />
          <Lit id={`${id}u-cloth`} base={sleeve} dim={dim} />
        </Defs>
        {/* Upper arm, the deltoid rounding the shoulder. */}
        <Path d={limb(12, 30, 12, 9, 0.8)} fill={`url(#${id}u-skin)`} />
        {umpire ? (
          <>
            <Path d={limb(12, 30, 12.2, 10, 1)} fill={`url(#${id}u-cloth)`} />
            <Path d="M3 8 Q6 10 9.4 8.6" stroke={shade('#C9C8BF', dim)} strokeWidth="0.5" fill="none" />
          </>
        ) : (
          <>
            {/* A short sleeve with its trim and a crease, the number on it. */}
            <Path d={limb(12, 17, 12.4, 11.4, 1)} fill={`url(#${id}u-cloth)`} />
            <Rect x="0.4" y="14.6" width="11.2" height="2.2" rx="1.1" fill={shade(look.trim, dim)} />
            <Path d="M2.6 6 Q5.4 8.6 9.6 7" stroke={shade(look.shirt, -0.28 + dim)} strokeWidth="0.5" fill="none" />
            {look.number && !back && (
              // Turned back the right way when the figure is mirrored.
              <G transform={facing === -1 ? 'translate(13.2 0) scale(-1 1)' : undefined}>
                <SvgText x="6.6" y="12.6" fontSize="5.4" fontWeight="900" fill={shade(look.trim, -0.1)} textAnchor="middle">
                  {look.number}
                </SvgText>
              </G>
            )}
          </>
        )}
      </Svg>
      <Joint x={6} y={26.5} w={10} h={30} angle={elbow}>
        <Svg width={10} height={30} style={StyleSheet.absoluteFill}>
          <Defs>
            <Lit id={`${id}f-skin`} base={look.skin} dim={dim - 0.02} />
            <Lit id={`${id}f-cloth`} base={sleeve} dim={dim} />
          </Defs>
          {/* Forearm: thicker at the elbow, a tendon line, the wrist; the umpire's in the coat sleeve with a cuff. */}
          <Path d={limb(10, 22, 9.4, 6.6, 0.6)} fill={umpire ? `url(#${id}f-cloth)` : `url(#${id}f-skin)`} />
          {umpire ? (
            <Rect x="1.4" y="17.6" width="7.2" height="3.4" rx="1.4" fill={shade('#D6D5CC', dim)} />
          ) : (
            <Path d="M4.2 4 Q4.8 11 4.6 18" stroke={shade(look.skin, -0.18 + dim)} strokeWidth="0.45" fill="none" />
          )}
          <G transform="translate(0.6 19.4)">
            <Hand id={`${id}f-skin`} skin={look.skin} dim={dim} />
          </G>
        </Svg>
      </Joint>
    </Joint>
  );
}

function Leg({ at, hip, knee, look, id, back }: { at: { x: number; y: number }; hip: Animated.AnimatedInterpolation<string>; knee: Animated.AnimatedInterpolation<string>; look: Look; id: string; back?: boolean }) {
  const umpire = look.kind === 'umpire';
  const dim = back ? -0.14 : 0;
  const trouser = umpire ? '#262C2D' : '#F4F3EC';
  const fold = shade(umpire ? '#121617' : '#CFCEC4', dim);
  return (
    <Joint x={at.x} y={at.y} w={14} h={41} angle={hip}>
      <Svg width={14} height={41} style={StyleSheet.absoluteFill}>
        <Defs>
          <Lit id={`${id}t`} base={trouser} dim={dim} />
        </Defs>
        {/* Thigh: full at the top, the crease down the front, a fold at the knee. */}
        <Path d={limb(14, 41, 14, 11, 1)} fill={`url(#${id}t)`} />
        <Path d="M8.6 3 Q9 20 8.4 37" stroke={fold} strokeWidth="0.6" fill="none" />
        <Path d="M2.4 34 Q6.4 36.2 11 34.6" stroke={fold} strokeWidth="0.6" fill="none" />
      </Svg>
      <Joint x={7} y={37} w={12} h={42} angle={knee}>
        <Svg width={20} height={44} style={styles.overhang}>
          <Defs>
            <Lit id={`${id}s`} base={trouser} dim={dim} />
            <LinearGradient id={`${id}shoe`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={umpire ? shade('#2A2E2F', dim) : shade('#FFFFFF', dim)} />
              <Stop offset="1" stopColor={umpire ? shade('#0C0E0E', dim) : shade('#D4D3CB', dim)} />
            </LinearGradient>
          </Defs>
          {/* Shin and calf, the trouser falling to the shoe with a break. */}
          <Path d={limb(12, 36, 11.2, 9.2, 0.8)} fill={`url(#${id}s)`} />
          <Path d="M7.2 2 Q7.6 18 7 32" stroke={fold} strokeWidth="0.5" fill="none" />
          <Path d="M2 31 Q5.4 33 10 31.6" stroke={fold} strokeWidth="0.55" fill="none" />
          {/* The shoe: toe pointing forward, laces, the sole and (for a captain) spikes. */}
          <Path d="M1.6 33.6 Q1.4 31 5 31 L10.6 31 Q16.4 32.2 18.6 36.6 Q19.2 39 16.6 39.2 L2.6 39.2 Q1.4 39.2 1.6 37.4 Z" fill={`url(#${id}shoe)`} />
          <Path d="M8.4 32.2 L13.6 34.6" stroke={umpire ? '#3E4344' : '#A9A89F'} strokeWidth="0.5" strokeDasharray="1 0.8" />
          <Rect x="1.6" y="38.4" width="17.4" height="1.8" rx="0.9" fill={umpire ? '#050606' : shade('#9C9B92', dim)} />
          {!umpire && [4, 8, 12, 16].map((x) => <Rect key={x} x={x} y="40" width="1.1" height="1.1" fill="#8A8980" />)}
          <Path d="M11 31.4 Q15.6 32.8 17.6 35.6" stroke={umpire ? '#4A4F50' : '#FFFFFF'} strokeWidth="0.5" fill="none" opacity="0.8" />
        </Svg>
      </Joint>
    </Joint>
  );
}

/** The head at 30 × 36, its neck at the bottom middle, facing right: lit face, features, hair, and a cap or hat. */
function HeadArt({ look, id }: { look: Look; id: string }) {
  const umpire = look.kind === 'umpire';
  const hair = umpire ? '#A8A59E' : look.hair;
  const shadowSkin = shade(look.skin, -0.3);
  return (
    <Svg width={30} height={36} viewBox="0 0 30 36">
      <Defs>
        <LinearGradient id={`${id}face`} x1="0" y1="0" x2="1" y2="0.4">
          <Stop offset="0" stopColor={shade(look.skin, -0.26)} />
          <Stop offset="0.45" stopColor={shade(look.skin, -0.04)} />
          <Stop offset="0.8" stopColor={shade(look.skin, 0.08)} />
          <Stop offset="1" stopColor={shade(look.skin, 0.2)} />
        </LinearGradient>
        <RadialGradient id={`${id}cheek`} cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor="#E0846A" stopOpacity="0.28" />
          <Stop offset="1" stopColor="#E0846A" stopOpacity="0" />
        </RadialGradient>
        <LinearGradient id={`${id}cap`} x1="0" y1="0" x2="1" y2="0.6">
          <Stop offset="0" stopColor={shade(look.cap, -0.3)} />
          <Stop offset="0.6" stopColor={look.cap} />
          <Stop offset="1" stopColor={shade(look.cap, 0.18)} />
        </LinearGradient>
      </Defs>
      {/* Neck, darker under the jaw, with the Adam's apple. */}
      <Path d="M11 23 L19.6 23 L19.8 36 L10.8 36 Z" fill={shade(look.skin, -0.18)} />
      <Path d="M17.8 28 Q19.2 29.4 18.6 31" stroke={shadowSkin} strokeWidth="0.5" fill="none" />
      <Path d="M11 24 Q15 27.6 19.6 25" fill={shadowSkin} opacity="0.5" />
      {/* The head: skull, brow, the nose's bridge, upper lip, chin and jaw back to the ear. */}
      <Path
        d="M5 15 Q5 4.2 15 4 Q23.6 4 24.6 11.6 L24.8 13 Q26 15.6 27.2 17.4 Q27.4 18.4 26 18.6 L25.6 19.4 Q26.2 20.4 25.4 21.6 Q25.6 23.6 23.8 25.4 Q20.6 27.8 16.4 27 Q11.4 26.4 8.8 23.2 Q5.2 20 5 15 Z"
        fill={`url(#${id}face)`}
      />
      {/* Cheek colour, the cheekbone's light, the shadow along the jaw. */}
      <Ellipse cx="19.6" cy="18.6" rx="3.6" ry="2.6" fill={`url(#${id}cheek)`} />
      <Path d="M17 15.8 Q19.6 14.8 22.6 16" stroke={shade(look.skin, 0.28)} strokeWidth="0.6" fill="none" opacity="0.7" />
      <Path d="M9 22.6 Q13 26.4 18.6 26.6" stroke={shadowSkin} strokeWidth="0.8" fill="none" opacity="0.55" />
      {/* Hair at the back, the sideburn down in front of the ear. */}
      <Path d="M5 15.2 Q4.2 6.4 11.4 4.4 L16.6 4 Q9.4 7.6 9.6 13.4 L9.2 20.6 Q5.6 19 5 15.2 Z" fill={hair} />
      <Path d="M12.6 12.6 L13.6 12.4 L13.4 19 Q12.8 19.6 12.4 18.8 Z" fill={hair} />
      <Path d="M6.2 10 Q7.6 8 9.6 7.2 M6 13 Q7.4 11 9.4 10.4" stroke={shade(hair, 0.25)} strokeWidth="0.4" fill="none" />
      {/* Ear, with its inner fold and a shadow. */}
      <Path d="M8.8 14.2 Q11.6 13.4 12 16.6 Q12.2 19.6 9.6 20 Q8 19.4 8 17 Q8 15 8.8 14.2 Z" fill={shade(look.skin, -0.12)} />
      <Path d="M9.6 15.4 Q11.2 15.6 10.8 17.6 Q10.4 18.6 9.6 18.4" stroke={shadowSkin} strokeWidth="0.55" fill="none" />
      {/* Brow and eyebrow, the eye with its lid, lashes, iris and a catch of light. */}
      <Path d="M18 11.4 Q21 10 23.8 11.4" stroke={umpire ? '#8C8982' : look.hair} strokeWidth="1.15" strokeLinecap="round" fill="none" />
      <Path d="M19.4 13.4 Q21.6 12.4 23.4 13.6" stroke={shadowSkin} strokeWidth="0.5" fill="none" opacity="0.6" />
      <Path d="M19.8 14.6 Q21.6 13.2 23.3 14.4 Q21.8 15.6 19.8 14.6 Z" fill="#F6F3EC" />
      <Circle cx="22" cy="14.45" r="0.85" fill="#3A2618" />
      <Circle cx="22.05" cy="14.45" r="0.42" fill="#0E0906" />
      <Circle cx="22.3" cy="14.15" r="0.22" fill="#FFFFFF" />
      <Path d="M19.6 14.5 Q21.6 12.9 23.5 14.3" stroke="#2A1C14" strokeWidth="0.55" fill="none" strokeLinecap="round" />
      {/* Nose: its line, the nostril, the shadow below. */}
      <Path d="M24.4 12.8 Q25.6 16 27 17.6 Q26 18.8 24.2 18.6" stroke={shade(look.skin, -0.32)} strokeWidth="0.55" fill="none" />
      <Path d="M24.2 18.2 Q25 18.8 25.4 18.3" stroke={shade(look.skin, -0.45)} strokeWidth="0.5" fill="none" />
      {/* Lips and the line between them. */}
      <Path d="M21.6 21.8 Q23.6 21 25.2 21.6 Q23.6 22.6 21.6 21.8 Z" fill={shade(look.skin, -0.22)} />
      <Path d="M21.8 22 Q23.6 23.6 25 22.2" fill={shade('#B66A57', 0)} opacity="0.55" />
      <Path d="M21.4 21.9 Q23.4 22.4 25.2 21.7" stroke="#6E3628" strokeWidth="0.45" fill="none" />
      {/* Facial hair. */}
      {look.face === 'stubble' && <Path d="M10.4 22 Q13 26.2 17.4 26.6 Q22 26.8 24.6 23.4 L24.2 21 Q21 24 17 22.8 Q13 22 10.4 22 Z" fill={look.hair} opacity="0.22" />}
      {look.face === 'beard' && (
        <Path d="M10.2 21.4 Q11.6 26.8 17 27.6 Q22.4 28 25 23.8 L25.2 22.6 Q23.4 24.4 21.4 23.4 Q19 22.6 16.6 22.8 Q13 22.4 10.2 21.4 Z" fill={look.hair} opacity="0.85" />
      )}
      {(look.face === 'moustache' || look.face === 'beard') && (
        <Path d="M21 20.8 Q23.4 19.4 25.6 20.6 Q24.6 21.4 23.2 21.2 Q22 21.6 21 20.8 Z" fill={umpire ? '#B9B6AE' : look.hair} />
      )}
      {umpire ? (
        <>
          {/* A wide white hat with a dark band, its brim throwing a shadow across the eyes. */}
          <Path d="M5.4 11.4 Q16 14.6 27.4 11 L26.8 13.4 Q16 16.6 6 13.6 Z" fill="#000" opacity="0.16" />
          <Ellipse cx="15.8" cy="10.2" rx="15.2" ry="3.1" fill="#E9E8E0" />
          <Path d="M1.4 10.6 Q15.8 13.6 30.2 10.2" stroke="#C9C8BF" strokeWidth="0.6" fill="none" />
          <Path d="M7.8 10.2 Q7.8 0.6 15.8 0.6 Q23.6 0.6 23.8 10.2 Z" fill="#F9F8F2" />
          <Path d="M8.4 9.6 Q8.6 2 14 1.2" stroke="#FFFFFF" strokeWidth="0.8" fill="none" />
          <Rect x="7.9" y="6.8" width="15.8" height="2.4" fill="#1B1E1C" />
        </>
      ) : (
        <>
          {/* A cricket cap: panels, the button, the logo, and its peak forward with shadow under. */}
          <Path d="M5.6 12.2 Q15 15 25.6 12" fill="#000" opacity="0.18" />
          <Path d="M4.8 12.6 Q4.6 2 15 1.8 Q25 1.8 25.2 11.6 Z" fill={`url(#${id}cap)`} />
          <Path d="M10 3 Q15 2.2 20 3.2 M15 1.9 L15.2 12" stroke={shade(look.cap, -0.25)} strokeWidth="0.45" fill="none" />
          <Circle cx="15" cy="2.2" r="1" fill={shade(look.cap, -0.35)} />
          <Circle cx="20" cy="8.4" r="1.8" fill={look.trim} />
          <Path d="M22.6 10.2 L31 12.2 Q30.6 14.4 22.8 13.1 Z" fill={shade(look.cap, -0.3)} />
          <Path d="M23 13 L30.6 14" stroke={shade(look.cap, -0.5)} strokeWidth="0.5" />
        </>
      )}
    </Svg>
  );
}

const Head = memo(HeadArt);

/** The body: torso and hips, with the shirt or coat, lit and creased. */
function TorsoArt({ look, id, facing }: { look: Look; id: string; facing: 1 | -1 }) {
  const umpire = look.kind === 'umpire';
  return (
    <Svg width={FIGURE.w} height={FIGURE.h} viewBox={`0 0 ${FIGURE.w} ${FIGURE.h}`} style={StyleSheet.absoluteFill}>
      <Defs>
        <Lit id={`${id}cloth`} base={umpire ? '#F4F3EC' : look.shirt} />
        <Lit id={`${id}trouser`} base="#F4F3EC" />
      </Defs>
      {umpire ? (
        <>
          {/* Side on: the long coat from the shoulder to the knee, the chest forward, the back behind. A lapel and the
              tie at the front, a breast pocket with a pen, buttons down the front edge, a side pocket. */}
          <Path d="M36.6 35 L44 35 Q51 37 52.6 45 Q55.2 60 55.6 80 L57.6 120 Q42 123.4 25.8 120 L28.4 80 Q28.6 60 29.6 46 Q30.8 37 36.6 35 Z" fill={`url(#${id}cloth)`} />
          <Path d="M43.8 35.2 L50.6 38.4 L47.2 54 L45.4 40 Z" fill="#E1E0D7" />
          <Path d="M47.4 37.2 L49.4 37.8 L48.8 52 L47.2 53.6 Z" fill="#1B1F1F" />
          <Path d="M44.6 46.4 L51.2 46.4 L51.4 51.6 L44.8 51.6 Z" fill="none" stroke="#C9C8BF" strokeWidth="0.6" />
          <Rect x="48.6" y="43" width="1.2" height="5" rx="0.6" fill="#1E3A8A" />
          {[64, 78, 92, 106].map((y) => (
            <Circle key={y} cx={53.6 + (y - 64) * 0.03} cy={y} r="1.05" fill="#A3A299" />
          ))}
          <Path d="M53.4 56 Q55.4 84 56.4 119" stroke="#D2D1C8" strokeWidth="0.7" fill="none" />
          <Path d="M36 90 L46 90" stroke="#B9B8AF" strokeWidth="1" />
          <Path d="M31 60 Q30 86 29 116" stroke="#D2D1C8" strokeWidth="0.7" fill="none" />
        </>
      ) : (
        <>
          {/* Side on: the hip and seat in whites; the shirt over a forward chest and a back; the collar at the front of
              the neck with its trim; the placket down the front; folds; the belt; the captain's badge on the chest. */}
          <Path d="M29.2 90 L51.4 90 Q53.4 98 51.2 106.4 L30 106.4 Q26.6 98.6 29.2 90 Z" fill={`url(#${id}trouser)`} />
          <Path d="M36.6 35 L44 35 Q50 37 51.6 44 Q53.6 52 52.6 60 Q51.4 72 51.6 84 L51.8 95 L29 95 Q30 84 30.6 72 Q29.2 58 30.2 46 Q31 37 36.6 35 Z" fill={`url(#${id}cloth)`} />
          <Path d="M42.6 34.6 L48 36.8 L44.8 42.4 Z" fill="#F4F3EC" />
          <Path d="M42.6 34.6 L48 36.8 L44.8 42.4" stroke={look.trim} strokeWidth="1" fill="none" />
          <Path d="M35.2 35 L38.4 34.4 L39 37.8 L35.4 38 Z" fill={shade(look.shirt, -0.2)} />
          <Path d="M49.4 42 L50.6 60" stroke={shade(look.shirt, -0.25)} strokeWidth="0.6" />
          {[48, 54].map((y) => (
            <Circle key={y} cx={50.2} cy={y} r="0.65" fill="#F4F3EC" />
          ))}
          <Path d="M32 62 Q42 65 51 61 M31.4 76 Q40 79 51.2 75 M33 87 Q38 91 44 88.6" stroke={shade(look.shirt, -0.22)} strokeWidth="0.55" fill="none" opacity="0.55" />
          <Path d="M30.2 46 Q29.4 60 30.6 72 Q30 84 29 95" stroke={shade(look.shirt, -0.36)} strokeWidth="0.8" fill="none" />
          <Rect x="29" y="92.6" width="23" height="2.6" rx="1.3" fill="#2A2A26" />
          <Rect x="47.6" y="92.2" width="3.6" height="3.4" rx="0.6" fill="#B9B8AF" />
          <Circle cx="46" cy="52" r="3.8" fill="#FFCB52" />
          <Circle cx="46" cy="52" r="3.8" fill="none" stroke="#B9851A" strokeWidth="0.6" />
          {/* Turned back the right way when the figure is mirrored. */}
          <G transform={facing === -1 ? 'translate(92 0) scale(-1 1)' : undefined}>
            <SvgText x="46" y="54.4" fontSize="5.8" fontWeight="900" fill="#5A3B05" textAnchor="middle">
              C
            </SvgText>
          </G>
        </>
      )}
    </Svg>
  );
}

const Torso = memo(TorsoArt);

/** Blinks every few seconds, each person at their own rhythm: a lid closing over the eye. */
function Blink({ skin, every }: { skin: string; every: number }) {
  const lid = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(every),
        Animated.timing(lid, { toValue: 1, duration: 70, easing: Easing.in(Easing.quad), useNativeDriver: native }),
        Animated.timing(lid, { toValue: 0, duration: 110, easing: Easing.out(Easing.quad), useNativeDriver: native }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [lid, every]);
  return <Animated.View pointerEvents="none" style={[styles.lid, { backgroundColor: shade(skin, -0.06), transformOrigin: 'top', transform: [{ scaleY: lid }] }]} />;
}

/** The person, posed. `facing` -1 turns them to face left. */
export function Person({ look, id, pose, facing = 1 }: { look: Look; id: string; pose: Pose; facing?: 1 | -1 }) {
  const umpire = look.kind === 'umpire';
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
  const chest = breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.018] });

  // The walk, a stride at a time: the front foot lands heel first with the knee straight, the leg passes under the
  // body, pushes off behind with the knee bending, and swings through with the knee bent most. The other leg does
  // the same half a stride later. The arms swing against the legs; the body is lowest with both feet down.
  const legA = cycle(pose, [-24, -2, 20, 2, -24]);
  const kneeA = cycle(pose, [4, 8, 28, 42, 4]);
  const legB = cycle(pose, [20, 2, -24, -2, 20]);
  const kneeB = cycle(pose, [28, 42, 4, 8, 28]);
  const frontSwing = cycle(pose, [17, 1, -15, -1, 17]);
  const backSwing = cycle(pose, [-15, -1, 17, 1, -15]);
  const elbowSwing = cycle(pose, [-4, -10, -22, -10, -4]);
  const bob = cycle(pose, [1.2, -1.4, 1.2, -1.4, 1.2]);
  // A crouch bends the hips forward and the knees back, and drops the body.
  const hipBend = pose.crouch.interpolate({ inputRange: [0, 1], outputRange: [0, -28] });
  const kneeBend = pose.crouch.interpolate({ inputRange: [0, 1], outputRange: [0, 50] });
  const drop = pose.crouch.interpolate({ inputRange: [0, 1], outputRange: [0, 12] });

  const front = { shoulder: deg(Animated.add(pose.frontShoulder, frontSwing)), elbow: deg(Animated.add(pose.frontElbow, elbowSwing)) };
  const back = { shoulder: deg(Animated.add(pose.backShoulder, backSwing)), elbow: deg(Animated.add(pose.backElbow, elbowSwing)) };
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
        {/* Side on, the far arm and leg are behind the body, the near ones in front of it. */}
        <Arm at={{ x: 39, y: 38.6 }} shoulder={back.shoulder} elbow={back.elbow} look={look} id={`${id}ab`} back />
        <Leg at={{ x: 38.6, y: 96 }} hip={hips.b} knee={hips.kb} look={look} id={`${id}lb`} back />
        {umpire && <Leg at={{ x: 41.6, y: 96 }} hip={hips.a} knee={hips.ka} look={look} id={`${id}lf`} />}
        <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: '50% 55%', transform: [{ scaleY: chest }, { scaleX: chest }] }]}>
          <Torso look={look} id={id} facing={facing} />
        </Animated.View>
        {!umpire && <Leg at={{ x: 41.6, y: 96 }} hip={hips.a} knee={hips.ka} look={look} id={`${id}lf`} />}
        <Animated.View style={[styles.head, { transformOrigin: '50% 90%', transform: [{ rotate: deg(pose.head) }] }]}>
          <Head look={look} id={id} />
          <Blink skin={look.skin} every={2600 + id.length * 700} />
        </Animated.View>
        <Arm at={{ x: 41.6, y: 39.4 }} shoulder={front.shoulder} elbow={front.elbow} look={look} id={`${id}af`} facing={facing} />
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
  /** The eyelid, sitting over the eye on the head. */
  lid: { position: 'absolute', left: 19.4, top: 12.6, width: 4.4, height: 2.6, borderRadius: 1.4 },
  shadow: { position: 'absolute', left: 6, top: 167 },
});
