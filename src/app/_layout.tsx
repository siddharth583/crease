import {
  BarlowCondensed_600SemiBold,
  BarlowCondensed_700Bold,
  BarlowCondensed_800ExtraBold_Italic,
  BarlowCondensed_900Black_Italic,
} from '@expo-google-fonts/barlow-condensed';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MatchesProvider } from '../store/matches.tsx';
import { PrefsProvider } from '../store/prefs.ts';
import { colors, isDay } from '../theme.ts';

export default function RootLayout() {
  const [loaded, failed] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    BarlowCondensed_600SemiBold,
    BarlowCondensed_700Bold,
    BarlowCondensed_800ExtraBold_Italic,
    BarlowCondensed_900Black_Italic,
  });

  // Wait for the fonts so text doesn't jump; if they fail, carry on with the system font.
  if (!loaded && !failed) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  return (
    <SafeAreaProvider>
      <PrefsProvider>
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
      </PrefsProvider>
    </SafeAreaProvider>
  );
}
