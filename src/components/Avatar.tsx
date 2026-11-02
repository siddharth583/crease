import { Ionicons } from '@expo/vector-icons';
import { Image, StyleSheet, Text, View } from 'react-native';
import { colors, font } from '../theme.ts';

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

/** A round photo, or the person's initials when there's no photo. */
export function Avatar({ photo, name, size }: { photo?: string | null; name: string; size: number }) {
  if (photo) return <Image source={{ uri: photo }} style={{ width: size, height: size, borderRadius: size / 2 }} accessibilityIgnoresInvertColors />;
  return (
    <View style={[styles.initials, { width: size, height: size, borderRadius: size / 2 }]}>
      {name ? <Text style={[styles.initialsText, { fontSize: size * 0.38 }]}>{initials(name)}</Text> : <Ionicons name="person" size={size * 0.5} color={colors.muted} />}
    </View>
  );
}

const styles = StyleSheet.create({
  initials: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceHi, borderWidth: 1, borderColor: colors.border },
  initialsText: { color: colors.text, fontFamily: font.posterBlack },
});
