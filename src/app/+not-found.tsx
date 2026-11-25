import { router } from 'expo-router';
import { StumpsScreen } from '../components/ErrorBoundary.tsx';

/** An address the app doesn't have (an old club invite link, a typo): say so kindly and offer the way home. */
export default function NotFound() {
  return (
    <StumpsScreen
      kicker="Bowled! Page not found"
      title="That page isn’t on the scorecard"
      body="The link may be old or mistyped. Your matches are all still here."
      action="Go home"
      onAction={() => router.replace('/')}
    />
  );
}
