'use strict';

const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  {
    ignores: ['node_modules/**', 'data/**', 'docs/**', '.eslintcache'],
  },
  js.configs.recommended,
  {
    files: ['app.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        Chart: 'readonly',
        // js/dashboard-features.js globals consumed by app.js
        toggleDetails: 'readonly',
        initDetails: 'readonly',
        synthesizePressureHistory: 'readonly',
        renderHourlyRibbon: 'readonly',
        renderWindCompassDial: 'readonly',
        renderWindCompassDialInto: 'readonly',
        renderWindVerdict: 'readonly',
        renderWindMicroStrip: 'readonly',
        // js/chart-plugins.js globals consumed by app.js
        getOrCreateTooltipEl: 'readonly',
        makeExternalTooltipHandler: 'readonly',
        makeNowLinePlugin: 'readonly',
        makeDayLabelsPlugin: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',
      'no-unused-vars': ['warn', { args: 'none', ignoreRestSiblings: true }],
      eqeqeq: ['error', 'smart'],
      'no-var': 'error',
      'prefer-const': 'warn',
    },
  },
  {
    // js/chart-plugins.js defines the plugin factories — no cross-file globals needed
    files: ['js/chart-plugins.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: { ...globals.browser, Chart: 'readonly', cssVar: 'readonly' },
    },
    rules: {
      'no-console': 'off',
      'no-unused-vars': ['warn', { args: 'none', ignoreRestSiblings: true }],
      eqeqeq: ['error', 'smart'],
      'no-var': 'error',
      'prefer-const': 'warn',
    },
  },
  {
    // Other js/*.js modules reference globals from app.js and js/chart-plugins.js
    files: ['js/wind-direction.js', 'js/pressure-inline.js', 'js/build-info.js', 'js/dashboard-features.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        Chart: 'readonly',
        // app.js globals
        animatedClose: 'readonly',
        cssVar: 'readonly',
        setupDoubleTap: 'readonly',
        _themeRerenderCallbacks: 'readonly',
        degreesToCompass: 'readonly',
        // js/chart-plugins.js globals
        makeDayLabelsPlugin: 'readonly',
        makeNowLinePlugin: 'readonly',
        makeExternalTooltipHandler: 'readonly',
        getOrCreateTooltipEl: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',
      'no-unused-vars': ['warn', { args: 'none', ignoreRestSiblings: true }],
      eqeqeq: ['error', 'smart'],
      'no-var': 'error',
      'prefer-const': 'warn',
    },
  },
  {
    files: ['scripts/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-console': 'off',
      'no-unused-vars': ['warn', { args: 'none', ignoreRestSiblings: true }],
      eqeqeq: ['error', 'smart'],
      'no-var': 'error',
      'prefer-const': 'warn',
    },
  },
];
