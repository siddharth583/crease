import { memo } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';

// A figure out in the middle, drawn at 80 × 170 and facing right: a captain in whites with their side's shirt and
// cap, or the umpire in a white coat and wide hat. The arms are separate, so they can toss, point and celebrate.

export const FIGURE = { w: 80, h: 170 };
/** Where each shoulder is on the figure, and how long an arm is. */
export const SHOULDER = { back: { x: 24, y: 52 }, front: { x: 56, y: 52 }, arm: 48 };

export type Look = { kind: 'captain' | 'umpire'; shirt: string; cap: string; skin: string };

const shade = (hex: string, by: number) => {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c * (1 + by))));
  return `#${[f(n >> 16), f((n >> 8) & 255), f(n & 255)].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
};

function BodyArt({ look, id, facing }: { look: Look; id: string; facing: 1 | -1 }) {
  const umpire = look.kind === 'umpire';
  const coat = '#F3F2EC';
  return (
    <Svg width={FIGURE.w} height={FIGURE.h} viewBox={`0 0 ${FIGURE.w} ${FIGURE.h}`}>
      <Defs>
        <LinearGradient id={`${id}shirt`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={umpire ? '#FFFFFF' : shade(look.shirt, 0.12)} />
          <Stop offset="1" stopColor={umpire ? '#D9D8D0' : shade(look.shirt, -0.28)} />
        </LinearGradient>
        <LinearGradient id={`${id}legs`} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={umpire ? '#2A302C' : '#FFFFFF'} />
          <Stop offset="1" stopColor={umpire ? '#151917' : '#CFCFC6'} />
        </LinearGradient>
        <LinearGradient id={`${id}skin`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={shade(look.skin, 0.1)} />
          <Stop offset="1" stopColor={shade(look.skin, -0.18)} />
        </LinearGradient>
        <LinearGradient id={`${id}cap`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={shade(look.cap, 0.15)} />
          <Stop offset="1" stopColor={shade(look.cap, -0.3)} />
        </LinearGradient>
      </Defs>
      {/* Shadow on the grass. */}
      <Ellipse cx="40" cy="165" rx="26" ry="4.5" fill="#000" opacity="0.4" />
      {/* Legs and shoes. */}
      <Rect x="27" y="98" width="12" height="64" rx="4" fill={`url(#${id}legs)`} />
      <Rect x="41" y="98" width="12" height="64" rx="4" fill={`url(#${id}legs)`} />
      <Ellipse cx="34" cy="163" rx="9" ry="3.6" fill={umpire ? '#0E100F' : '#EDEDE6'} />
      <Ellipse cx="49" cy="163" rx="9" ry="3.6" fill={umpire ? '#0E100F' : '#EDEDE6'} />
      {/* Neck. */}
      <Rect x="35" y="36" width="10" height="11" rx="3" fill={`url(#${id}skin)`} />
      {umpire ? (
        <>
          {/* The umpire's long white coat, lapels and black tie. */}
          <Path d="M17 58 Q17 46 30 44 L50 44 Q63 46 63 58 L66 122 L14 122 Z" fill={`url(#${id}shirt)`} />
          <Path d="M33 44 L40 62 L47 44" fill="none" stroke="#BDBCB2" strokeWidth="1.4" />
          <Path d="M38.6 47 L41.4 47 L42.4 70 L40 74 L37.6 70 Z" fill="#141716" />
          {[80, 92, 104].map((y) => (
            <Circle key={y} cx="40" cy={y} r="1.3" fill="#9C9B92" />
          ))}
          <Rect x="22" y="96" width="9" height="5" rx="1" fill="#D1D0C7" />
          <Rect x="49" y="96" width="9" height="5" rx="1" fill="#D1D0C7" />
        </>
      ) : (
        <>
          {/* A captain's shirt, open collar, and the captain's armband. */}
          <Path d="M19 58 Q19 46 30 44 L50 44 Q61 46 61 58 L59 102 L21 102 Z" fill={`url(#${id}shirt)`} />
          <Path d="M34 44 L40 54 L46 44" fill={coat} />
          <Rect x="21" y="100" width="38" height="4" rx="2" fill="#EDEDE6" />
          <Circle cx="50" cy="66" r="5.5" fill="#FFCB52" />
          {/* Turned back the right way round when the whole figure is mirrored. */}
          <G transform={facing === -1 ? 'translate(100 0) scale(-1 1)' : undefined}>
            <SvgText x="50" y="69.2" fontSize="8" fontWeight="900" fill="#5A3B05" textAnchor="middle">
              C
            </SvgText>
          </G>
        </>
      )}
      {/* Head, ear and eye, facing right. */}
      <Circle cx="40" cy="27" r="13" fill={`url(#${id}skin)`} />
      <Ellipse cx="34" cy="28" rx="2.6" ry="3.4" fill={shade(look.skin, -0.12)} />
      <Circle cx="47.5" cy="27" r="1.4" fill="#1B1410" />
      <Path d="M45 33.5 Q48 35 50.5 33" fill="none" stroke="#7A4A35" strokeWidth="1.1" strokeLinecap="round" />
      {umpire ? (
        <>
          {/* A wide white hat with a black band. */}
          <Ellipse cx="41" cy="18" rx="22" ry="4.6" fill="#ECEBE3" />
          <Path d="M29 18 Q29 5 40 5 Q51 5 52 18 Z" fill="#F7F6F0" />
          <Rect x="29.2" y="14" width="22.6" height="3.2" fill="#1B1E1C" />
        </>
      ) : (
        <>
          {/* A cap in the side's colour, its peak towards the other captain. */}
          <Path d="M27 21 Q27 8 40 8 Q53 8 53 21 Z" fill={`url(#${id}cap)`} />
          <Path d="M48 19 L64 21.5 Q63 24.5 49 23.5 Z" fill={shade(look.cap, -0.35)} />
          <Circle cx="40" cy="8.6" r="1.4" fill={shade(look.cap, -0.4)} />
        </>
      )}
    </Svg>
  );
}

const Body = memo(BodyArt);

/** An arm hanging from the shoulder: a sleeve and a hand, turned by `angle` (degrees, 0 is straight down). */
function Arm({ at, angle, sleeve, skin }: { at: { x: number; y: number }; angle: Animated.AnimatedInterpolation<string> | string; sleeve: string; skin: string }) {
  const L = SHOULDER.arm;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.arm,
        { left: at.x - 6, top: at.y - 4, height: L + 8 },
        // Turned about the shoulder: the top of the arm.
        { transform: [{ translateY: -(L + 8) / 2 }, { rotate: angle }, { translateY: (L + 8) / 2 }] },
      ]}
    >
      <Svg width={12} height={L + 8} viewBox={`0 0 12 ${L + 8}`}>
        <Rect x="0.5" y="0" width="11" height={L * 0.55} rx="5.5" fill={sleeve} />
        <Rect x="2" y={L * 0.45} width="8" height={L * 0.5} rx="4" fill={skin} />
        <Circle cx="6" cy={L + 1} r="5" fill={skin} />
      </Svg>
    </Animated.View>
  );
}

/**
 * A figure with its arms. `front` and `back` turn the arms; `facing` -1 turns the figure to face left.
 */
export function Person({
  look,
  id,
  front,
  back,
  facing = 1,
}: {
  look: Look;
  id: string;
  front: Animated.AnimatedInterpolation<string> | string;
  back: Animated.AnimatedInterpolation<string> | string;
  facing?: 1 | -1;
}) {
  const sleeve = look.kind === 'umpire' ? '#EDECE5' : look.shirt;
  return (
    <View style={[styles.person, facing === -1 && { transform: [{ scaleX: -1 }] }]}>
      <Arm at={SHOULDER.back} angle={back} sleeve={shade(sleeve, -0.18)} skin={shade(look.skin, -0.1)} />
      <Body look={look} id={id} facing={facing} />
      <Arm at={SHOULDER.front} angle={front} sleeve={sleeve} skin={look.skin} />
    </View>
  );
}

const styles = StyleSheet.create({
  person: { width: FIGURE.w, height: FIGURE.h },
  arm: { position: 'absolute', width: 12 },
});
