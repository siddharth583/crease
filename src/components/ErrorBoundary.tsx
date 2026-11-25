import { LinearGradient } from 'expo-linear-gradient';
import { Component, useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, font, gradients, radius, space } from '../theme.ts';
import { Stumps, OvalGround } from './cricket.tsx';
import { Rise } from './motion.tsx';
import { Button } from './ui.tsx';

// The last safety net: something one screen can't show (a match that doesn't read right) shows this instead of a
// blank app. Everything kept on the phone stays; going back home or reloading usually gets past it.

/** A friendly full-screen message: the stumps go down, a few words, one Go home button. Used by errors and wrong addresses. */
export function StumpsScreen({ kicker, title, body, action, onAction }: { kicker: string; title: string; body: string; action: string; onAction: () => void }) {
  // The wicket falls a beat after the screen opens.
  const [hit, setHit] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setHit(true), 650);
    return () => clearTimeout(t);
  }, []);
  return (
    <View style={styles.screen}>
      <LinearGradient pointerEvents="none" colors={gradients.glow} style={StyleSheet.absoluteFill} />
      <View style={styles.panel}>
        <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} />
        <OvalGround />
        <Rise>
          <Stumps size={96} hit={hit} color="#F4F1E6" bail={colors.gold} />
        </Rise>
        <Rise index={1}>
          <Text style={styles.kicker}>{kicker}</Text>
        </Rise>
        <Rise index={2}>
          <Text style={styles.title}>{title}</Text>
        </Rise>
        <Rise index={3}>
          <Text style={styles.body}>{body}</Text>
        </Rise>
        <Rise index={4} style={{ alignSelf: 'stretch', marginTop: space.sm }}>
          <Button icon="home-outline" label={action} onPress={onAction} />
        </Rise>
      </View>
    </View>
  );
}

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
      <StumpsScreen
        kicker="Howzat! A wicket on this screen"
        title="Something on this screen didn’t load"
        body="Your matches are safe on this phone. Go back home and try again."
        action="Go home"
        onAction={home}
      />
    );
  }
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: space.lg },
  panel: { width: '100%', maxWidth: 440, borderRadius: radius.xl, overflow: 'hidden', alignItems: 'center', padding: space.xl, paddingTop: space.xxl, gap: space.md, borderWidth: 1, borderColor: colors.borderHi },
  kicker: { color: colors.gold, fontSize: 11, fontFamily: font.bold, letterSpacing: 1.4, textTransform: 'uppercase', textAlign: 'center' },
  title: { color: '#F4F1E6', fontFamily: font.posterBlack, fontSize: 28, lineHeight: 32, textAlign: 'center', letterSpacing: -0.6 },
  body: { color: '#94AB9D', fontFamily: font.regular, fontSize: 15, lineHeight: 22, textAlign: 'center' },
});
