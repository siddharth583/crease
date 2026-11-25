import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';
import type { Rating } from '../engine/squad.ts';
import { colors } from '../theme.ts';
import { useReducedMotion } from './motion.tsx';
import { PressableScale } from './ui.tsx';

const native = Platform.OS !== 'web';

/** One brass star; it springs when it lights up. */
function Star({ on, size }: { on: boolean; size: number }) {
  const still = useReducedMotion();
  const s = useRef(new Animated.Value(1)).current;
  const was = useRef(on);
  useEffect(() => {
    if (was.current === on) return;
    was.current = on;
    if (still || !on) return;
    s.setValue(0.5);
    Animated.spring(s, { toValue: 1, useNativeDriver: native, speed: 16, bounciness: 18 }).start();
  }, [on, s, still]);
  return (
    <Animated.View style={{ transform: [{ scale: s }] }}>
      <Ionicons name={on ? 'star' : 'star-outline'} size={size} color={on ? colors.gold : colors.faint} />
    </Animated.View>
  );
}

/** Five stars; tap one to set the rating, or leave `onChange` out to just show it. */
export function Stars({ value, onChange, size = 16, label }: { value: number; onChange?: (r: Rating) => void; size?: number; label?: string }) {
  return (
    <View style={styles.row} accessibilityLabel={label ? `${label}: ${value} out of 5` : undefined}>
      {[1, 2, 3, 4, 5].map((n) => {
        const star = <Star on={n <= value} size={size} />;
        return onChange ? (
          <PressableScale key={n} hitSlop={4} scaleTo={0.8} accessibilityLabel={`${label ?? 'Rating'} ${n}`} onPress={() => onChange(n as Rating)} style={styles.hit}>
            {star}
          </PressableScale>
        ) : (
          <View key={n}>{star}</View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  hit: { padding: 2 },
});
