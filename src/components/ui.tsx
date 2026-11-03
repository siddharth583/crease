import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BallView } from '../engine/engine.ts';
import { useLayout } from './layout.tsx';
import { EASE_OUT, useReducedMotion } from './motion.tsx';
import { ballColors, colors, font, gradients, radius, space, type, edge, isDay, type TeamTheme } from '../theme.ts';

export type IconName = ComponentProps<typeof Ionicons>['name'];

/** The native driver isn't available on web. */
const native = Platform.OS !== 'web';

export function tap(kind: 'light' | 'medium' | 'heavy' | 'success' | 'warning' = 'light') {
  if (Platform.OS === 'web') return;
  if (kind === 'success' || kind === 'warning')
    Haptics.notificationAsync(
      kind === 'success' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning,
    ).catch(() => {});
  else
    Haptics.impactAsync(
      { light: Haptics.ImpactFeedbackStyle.Light, medium: Haptics.ImpactFeedbackStyle.Medium, heavy: Haptics.ImpactFeedbackStyle.Heavy }[kind],
    ).catch(() => {});
}

// ─── Surfaces ────────────────────────────────────────────────────────────────

/**
 * A team's page wears its side's theme: the haze at the top, the cards and their edges, the section labels. Pages
 * read it for their own highlights. Unset everywhere else.
 */
const PageTone = createContext<TeamTheme | null>(null);
export const PageToneProvider = PageTone.Provider;
export const usePageTone = () => useContext(PageTone);

/** A screen at the ground after dark: the pitch-black page with a faint green haze from the floodlights. */
export function Screen({ children, style, glow = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; glow?: boolean }) {
  const insets = useSafeAreaInsets();
  const tone = usePageTone();
  return (
    <View style={[styles.screen, { paddingTop: insets.top }, style]}>
      {glow && <LinearGradient pointerEvents="none" colors={tone?.glow ?? gradients.glow} style={styles.glow} />}
      {children}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const tone = usePageTone();
  return <View style={[styles.card, tone && { backgroundColor: tone.card, borderColor: tone.line }, style]}>{children}</View>;
}

/** Mown-grass stripes, as seen on a ground from the stands. Fills its parent. */
/** `tint` is an "r,g,b" for the stripes; the theme's grass by default. */
export function PitchStripes({ count = 9, opacity = 0.035, tint }: { count?: number; opacity?: number; tint?: string }) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { flexDirection: 'row' }]}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={{ flex: 1, backgroundColor: i % 2 ? `rgba(${tint ?? colors.stripe},${opacity})` : 'transparent' }} />
      ))}
    </View>
  );
}

/** A huge, faint word behind content. Retired in the Clubhouse design (it made screens busy); kept so call sites stay simple. */
export function GhostWord(_: { children: string; size?: number; style?: StyleProp<TextStyle> }) {
  return null;
}

/** A section's small caps label. `flush` drops the room above it: the first thing in a column, level with its neighbour's. */
export function SectionLabel({ children, right, flush }: { children: ReactNode; right?: ReactNode; flush?: boolean }) {
  const tone = usePageTone();
  return (
    <View style={[styles.sectionRow, flush && { marginTop: 0 }]}>
      <Text style={[styles.sectionLabel, tone && { color: tone.ink }]}>{children}</Text>
      {right}
    </View>
  );
}

// ─── Motion ──────────────────────────────────────────────────────────────────

/** Anything that springs down a little under the thumb. */
export function PressableScale({
  children,
  onPress,
  onLongPress,
  disabled,
  style,
  scaleTo = 0.96,
  haptic = 'light',
  accessibilityLabel,
  accessibilityRole = 'button',
  accessibilityState,
  hitSlop,
  wrapStyle,
  dimWhenDisabled = true,
}: {
  children: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  haptic?: Parameters<typeof tap>[0] | null;
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'link' | 'tab';
  accessibilityState?: { selected?: boolean; disabled?: boolean };
  hitSlop?: number;
  /** Layout for the touch area itself, e.g. flex: 1 in a row. */
  wrapStyle?: StyleProp<ViewStyle>;
  /** Off for things that are simply not tappable, rather than unavailable. */
  dimWhenDisabled?: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) => Animated.spring(scale, { toValue: v, useNativeDriver: native, speed: 40, bounciness: 8 }).start();
  return (
    <Pressable
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled, ...accessibilityState }}
      disabled={disabled}
      hitSlop={hitSlop}
      style={wrapStyle}
      onPressIn={() => to(scaleTo)}
      onPressOut={() => to(1)}
      onLongPress={onLongPress}
      onPress={() => {
        if (haptic) tap(haptic);
        onPress?.();
      }}
    >
      <Animated.View style={[style, { transform: [{ scale }], opacity: disabled && dimWhenDisabled ? 0.35 : 1 }]}>{children}</Animated.View>
    </Pressable>
  );
}

/** Fades and rises into place on mount, settling slowly; pass increasing delays to stagger a list. */
export function FadeIn({ children, delay = 0, style }: { children: ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const still = useReducedMotion();
  const v = useRef(new Animated.Value(still ? 1 : 0)).current;
  useEffect(() => {
    if (still) return;
    Animated.timing(v, { toValue: 1, duration: 640, delay, easing: EASE_OUT, useNativeDriver: native }).start();
  }, [v, delay, still]);
  const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [20, 0] });
  const scale = v.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1] });
  return <Animated.View style={[style, { opacity: v, transform: [{ translateY }, { scale }] }]}>{children}</Animated.View>;
}

/** Text that punches up whenever its value changes: the score after every run. */
export function PopText({ value, style }: { value: string | number; style?: StyleProp<TextStyle> }) {
  const scale = useRef(new Animated.Value(1)).current;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    scale.setValue(1.18);
    Animated.spring(scale, { toValue: 1, useNativeDriver: native, speed: 14, bounciness: 14 }).start();
  }, [value, scale]);
  return <Animated.Text style={[style, { transform: [{ scale }] }]}>{value}</Animated.Text>;
}

export type Moment = { kind: 'four' | 'six' | 'wicket' | 'fifty' | 'hundred' | 'hattrick'; caption?: string; key: number };

const MOMENTS = {
  four: { word: 'FOUR!', bg: colors.cyan, fg: colors.onAccent, size: 1, hold: 520 },
  six: { word: 'SIX!', bg: colors.accent, fg: colors.onAccent, size: 1, hold: 520 },
  wicket: { word: 'OUT!', bg: colors.danger, fg: '#FFFFFF', size: 1, hold: 520 },
  fifty: { word: 'FIFTY!', bg: colors.gold, fg: colors.onAccent, size: 0.82, hold: 1100 },
  hundred: { word: 'CENTURY!', bg: colors.gold, fg: colors.onAccent, size: 0.6, hold: 1400 },
  hattrick: { word: 'HAT-TRICK!', bg: colors.danger, fg: '#FFFFFF', size: 0.5, hold: 1400 },
};

/** The broadcast takeover after a boundary or a wicket: a flood of colour and one giant word. */
export function MomentFlash({ moment }: { moment: Moment | null }) {
  const v = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState<Moment | null>(null);

  useEffect(() => {
    if (!moment) return;
    setShown(moment);
    v.setValue(0);
    Animated.sequence([
      Animated.spring(v, { toValue: 1, useNativeDriver: native, speed: 11, bounciness: 9 }),
      Animated.delay(MOMENTS[moment.kind].hold),
      Animated.timing(v, { toValue: 2, duration: 380, easing: Easing.bezier(0.55, 0, 1, 0.45), useNativeDriver: native }),
    ]).start(() => setShown(null));
  }, [moment, v]);

  if (!shown) return null;
  const m = MOMENTS[shown.kind];
  const opacity = v.interpolate({ inputRange: [0, 0.5, 1.5, 2], outputRange: [0, 0.97, 0.97, 0] });
  const scale = v.interpolate({ inputRange: [0, 1, 2], outputRange: [0.6, 1, 1.12] });
  const translateY = v.interpolate({ inputRange: [0, 1, 2], outputRange: [40, 0, -30] });
  // A ring bursts out from the centre as the colour floods in.
  const ring = v.interpolate({ inputRange: [0, 1, 2], outputRange: [0.2, 2.6, 4] });
  const ringOpacity = v.interpolate({ inputRange: [0, 0.4, 1, 2], outputRange: [0, 0.5, 0.15, 0] });

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.moment, { backgroundColor: m.bg, opacity }]}>
      <PitchStripes count={7} opacity={0.06} />
      <Animated.View style={[styles.momentRing, { borderColor: m.fg, opacity: ringOpacity, transform: [{ scale: ring }] }]} />
      <Animated.Text
        numberOfLines={1}
        adjustsFontSizeToFit
        style={[
          styles.momentWord,
          { color: m.fg, fontSize: 150 * m.size, lineHeight: 160 * m.size, transform: [{ translateY }, { scale }] },
        ]}
      >
        {m.word}
      </Animated.Text>
      {shown.caption ? (
        <Animated.Text style={[styles.momentCaption, { color: m.fg, transform: [{ translateY }] }]}>{shown.caption}</Animated.Text>
      ) : null}
    </Animated.View>
  );
}

// ─── Controls ────────────────────────────────────────────────────────────────

/** A pill: primary is volt with dark type, ghost a quiet surface, danger red. It sinks a little under the thumb. */
export function Button({
  label,
  onPress,
  icon,
  variant = 'primary',
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  variant?: 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const press = useRef(new Animated.Value(0)).current;
  const to = (v: number) => Animated.spring(press, { toValue: v, useNativeDriver: native, speed: 50, bounciness: 6 }).start();
  const fg = variant === 'primary' ? colors.onAccent : variant === 'danger' ? '#FFFFFF' : colors.text;
  const scale = press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.97] });
  const fill =
    variant === 'primary' ? styles.primaryFill : variant === 'danger' ? styles.dangerFill : styles.ghostFill;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPressIn={() => to(1)}
      onPressOut={() => to(0)}
      onPress={() => {
        tap('medium');
        onPress();
      }}
      style={[styles.buttonWrap, { opacity: disabled ? 0.35 : 1 }, style]}
    >
      <Animated.View style={[styles.buttonFill, fill, { transform: [{ scale }] }]}>
        {icon && <Ionicons name={icon} size={18} color={fg} />}
        <Text style={[styles.buttonText, { color: fg }]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

export function IconButton({
  icon,
  onPress,
  disabled,
  label,
  tint = colors.text,
  active,
}: {
  icon: IconName;
  onPress: () => void;
  disabled?: boolean;
  label: string;
  tint?: string;
  active?: boolean;
}) {
  return (
    <PressableScale
      accessibilityLabel={label}
      disabled={disabled}
      hitSlop={8}
      scaleTo={0.88}
      onPress={onPress}
      style={[styles.iconButton, active && { backgroundColor: colors.accent }]}
    >
      <Ionicons name={icon} size={19} color={active ? colors.onAccent : tint} />
    </PressableScale>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  disabled,
  tone = 'accent',
  icon,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'accent' | 'violet' | 'danger';
  icon?: IconName;
}) {
  const on = {
    accent: [colors.text, colors.bg],
    violet: [colors.violet, isDay ? '#FFFFFF' : colors.onAccent],
    danger: [colors.danger, '#FFFFFF'],
  }[tone];
  return (
    <PressableScale
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      disabled={disabled}
      scaleTo={0.92}
      // 36 high to look at, 44 to the thumb.
      hitSlop={4}
      onPress={onPress}
      style={[styles.chip, selected && { backgroundColor: on[0], borderColor: on[0] }]}
    >
      {icon && <Ionicons name={icon} size={14} color={selected ? on[1] : colors.muted} />}
      <Text style={[styles.chipText, selected && { color: on[1] }]}>{label}</Text>
    </PressableScale>
  );
}

/**
 * Joined options, one picked. Four or more get smaller type so each word fits a phone's width; `multiline` lets a
 * long label (a team's full name) wrap onto a second line instead of being cut.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  multiline,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  multiline?: boolean;
}) {
  const dense = options.length >= 4;
  return (
    <View style={styles.segmented}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <PressableScale
            key={o.value}
            accessibilityLabel={o.label}
            accessibilityState={{ selected: on }}
            scaleTo={0.95}
            onPress={() => onChange(o.value)}
            wrapStyle={{ flex: 1 }}
            style={[styles.segment, dense && styles.segmentDense, multiline && styles.segmentTall, on && styles.segmentOn]}
          >
            <Text
              numberOfLines={multiline ? 2 : 1}
              style={[styles.segmentText, dense && styles.segmentTextDense, multiline && { textAlign: 'center', lineHeight: 17 }, on && { color: colors.bg }]}
            >
              {o.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

/** The years with a match in them, newest first. */
export const matchYears = (matches: { createdAt: number }[]) =>
  [...new Set(matches.map((m) => new Date(m.createdAt).getFullYear()))].sort((a, b) => b - a);
/** Only that year's matches; every match for `null`. */
export const inYear = <M extends { createdAt: number }>(matches: M[], year: number | null) =>
  year === null ? matches : matches.filter((m) => new Date(m.createdAt).getFullYear() === year);

/** A season to look at: All, then each year with a match. Nothing while every match is in the one year. */
export function YearChips({ years, value, onChange }: { years: number[]; value: number | null; onChange: (year: number | null) => void }) {
  if (years.length < 2) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.years}>
      <Chip label="All" selected={value === null} onPress={() => onChange(null)} />
      {years.map((y) => (
        <Chip key={y} label={String(y)} selected={value === y} onPress={() => onChange(y)} />
      ))}
    </ScrollView>
  );
}

export function Stepper({
  label,
  hint,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{label}</Text>
        {hint && <Text style={styles.rowHint}>{hint}</Text>}
      </View>
      <View style={styles.stepper}>
        <IconButton icon="remove" label={`Fewer ${label}`} disabled={value <= min} onPress={() => onChange(value - 1)} />
        <PopText value={value} style={styles.stepperValue} />
        <IconButton icon="add" label={`More ${label}`} disabled={value >= max} onPress={() => onChange(value + 1)} />
      </View>
    </View>
  );
}

export function ToggleRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1, paddingRight: space.md }}>
        <Text style={styles.rowTitle}>{label}</Text>
        {hint && <Text style={styles.rowHint}>{hint}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={(v) => {
          tap();
          onChange(v);
        }}
        trackColor={{ false: colors.surfaceHi, true: colors.accent }}
        thumbColor={value ? colors.onAccent : colors.muted}
        ios_backgroundColor={colors.surfaceHi}
        // react-native-web colours the "on" thumb with its own prop.
        {...({ activeThumbColor: colors.onAccent } as object)}
      />
    </View>
  );
}

/** One delivery on the scorebug: a square tile that drops in when it's bowled. */
export function BallChip({ ball, size = 36, animate = false }: { ball?: BallView; size?: number; animate?: boolean }) {
  const v = useRef(new Animated.Value(animate ? 0 : 1)).current;
  useEffect(() => {
    if (animate) Animated.spring(v, { toValue: 1, useNativeDriver: native, speed: 16, bounciness: 12 }).start();
  }, [animate, v]);
  if (!ball) return <View style={[styles.ball, styles.ballEmpty, { width: size, height: size, borderRadius: size / 2 }]} />;
  const c = ballColors[ball.tone];
  const wide = ball.label.length > 1;
  const scale = v.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });
  return (
    <Animated.View
      style={[
        styles.ball,
        { minWidth: size, height: size, borderRadius: size / 2, backgroundColor: c.bg, paddingHorizontal: wide ? 8 : 0 },
        { opacity: v, transform: [{ scale }] },
      ]}
    >
      <Text style={[styles.ballText, { color: c.fg, fontSize: wide ? 13 : size * 0.44 }]}>{ball.label}</Text>
    </Animated.View>
  );
}

/**
 * A pushed screen's head on a tablet or laptop: Back, the page's title large, a line under it, its actions at the
 * right. The phone keeps each screen's own compact header.
 */
export function WideHead({
  title,
  sub,
  onBack,
  right,
  lead,
}: {
  title: string;
  sub?: ReactNode;
  onBack?: () => void;
  right?: ReactNode;
  /** Before the title, after Back: a crest or a photo. */
  lead?: ReactNode;
}) {
  return (
    <View style={styles.wideHead}>
      {onBack && <IconButton icon="chevron-back" label="Back" onPress={onBack} />}
      {lead}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.wideTitle} numberOfLines={1}>
          {title}
        </Text>
        {sub ? <Text style={styles.wideSub} numberOfLines={1}>{sub}</Text> : null}
      </View>
      {right ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>{right}</View> : null}
    </View>
  );
}

// ─── Overlays ────────────────────────────────────────────────────────────────

export type ToastTone = 'success' | 'error' | 'info';

/** A short message that slides up from the bottom for a few seconds. */
export function useToast(placement: 'bottom' | 'top' = 'bottom') {
  const [toast, setToast] = useState<{ text: string; tone: ToastTone; key: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const v = useRef(new Animated.Value(0)).current;
  const show = useCallback(
    (text: string, tone: ToastTone = 'success') => {
      clearTimeout(timer.current);
      setToast({ text, tone, key: Date.now() });
      v.setValue(0);
      Animated.spring(v, { toValue: 1, useNativeDriver: native, speed: 18, bounciness: 9 }).start();
      timer.current = setTimeout(() => {
        Animated.timing(v, { toValue: 0, duration: 200, useNativeDriver: native }).start(() => setToast(null));
      }, 3200);
    },
    [v],
  );
  useEffect(() => () => clearTimeout(timer.current), []);
  const insets = useSafeAreaInsets();
  // No tab bar to clear on a tablet or laptop: the toast sits near the foot, centred.
  const { wide } = useLayout();
  const icon: IconName = toast?.tone === 'error' ? 'alert-circle' : toast?.tone === 'info' ? 'information-circle' : 'checkmark-circle';
  const color = toast?.tone === 'error' ? colors.danger : toast?.tone === 'info' ? colors.cyan : colors.accent;
  const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [40, 0] });
  const element = toast ? (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.toastWrap,
        placement === 'top' ? { top: insets.top + 64 } : { bottom: insets.bottom + (wide ? space.xxl : 96) },
        { opacity: v, transform: [{ translateY: placement === 'top' ? Animated.multiply(translateY, -1) : translateY }] },
      ]}
    >
      <View style={styles.toast} accessibilityLiveRegion="polite">
        <Ionicons name={icon} size={18} color={color} />
        <Text style={styles.toastText}>{toast.text}</Text>
      </View>
    </Animated.View>
  ) : null;
  return { show, element };
}

export function Sheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const still = useReducedMotion();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!visible) return;
    v.setValue(still ? 1 : 0);
    if (!still) Animated.spring(v, { toValue: 1, useNativeDriver: native, speed: 14, bounciness: 5 }).start();
  }, [visible, v, still]);
  const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [520, 0] });
  const { wide, height } = useLayout();
  // A tablet or laptop: not a sheet stretched across the screen but a dialog in the middle, at a reading width.
  if (wide) {
    const lift = v.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });
    const scale = v.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] });
    return (
      <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: v }]}>
          <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
        </Animated.View>
        <View pointerEvents="box-none" style={styles.dialogWrap}>
          <Animated.View
            accessibilityViewIsModal
            style={[styles.dialog, { maxHeight: height * 0.86, opacity: v, transform: [{ translateY: lift }, { scale }] }]}
          >
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>{title}</Text>
              <IconButton icon="close" label="Close" onPress={onClose} />
            </View>
            {children}
          </Animated.View>
        </View>
      </Modal>
    );
  }
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: v }]}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      </Animated.View>
      <Animated.View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg, position: 'absolute', left: 0, right: 0, bottom: 0, transform: [{ translateY }] }]}>
        <View style={styles.grabber} />
        <View style={styles.sheetHead}>
          <Text style={styles.sheetTitle}>{title}</Text>
          <IconButton icon="close" label="Close" onPress={onClose} />
        </View>
        {children}
      </Animated.View>
    </Modal>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  glow: { position: 'absolute', top: 0, left: 0, right: 0, height: 360 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
    ...edge,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.xl + 4,
    marginBottom: space.md,
    paddingHorizontal: 4,
  },
  sectionLabel: { ...type.label, color: colors.muted },
  buttonWrap: { height: 56 },
  buttonFill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    borderRadius: radius.pill,
    paddingHorizontal: space.xl,
  },
  primaryFill: { backgroundColor: colors.accent, ...edge },
  dangerFill: { backgroundColor: colors.danger },
  ghostFill: { backgroundColor: colors.surfaceHi, borderWidth: 1, borderColor: colors.border },
  buttonText: { fontSize: 16, fontFamily: font.bold, letterSpacing: -0.1 },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceHi,
    borderWidth: 1,
    borderColor: colors.border,
    ...edge,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    height: 36,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceHi,
  },
  chipText: { color: colors.muted, fontSize: 14, fontFamily: font.semibold },
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceHi,
    borderRadius: radius.pill,
    padding: 4,
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segment: { height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, paddingHorizontal: 10 },
  segmentDense: { paddingHorizontal: 4 },
  segmentTall: { height: undefined, minHeight: 38, paddingVertical: 4, borderRadius: radius.md },
  segmentTextDense: { fontSize: 13 },
  // Room above and below for the chips' larger touch area.
  years: { gap: space.sm, paddingVertical: 4 },
  segmentOn: { backgroundColor: colors.text },
  segmentText: { color: colors.muted, fontSize: 14, fontFamily: font.semibold },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.sm, minHeight: 58 },
  rowTitle: { color: colors.text, fontSize: 15, fontFamily: font.semibold },
  rowHint: { color: colors.muted, fontSize: 13, fontFamily: font.regular, marginTop: 2, lineHeight: 18 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  stepperValue: { color: colors.text, fontSize: 26, fontFamily: font.posterBlack, minWidth: 40, textAlign: 'center', ...type.num },
  ball: { alignItems: 'center', justifyContent: 'center' },
  ballEmpty: { borderWidth: 1.5, borderColor: colors.borderHi, borderStyle: 'dashed' },
  ballText: { fontFamily: font.posterBlack, ...type.num },
  moment: { alignItems: 'center', justifyContent: 'center', zIndex: 50 },
  momentRing: { position: 'absolute', width: 220, height: 220, borderRadius: 110, borderWidth: 3 },
  momentWord: { fontFamily: font.posterBlack, fontSize: 150, lineHeight: 165, letterSpacing: -6 },
  momentCaption: { fontFamily: font.poster, fontSize: 24, marginTop: 0, letterSpacing: -0.3 },
  toastWrap: { position: 'absolute', left: space.lg, right: space.lg, alignItems: 'center', zIndex: 40 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: isDay ? colors.text : colors.surfaceHi,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    maxWidth: 440,
    ...edge,
  },
  toastText: { color: isDay ? colors.bg : colors.text, fontSize: 14, fontFamily: font.semibold, flexShrink: 1 },
  backdrop: { flex: 1, backgroundColor: colors.scrim },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl + 4,
    borderTopRightRadius: radius.xl + 4,
    borderTopWidth: 1,
    borderColor: colors.borderHi,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    maxHeight: '88%',
  },
  dialogWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  dialog: {
    width: '100%',
    maxWidth: 560,
    backgroundColor: colors.surface,
    borderRadius: radius.xl + 4,
    borderWidth: 1,
    borderColor: colors.borderHi,
    paddingHorizontal: space.xl,
    paddingTop: space.lg,
    paddingBottom: space.xl,
    boxShadow: '0px 24px 80px rgba(0,0,0,0.45)',
  },
  wideHead: { flexDirection: 'row', alignItems: 'center', gap: space.lg, marginBottom: space.xl, minHeight: 56 },
  wideTitle: { fontFamily: font.posterBlack, fontSize: 40, lineHeight: 46, color: colors.text, letterSpacing: -1.2 },
  wideSub: { fontFamily: font.medium, fontSize: 15, color: colors.muted, marginTop: 2 },
  grabber: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: colors.borderHi, marginBottom: space.md },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.md },
  sheetTitle: { ...type.title, fontSize: 26, color: colors.text },
});
