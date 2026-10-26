import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState, type ReactNode } from 'react';
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
 * A number that counts up to its value, and from one value to the next when it changes: season totals, records,
 * purses. `format` turns the running number into text (rupees, decimals).
 */
export function CountUp({
  value,
  style,
  duration = 1100,
  delay = 0,
  format = (n) => String(Math.round(n)),
}: {
  value: number;
  style?: StyleProp<TextStyle>;
  duration?: number;
  delay?: number;
  format?: (n: number) => string;
}) {
  const still = useReducedMotion();
  const [shown, setShown] = useState(still ? value : 0);
  const from = useRef(still ? value : 0);
  useEffect(() => {
    if (still) {
      setShown(value);
      from.current = value;
      return;
    }
    const v = new Animated.Value(from.current);
    const id = v.addListener(({ value: n }) => setShown(n));
    const anim = Animated.timing(v, { toValue: value, duration, delay, easing: EASE_OUT, useNativeDriver: false });
    anim.start(() => {
      from.current = value;
    });
    return () => {
      anim.stop();
      v.removeListener(id);
      from.current = value;
    };
  }, [value, duration, delay, still]);
  return <Text style={style}>{format(shown)}</Text>;
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

/** A bar that grows to its share (0 to 1) when it appears, and glides when the share changes. */
export function GrowBar({
  share,
  style,
  trackStyle,
  vertical,
  delay = 0,
  duration = 900,
}: {
  share: number;
  style?: StyleProp<ViewStyle>;
  trackStyle?: StyleProp<ViewStyle>;
  vertical?: boolean;
  delay?: number;
  duration?: number;
}) {
  const still = useReducedMotion();
  const v = useRef(new Animated.Value(still ? share : 0)).current;
  useEffect(() => {
    const target = Math.max(0, Math.min(1, share));
    if (still) {
      v.setValue(target);
      return;
    }
    Animated.timing(v, { toValue: target, duration, delay, easing: EASE_OUT, useNativeDriver: false }).start();
  }, [share, still, v, delay, duration]);
  const size = v.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  return (
    <View style={[trackStyle, vertical && { justifyContent: 'flex-end' }]}>
      <Animated.View style={[style, vertical ? { height: size } : { width: size }]} />
    </View>
  );
}

/** The live dot: a steady centre with a ring that keeps breathing out from it. */
export function Pulse({ color, size = 8 }: { color: string; size?: number }) {
  const still = useReducedMotion();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (still) return;
    const loop = Animated.loop(Animated.timing(v, { toValue: 1, duration: 1600, easing: Easing.out(Easing.quad), useNativeDriver: native }));
    loop.start();
    return () => loop.stop();
  }, [v, still]);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {!still && (
        <Animated.View
          style={{
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
            opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
            transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 2.8] }) }],
          }}
        />
      )}
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />
    </View>
  );
}

/** A soft band of light that sweeps across a card now and then, like floodlights catching glass. */
export function Sheen({ every = 5200, strength = 0.09 }: { every?: number; strength?: number }) {
  const still = useReducedMotion();
  const v = useRef(new Animated.Value(0)).current;
  const [w, setW] = useState(0);
  useEffect(() => {
    if (still || !w) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(900),
        Animated.timing(v, { toValue: 1, duration: 1500, easing: EASE_IN_OUT, useNativeDriver: native }),
        Animated.delay(every),
        Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: native }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v, still, w, every]);
  if (still) return null;
  const translateX = v.interpolate({ inputRange: [0, 1], outputRange: [-w * 0.8, w * 1.2] });
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      <Animated.View style={[styles.sheen, { width: Math.max(120, w * 0.45), transform: [{ translateX }, { rotate: '18deg' }] }]}>
        <LinearGradient
          colors={['rgba(255,255,255,0)', `rgba(255,255,255,${strength})`, 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

/** Children rise into place one after another: give each a growing `index`. */
export function Rise({ children, index = 0, style, step = 55 }: { children: ReactNode; index?: number; style?: StyleProp<ViewStyle>; step?: number }) {
  const still = useReducedMotion();
  const v = useRef(new Animated.Value(still ? 1 : 0)).current;
  useEffect(() => {
    if (still) return;
    Animated.timing(v, { toValue: 1, duration: 620, delay: Math.min(index, 12) * step, easing: EASE_OUT, useNativeDriver: native }).start();
  }, [v, index, step, still]);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: v,
          transform: [
            { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [22, 0] }) },
            { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

const CONFETTI = ['#D7FF3A', '#F1F5EE', '#7FE6FF', '#FFCB52', '#B9A6FF'];

/** A short burst of confetti falling over a win. Plays once when it mounts. */
export function Confetti({ count = 28, height = 520 }: { count?: number; height?: number }) {
  const still = useReducedMotion();
  const pieces = useRef(
    Array.from({ length: count }, (_, i) => ({
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

/** Something that lands with a little bounce and a turn: the trophy, a stamp. */
export function PopIn({ children, delay = 0, turn = -12, style }: { children: ReactNode; delay?: number; turn?: number; style?: StyleProp<ViewStyle> }) {
  const still = useReducedMotion();
  const v = useRef(new Animated.Value(still ? 1 : 0)).current;
  useEffect(() => {
    if (still) return;
    Animated.sequence([Animated.delay(delay), Animated.spring(v, { toValue: 1, useNativeDriver: native, speed: 9, bounciness: 14 })]).start();
  }, [v, delay, still]);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: v.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1] }),
          transform: [
            { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) },
            { rotate: v.interpolate({ inputRange: [0, 1], outputRange: [`${turn}deg`, '0deg'] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/** A tug of war: the left side pulls to `edge` (0 to 1) from the middle when it appears. */
export function Tug({ edge, style, leftStyle, rightStyle, delay = 150 }: { edge: number; style?: StyleProp<ViewStyle>; leftStyle?: StyleProp<ViewStyle>; rightStyle?: StyleProp<ViewStyle>; delay?: number }) {
  const still = useReducedMotion();
  const v = useRef(new Animated.Value(still ? edge : 0.5)).current;
  useEffect(() => {
    if (still) {
      v.setValue(edge);
      return;
    }
    Animated.spring(v, { toValue: Math.max(0.02, Math.min(0.98, edge)), delay, useNativeDriver: false, speed: 6, bounciness: 8 }).start();
  }, [edge, still, v, delay]);
  return (
    <View style={[style, { flexDirection: 'row', gap: 2 }]}>
      <Animated.View style={[leftStyle, { width: v.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
      <View style={[rightStyle, { flex: 1 }]} />
    </View>
  );
}
