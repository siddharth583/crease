// After `expo export`, point the page's own links (manifest, icons, offline worker) at the sub-folder the site is
// served from, and add what GitHub Pages needs: a 404.html that loads the app for any address, and .nojekyll so
// the _expo folder is served. Does nothing without EXPO_BASE_URL.
import { copyFileSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const base = (process.env.EXPO_BASE_URL || '').replace(/\/$/, '');
if (!base) process.exit(0);

const html = 'dist/index.html';
writeFileSync(
  html,
  readFileSync(html, 'utf8')
    .replace('href="/manifest.json"', `href="${base}/manifest.json"`)
    .replace('href="/apple-touch-icon.png"', `href="${base}/apple-touch-icon.png"`)
    .replace("register('/sw.js')", `register('${base}/sw.js', { scope: '${base}/' })`),
);

const manifest = JSON.parse(readFileSync('dist/manifest.json', 'utf8'));
manifest.start_url = `${base}/`;
manifest.scope = `${base}/`;
manifest.icons = manifest.icons.map((i) => ({ ...i, src: `${base}${i.src}` }));
writeFileSync('dist/manifest.json', JSON.stringify(manifest, null, 2));

copyFileSync(html, 'dist/404.html');
writeFileSync('dist/.nojekyll', '');
rmSync('dist/_redirects', { force: true });
console.log(`Prepared dist for ${base}/`);
