// Caches the app itself so it opens at grounds with no signal. Data lives on the device and moves by match files.
module.exports = {
  globDirectory: 'dist/',
  globPatterns: [
    '**/*.{js,css,html,png,ico,json,woff,woff2}',
    // The fonts the app uses, so an offline copy never asks for fonts a newer version has dropped.
    'assets/node_modules/@expo-google-fonts/inter/{400Regular,500Medium,600SemiBold,700Bold,800ExtraBold}/*.ttf',
    'assets/node_modules/@expo-google-fonts/bricolage-grotesque/{500Medium,600SemiBold,700Bold,800ExtraBold}/*.ttf',
    'assets/node_modules/@expo/vector-icons/**/Ionicons*.ttf',
    'assets/node_modules/@expo/vector-icons/**/MaterialCommunityIcons*.ttf',
  ],
  // Leave out the rest of node_modules' assets, and the GitHub Pages copy of the page.
  globIgnores: ['**/node_modules/**/*.{js,css,html,png,ico,json}', '404.html'],
  maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
  swDest: 'dist/sw.js',
  // On GitHub Pages the site lives under /crease, so every address falls back to that copy of the page.
  navigateFallback: `${(process.env.EXPO_BASE_URL || '').replace(/\/$/, '')}/index.html`,
  // New versions take over on the next open instead of waiting for every tab to close.
  skipWaiting: true,
  clientsClaim: true,
};
