import type { ComponentProps } from 'react';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Platform, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { colors, font, hero, isDay, radius, type } from '../theme.ts';
import { PopIn, CountUp, EASE_OUT, useReducedMotion } from './motion.tsx';
import { PressableScale, type IconName } from './ui.tsx';

// The pieces shared by the Record book, the Awards and the rivalry pages: the honours board's brass plaques, medals,
// scoreboard figures and the sliding category tabs.

const native = Platform.OS !== 'web';
/** Ink for a figure sitting on brass. */
export const onGold = isDay ? '#FFFFFF' : colors.onAccent;

/** A medal for a place: brass for first, silver-grey for second, a dim brass ring for third. Pops in. */
export function Medal({ rank, size = 26, delay = 0 }: { rank: number; size?: number; delay?: number }) {
  const first = rank === 1;
  const second = rank === 2;
  const ring = first ? colors.gold : second ? colors.muted : colors.faint;
  return (
    <PopIn delay={delay} turn={-24}>
      <View
        accessibilityLabel={`Place ${rank}`}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: first ? colors.gold : colors.surfaceHi,
          borderWidth: first ? 0 : 1.5,
          borderColor: ring,
        }}
      >
        {first ? (
          <Ionicons name="star" size={size * 0.55} color={onGold} />
        ) : (
          <Text style={{ fontFamily: font.posterBlack, fontSize: size * 0.5, lineHeight: size * 0.62, color: ring }}>{rank}</Text>
        )}
      </View>
    </PopIn>
  );
}

/** The brass disc a record or trophy carries its icon on. */
export function BrassIcon({ name, size = 34, tone = 'brass' }: { name: IconName; size?: number; tone?: 'brass' | 'jade' }) {
  const brass = tone === 'brass';
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: brass ? colors.gold : colors.accent }}>
      <Ionicons name={name} size={size * 0.52} color={brass ? onGold : colors.onAccent} />
    </View>
  );
}

/** A brass-plated card: a thin brass bar along the top, like the plate on an honours board. */
export function Plaque({ children, style, glow }: { children: ReactNode; style?: StyleProp<ViewStyle>; glow?: boolean }) {
  return (
    <View style={[styles.plaque, style]}>
      {/* A soft brass light from the top corner rather than a stripe along the edge. */}
      <LinearGradient pointerEvents="none" colors={[colors.goldDim, 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 0.6 }} style={StyleSheet.absoluteFill} />
      {glow && <LinearGradient pointerEvents="none" colors={[colors.goldDim, 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 0.9, y: 1 }} style={StyleSheet.absoluteFill} />}
      {children}
    </View>
  );
}

/**
 * A figure like "147", "7.4", "73*" or "3/12": its leading number counts up, the rest (star, wickets, unit) stays put.
 */
export function Figure({ display, style, delay = 0, unit, unitStyle }: { display: string; style?: StyleProp<TextStyle>; delay?: number; unit?: string; unitStyle?: StyleProp<TextStyle> }) {
  const m = /^([+-]?)(\d+(?:\.\d+)?)(.*)$/.exec(display);
  if (!m) {
    return (
      <Text style={style}>
        {display}
        {unit ? <Text style={unitStyle}>{unit}</Text> : null}
      </Text>
    );
  }
  const [, sign, num, rest] = m;
  const digits = num.includes('.') ? num.split('.')[1]!.length : 0;
  return (
    <Text style={style}>
      {sign}
      <CountUp value={parseFloat(num)} delay={delay} format={(n) => n.toFixed(digits)} style={style} />
      {rest}
      {unit ? <Text style={unitStyle}>{unit}</Text> : null}
    </Text>
  );
}

/** A bar that grows to its share of the track. */
export function ShareBar({ share, color, delay = 0, height = 4 }: { share: number; color: string; delay?: number; height?: number }) {
  const still = useReducedMotion();
  const v = useRef(new Animated.Value(still ? share : 0)).current;
  useEffect(() => {
    const t = Math.max(0.03, Math.min(1, share));
    if (still) return v.setValue(t);
    Animated.timing(v, { toValue: t, duration: 900, delay, easing: EASE_OUT, useNativeDriver: false }).start();
  }, [share, still, v, delay]);
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: `rgba(${colors.ink},0.08)`, overflow: 'hidden' }}>
      <Animated.View style={{ height, borderRadius: height / 2, backgroundColor: color, width: v.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} />
    </View>
  );
}

/** A stacked bar of parts (dots, ones, fours...) that sweeps open from the left. */
export function GrowStack({ parts, height = 14, style }: { parts: { n: number; c: string }[]; height?: number; style?: StyleProp<ViewStyle> }) {
  const still = useReducedMotion();
  const [w, setW] = useState(0);
  const v = useRef(new Animated.Value(still ? 1 : 0)).current;
  useEffect(() => {
    if (still) return v.setValue(1);
    Animated.timing(v, { toValue: 1, duration: 1000, delay: 250, easing: EASE_OUT, useNativeDriver: false }).start();
  }, [still, v]);
  const total = parts.reduce((n, p) => n + p.n, 0) || 1;
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={[{ height, borderRadius: height / 2, overflow: 'hidden' }, style]}>
      <Animated.View style={{ width: v.interpolate({ inputRange: [0, 1], outputRange: [0, w] }), height, overflow: 'hidden' }}>
        <View style={{ width: w, height, flexDirection: 'row', gap: 2 }}>
          {parts.map((p, i) => (
            <View key={i} style={{ flex: p.n / total, backgroundColor: p.c }} />
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

/** A scoreboard cell: a big figure that counts up and a small caps caption under it, for dark panels. */
export function Tile({ value, label, color, size = 32, delay = 0, format }: { value: number; label: string; color: string; size?: number; delay?: number; format?: (n: number) => string }) {
  return (
    <View style={{ flex: 1, minWidth: 0 }} accessibilityLabel={`${label}: ${format ? format(value) : value}`}>
      <CountUp value={value} delay={delay} format={format} style={{ fontFamily: font.posterBlack, fontSize: size, lineHeight: size * 1.1, color, ...type.num }} />
      <Text style={{ ...type.label, fontSize: 9, color: hero.muted }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/**
 * Category tabs with an icon over each word and a jade pill that glides to the one picked. Sticks to the top of a
 * scroller: give it a solid background.
 */
/** `mci` draws a MaterialCommunityIcons glyph (it has the cricket bat and the ball) in place of `icon`. */
export function CategoryTabs<T extends string>({ options, value, onChange }: { options: { value: T; label: string; icon: IconName; mci?: ComponentProps<typeof MaterialCommunityIcons>['name'] }[]; value: T; onChange: (v: T) => void }) {
  const still = useReducedMotion();
  const [w, setW] = useState(0);
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  const x = useRef(new Animated.Value(idx)).current;
  useEffect(() => {
    if (still) return x.setValue(idx);
    Animated.spring(x, { toValue: idx, useNativeDriver: native, speed: 16, bounciness: 7 }).start();
  }, [idx, still, x]);
  const cell = w ? (w - 8) / options.length : 0;
  return (
    <View style={styles.tabs} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {cell > 0 && (
        <Animated.View style={[styles.tabPill, { width: cell, transform: [{ translateX: x.interpolate({ inputRange: [0, Math.max(1, options.length - 1)], outputRange: [0, cell * Math.max(1, options.length - 1)] }) }] }]} />
      )}
      {options.map((o) => {
        const on = o.value === value;
        return (
          <PressableScale
            key={o.value}
            accessibilityLabel={o.label}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            scaleTo={0.95}
            onPress={() => onChange(o.value)}
            wrapStyle={{ flex: 1 }}
            style={styles.tab}
          >
            {o.mci ? <MaterialCommunityIcons name={o.mci} size={19} color={on ? colors.onAccent : colors.muted} /> : <Ionicons name={o.icon} size={18} color={on ? colors.onAccent : colors.muted} />}
            <Text style={[styles.tabText, on && { color: colors.onAccent, fontFamily: font.heavy }]} numberOfLines={1}>
              {o.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  plaque: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, overflow: 'hidden', paddingTop: 3 },
  plaqueBar: { position: 'absolute', left: 0, right: 0, top: 0, height: 3 },
  tabs: { flexDirection: 'row', padding: 4, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  tabPill: { position: 'absolute', left: 4, top: 4, bottom: 4, borderRadius: radius.md, backgroundColor: colors.accent },
  tab: { alignItems: 'center', justifyContent: 'center', gap: 2, minHeight: 52, paddingVertical: 6 },
  tabText: { color: colors.muted, fontSize: 12, fontFamily: font.semibold },
});
