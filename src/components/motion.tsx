import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

// Crease's motion: quick to start, slow to settle (ease-out-quint), with springs only where a thing lands. Every
// piece steps aside when the phone asks for reduced motion.

const native = Platform.OS !== 'web';

/** The house curve: fast off the mark, a long soft landing. */
export const EASE_OUT = Easing.bezier(0.22, 1, 0.36, 1);
export const EASE_IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);

let reduced = false;
const listeners = new Set<(v: boolean) => void>();
AccessibilityInfo.isReduceMotionEnabled()
  .then((v) => {
    reduced = v;
    listeners.forEach((l) => l(v));
  })
  .catch(() => {});
AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v) => {
  reduced = v;
  listeners.forEach((l) => l(v));
});

/** True when the phone (or browser) asks for less motion. */
export function useReducedMotion() {
  const [v, set] = useState(reduced);
  useEffect(() => {
    listeners.add(set);
    return () => {
      listeners.delete(set);
    };
  }, []);
  return v;
}

/**
 * A figure with its format applied. It used to count up from nothing; that's gone (it only delayed the real number),
 * so it shows the value straight away. Kept as a component so every call site stays the same.
 */
export function CountUp({ value, style, format = (n) => String(Math.round(n)) }: { value: number; style?: StyleProp<TextStyle>; duration?: number; delay?: number; format?: (n: number) => string }) {
  return <Text style={style}>{format(value)}</Text>;
}

/**
 * The scoreboard's big number: when it changes the old figure lifts away and the new one rises into place, like a
 * flip board. Pass the line height of the text so the window is exactly one line tall.
 */
export function Ticker({ value, style, lineHeight }: { value: string | number; style?: StyleProp<TextStyle>; lineHeight: number }) {
  const still = useReducedMotion();
  const [pair, setPair] = useState<{ now: string; was: string | null; key: number }>({ now: String(value), was: null, key: 0 });
  const v = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const next = String(value);
    if (next === pair.now) return;
    if (still) {
      setPair({ now: next, was: null, key: pair.key + 1 });
      return;
    }
    setPair({ now: next, was: pair.now, key: pair.key + 1 });
    v.setValue(0);
    Animated.spring(v, { toValue: 1, useNativeDriver: native, speed: 14, bounciness: 6 }).start(() =>
      setPair((p) => ({ ...p, was: null })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  const inY = v.interpolate({ inputRange: [0, 1], outputRange: [lineHeight * 0.7, 0] });
  const outY = v.interpolate({ inputRange: [0, 1], outputRange: [0, -lineHeight * 0.7] });
  return (
    <View style={{ height: lineHeight, overflow: 'hidden' }}>
      {pair.was !== null && (
        <Animated.Text style={[style, styles.abs, { opacity: v.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }), transform: [{ translateY: outY }] }]}>
          {pair.was}
        </Animated.Text>
      )}
      <Animated.Text style={[style, { opacity: pair.was !== null ? v : 1, transform: [{ translateY: pair.was !== null ? inY : 0 }] }]}>{pair.now}</Animated.Text>
    </View>
  );
}

/** A bar at its share (0 to 1) of its track: drawn at full size straight away. */
export function GrowBar({ share, style, trackStyle, vertical }: { share: number; style?: StyleProp<ViewStyle>; trackStyle?: StyleProp<ViewStyle>; vertical?: boolean; delay?: number; duration?: number }) {
  const pct = `${Math.round(Math.max(0, Math.min(1, share)) * 1000) / 10}%` as const;
  return (
    <View style={[trackStyle, vertical && { justifyContent: 'flex-end' }]}>
      <View style={[style, vertical ? { height: pct } : { width: pct }]} />
    </View>
  );
}

/**
 * A web animation that never ends runs as CSS, not frame by frame through React: a JS loop keeps React busy every
 * frame, and a page waiting to open (records, the squad, a match) waits behind it for as long as the loop runs.
 */
const compiled = new Map<string, ViewStyle>();
export const css = (keyframes: Record<string, object>, ms: number, timing: string): ViewStyle => {
  // React Native Web writes keyframes only from StyleSheet.create, never from an inline style: one sheet per shape.
  const key = JSON.stringify([keyframes, ms, timing]);
  let style = compiled.get(key);
  if (!style) {
    const rule = { animationKeyframes: [keyframes], animationDuration: `${ms}ms`, animationTimingFunction: timing, animationIterationCount: 'infinite' };
    style = StyleSheet.create({ rule: rule as unknown as ViewStyle }).rule;
    compiled.set(key, style);
  }
  return style;
};

/**
 * A web animation that plays once (an entrance) as CSS: the browser runs it, React isn't touched once per frame. Held
 * at its first frame through the delay and at its last after it ends.
 */
const compiledOnce = new Map<string, ViewStyle>();
export const cssOnce = (keyframes: Record<string, object>, ms: number, timing: string, delay = 0): ViewStyle => {
  const key = JSON.stringify([keyframes, ms, timing, delay]);
  let style = compiledOnce.get(key);
  if (!style) {
    const rule = { animationKeyframes: [keyframes], animationDuration: `${ms}ms`, animationTimingFunction: timing, animationDelay: `${Math.round(delay)}ms`, animationFillMode: 'both', animationIterationCount: 1 };
    style = StyleSheet.create({ rule: rule as unknown as ViewStyle }).rule;
    compiledOnce.set(key, style);
  }
  return style;
};
/** False for the first moment after mounting, then true: lets a CSS transition run from a starting size to the real one. */
export function useArrived(skip = false) {
  const [on, set] = useState(skip || native);
  useEffect(() => {
    if (on) return;
    const t = setTimeout(() => set(true), 30);
    return () => clearTimeout(t);
  }, [on]);
  return on;
}
/** A CSS transition for one property on the web. */
export const webTransition = (property: string, ms: number, delay = 0, timing = 'cubic-bezier(0.22, 1, 0.36, 1)') =>
  ({ transitionProperty: property, transitionDuration: `${ms}ms`, transitionDelay: `${delay}ms`, transitionTimingFunction: timing }) as unknown as ViewStyle;
/** The house curve as CSS. */
export const CSS_EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';
const RISE = { '0%': { opacity: 0, transform: 'translateY(22px) scale(0.97)' }, '100%': { opacity: 1, transform: 'translateY(0px) scale(1)' } };
const FADE_UP = { '0%': { opacity: 0, transform: 'translateY(20px) scale(0.98)' }, '100%': { opacity: 1, transform: 'translateY(0px) scale(1)' } };
/** Entrances on the web, ready made: a card rising into place. */
export const webRise = (delay = 0, ms = 620) => cssOnce(RISE, ms, CSS_EASE_OUT, delay);
export const webFadeUp = (delay = 0, ms = 640) => cssOnce(FADE_UP, ms, CSS_EASE_OUT, delay);

/** The live dot: a steady centre with a ring that keeps breathing out from it. */
export function Pulse({ color, size = 8 }: { color: string; size?: number }) {
  const still = useReducedMotion();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (still || !native) return;
    const loop = Animated.loop(Animated.timing(v, { toValue: 1, duration: 1600, easing: Easing.out(Easing.quad), useNativeDriver: native }));
    loop.start();
    return () => loop.stop();
  }, [v, still]);
  const ring = { position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: color } as const;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {!still &&
        (native ? (
          <Animated.View
            style={{
              ...ring,
              opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
              transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 2.8] }) }],
            }}
          />
        ) : (
          <View
            style={[
              ring,
              css({ '0%': { opacity: 0.55, transform: 'scale(1)' }, '100%': { opacity: 0, transform: 'scale(2.8)' } }, 1600, 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'),
            ]}
          />
        ))}
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />
    </View>
  );
}

/** The light that used to sweep across cards: retired, it was decoration that kept phones busy. */
export function Sheen(_: { every?: number; strength?: number }) {
  return null;
}

/** A list item. Items used to rise in one after another; now they're simply there. */
export function Rise({ children, style }: { children: ReactNode; index?: number; style?: StyleProp<ViewStyle>; step?: number }) {
  return <View style={style}>{children}</View>;
}

const CONFETTI = ['#D7FF3A', '#F4F1E6', '#7FE6FF', '#FFCB52', '#B9A6FF'];

/** A short burst of confetti falling over a win. Plays once when it mounts. */
export function Confetti({ count = 28, height = 520 }: { count?: number; height?: number }) {
  const still = useReducedMotion();
  const pieces = useRef(
    // The web moves each piece frame by frame: fewer of them, so a phone keeps up.
    Array.from({ length: native ? count : Math.min(count, 18) }, (_, i) => ({
      v: new Animated.Value(0),
      x: Math.random(),
      drift: (Math.random() - 0.5) * 120,
      spin: (Math.random() - 0.5) * 900,
      delay: Math.random() * 380,
      color: CONFETTI[i % CONFETTI.length],
      w: 6 + Math.random() * 6,
      round: Math.random() < 0.3,
    })),
  ).current;
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (still) return;
    Animated.parallel(
      pieces.map((p) => Animated.timing(p.v, { toValue: 1, duration: 1800 + Math.random() * 700, delay: p.delay, easing: Easing.out(Easing.quad), useNativeDriver: native })),
    ).start(() => setDone(true));
  }, [pieces, still]);
  if (still || done) return null;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
      {pieces.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            top: -20,
            left: `${p.x * 100}%`,
            width: p.w,
            height: p.round ? p.w : p.w * 1.8,
            borderRadius: p.round ? p.w / 2 : 2,
            backgroundColor: p.color,
            opacity: p.v.interpolate({ inputRange: [0, 0.75, 1], outputRange: [1, 1, 0] }),
            transform: [
              { translateY: p.v.interpolate({ inputRange: [0, 1], outputRange: [0, height] }) },
              { translateX: p.v.interpolate({ inputRange: [0, 1], outputRange: [0, p.drift] }) },
              { rotate: p.v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.spin}deg`] }) },
            ],
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  abs: { position: 'absolute', left: 0, top: 0 },
  sheen: { position: 'absolute', top: '-40%', bottom: '-40%', left: 0 },
});

/** A badge or stamp. It used to land with a bounce; now it's simply there. */
export function PopIn({ children, style }: { children: ReactNode; delay?: number; turn?: number; style?: StyleProp<ViewStyle> }) {
  return <View style={style}>{children}</View>;
}

/** A tug of war: the left side's share (`edge`, 0 to 1) against the right, drawn straight away. */
export function Tug({ edge, style, leftStyle, rightStyle }: { edge: number; style?: StyleProp<ViewStyle>; leftStyle?: StyleProp<ViewStyle>; rightStyle?: StyleProp<ViewStyle>; delay?: number }) {
  return (
    <View style={[style, { flexDirection: 'row', gap: 2 }]}>
      <View style={[leftStyle, { width: `${Math.max(0.02, Math.min(0.98, edge)) * 100}%` }]} />
      <View style={[rightStyle, { flex: 1 }]} />
    </View>
  );
}
