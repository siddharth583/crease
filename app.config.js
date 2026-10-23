// app.json holds the settings; this only adds the web address prefix when the site lives in a sub-folder,
// as on GitHub Pages (EXPO_BASE_URL=/crease). Netlify and the dev server serve from the root and leave it unset.
module.exports = ({ config }) => ({
  ...config,
  experiments: { ...config.experiments, baseUrl: process.env.EXPO_BASE_URL || '' },
});
