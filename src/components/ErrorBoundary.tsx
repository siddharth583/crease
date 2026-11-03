import { Component, type ReactNode } from 'react';
import { Text, View } from 'react-native';
import { colors, font } from '../theme.ts';
import { Button } from './ui.tsx';

// The last safety net: something one screen can't show (a match that doesn't read right) shows this instead of a
// blank app. Everything kept on the phone stays; going back home or reloading usually gets past it.

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    const home = () => {
      this.setState({ error: null });
      if (typeof window !== 'undefined' && window.location) window.location.assign((process.env.EXPO_BASE_URL ?? '') + '/');
    };
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 }}>
        <Text style={{ color: colors.text, fontFamily: font.poster, fontSize: 22, textAlign: 'center' }}>Something on this screen didn’t load</Text>
        <Text style={{ color: colors.muted, fontFamily: font.regular, fontSize: 15, textAlign: 'center' }}>
          Your matches are safe on this phone. Go back home and try again.
        </Text>
        <Button label="Go home" onPress={home} />
      </View>
    );
  }
}
