import { Redirect } from 'expo-router';

/** An address the app doesn't have (an old club invite link, a typo): go home. */
export default function NotFound() {
  return <Redirect href="/" />;
}
