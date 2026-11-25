import { LinearGradient as Fade } from 'expo-linear-gradient';
import { memo, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Line, LinearGradient, Path, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { colors, ink } from '../theme.ts';
import { css, EASE_OUT, useReducedMotion, webRise } from './motion.tsx';

// Cricket furniture: the shapes that make a screen feel like it belongs to a cricket ground and not to a generic
// dashboard. Use these (with the motion helpers) instead of plain lines and boxes wherever they fit.

const native = Platform.OS !== 'web';

/** A steady scatter of points (the crowd in the stands), the same every time it's drawn. */
function crowd(n: number, seed = 7) {
  let x = seed;
  const rnd = () => ((x = (x * 16807) % 2147483647) / 2147483647);
  return Array.from({ length: n }, () => ({ a: rnd() * Math.PI * 2, r: rnd(), c: rnd() }));
}
const CROWD = crowd(260);
/** The crowd drawn as three shapes (one per shirt colour) rather than hundreds: far less for a phone to lay out. */
const CROWD_PATHS = (() => {
  const groups: Record<string, string[]> = { brass: [], volt: [], ivory: [] };
  for (const p of CROWD) {
    const rr = 0.72 + p.r * 0.28;
    const x = 200 + Math.cos(p.a) * 290 * rr;
    const y = 168 + Math.sin(p.a) * 152 * rr;
    const r = 0.9 + p.c * 0.8;
    const g = p.c > 0.8 ? 'brass' : p.c > 0.55 ? 'volt' : 'ivory';
    groups[g].push(`M${(x - r).toFixed(1)} ${y.toFixed(1)}a${r.toFixed(1)} ${r.toFixed(1)} 0 1 0 ${(2 * r).toFixed(1)} 0a${r.toFixed(1)} ${r.toFixed(1)} 0 1 0 ${(-2 * r).toFixed(1)} 0`);
  }
  return [
    { d: groups.brass.join(''), fill: '#E3BE72', opacity: 0.38 },
    { d: groups.volt.join(''), fill: '#D7FF3A', opacity: 0.3 },
    { d: groups.ivory.join(''), fill: '#F4F1E6', opacity: 0.24 },
  ];
})();
/** The mown stripes as one shape. */
const STRIPES = Array.from({ length: 22 }, (_, i) => `M${i * 20 - 20} 40h10v240h-10z`).join('');

/**
 * The ground at night, seen from high in the stands: floodlight towers throwing their beams down, the crowd in the
 * stands, the advertising boards and the rope, a mown outfield with its 30-yard circle, and the pitch running away in
 * the middle. Fills its parent, behind a panel's content. `opacity` is how strongly it shows (0.1 is the usual: the
 * numbers stay the hero); `drift` pans it very slowly, like a broadcast camera.
 */
export const OvalGround = memo(function OvalGround({ color = '#FFFFFF', opacity = 0.09, drift = true, style }: { color?: string; opacity?: number; drift?: boolean; style?: StyleProp<ViewStyle> }) {
  const still = useReducedMotion();
  const id = `g${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const pan = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    // On the web the pan would run through JavaScript every frame for as long as the page is open: there it holds still.
    // The ground holds still: the slow pan was decoration.
    if (still || !drift || !native || true) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pan, { toValue: 1, duration: 16000, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
        Animated.timing(pan, { toValue: 0, duration: 16000, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [still, drift, pan]);
  const translateX = pan.interpolate({ inputRange: [0, 1], outputRange: [-8, 8] });
  const scale = pan.interpolate({ inputRange: [0, 1], outputRange: [1.04, 1.08] });
  // The illustration is drawn in full colour; `opacity` (0.07 to 0.12 at the call sites) sets how far it shows through.
  const strength = Math.min(0.95, opacity * 7.5);
  const W = 400;
  const cx = 200;
  const cy = 168;
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: strength, transform: native ? [{ translateX }, { scale }] : [{ scale: 1.06 }] }, style]}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${W} 240`} preserveAspectRatio="xMidYMid slice">
        <Defs>
          <RadialGradient id={`${id}grass`} cx={cx} cy={cy} rx="210" ry="104" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#2F7A43" />
            <Stop offset="0.7" stopColor="#1C5530" />
            <Stop offset="1" stopColor="#123D22" />
          </RadialGradient>
          <LinearGradient id={`${id}pitch`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#B99C62" />
            <Stop offset="1" stopColor="#D6BD86" />
          </LinearGradient>
          <LinearGradient id={`${id}beam`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#F4FFE6" stopOpacity="0.38" />
            <Stop offset="1" stopColor="#F4FFE6" stopOpacity="0" />
          </LinearGradient>
          <RadialGradient id={`${id}lamp`} cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="1" />
            <Stop offset="0.35" stopColor="#F4FFE0" stopOpacity="0.7" />
            <Stop offset="1" stopColor="#F4FFE0" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id={`${id}stand`} cx={cx} cy={cy} rx="300" ry="160" gradientUnits="userSpaceOnUse">
            <Stop offset="0.6" stopColor="#0B1A11" />
            <Stop offset="1" stopColor="#040A06" />
          </RadialGradient>
          <ClipPath id={`${id}field`}>
            <Ellipse cx={cx} cy={cy} rx="206" ry="102" />
          </ClipPath>
        </Defs>
        {/* The stands, packed. */}
        <Ellipse cx={cx} cy={cy} rx="300" ry="160" fill={`url(#${id}stand)`} />
        {CROWD_PATHS.map((g) => (
          <Path key={g.fill} d={g.d} fill={g.fill} opacity={g.opacity} />
        ))}
        {/* Advertising boards, then the rope. */}
        <Ellipse cx={cx} cy={cy} rx="214" ry="108" fill="none" stroke="#0A0F0C" strokeWidth="7" />
        <Ellipse cx={cx} cy={cy} rx="214" ry="108" fill="none" stroke="#D7FF3A" strokeWidth="5" strokeDasharray="18 10" opacity={0.35} />
        <Ellipse cx={cx} cy={cy} rx="206" ry="102" fill={`url(#${id}grass)`} />
        {/* Mown stripes across the outfield. */}
        <G clipPath={`url(#${id}field)`}>
          <Path d={STRIPES} fill="#FFFFFF" opacity={0.045} />
        </G>
        <Ellipse cx={cx} cy={cy} rx="206" ry="102" fill="none" stroke={color} strokeWidth="1.6" opacity={0.75} />
        <Ellipse cx={cx} cy={cy} rx="104" ry="52" fill="none" stroke={color} strokeWidth="1.2" strokeDasharray="3 5" opacity={0.55} />
        {/* The pitch, running away from the camera, with its creases and stumps. */}
        <Path d={`M${cx - 9} ${cy - 40} L${cx + 9} ${cy - 40} L${cx + 14} ${cy + 40} L${cx - 14} ${cy + 40} Z`} fill={`url(#${id}pitch)`} opacity={0.9} />
        <Line x1={cx - 13} y1={cy - 33} x2={cx + 13} y2={cy - 33} stroke="#FFFFFF" strokeWidth="1" opacity={0.85} />
        <Line x1={cx - 17} y1={cy + 32} x2={cx + 17} y2={cy + 32} stroke="#FFFFFF" strokeWidth="1.2" opacity={0.85} />
        <Rect x={cx - 3} y={cy - 39} width="6" height="2.2" rx="1" fill="#F4F1E6" />
        <Rect x={cx - 4} y={cy + 36} width="8" height="2.6" rx="1" fill="#F4F1E6" />
        {/* Four floodlight towers, their beams falling on the square. */}
        {[
          [28, 6],
          [372, 6],
        ].map(([x, y], i) => (
          <G key={i}>
            <Path d={`M${x} ${y + 6} L${cx + (i ? 60 : -60)} ${cy + 30} L${cx + (i ? -10 : 10)} ${cy + 30} Z`} fill={`url(#${id}beam)`} />
            <Line x1={x} y1={y + 6} x2={x + (i ? 10 : -10)} y2={y + 70} stroke="#0A0F0C" strokeWidth="3" />
            <Rect x={x - 11} y={y - 2} width="22" height="9" rx="2" fill="#1A221C" />
            <Circle cx={x} cy={y + 2} r="22" fill={`url(#${id}lamp)`} />
          </G>
        ))}
      </Svg>
    </Animated.View>
  );
});

/**
 * A quiet divider between the parts of a card: one hairline that fades out at both ends. (It keeps its old name and
 * height so every card spaces the same.) `stitch` is no longer used.
 */
export function SeamDivider({ color, style }: { color?: string; style?: StyleProp<ViewStyle>; stitch?: number }) {
  const c = color ?? ink(0.14);
  return (
    <View style={[{ height: 9, justifyContent: 'center' }, style]} accessible={false}>
      <Fade colors={['transparent', c, c, 'transparent']} locations={[0, 0.15, 0.85, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: 1 }} />
    </View>
  );
}

const SPIN = css({ '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } }, 1400, 'linear');

/** A cricket ball with its seam: for icons, bullets and loaders. `spin` rolls it. */
export function SeamBall({ size = 28, color = colors.danger, seam = '#FFF1E2', spin = false }: { size?: number; color?: string; seam?: string; spin?: boolean }) {
  const still = useReducedMotion();
  const turn = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!spin || still || !native) return;
    const loop = Animated.loop(Animated.timing(turn, { toValue: 1, duration: 1400, easing: Easing.linear, useNativeDriver: native }));
    loop.start();
    return () => loop.stop();
  }, [spin, still, turn]);
  const rotate = turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <Animated.View style={[{ width: size, height: size }, native ? { transform: [{ rotate }] } : spin && !still ? SPIN : null]}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Circle cx="50" cy="50" r="48" fill={color} />
        <Path d="M30 8 C 52 30, 52 70, 30 92" fill="none" stroke={seam} strokeWidth="3.2" opacity={0.9} />
        <Path d="M70 8 C 48 30, 48 70, 70 92" fill="none" stroke={seam} strokeWidth="3.2" opacity={0.9} />
        <G stroke={seam} strokeWidth="2.6" strokeLinecap="round" opacity={0.85}>
          {[22, 34, 46, 58, 70].map((y) => (
            <G key={y}>
              <Line x1={y < 40 ? 36 + (y - 22) * 0.1 : 40} y1={y} x2={y < 40 ? 44 : 46} y2={y + 4} />
              <Line x1={y < 40 ? 64 - (y - 22) * 0.1 : 60} y1={y} x2={y < 40 ? 56 : 54} y2={y + 4} />
            </G>
          ))}
        </G>
      </Svg>
    </Animated.View>
  );
}

/**
 * Three stumps and two bails. When `hit` turns true the bails fly off and the stumps knock back: the wicket falling.
 * It resets when `hit` goes false again.
 */
export function Stumps({ size = 64, hit = false, color = colors.text, bail = colors.accent }: { size?: number; hit?: boolean; color?: string; bail?: string }) {
  const still = useReducedMotion();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (still) return v.setValue(hit ? 1 : 0);
    Animated.spring(v, { toValue: hit ? 1 : 0, useNativeDriver: native, speed: 9, bounciness: 12 }).start();
  }, [hit, still, v]);
  const w = size * 0.13;
  const h = size * 0.78;
  const lean = (d: number) => v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${d}deg`] });
  const stump = (i: number, d: number) => (
    <Animated.View key={i} style={{ width: w, height: h, borderRadius: w / 2, backgroundColor: color, marginHorizontal: w * 0.35, transform: [{ rotate: lean(d) }], transformOrigin: 'bottom' as never }} />
  );
  const fly = (dx: number, dy: number, rot: number) => ({
    transform: [
      { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, dx] }) },
      { translateY: v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, dy, 0] }) },
      { rotate: v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${rot}deg`] }) },
    ],
  });
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'flex-end' }}>
      <View style={{ position: 'absolute', top: size * 0.06, flexDirection: 'row' }}>
        <Animated.View style={[{ width: w * 2.3, height: w * 0.45, borderRadius: w, backgroundColor: bail, marginRight: w * 0.6 }, fly(-size * 0.4, -size * 0.45, -70)]} />
        <Animated.View style={[{ width: w * 2.3, height: w * 0.45, borderRadius: w, backgroundColor: bail }, fly(size * 0.45, -size * 0.55, 80)]} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
        {stump(0, -14)}
        {stump(1, 6)}
        {stump(2, 18)}
      </View>
    </View>
  );
}

/**
 * A number that rolls like a scoreboard digit: the old value slides up out of the window as the new one arrives from
 * below. Each character rolls on its own, so 99 to 100 turns three digits.
 */
export function Flip({ value, style, lineHeight }: { value: string | number; style?: StyleProp<TextStyle>; lineHeight: number }) {
  const text = String(value);
  return (
    <View style={{ flexDirection: 'row', height: lineHeight, overflow: 'hidden' }} accessibilityLabel={text}>
      {[...text].map((ch, i) => (
        <Digit key={`${text.length - i}`} ch={ch} style={style} lineHeight={lineHeight} />
      ))}
    </View>
  );
}

function Digit({ ch, style, lineHeight }: { ch: string; style?: StyleProp<TextStyle>; lineHeight: number }) {
  const still = useReducedMotion();
  const [prev, setPrev] = useState(ch);
  const v = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (ch === prev) return;
    if (still) return setPrev(ch);
    v.setValue(0);
    Animated.timing(v, { toValue: 1, duration: 420, easing: EASE_OUT, useNativeDriver: native }).start(() => setPrev(ch));
  }, [ch, prev, still, v]);
  const rolling = ch !== prev;
  const out = v.interpolate({ inputRange: [0, 1], outputRange: [0, -lineHeight] });
  const inn = v.interpolate({ inputRange: [0, 1], outputRange: [lineHeight, 0] });
  return (
    <View style={{ height: lineHeight }}>
      {rolling ? (
        <>
          <Animated.Text style={[style, { lineHeight, position: 'absolute', transform: [{ translateY: out }] }]}>{prev}</Animated.Text>
          <Animated.Text style={[style, { lineHeight, transform: [{ translateY: inn }] }]}>{ch}</Animated.Text>
        </>
      ) : (
        <Text style={[style, { lineHeight }]}>{ch}</Text>
      )}
    </View>
  );
}

/** A group of cards, one under another. They used to rise in one by one; now they're simply there. */
export function Stagger({ children, style }: { children: ReactNode[]; step?: number; style?: StyleProp<ViewStyle> }) {
  return <View style={style}>{children}</View>;
}

/**
 * A player's shirt, for when there is no photo: a cricket jersey in their side's colours with their initials on the
 * chest, standing where the cut-out would. `id` keeps gradients apart when several share a page.
 */
export function Jersey({ size, from, to, initials, id }: { size: number; from: string; to: string; initials: string; id: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id={`${id}j`} x1="0" y1="0" x2="0.3" y2="1">
          <Stop offset="0" stopColor={from} />
          <Stop offset="1" stopColor={to} />
        </LinearGradient>
      </Defs>
      <Path d="M31 10 L43 5 Q50 12 57 5 L69 10 L91 27 L80 43 L71 36 L71 95 L29 95 L29 36 L20 43 L9 27 Z" fill={`url(#${id}j)`} stroke="rgba(255,255,255,0.25)" strokeWidth="1.2" strokeLinejoin="round" />
      <Path d="M43 5 Q50 16 57 5" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="2.4" />
      <Path d="M29 36 L29 95 M71 36 L71 95" stroke="rgba(0,0,0,0.18)" strokeWidth="5" />
      <SvgText x="50" y="64" fontSize="24" fontWeight="900" fill="rgba(255,255,255,0.92)" textAnchor="middle" letterSpacing="-1">
        {initials}
      </SvgText>
    </Svg>
  );
}
