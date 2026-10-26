import { useId } from 'react';
import { SvgXml } from 'react-native-svg';
import { appIconSvg } from '../engine/mark.ts';

/** The app icon itself, drawn in the app: the same picture as on the phone's home screen. */
export function AppMark({ size = 32 }: { size?: number }) {
  // Each copy on a page gets its own ids, so their gradients and clips don't mix.
  const id = `m${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return <SvgXml xml={appIconSvg(size, { id })} width={size} height={size} accessibilityLabel="Crease" />;
}
