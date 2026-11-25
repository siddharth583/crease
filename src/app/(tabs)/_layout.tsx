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
/** The round New match button in the middle of the dock. */
const FAB = 58;

type Tab = { label: string; icon: IconName; iconOn: IconName; /** Routes that light this tab up. */ owns: string[] };
// Four places, in the order they sit. Stats holds the leaderboards, the record book and the season awards together.
const TABS: Record<string, Tab> = {
  index: { label: 'Home', icon: 'home-outline', iconOn: 'home', owns: ['index'] },
  players: { label: 'Stats', icon: 'stats-chart-outline', iconOn: 'stats-chart', owns: ['players', 'records', 'awards'] },
  teams: { label: 'Teams', icon: 'shield-outline', iconOn: 'shield', owns: ['teams'] },
  profile: { label: 'Me', icon: 'person-circle-outline', iconOn: 'person-circle', owns: ['profile'] },
};
const ORDER = ['index', 'players', 'teams', 'profile'];
/** Which tab the current route belongs to. */
const activeTab = (state: BottomTabBarProps['state']) => {
  const name = state.routes[state.index]?.name;
  return ORDER.find((k) => TABS[k].owns.includes(name)) ?? 'index';
};

/**
 * A floating dock: Home and Stats, a big round New match button in the middle (the one thing you do most), then Teams
 * and Me. The active tab's pill glides to it; the middle button breathes.
 */
function TabBar({ state, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const still = useReducedMotion();
  const access = useAccess();
  const active = activeTab(state);
  const tabs = ORDER.map((k) => state.routes.find((r) => r.name === k)).filter((r): r is NonNullable<typeof r> => Boolean(r));
  const fab = access.score;
  // The highlight glides to the chosen tab rather than jumping.
  const [width, setWidth] = useState(0);
  const slot = width ? (width - 2 - PAD * 2 - GAP * (tabs.length - 1 + (fab ? 1 : 0)) - (fab ? FAB : 0)) / tabs.length : 0;
  const x = useRef(new Animated.Value(0)).current;
  const at = Math.max(0, ORDER.indexOf(active));
  useEffect(() => {
    const to = at * (slot + GAP) + (fab && at >= 2 ? FAB + GAP : 0);
    if (still || !slot) x.setValue(to);
    else Animated.spring(x, { toValue: to, useNativeDriver: Platform.OS !== 'web', speed: 16, bounciness: 7 }).start();
  }, [at, slot, still, x, fab]);
  const breathe = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (still || !fab) return;
    const loop = Animated.loop(Animated.sequence([Animated.timing(breathe, { toValue: 1, duration: 1800, useNativeDriver: Platform.OS !== 'web' }), Animated.timing(breathe, { toValue: 0, duration: 1800, useNativeDriver: Platform.OS !== 'web' })]));
    loop.start();
    return () => loop.stop();
  }, [still, fab, breathe]);
  const halo = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.22] });
  const haloOpacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] });
  const item = (route: (typeof tabs)[number]) => {
    const tab = TABS[route.name];
    const on = active === route.name;
    return (
      <PressableScale
        key={route.key}
        accessibilityRole="tab"
        accessibilityLabel={tab.label}
        accessibilityState={{ selected: on }}
        scaleTo={0.92}
        onPress={() => !on && navigateToTab(route.key)}
        wrapStyle={{ flex: 1 }}
        style={styles.tab}
      >
        <Ionicons name={on ? tab.iconOn : tab.icon} size={21} color={on ? colors.onAccent : colors.faint} />
        <Text style={[styles.tabLabel, on && { color: colors.onAccent, fontFamily: font.heavy }]}>{tab.label}</Text>
      </PressableScale>
    );
  };
  const add = fab && (
    <View key="fab" style={{ width: FAB, height: FAB, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View pointerEvents="none" style={[styles.fabHalo, { opacity: haloOpacity, transform: [{ scale: halo }] }]} />
      <PressableScale accessibilityLabel="New match" haptic="medium" scaleTo={0.88} onPress={() => router.push('/new')} style={styles.fab}>
        <Ionicons name="add" size={30} color={colors.onAccent} />
      </PressableScale>
    </View>
  );
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, space.md) }]}>
      <LinearGradient pointerEvents="none" colors={[`${colors.bg}00`, `${colors.bg}EB`, colors.bg]} style={styles.fade} />
      <View style={styles.capsule} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {slot > 0 && <Animated.View pointerEvents="none" style={[styles.indicator, { width: slot, transform: [{ translateX: x }] }]} />}
        {tabs.slice(0, 2).map(item)}
        {add}
        {tabs.slice(2).map(item)}
      </View>
    </View>
  );
}

/**
 * On a tablet or laptop the tabs are a rail down the left: the mark at the top, New match, the four places, then
 * Settings at the foot. Names show beside the icons on a laptop, under them on a tablet.
 */
function SideRail({ state, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { desk } = useLayout();
  const access = useAccess();
  const active = activeTab(state);
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
      <Ionicons name={icon} size={desk ? 20 : 22} color={on ? colors.onAccent : colors.muted} />
      <Text numberOfLines={1} style={[desk ? styles.railLabelWide : styles.railLabel, on && { color: colors.onAccent, fontFamily: font.heavy }]}>
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
        {ORDER.map((k) => {
          const route = state.routes.find((r) => r.name === k);
          if (!route) return null;
          const tab = TABS[k];
          const on = active === k;
          return item(tab.label, on ? tab.iconOn : tab.icon, on, () => !on && navigateToTab(route.key), route.key);
        })}
      </View>
      <View style={{ flex: 1 }} />
      <View style={styles.railTabs}>{item('Settings', 'settings-outline', false, () => router.push('/settings'), 'settings')}</View>
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
      <Tabs.Screen name="profile" />
      {/* Part of Stats: reached from its segmented bar, with the dock still showing. The dock draws only the four places,
          so these need no href: null (which would make them unreachable by address). */}
      <Tabs.Screen name="records" />
      <Tabs.Screen name="awards" />
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
    height: 68,
    padding: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...edge,
  },
  tab: {
    height: 54,
    borderRadius: radius.pill,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  indicator: {
    position: 'absolute',
    left: PAD,
    top: PAD,
    bottom: PAD,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  tabLabel: { color: colors.faint, fontFamily: font.semibold, fontSize: 11 },
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
  railItemOn: { backgroundColor: colors.accent },
  railLabel: { color: colors.muted, fontFamily: font.semibold, fontSize: 11 },
  railLabelWide: { color: colors.muted, fontFamily: font.semibold, fontSize: 15 },
  fab: { width: FAB - 6, height: FAB - 6, borderRadius: (FAB - 6) / 2, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', boxShadow: '0px 6px 20px rgba(215,255,58,0.45)' },
  fabHalo: { position: 'absolute', width: FAB - 6, height: FAB - 6, borderRadius: (FAB - 6) / 2, backgroundColor: colors.accent },
  railNew: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  railNewWide: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs, height: 48, borderRadius: radius.pill, backgroundColor: colors.accent },
  railNewLabel: { color: colors.onAccent, fontFamily: font.bold, fontSize: 15 },
  tabLabelOn: { color: colors.text },
});
