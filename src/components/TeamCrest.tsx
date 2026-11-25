import { LinearGradient } from 'expo-linear-gradient';
import { useId } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { teamLogoSvg } from '../engine/teamLogos.ts';
import { font, ownTeamTheme } from '../theme.ts';

// A side's badge: its initials on a shield in its own colours. The club's two sides wear their themes (Thunder blue,
// Royal gold); any other side gets a colour of its own from its name, so every team is recognisable at a glance.

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

export type Crest = { from: string; to: string; ink: string; ring: string };

/** The colours a side wears: its theme, or a steady colour made from its name. */
export function crestOf(name: string): Crest {
  const own = ownTeamTheme(name);
  if (own) return { from: own.accent, to: own.hero[0], ink: own.onAccent, ring: own.accent };
  const h = hash(name.trim().toLowerCase()) % 360;
  return { from: `hsl(${h},82%,62%)`, to: `hsl(${(h + 24) % 360},70%,38%)`, ink: '#0A0D06', ring: `hsl(${h},82%,62%)` };
}

const initials = (name: string) => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  return (words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[words.length - 1][0]).toUpperCase();
};

/** The badge: a squircle shield with a slanted shine, the side's initials in heavy type. */
export function TeamCrest({ name, size = 44 }: { name: string; size?: number }) {
  // Each copy on a page gets its own gradient ids, so they don't mix.
  const id = `t${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const logo = teamLogoSvg(name, size, id);
  if (logo) return <SvgXml xml={logo} width={size} height={size} accessibilityLabel={name} />;
  const c = crestOf(name);
  return (
    <View style={{ width: size, height: size }} accessibilityLabel={name}>
      <LinearGradient colors={[c.from, c.to]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.shield, { borderRadius: size * 0.32, borderBottomLeftRadius: size * 0.5, borderBottomRightRadius: size * 0.5 }]}>
        <View style={[styles.shine, { width: size * 0.5, height: size * 1.6, left: size * 0.05, top: -size * 0.3 }]} />
        <Text style={[styles.text, { color: c.ink, fontSize: size * 0.4, letterSpacing: -size * 0.02 }]}>{initials(name)}</Text>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  shield: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  shine: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.16)', transform: [{ rotate: '24deg' }] },
  text: { fontFamily: font.posterBlack },
});

/**
 * A soft wash of a colour fading across its parent from one corner: what marks a card as a side's (or a winner's)
 * where a coloured stripe along its edge used to. Fills the parent, behind its content.
 */
export function TeamWash({ color, strength = 0.18 }: { color: string; strength?: number }) {
  return <LinearGradient pointerEvents="none" colors={[color, 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 0.85, y: 1 }} style={[StyleSheet.absoluteFill, { opacity: strength }]} />;
}
