import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Tabs, type BottomTabBarProps } from 'expo-router/js-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableScale, type IconName } from '../../components/ui.tsx';
import { colors, font, radius, space, edge } from '../../theme.ts';

const TABS: Record<string, { label: string; icon: IconName; iconOn: IconName }> = {
  index: { label: 'Matches', icon: 'albums-outline', iconOn: 'albums' },
  players: { label: 'Players', icon: 'podium-outline', iconOn: 'podium' },
};

/** A floating capsule of tabs, with the one thing you come here to do (start a match) beside it in volt. */
function TabBar({ state, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, space.md) }]}>
      <LinearGradient pointerEvents="none" colors={[`${colors.bg}00`, `${colors.bg}EB`, colors.bg]} style={styles.fade} />
      <View style={styles.capsule}>
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
              style={[styles.tab, on && styles.tabOn]}
            >
              <Ionicons name={on ? tab.iconOn : tab.icon} size={19} color={on ? colors.text : colors.faint} />
              <Text style={[styles.tabLabel, on && styles.tabLabelOn]}>{tab.label}</Text>
            </PressableScale>
          );
        })}
      </View>
      <PressableScale
        accessibilityLabel="New match"
        haptic="medium"
        scaleTo={0.88}
        onPress={() => router.push('/new')}
        style={styles.fab}
      >
        <Ionicons name="add" size={30} color={colors.onAccent} />
      </PressableScale>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="players" />
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
  tabOn: { backgroundColor: colors.surfaceHi, borderWidth: 1, borderColor: colors.borderHi },
  tabLabel: { color: colors.faint, fontFamily: font.semibold, fontSize: 14 },
  tabLabelOn: { color: colors.text },
  fab: {
    width: 62,
    height: 62,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...edge,
  },
});
