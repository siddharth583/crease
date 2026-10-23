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
  club: { label: 'Club', icon: 'people-outline', iconOn: 'people' },
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
              scaleTo={0.9}
              onPress={() => !on && navigateToTab(route.key)}
              style={[styles.tab, on && styles.tabOn]}
            >
              <Ionicons name={on ? tab.iconOn : tab.icon} size={19} color={on ? colors.onAccent : colors.muted} />
              {on && <Text style={styles.tabLabel}>{tab.label}</Text>}
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
      <Tabs.Screen name="club" />
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
    justifyContent: 'space-between',
    height: 62,
    paddingHorizontal: 6,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderHi,
    ...edge,
  },
  tab: {
    height: 48,
    minWidth: 52,
    paddingHorizontal: space.md,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  tabOn: { backgroundColor: colors.accent, paddingHorizontal: space.lg },
  tabLabel: { color: colors.onAccent, fontFamily: font.poster, fontSize: 18, textTransform: 'uppercase' },
  fab: {
    width: 62,
    height: 62,
    borderRadius: radius.xl,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '0deg' }],
    ...edge,
  },
});
