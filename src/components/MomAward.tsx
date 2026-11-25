import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Image, Platform, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { photoFor } from '../engine/photos.ts';
import { displayName } from '../engine/stats.ts';
import { usePhotos } from '../store/sync.tsx';
import { font, hero, radius, space, teamTheme, type } from '../theme.ts';
import { Jersey, OvalGround } from './cricket.tsx';
import { css, PopIn, Sheen, useReducedMotion } from './motion.tsx';
import { PressableScale } from './ui.tsx';
import { useLayout } from './layout.tsx';
import { crestOf, TeamCrest } from './TeamCrest.tsx';

// The Man of the Match as an award moment, the way a broadcast shows it: the player standing in a burst of brass light
// on the ground at night, the award's name engraved above, their name large, and what they did as labelled chips.
// Used on the full-time screen and at the top of the scorecard.

const BRASS = '#E3BE72';
const BRASS_HI = '#F6DFA6';
const native = Platform.OS !== 'web';

/** A photo with its background: the edges and the shoulders melt away, leaving the face and the player. */
const PHOTO_MASK = 'radial-gradient(ellipse 50% 52% at 50% 40%, #000 58%, rgba(0,0,0,0.6) 74%, transparent 100%)';
/** A true cut-out keeps its own outline; only the bottom fades, so the player stands on the grass, not cut off. */
const CUTOUT_MASK = 'linear-gradient(to bottom, #000 78%, transparent 100%)';

type Kind = 'cutout' | 'photo';
/** What each picture turned out to be, worked out once per picture and kept. */
const kinds = new Map<string, Kind>();

/**
 * Whether a picture is a real cut-out: most of the pixels around its edge are see-through. Anything else, a JPEG, a
 * PNG with its background, a screenshot with a few clear corners, is a photo with a background.
 */
function classify(uri: string): Promise<Kind> {
  const known = kinds.get(uri);
  if (known) return Promise.resolve(known);
  if (uri.startsWith('data:image/jpeg')) {
    kinds.set(uri, 'photo');
    return Promise.resolve('photo');
  }
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      const n = 48;
      const canvas = document.createElement('canvas');
      canvas.width = n;
      canvas.height = n;
      const ctx = canvas.getContext('2d');
      let kind: Kind = 'photo';
      if (ctx) {
        ctx.drawImage(img, 0, 0, n, n);
        const { data } = ctx.getImageData(0, 0, n, n);
        let clear = 0;
        let edge = 0;
        for (let i = 0; i < n; i++)
          for (const [x, y] of [
            [i, 0],
            [i, n - 1],
            [0, i],
            [n - 1, i],
          ]) {
            edge++;
            if (data[(y * n + x) * 4 + 3] < 40) clear++;
          }
        kind = clear / edge > 0.5 ? 'cutout' : 'photo';
      }
      kinds.set(uri, kind);
      resolve(kind);
    };
    img.onerror = () => resolve('photo');
    img.src = uri;
  });
}

/**
 * A player's photo standing free in a scene, filling its parent, feet at the bottom. A real cut-out keeps its outline
 * with only its foot fading into the grass; a photo that still has its background melts away at the edges, so it reads
 * as the player and not as a box. On the web it stays hidden for the moment it takes to tell which, then fades in.
 */
export function PlayerPhoto({ uri }: { uri: string }) {
  const [kind, setKind] = useState<Kind | undefined>(() => kinds.get(uri));
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    let live = true;
    setKind(kinds.get(uri));
    void classify(uri).then((k) => live && setKind(k));
    return () => {
      live = false;
    };
  }, [uri]);
  if (Platform.OS === 'web') {
    const mask = kind === 'cutout' ? CUTOUT_MASK : PHOTO_MASK;
    // A plain <img> in a box that sits it at the foot: sized to the picture itself (no letterbox), so the fade follows
    // the picture's own edges. The browser's mask needs the real element, which React Native's Image doesn't pass on.
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', pointerEvents: 'none' }}>
        <img
          src={uri}
          alt=""
          style={{
            display: 'block',
            maxWidth: '100%',
            maxHeight: '100%',
            width: 'auto',
            height: 'auto',
            opacity: kind ? 1 : 0,
            transition: 'opacity 300ms ease-out',
            maskImage: mask,
            WebkitMaskImage: mask,
          }}
        />
      </div>
    );
  }
  return <Image source={{ uri }} resizeMode="contain" accessibilityIgnoresInvertColors style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />;
}

/** "30 (8) · 1/11 · 2 catches" split into labelled parts: bat, ball, field. */
function parts(summary: string): { icon: 'cricket' | 'baseball' | 'hand-back-right'; label: string; value: string }[] {
  return summary
    .split('·')
    .map((x) => x.trim())
    .filter(Boolean)
    .map((value) =>
      /\(\d+\)/.test(value)
        ? { icon: 'cricket' as const, label: 'Batting', value }
        : /^\d+\/\d+/.test(value)
          ? { icon: 'baseball' as const, label: 'Bowling', value }
          : { icon: 'hand-back-right' as const, label: 'Fielding', value },
    );
}

const TURN = css({ '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } }, 40000, 'linear');

/** Slowly turning rays of brass light behind the player. */
function Rays({ size }: { size: number }) {
  const still = useReducedMotion();
  const turn = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    // The rays hold still: the slow turn was decoration.
    if (still || !native || true) return;
    const loop = Animated.loop(Animated.timing(turn, { toValue: 1, duration: 40000, easing: Easing.linear, useNativeDriver: native }));
    loop.start();
    return () => loop.stop();
  }, [still, turn]);
  const rotate = turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const rays = Array.from({ length: 18 }, (_, i) => {
    const a = (i / 18) * Math.PI * 2;
    const b = a + Math.PI / 36;
    return `M50 50 L${50 + 60 * Math.cos(a)} ${50 + 60 * Math.sin(a)} L${50 + 60 * Math.cos(b)} ${50 + 60 * Math.sin(b)} Z`;
  });
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: size, height: size }, null]}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id="mr" cx="50" cy="50" r="50" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={BRASS_HI} stopOpacity="0.55" />
            <Stop offset="1" stopColor={BRASS} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        {rays.map((d, i) => (
          <Path key={i} d={d} fill="url(#mr)" />
        ))}
        <Rect x="0" y="0" width="100" height="100" fill="url(#mr)" opacity={0.35} />
      </Svg>
    </Animated.View>
  );
}

export function MomAward({
  name,
  team,
  summary,
  onPress,
  disabled,
  picked,
  action,
  compact,
}: {
  name: string;
  team: string;
  summary: string;
  onPress?: () => void;
  disabled?: boolean;
  /** Picked by hand rather than by Crease. */
  picked?: boolean;
  /** A small control at the top right, e.g. Change. */
  action?: ReactNode;
  compact?: boolean;
}) {
  const photo = photoFor(usePhotos(), name);
  const side = teamTheme(team);
  const { wide } = useLayout();
  const figure = compact ? 128 : wide ? 156 : 112;
  const initials = displayName(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
  return (
    <PopIn delay={350} turn={-3}>
      {/* A brass frame: a gradient one pixel and a half wide around the whole award. */}
      <LinearGradient colors={[BRASS_HI, '#9A7A3A', BRASS]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.frame}>
        <PressableScale scaleTo={0.98} disabled={disabled} dimWhenDisabled={false} onPress={onPress} accessibilityLabel={`Man of the Match: ${name}, ${summary}`} style={s.card}>
          <LinearGradient colors={['#14301F', '#0B1D13', '#07130C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <OvalGround color={BRASS} opacity={0.08} />
          <Sheen every={6000} strength={0.08} />
          <View style={[s.eyebrow, { marginBottom: space.sm, minHeight: 28 }, action ? { paddingRight: 80 } : null]}>
            <MaterialCommunityIcons name="star-four-points" size={11} color={BRASS} />
            <Text style={s.eyebrowText}>Man of the Match</Text>
            <MaterialCommunityIcons name="star-four-points" size={11} color={BRASS} />
          </View>
          <View style={s.row}>
            {/* The player in a burst of light. */}
            <View style={[s.stage, { width: figure, height: figure + 10 }]}>
              <Rays size={figure * 1.6} />
              {photo ? (
                <PlayerPhoto uri={photo} />
              ) : (
                <View style={s.fallback}>
                  <Jersey size={figure * 0.9} from={crestOf(team).from} to={crestOf(team).to} initials={initials} id={`mj${initials}`} />
                </View>
              )}
              <View style={s.medal}>
                <MaterialCommunityIcons name="trophy" size={16} color="#2A1D05" />
              </View>
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
              <Text style={[s.name, (compact || !wide) && { fontSize: 24, lineHeight: 27 }]} numberOfLines={2}>
                {name}
              </Text>
              <View style={s.team}>
                <TeamCrest name={team} size={18} />
                <Text style={s.teamText} numberOfLines={1}>
                  {team}
                  {picked ? '  ·  picked by hand' : ''}
                </Text>
              </View>
              <View style={s.chips}>
                {parts(summary).map((p) => (
                  <View key={p.label + p.value} style={s.chip}>
                    <MaterialCommunityIcons name={p.icon} size={13} color={BRASS} />
                    <View>
                      <Text style={s.chipValue}>{p.value}</Text>
                      <Text style={s.chipLabel}>{p.label}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </PressableScale>
        {/* Outside the award's own button: a button can't hold another one. */}
        {action && <View style={s.action}>{action}</View>}
      </LinearGradient>
    </PopIn>
  );
}

const s = StyleSheet.create({
  frame: { borderRadius: radius.xl + 2, padding: 1.5, boxShadow: '0px 10px 40px rgba(227,190,114,0.18)' } as object,
  card: { borderRadius: radius.xl, overflow: 'hidden', padding: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  stage: { alignItems: 'center', justifyContent: 'center' },
  fallback: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'flex-end' },
  initials: { position: 'absolute', fontFamily: font.posterBlack, letterSpacing: -1 },
  medal: { position: 'absolute', right: 6, bottom: 8, width: 30, height: 30, borderRadius: 15, backgroundColor: BRASS, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: BRASS_HI, boxShadow: '0px 0px 14px rgba(246,223,166,0.6)' } as object,
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  eyebrowText: { ...type.label, fontSize: 10, letterSpacing: 2, color: BRASS },
  name: { color: hero.text, fontFamily: font.posterBlack, fontSize: 30, lineHeight: 33, letterSpacing: -1 },
  team: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  teamText: { color: hero.muted, fontSize: 12, fontFamily: font.semibold, flexShrink: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.sm, backgroundColor: 'rgba(227,190,114,0.10)', borderWidth: 1, borderColor: 'rgba(227,190,114,0.28)' },
  chipValue: { color: hero.text, fontFamily: font.posterBlack, fontSize: 16, lineHeight: 18, ...type.num },
  chipLabel: { color: BRASS, fontFamily: font.bold, fontSize: 9, letterSpacing: 0.8, textTransform: 'uppercase' },
  action: { position: 'absolute', top: space.md + 2, right: space.md + 2 },
});
