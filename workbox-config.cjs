// Caches the app itself so it opens at grounds with no signal. Data lives on the device and syncs separately.
module.exports = {
  globDirectory: 'dist/',
  globPatterns: ['**/*.{js,css,html,png,ico,json,ttf,woff,woff2}'],
  maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
  swDest: 'dist/sw.js',
  navigateFallback: '/index.html',
  // New versions take over on the next open instead of waiting for every tab to close.
  skipWaiting: true,
  clientsClaim: true,
};
