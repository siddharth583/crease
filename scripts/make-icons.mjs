// Draws every app icon from the one mark in src/engine/mark.ts, so the icon on the phone and the logo in the app
// stay the same picture. Needs an SVG renderer that isn't part of the app:
//   npm install --no-save @resvg/resvg-js && node scripts/make-icons.mjs
import { writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { appIconSvg, markAloneSvg } from '../src/engine/mark.ts';

const png = (svg, width) => new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render().asPng();
const square = appIconSvg(1024, { rounded: false });
const pitch = appIconSvg(1024, { rounded: false, mark: false });

const files = {
  'assets/icon.png': [square, 1024],
  'assets/favicon.png': [square, 64],
  'public/logo512.png': [square, 512],
  'public/logo192.png': [square, 192],
  'public/apple-touch-icon.png': [square, 180],
  // Android draws its own shape round these: the mark inside the safe zone, the pitch behind, one colour for themes.
  'assets/android-icon-foreground.png': [markAloneSvg(1024, 0.62), 1024],
  'assets/android-icon-background.png': [pitch, 1024],
  'assets/android-icon-monochrome.png': [markAloneSvg(1024, 0.62, { color: '#ffffff', cutSeam: true }), 1024],
  'assets/splash-icon.png': [markAloneSvg(1024, 0.9), 1024],
};
for (const [file, [svg, width]] of Object.entries(files)) writeFileSync(file, png(svg, width));
console.log(`Drew ${Object.keys(files).length} icons`);
