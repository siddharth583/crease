import {
  BricolageGrotesque_500Medium,
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold,
  BricolageGrotesque_800ExtraBold,
} from '@expo-google-fonts/bricolage-grotesque';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MatchesProvider } from '../store/matches.tsx';
import { PrefsProvider } from '../store/prefs.ts';
import { SquadProvider } from '../store/squad.ts';
import { colors, isDay } from '../theme.ts';

export default function RootLayout() {
  const [loaded, failed] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    BricolageGrotesque_500Medium,
    BricolageGrotesque_600SemiBold,
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
  });

  // Wait briefly for the fonts so text doesn't jump; on a slow connection, show the app after 2.5 seconds anyway
  // and let the fonts swap in when they arrive. If they fail, carry on with the system font.
  const [waited, setWaited] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setWaited(true), 2500);
    return () => clearTimeout(t);
  }, []);
  if (!loaded && !failed && !waited) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  return (
    <SafeAreaProvider>
      <PrefsProvider>
      <SquadProvider>
      <MatchesProvider>
        <StatusBar style={isDay ? 'dark' : 'light'} />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg },
            animation: 'slide_from_right',
          }}
        />
      </MatchesProvider>
      </SquadProvider>
      </PrefsProvider>
    </SafeAreaProvider>
  );
}
