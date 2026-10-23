// Caches the app itself so it opens at grounds with no signal. Data lives on the device and syncs separately.
module.exports = {
  globDirectory: 'dist/',
  globPatterns: ['**/*.{js,css,html,png,ico,json,ttf,woff,woff2}'],
  // Workbox skips node_modules unless told otherwise; keep that, and leave out the GitHub Pages copy of the page.
  globIgnores: ['**/node_modules/**/*', '404.html'],
  maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
  swDest: 'dist/sw.js',
  // On GitHub Pages the site lives under /crease, so every address falls back to that copy of the page.
  navigateFallback: `${(process.env.EXPO_BASE_URL || '').replace(/\/$/, '')}/index.html`,
  // New versions take over on the next open instead of waiting for every tab to close.
  skipWaiting: true,
  clientsClaim: true,
};
