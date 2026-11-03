import { Ionicons } from '@expo/vector-icons';
import { Tabs, type BottomTabBarProps } from 'expo-router/js-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { AppMark } from '../../components/AppMark.tsx';
import { useLayout } from '../../components/layout.tsx';
import { useReducedMotion } from '../../components/motion.tsx';
import { useAccess } from '../../store/sync.tsx';
import { PressableScale, type IconName } from '../../components/ui.tsx';
import { colors, font, radius, space, edge } from '../../theme.ts';

const PAD = 6;
const GAP = 4;

const TABS: Record<string, { label: string; icon: IconName; iconOn: IconName }> = {
  index: { label: 'Matches', icon: 'albums-outline', iconOn: 'albums' },
  players: { label: 'Players', icon: 'podium-outline', iconOn: 'podium' },
  teams: { label: 'Teams', icon: 'people-outline', iconOn: 'people' },
};

/** A floating capsule of tabs. A new match starts from the Matches tab. */
function TabBar({ state, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const still = useReducedMotion();
  const tabs = state.routes.filter((r) => TABS[r.name]);
  // The highlight glides to the chosen tab rather than jumping.
  const [width, setWidth] = useState(0);
  // The capsule has a 1px border; its tabs sit inside the padding.
  const slot = width ? (width - 2 - PAD * 2 - GAP * (tabs.length - 1)) / tabs.length : 0;
  const x = useRef(new Animated.Value(0)).current;
  const at = Math.max(0, tabs.findIndex((r) => r.key === state.routes[state.index]?.key));
  useEffect(() => {
    const to = at * (slot + GAP);
    if (still || !slot) x.setValue(to);
    else Animated.spring(x, { toValue: to, useNativeDriver: Platform.OS !== 'web', speed: 16, bounciness: 7 }).start();
  }, [at, slot, still, x]);
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, space.md) }]}>
      <LinearGradient pointerEvents="none" colors={[`${colors.bg}00`, `${colors.bg}EB`, colors.bg]} style={styles.fade} />
      <View style={styles.capsule} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {slot > 0 && <Animated.View pointerEvents="none" style={[styles.indicator, { width: slot, transform: [{ translateX: x }] }]} />}
        {state.routes.map((route, i) => {
          const tab = TABS[route.name];
          if (!tab) return null;
          const on = state.index === i;
          return (
            <PressableScale
              key={route.key}
              accessibilityRole="tab"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: on }}
              scaleTo={0.94}
              onPress={() => !on && navigateToTab(route.key)}
              wrapStyle={{ flex: 1 }}
              style={styles.tab}
            >
              <Ionicons name={on ? tab.iconOn : tab.icon} size={19} color={on ? colors.text : colors.faint} />
              <Text style={[styles.tabLabel, on && styles.tabLabelOn]}>{tab.label}</Text>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

/**
 * On a tablet or laptop the tabs are a rail down the left, the way an app built for a big screen keeps its places:
 * the mark at the top, the three places, New match, then profile and settings at the foot. Names show beside the icons
 * on a laptop, under them on a tablet.
 */
function SideRail({ state, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { desk } = useLayout();
  const access = useAccess();
  const item = (label: string, icon: IconName, on: boolean, onPress: () => void, key: string) => (
    <PressableScale
      key={key}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: on }}
      scaleTo={0.96}
      onPress={onPress}
      style={[desk ? styles.railItemWide : styles.railItem, on && styles.railItemOn]}
    >
      <Ionicons name={icon} size={desk ? 20 : 22} color={on ? colors.text : colors.muted} />
      <Text numberOfLines={1} style={[desk ? styles.railLabelWide : styles.railLabel, on && styles.tabLabelOn]}>
        {label}
      </Text>
    </PressableScale>
  );
  return (
    <View style={[styles.rail, desk && styles.railWide, { paddingTop: insets.top + space.lg, paddingBottom: insets.bottom + space.lg }]}>
      <View style={[styles.railBrand, desk && { flexDirection: 'row', gap: space.sm, alignSelf: 'stretch', paddingHorizontal: space.sm }]}>
        <AppMark size={desk ? 34 : 40} />
        {desk && <Text style={styles.railName}>Crease</Text>}
      </View>
      {access.score && (
        <PressableScale accessibilityLabel="New match" haptic="medium" onPress={() => router.push('/new')} style={desk ? styles.railNewWide : styles.railNew}>
          <Ionicons name="add" size={22} color={colors.onAccent} />
          {desk && <Text style={styles.railNewLabel}>New match</Text>}
        </PressableScale>
      )}
      <View style={styles.railTabs}>
        {state.routes.map((route, i) => {
          const tab = TABS[route.name];
          if (!tab) return null;
          const on = state.index === i;
          return item(tab.label, on ? tab.iconOn : tab.icon, on, () => !on && navigateToTab(route.key), route.key);
        })}
      </View>
      <View style={{ flex: 1 }} />
      <View style={styles.railTabs}>
        {item('Records', 'trophy-outline', false, () => router.push('/records'), 'records')}
        {item('My profile', 'person-circle-outline', false, () => router.push('/profile'), 'profile')}
        {item('Settings', 'settings-outline', false, () => router.push('/settings'), 'settings')}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const { wide } = useLayout();
  return (
    <Tabs
      tabBar={(props) => (wide ? <SideRail {...props} /> : <TabBar {...props} />)}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg }, tabBarPosition: wide ? 'left' : 'bottom' }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="players" />
      <Tabs.Screen name="teams" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.xl,
    zIndex: 100,
    elevation: 20,
  },
  fade: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  capsule: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 62,
    padding: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...edge,
  },
  tab: {
    height: 48,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  indicator: {
    position: 'absolute',
    left: PAD,
    top: PAD,
    bottom: PAD,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceHi,
    borderWidth: 1,
    borderColor: colors.borderHi,
  },
  tabLabel: { color: colors.faint, fontFamily: font.semibold, fontSize: 14 },
  rail: {
    width: 96,
    alignItems: 'center',
    gap: space.lg,
    backgroundColor: colors.surface,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  railWide: { width: 232, alignItems: 'stretch', paddingHorizontal: space.md },
  railBrand: { alignItems: 'center', marginBottom: space.sm },
  railName: { color: colors.text, fontFamily: font.posterBlack, fontSize: 24, letterSpacing: -0.5 },
  railTabs: { gap: space.xs, alignSelf: 'stretch', paddingHorizontal: space.sm },
  railItem: { alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: 64, borderRadius: radius.lg, paddingVertical: space.sm },
  railItemWide: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 48, borderRadius: radius.md, paddingHorizontal: space.md },
  railItemOn: { backgroundColor: colors.surfaceHi, borderWidth: 1, borderColor: colors.borderHi },
  railLabel: { color: colors.muted, fontFamily: font.semibold, fontSize: 11 },
  railLabelWide: { color: colors.muted, fontFamily: font.semibold, fontSize: 15 },
  railNew: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  railNewWide: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs, height: 48, borderRadius: radius.pill, backgroundColor: colors.accent },
  railNewLabel: { color: colors.onAccent, fontFamily: font.bold, fontSize: 15 },
  tabLabelOn: { color: colors.text },
});
