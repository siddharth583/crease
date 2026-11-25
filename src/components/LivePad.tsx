import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import type { InningsState } from '../engine/engine.ts';
import type { BallEvent, Extra, Match } from '../engine/types.ts';
import { useClubSync } from '../store/sync.tsx';
import { colors, edge, isDay, font, gradients, radius, space, type } from '../theme.ts';
import { Pulse } from './motion.tsx';
import { FadeIn, PressableScale, Segmented, tap } from './ui.tsx';

// The scoring pad, in the thumb zone: runs 0 to 6 (the boundaries bigger), the extras above them, a leather-red WICKET
// key, and Undo with the rare actions behind More. Presentation only: it hands finished balls to the screen.

export type PadMode = Extra | 'bouncer';

/** What OUT was pressed with: an extra picked first, or a bounce and its call. */
export type Armed = { mode: Extra | null; bouncer?: 'fair' | 'wide' };

const EXTRAS: { value: PadMode; label: string; name: string; kbd?: string }[] = [
  { value: 'wide', label: 'Wd', name: 'Wide', kbd: 'D' },
  { value: 'noball', label: 'Nb', name: 'No ball', kbd: 'N' },
  { value: 'bouncer', label: 'Bounce', name: 'Bounce' },
];

const MODE_HINT: Record<Extra, string> = {
  wide: 'WIDE · tap Wd to add it',
  noball: 'NO BALL · tap the runs off the bat',
  bye: 'BYE · tap the runs they ran',
  legbye: 'LEG BYE · tap the runs they ran',
};

const ordinal = (n: number) => `${n}${[, 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] ?? 'th'}`;

export type Bounce = { choice: boolean; hint: string; calledAs: 'wide' | 'noball' };

/** How the next bounce counts: the umpire's call (fair or wide) while the over's allowance lasts, then called. */
export function bounceInfo(match: Match, s: InningsState): Bounce {
  const rule = match.rules.bouncer ?? { fair: 1, calledAs: 'noball' as const };
  const left = rule.fair - s.bouncersThisOver;
  return left > 0
    ? { choice: true, calledAs: rule.calledAs, hint: `BOUNCE · umpire’s call: fair or wide · ${left === 1 ? 'the next one is' : `${left} left, then`} a ${rule.calledAs === 'wide' ? 'wide' : 'no ball'}` }
    : {
        choice: false,
        calledAs: rule.calledAs,
        hint: `BOUNCE · ${ordinal(s.bouncersThisOver + 1)} this over: a ${rule.calledAs === 'wide' ? 'wide · tap Wd' : 'no ball · tap the runs'}`,
      };
}

type KeyVariant = 'plain' | 'dot' | 'four' | 'six' | 'out' | 'mode';

function Key({
  label,
  sub,
  onPress,
  disabled,
  variant = 'plain',
  height,
  kbd,
  a11y,
  wicket,
}: {
  label: string;
  sub?: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: KeyVariant;
  height: number;
  kbd?: string;
  a11y?: string;
  wicket?: boolean;
}) {
  const fg = { plain: colors.text, dot: colors.muted, four: colors.cyan, six: colors.onAccent, out: '#FFFFFF', mode: colors.violet }[variant];
  const big = height >= 70;
  return (
    <PressableScale
      accessibilityLabel={a11y ?? (sub ? `${label} ${sub}` : label)}
      disabled={disabled}
      haptic={null}
      scaleTo={0.9}
      wrapStyle={{ flex: 1 }}
      onPress={onPress}
      style={[k.key, { height }, variant === 'four' && k.four, variant === 'six' && k.six, variant === 'out' && k.out, variant === 'mode' && k.mode, variant === 'dot' && k.dot]}
    >
      {variant === 'six' && <LinearGradient pointerEvents="none" colors={gradients.accent} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />}
      {variant === 'out' && <LinearGradient pointerEvents="none" colors={gradients.danger} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />}
      {wicket ? (
        <View style={{ alignItems: 'center', gap: 1 }}>
          <Text style={[k.wicketText, { color: fg, fontSize: big ? 24 : 21 }]}>WICKET</Text>
          <Text style={[k.sub, { color: fg }]}>BATTER OUT</Text>
        </View>
      ) : (
        <>
          <Text style={[k.text, { color: fg, fontSize: big ? 40 : 30, lineHeight: big ? 44 : 34 }, label.length > 2 && { fontSize: 24 }]}>{label}</Text>
          {sub && <Text style={[k.sub, { color: fg }]}>{sub}</Text>}
        </>
      )}
      {kbd && <Text style={[k.kbd, { color: fg }]}>{kbd}</Text>}
    </PressableScale>
  );
}

/** FREE HIT and HAT-TRICK BALL: a slim banner above the pad. */
export function Banner({ tone, title, body }: { tone: 'volt' | 'red'; title: string; body: string }) {
  const red = tone === 'red';
  return (
    <FadeIn>
      <View style={[k.banner, red ? { backgroundColor: colors.danger } : { backgroundColor: colors.accentDim, borderWidth: 1, borderColor: colors.accent }]}>
        <Pulse color={red ? '#FFFFFF' : colors.accent} size={7} />
        <Text style={[k.bannerTitle, { color: red ? '#FFFFFF' : colors.accentInk }]}>{title}</Text>
        <Text numberOfLines={1} style={[k.bannerBody, { color: red ? '#FFFFFF' : colors.text }]}>
          {body}
        </Text>
      </View>
    </FadeIn>
  );
}

/** The pad's keys on a keyboard, for the extras row. */
export function Pad({
  onBall,
  onWicket,
  bounce,
  extraRun,
  big,
  shortcuts,
  hints,
  onUndo,
}: {
  onBall: (b: BallEvent) => void;
  /** OUT: the extra or bounce armed before it goes with the wicket, so it isn't lost. */
  onWicket: (armed: Armed) => void;
  bounce: Bounce;
  extraRun: number;
  big?: boolean;
  shortcuts?: boolean;
  hints?: boolean;
  onUndo?: () => void;
}) {
  const [mode, setMode] = useState<PadMode | null>(null);
  const [call, setCall] = useState<'fair' | 'wide'>('fair');
  const score = (r: number) => {
    tap(r >= 4 ? 'heavy' : 'light');
    onBall(mode === 'bouncer' ? { type: 'ball', runs: r, bouncer: bounce.choice ? call : 'fair' } : { type: 'ball', runs: r, extra: mode ?? undefined });
    setMode(null);
    setCall('fair');
  };
  const out = () => {
    tap('warning');
    onWicket(mode === 'bouncer' ? { mode: null, bouncer: bounce.choice ? call : 'fair' } : { mode });
    setMode(null);
    setCall('fair');
  };
  const byes = mode === 'bye' || mode === 'legbye';
  // A wide is the one wide run the rules give and nothing more (turf: nobody runs on a wide). A bounce called wide too.
  const wide = mode === 'wide' || (mode === 'bouncer' && (bounce.choice ? call === 'wide' : bounce.calledAs === 'wide'));
  const blocked = (r: number) => (byes && r === 0) || (wide && r > 0);
  const h1 = big ? 84 : 58;
  const h2 = big ? 98 : 68;
  const runKey = (r: number, height: number) => {
    const boundary = !mode && (r === 4 || r === 6);
    const kbd = hints ? String(r) : undefined;
    if (wide && r === 0)
      return <Key key={r} label="Wd" sub={extraRun ? `+${extraRun} RUN` : 'NO RUN'} variant="mode" height={height} kbd={kbd} onPress={() => score(0)} />;
    return (
      <Key
        key={r}
        label={String(r)}
        sub={!mode ? (r === 0 ? 'DOT' : r === 4 ? 'FOUR' : r === 6 ? 'SIX' : r === 1 ? 'RUN' : 'RUNS') : undefined}
        variant={mode ? 'mode' : boundary ? (r === 4 ? 'four' : 'six') : r === 0 ? 'dot' : 'plain'}
        disabled={blocked(r)}
        height={height}
        kbd={kbd}
        onPress={() => score(r)}
      />
    );
  };

  // The keyboard does what the keys do. Read fresh each render, so it always sees the mode picked.
  const onKey = useRef<(e: KeyboardEvent) => void>(() => {});
  onKey.current = (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
    const el = e.target as HTMLElement | null;
    if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
    const key = e.key.toLowerCase();
    if (/^[0-46]$/.test(key)) {
      if (!blocked(Number(key))) score(Number(key));
    } else if (key === 'w') out();
    else if (key === 'd' || key === 'n') setMode((m) => (m === (key === 'd' ? 'wide' : 'noball') ? null : key === 'd' ? 'wide' : 'noball'));
    else if (key === 'escape') {
      setMode(null);
      setCall('fair');
    } else if ((key === 'u' || key === 'backspace') && onUndo) onUndo();
    else return;
    e.preventDefault();
  };
  useEffect(() => {
    if (!shortcuts || Platform.OS !== 'web' || typeof document === 'undefined') return;
    const listen = (e: KeyboardEvent) => onKey.current(e);
    document.addEventListener('keydown', listen);
    return () => document.removeEventListener('keydown', listen);
  }, [shortcuts]);

  return (
    <View style={k.pad}>
      <View style={k.extrasRow}>
        {EXTRAS.map((e) => {
          const on = mode === e.value;
          return (
            <PressableScale
              key={e.value}
              accessibilityLabel={e.name}
              accessibilityState={{ selected: on }}
              scaleTo={0.92}
              wrapStyle={{ flex: 1 }}
              onPress={() => setMode(on ? null : e.value)}
              style={[k.extraKey, big && { height: 48 }, on && k.extraKeyOn]}
            >
              <Text numberOfLines={1} style={[k.extraText, big && { fontSize: 14 }, on && { color: isDay ? '#FFFFFF' : colors.onAccent }]}>
                {e.label}
              </Text>
              {hints && e.kbd && <Text style={[k.kbd, { top: 3, right: 6 }, on && { color: colors.onAccent }]}>{e.kbd}</Text>}
            </PressableScale>
          );
        })}
      </View>
      <View style={k.hintRow}>
        <Text numberOfLines={1} style={[k.modeHint, mode && { color: colors.violet }]}>
          {mode === 'bouncer' ? bounce.hint : mode ? MODE_HINT[mode] : 'TAP THE RUNS OFF THIS BALL'}
        </Text>
        {mode && (
          <PressableScale accessibilityLabel="Clear the extra" hitSlop={8} onPress={() => (setMode(null), setCall('fair'))}>
            <Text style={k.clear}>CLEAR</Text>
          </PressableScale>
        )}
      </View>
      {mode === 'bouncer' && bounce.choice && (
        <Segmented
          value={call}
          onChange={setCall}
          options={[
            { value: 'fair', label: 'Fair ball' },
            { value: 'wide', label: 'Wide' },
          ]}
        />
      )}
      <View style={k.grid}>{[0, 1, 2, 3].map((r) => runKey(r, h1))}</View>
      {/* The boundaries are taller; WICKET is two keys wide and red, and Undo lives above the pad: nothing to mistake for it. */}
      <View style={k.grid}>
        {runKey(4, h2)}
        {runKey(6, h2)}
        <View style={{ flex: 2, flexDirection: 'row' }}>
          <Key label="WICKET" a11y="OUT" wicket variant="out" height={h2} kbd={hints ? 'W' : undefined} onPress={out} />
        </View>
      </View>
    </View>
  );
}

/** Undo and Redo, a labelled More for the rare actions, and the club sync beside them. */
export function UndoBar({
  canUndo: undoable,
  canRedo,
  onUndo,
  onRedo,
  onMore,
  label = 'Undo last ball',
}: {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  /** Opens the More menu (rain, DLS, retire, swap strike, penalty, dead ball, end innings). */
  onMore?: () => void;
  label?: string;
}) {
  return (
    <View style={k.undoBar}>
      <PressableScale accessibilityLabel={label} disabled={!undoable} hitSlop={4} scaleTo={0.94} onPress={onUndo} style={[k.undoPill, undoable && k.undoPillOn]}>
        <Ionicons name="arrow-undo" size={16} color={colors.text} />
        <Text style={k.undoText}>Undo</Text>
      </PressableScale>
      {canRedo && (
        <PressableScale accessibilityLabel="Redo the ball just undone" hitSlop={4} scaleTo={0.94} onPress={onRedo} style={k.undoPill}>
          <Ionicons name="arrow-redo" size={16} color={colors.text} />
          <Text style={k.undoText}>Redo</Text>
        </PressableScale>
      )}
      {onMore && (
        <PressableScale accessibilityLabel="More: rain, DLS, retire, swap strike, penalty, dead ball, end innings" hitSlop={4} scaleTo={0.94} onPress={onMore} style={k.undoPill}>
          <Ionicons name="ellipsis-horizontal-circle-outline" size={17} color={colors.text} />
          <Text style={k.undoText}>More</Text>
        </PressableScale>
      )}
      <View style={{ flex: 1 }} />
      <SyncBadge />
    </View>
  );
}

/** Whether this phone's balls have reached the club. Nothing where there's no club sync (a test copy, signed out). */
function SyncBadge() {
  const sync = useClubSync();
  if (sync.status === 'unavailable' || !sync.user) return null;
  const waiting = !sync.online || sync.pending;
  return (
    <View style={k.syncBadge} accessibilityLiveRegion="polite">
      <Ionicons name={waiting ? 'cloud-offline-outline' : 'cloud-done-outline'} size={15} color={waiting ? colors.gold : colors.muted} />
      <Text style={[k.syncText, waiting && { color: colors.gold }]}>{waiting ? 'Waiting for signal' : 'Saved'}</Text>
    </View>
  );
}

const k = StyleSheet.create({
  pad: { gap: 6 },
  grid: { flexDirection: 'row', gap: 6 },
  key: {
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceHi,
    borderWidth: 1,
    borderColor: colors.borderHi,
    borderBottomWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...edge,
  },
  dot: { backgroundColor: colors.surface },
  four: { backgroundColor: colors.cyanDim, borderColor: colors.cyan },
  six: { backgroundColor: colors.accent, borderColor: colors.accent },
  out: { backgroundColor: colors.danger, borderColor: colors.danger },
  mode: { backgroundColor: colors.violetDim, borderColor: colors.violet },
  text: { fontFamily: font.posterBlack, ...type.num },
  wicketText: { fontFamily: font.posterBlack, letterSpacing: 1 },
  sub: { fontSize: 9, fontFamily: font.semibold, letterSpacing: 1, marginTop: -1, opacity: 0.75 },
  kbd: { position: 'absolute', top: 6, right: 9, fontSize: 10, fontFamily: font.bold, opacity: 0.6 },
  extrasRow: { flexDirection: 'row', gap: 6 },
  extraKey: { height: 38, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceHi, alignItems: 'center', justifyContent: 'center', ...edge },
  extraKeyOn: { backgroundColor: colors.violet, borderColor: colors.violet },
  extraText: { color: colors.muted, fontSize: 12.5, fontFamily: font.bold },
  hintRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 16 },
  modeHint: { ...type.label, fontSize: 10, color: colors.faint, textAlign: 'center' },
  clear: { ...type.label, fontSize: 10, color: colors.accentInk },
  banner: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderRadius: radius.pill, paddingHorizontal: space.lg, paddingVertical: 7, marginBottom: space.sm },
  bannerTitle: { fontFamily: font.posterBlack, fontSize: 15, letterSpacing: 0.5 },
  bannerBody: { flex: 1, fontFamily: font.semibold, fontSize: 12 },
  undoBar: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: 8 },
  undoPill: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderHi, backgroundColor: colors.surfaceHi },
  undoPillOn: { borderColor: colors.muted },
  undoText: { color: colors.text, fontSize: 14, fontFamily: font.semibold },
  syncBadge: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  syncText: { color: colors.muted, fontSize: 12, fontFamily: font.semibold },
});
