import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import type { Rating } from '../engine/squad.ts';
import { colors } from '../theme.ts';
import { PressableScale } from './ui.tsx';

/** Five stars; tap one to set the rating, or leave `onChange` out to just show it. */
export function Stars({ value, onChange, size = 16, label }: { value: number; onChange?: (r: Rating) => void; size?: number; label?: string }) {
  return (
    <View style={styles.row} accessibilityLabel={label ? `${label}: ${value} out of 5` : undefined}>
      {[1, 2, 3, 4, 5].map((n) => {
        const on = n <= value;
        const star = <Ionicons name={on ? 'star' : 'star-outline'} size={size} color={on ? colors.gold : colors.faint} />;
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
