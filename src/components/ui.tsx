import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
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
import { ballColors, colors, font, gradients, radius, space, type, ink, edge, isDay } from '../theme.ts';

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

/** A screen under the floodlights: black, with a faint volt glow falling from the top. */
export function Screen({ children, style, glow = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; glow?: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screen, { paddingTop: insets.top }, style]}>
      {glow && <LinearGradient pointerEvents="none" colors={gradients.glow} style={styles.glow} />}
      {children}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
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

/** A huge, faint word behind content, used as texture. */
export function GhostWord({ children, size = 160, style }: { children: string; size?: number; style?: StyleProp<TextStyle> }) {
  return (
    <Text
      pointerEvents="none"
      // The web adds "…" to a one-line Text; there a no-wrap style clips cleanly instead.
      numberOfLines={Platform.OS === 'web' ? undefined : 1}
      ellipsizeMode="clip"
      style={[styles.ghost, { fontSize: size, lineHeight: size * 0.9 }, Platform.OS === 'web' && ({ whiteSpace: 'nowrap' } as object), style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {children}
    </Text>
  );
}

export function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View style={styles.sectionRow}>
      <View style={styles.sectionLeft}>
        <View style={styles.sectionTick} />
        <Text style={styles.sectionLabel}>{children}</Text>
      </View>
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

/** Fades and rises into place on mount; pass increasing delays to stagger a list. */
export function FadeIn({ children, delay = 0, style }: { children: ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 420, delay, easing: Easing.out(Easing.cubic), useNativeDriver: native }).start();
  }, [v, delay]);
  const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] });
  return <Animated.View style={[style, { opacity: v, transform: [{ translateY }] }]}>{children}</Animated.View>;
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
      Animated.timing(v, { toValue: 1, duration: 260, easing: Easing.out(Easing.back(1.6)), useNativeDriver: native }),
      Animated.delay(MOMENTS[moment.kind].hold),
      Animated.timing(v, { toValue: 2, duration: 320, easing: Easing.in(Easing.cubic), useNativeDriver: native }),
    ]).start(() => setShown(null));
  }, [moment, v]);

  if (!shown) return null;
  const m = MOMENTS[shown.kind];
  const opacity = v.interpolate({ inputRange: [0, 0.6, 1.4, 2], outputRange: [0, 0.96, 0.96, 0] });
  const scale = v.interpolate({ inputRange: [0, 1, 2], outputRange: [0.55, 1, 1.25] });
  const translateX = v.interpolate({ inputRange: [0, 1, 2], outputRange: [-60, 0, 80] });
  const skew = v.interpolate({ inputRange: [0, 1, 2], outputRange: ['-14deg', '-8deg', '-4deg'] });

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.moment, { backgroundColor: m.bg, opacity }]}>
      <PitchStripes count={7} opacity={0.08} />
      <Animated.Text
        numberOfLines={1}
        adjustsFontSizeToFit
        style={[
          styles.momentWord,
          { color: m.fg, fontSize: 176 * m.size, lineHeight: 176 * m.size, transform: [{ translateX }, { scale }, { skewX: skew }] },
        ]}
      >
        {m.word}
      </Animated.Text>
      {shown.caption ? <Text style={[styles.momentCaption, { color: m.fg }]}>{shown.caption}</Text> : null}
    </Animated.View>
  );
}

// ─── Controls ────────────────────────────────────────────────────────────────

/** Primary is volt with a hard offset shadow it presses down into; ghost and danger are flat. */
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
  const shift = press.interpolate({ inputRange: [0, 1], outputRange: [0, 4] });
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
      {variant === 'primary' && !isDay && <View style={styles.buttonShadow} />}
      <Animated.View style={[styles.buttonFill, fill, { transform: [{ translateX: shift }, { translateY: shift }] }]}>
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
    accent: [colors.accent, colors.onAccent],
    violet: [colors.violet, isDay ? '#FFFFFF' : colors.onAccent],
    danger: [colors.danger, '#FFFFFF'],
  }[tone];
  return (
    <PressableScale
      accessibilityState={{ selected }}
      disabled={disabled}
      scaleTo={0.92}
      onPress={onPress}
      style={[styles.chip, selected && { backgroundColor: on[0], borderColor: on[0] }]}
    >
      {icon && <Ionicons name={icon} size={14} color={selected ? on[1] : colors.muted} />}
      <Text style={[styles.chipText, selected && { color: on[1] }]}>{label}</Text>
    </PressableScale>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <PressableScale
            key={o.value}
            accessibilityState={{ selected: on }}
            scaleTo={0.95}
            onPress={() => onChange(o.value)}
            wrapStyle={{ flex: 1 }}
            style={[styles.segment, on && styles.segmentOn]}
          >
            <Text numberOfLines={1} style={[styles.segmentText, on && { color: colors.onAccent }]}>
              {o.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
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
  if (!ball) return <View style={[styles.ball, styles.ballEmpty, { width: size, height: size }]} />;
  const c = ballColors[ball.tone];
  const wide = ball.label.length > 2;
  const scale = v.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });
  return (
    <Animated.View
      style={[
        styles.ball,
        { minWidth: size, height: size, backgroundColor: c.bg, paddingHorizontal: wide ? 7 : 0 },
        { opacity: v, transform: [{ scale }] },
      ]}
    >
      <Text style={[styles.ballText, { color: c.fg, fontSize: wide ? 14 : 19 }]}>{ball.label}</Text>
    </Animated.View>
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
  const icon: IconName = toast?.tone === 'error' ? 'alert-circle' : toast?.tone === 'info' ? 'information-circle' : 'checkmark-circle';
  const color = toast?.tone === 'error' ? colors.danger : toast?.tone === 'info' ? colors.cyan : colors.accent;
  const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [40, 0] });
  const element = toast ? (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.toastWrap,
        placement === 'top' ? { top: insets.top + 64 } : { bottom: insets.bottom + 96 },
        { opacity: v, transform: [{ translateY: placement === 'top' ? Animated.multiply(translateY, -1) : translateY }] },
      ]}
    >
      <View style={[styles.toast, { borderColor: color }]} accessibilityLiveRegion="polite">
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
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}>
        <View style={styles.grabber} />
        <View style={styles.sheetHead}>
          <Text style={styles.sheetTitle}>{title}</Text>
          <IconButton icon="close" label="Close" onPress={onClose} />
        </View>
        {children}
      </View>
    </Modal>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  glow: { position: 'absolute', top: 0, left: 0, right: 0, height: 320 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
    ...edge,
  },
  ghost: {
    position: 'absolute',
    fontFamily: font.posterBlack,
    color: ink(0.045),
    textTransform: 'uppercase',
    letterSpacing: -4,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.xl,
    marginBottom: space.sm,
    paddingHorizontal: 2,
  },
  sectionLeft: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  sectionTick: { width: 14, height: 3, backgroundColor: isDay ? colors.accentInk : colors.accent, transform: [{ skewX: '-20deg' }] },
  sectionLabel: { ...type.label, color: colors.muted },
  buttonWrap: { height: 56, marginRight: 4, marginBottom: 4 },
  buttonShadow: {
    position: 'absolute',
    left: 4,
    top: 4,
    right: -4,
    bottom: -4,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
  buttonFill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    borderRadius: radius.md,
  },
  primaryFill: { backgroundColor: colors.accent, ...edge },
  dangerFill: { backgroundColor: colors.danger },
  ghostFill: { backgroundColor: colors.surfaceHi, borderWidth: 1, borderColor: isDay ? colors.border : colors.borderHi },
  buttonText: { fontSize: 21, fontFamily: font.poster, textTransform: 'uppercase', letterSpacing: 0.3 },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
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
    height: 38,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderHi,
    backgroundColor: colors.surfaceHi,
  },
  chipText: { color: colors.muted, fontSize: 14, fontFamily: font.bold },
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    padding: 4,
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
    ...edge,
  },
  segment: { height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, paddingHorizontal: 8 },
  segmentOn: { backgroundColor: colors.accent },
  segmentText: { color: colors.muted, fontSize: 14, fontFamily: font.bold },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.sm, minHeight: 56 },
  rowTitle: { color: colors.text, fontSize: 15, fontFamily: font.bold },
  rowHint: { color: colors.muted, fontSize: 13, fontFamily: font.regular, marginTop: 2 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  stepperValue: { color: colors.accentInk, fontSize: 30, fontFamily: font.posterBlack, minWidth: 34, textAlign: 'center', ...type.num },
  ball: { borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  ballEmpty: { borderWidth: 1.5, borderColor: colors.border, borderStyle: 'dashed' },
  ballText: { fontFamily: font.posterBlack, ...type.num },
  moment: { alignItems: 'center', justifyContent: 'center', zIndex: 50 },
  momentWord: { fontFamily: font.posterBlack, fontSize: 176, lineHeight: 176, letterSpacing: -5 },
  momentCaption: { fontFamily: font.poster, fontSize: 26, marginTop: -8, letterSpacing: 0.5, textTransform: 'uppercase' },
  toastWrap: { position: 'absolute', left: space.lg, right: space.lg, alignItems: 'center', zIndex: 40 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.surfaceHi,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    maxWidth: 420,
  },
  toastText: { color: colors.text, fontSize: 14, fontFamily: font.semibold, flexShrink: 1 },
  backdrop: { flex: 1, backgroundColor: colors.scrim },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: 2,
    borderColor: colors.accent,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    maxHeight: '88%',
  },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderHi, marginBottom: space.sm },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.md },
  sheetTitle: { ...type.title, fontSize: 30, color: colors.text },
});
