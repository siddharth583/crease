import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import { colors, font } from '../theme.ts';
import { OvalGround, SeamBall } from './cricket.tsx';
import { useReducedMotion } from './motion.tsx';
import type { Moment } from './ui.tsx';

// The broadcast moment after a boundary, a wicket or a milestone. Each has its own scene rather than a flat flood of
// colour: a four races along the grass to the rope, a six sails into the night over the stands with a burst of sparks,
// a wicket is a red shockwave with OUT! stamped and shaken, a milestone is brass light and a raised-bat salute. The
// stumps (wicket) and confetti (milestones) from LiveMoments play on top. Respects reduced motion: then it's a still card.

const native = Platform.OS !== 'web';

type Look = { word: string; sub: string; bg: readonly [string, string, string]; ink: string; glow: string; hold: number; size: number };
const LOOKS: Record<Moment['kind'], Look> = {
  four: { word: 'FOUR', sub: 'to the rope', bg: ['#031C2A', '#06394F', '#0A5470'], ink: '#BFF1FF', glow: colors.cyan, hold: 650, size: 1 },
  six: { word: 'SIX', sub: 'out of the ground', bg: ['#050D09', '#0E2A14', '#1E4A12'], ink: '#D7FF3A', glow: '#D7FF3A', hold: 800, size: 1.25 },
  wicket: { word: 'OUT!', sub: 'wicket', bg: ['#1A0307', '#4A0A16', '#7A1226'], ink: '#FFFFFF', glow: colors.danger, hold: 750, size: 1 },
  fifty: { word: 'FIFTY', sub: 'raise the bat', bg: ['#0B1A12', '#2A2410', '#5A4515'], ink: '#F6DFA6', glow: '#E3BE72', hold: 1300, size: 0.92 },
  hundred: { word: 'CENTURY', sub: 'a hundred', bg: ['#0B1A12', '#3A2E0E', '#7A5A14'], ink: '#FFF1C9', glow: '#F6DFA6', hold: 1600, size: 0.72 },
  hattrick: { word: 'HAT-TRICK', sub: 'three in three', bg: ['#1A0307', '#3A0A1A', '#6A1230'], ink: '#FFFFFF', glow: '#E3BE72', hold: 1600, size: 0.6 },
};

/** Sparks flying out from a point, like a firework over the stands. */
function Sparks({ v, color, count = 14, radius = 150 }: { v: Animated.Value; color: string; count?: number; radius?: number }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: count }, (_, i) => {
        const a = (i / count) * Math.PI * 2;
        const dist = radius * (0.7 + ((i * 37) % 10) / 30);
        return (
          <Animated.View
            key={i}
            style={[
              s.spark,
              {
                backgroundColor: color,
                opacity: v.interpolate({ inputRange: [0, 0.35, 1, 1.6], outputRange: [0, 1, 0.8, 0] }),
                transform: [
                  { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(a) * dist] }) },
                  { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(a) * dist] }) },
                  { scale: v.interpolate({ inputRange: [0, 1, 2], outputRange: [0.4, 1, 0.2] }) },
                ],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

export function MomentFlash({ moment }: { moment: Moment | null }) {
  const still = useReducedMotion();
  const v = useRef(new Animated.Value(0)).current; // 0 in, 1 held, 2 out
  const ball = useRef(new Animated.Value(0)).current; // the ball's flight
  const burst = useRef(new Animated.Value(0)).current; // sparks and the shockwave
  const shake = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState<Moment | null>(null);

  useEffect(() => {
    if (!moment) return;
    setShown(moment);
    const look = LOOKS[moment.kind];
    [v, ball, burst, shake].forEach((x) => x.setValue(0));
    if (still) {
      v.setValue(1);
      const t = setTimeout(() => setShown(null), look.hold + 700);
      return () => clearTimeout(t);
    }
    Animated.parallel([
      Animated.sequence([
        Animated.spring(v, { toValue: 1, useNativeDriver: native, speed: 12, bounciness: 10 }),
        Animated.delay(look.hold),
        Animated.timing(v, { toValue: 2, duration: 360, easing: Easing.in(Easing.cubic), useNativeDriver: native }),
      ]),
      Animated.timing(ball, { toValue: 1, duration: moment.kind === 'six' ? 1000 : 620, easing: moment.kind === 'six' ? Easing.out(Easing.quad) : Easing.out(Easing.cubic), useNativeDriver: native }),
      Animated.sequence([
        Animated.delay(moment.kind === 'six' ? 520 : 120),
        Animated.timing(burst, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: native }),
        Animated.timing(burst, { toValue: 2, duration: 500, useNativeDriver: native }),
      ]),
      moment.kind === 'wicket'
        ? Animated.sequence([
            Animated.delay(180),
            ...[1, -1, 0.7, -0.5, 0].map((to) => Animated.timing(shake, { toValue: to, duration: 55, useNativeDriver: native })),
          ])
        : Animated.delay(0),
    ]).start(({ finished }) => finished && setShown(null));
  }, [moment, still]);

  if (!shown) return null;
  const look = LOOKS[shown.kind];
  const opacity = v.interpolate({ inputRange: [0, 0.4, 1.4, 2], outputRange: [0, 1, 1, 0] });
  const wordScale = v.interpolate({ inputRange: [0, 1, 2], outputRange: [1.9, 1, 0.92] });
  const wordY = v.interpolate({ inputRange: [0, 1, 2], outputRange: [30, 0, -24] });
  const shakeX = shake.interpolate({ inputRange: [-1, 1], outputRange: [-14, 14] });
  const ring = burst.interpolate({ inputRange: [0, 1, 2], outputRange: [0.2, 3.2, 4.2] });
  const ringOpacity = burst.interpolate({ inputRange: [0, 0.2, 1, 2], outputRange: [0, 0.6, 0.2, 0] });
  const milestone = shown.kind === 'fifty' || shown.kind === 'hundred' || shown.kind === 'hattrick';

  // The ball's path: a four skims low across to the rope, a six climbs in an arc and out over the top.
  const ballX = ball.interpolate({ inputRange: [0, 1], outputRange: shown.kind === 'six' ? [-150, 170] : [-210, 210] });
  const ballY = ball.interpolate({ inputRange: [0, 0.5, 1], outputRange: shown.kind === 'six' ? [210, -150, -330] : [170, 180, 165] });
  const ballScale = ball.interpolate({ inputRange: [0, 0.5, 1], outputRange: shown.kind === 'six' ? [1.2, 0.8, 0.35] : [0.9, 0.9, 0.7] });
  const ballSpin = ball.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '900deg'] });
  const flies = shown.kind === 'four' || shown.kind === 'six';

  return (
    <Animated.View pointerEvents="none" accessibilityLiveRegion="assertive" accessibilityLabel={`${look.word}${shown.caption ? `, ${shown.caption}` : ''}`} style={[StyleSheet.absoluteFill, s.root, { opacity }]}>
      <LinearGradient colors={look.bg} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
      {/* The ground under the lights, faint, so it reads as a moment in the match. */}
      <OvalGround opacity={0.1} drift={false} style={{ top: '35%' }} />
      <LinearGradient colors={['transparent', `${look.glow}33`, 'transparent']} start={{ x: 0, y: 0.3 }} end={{ x: 1, y: 0.7 }} style={StyleSheet.absoluteFill} />
      {/* Speed lines behind the word. */}
      {(shown.kind === 'four' || shown.kind === 'wicket') && (
        <View style={s.speed}>
          {Array.from({ length: 7 }, (_, i) => (
            <Animated.View
              key={i}
              style={[
                s.speedLine,
                {
                  backgroundColor: look.glow,
                  top: `${14 + i * 11}%`,
                  width: `${30 + ((i * 23) % 40)}%`,
                  opacity: burst.interpolate({ inputRange: [0, 0.3, 2], outputRange: [0, 0.35, 0] }),
                  transform: [{ translateX: burst.interpolate({ inputRange: [0, 2], outputRange: [-300, 500] }) }],
                },
              ]}
            />
          ))}
        </View>
      )}
      <Animated.View style={[s.ring, { borderColor: look.glow, opacity: ringOpacity, transform: [{ scale: ring }] }]} />
      {(shown.kind === 'six' || milestone) && (
        <View style={s.center}>
          <Sparks v={burst} color={look.glow} count={shown.kind === 'six' ? 18 : 12} radius={shown.kind === 'six' ? 170 : 130} />
        </View>
      )}
      {flies && (
        <Animated.View style={[s.center, { transform: [{ translateX: ballX }, { translateY: ballY }, { scale: ballScale }, { rotate: ballSpin }] }]}>
          <View style={[s.ballGlow, { backgroundColor: `${look.glow}55` }]} />
          <SeamBall size={46} color="#C8102E" />
        </Animated.View>
      )}
      <Animated.View style={{ alignItems: 'center', transform: [{ translateY: wordY }, { scale: wordScale }, { translateX: shakeX }, { skewX: '-8deg' }] }}>
        <Text numberOfLines={1} adjustsFontSizeToFit style={[s.word, { color: look.ink, fontSize: 132 * look.size, lineHeight: 140 * look.size, textShadowColor: look.glow }]}>
          {look.word}
        </Text>
      </Animated.View>
      <Animated.View style={[s.capWrap, { transform: [{ translateY: wordY }] }]}>
        <Text style={[s.sub, { color: look.glow }]}>{look.sub.toUpperCase()}</Text>
        {shown.caption ? <Text style={[s.caption, { color: look.ink }]}>{shown.caption}</Text> : null}
      </Animated.View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center', zIndex: 50, overflow: 'hidden' },
  center: { position: 'absolute', top: '50%', left: '50%', width: 0, height: 0, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 220, height: 220, borderRadius: 110, borderWidth: 4 },
  spark: { position: 'absolute', width: 9, height: 9, borderRadius: 5, boxShadow: '0px 0px 10px rgba(255,255,255,0.6)' } as object,
  ballGlow: { position: 'absolute', width: 90, height: 90, borderRadius: 45 },
  speed: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  speedLine: { position: 'absolute', left: 0, height: 3, borderRadius: 2 },
  word: { fontFamily: font.posterBlack, letterSpacing: -5, textShadowRadius: 30, textShadowOffset: { width: 0, height: 0 } },
  capWrap: { alignItems: 'center', marginTop: 4, gap: 4 },
  sub: { fontFamily: font.heavy, fontSize: 13, letterSpacing: 4 },
  caption: { fontFamily: font.poster, fontSize: 26, letterSpacing: -0.4 },
});
