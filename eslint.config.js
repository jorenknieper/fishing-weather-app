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
        renderWindStability: 'readonly',
        // js/dashboard.js globals consumed by app.js
        renderForecastMiniStrip: 'readonly',
        renderMoonCard: 'readonly',
        renderKmiCard: 'readonly',
        renderScoreWidget: 'readonly',
        renderPressureDelta: 'readonly',
        renderMetricSparklines: 'readonly',
        openPressureInline: 'readonly',
        renderConditionSummary: 'readonly',
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
    // js/wind-unified.js references globals from app.js, dashboard-features.js, and chart-plugins.js
    files: ['js/wind-unified.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        Chart: 'readonly',
        // app.js globals
        animatedClose: 'readonly',
        attachSwipeGesture: 'readonly',
        cssVar: 'readonly',
        degreesToCompass: 'readonly',
        makeFocusTrap: 'readonly',
        setupDoubleTap: 'readonly',
        _themeRerenderCallbacks: 'readonly',
        // js/chart-plugins.js globals
        getOrCreateTooltipEl: 'readonly',
        makeExternalTooltipHandler: 'readonly',
        makeDayLabelsPlugin: 'readonly',
        makeNowLinePlugin: 'readonly',
        // js/dashboard-features.js globals
        computeWindRotation: 'readonly',
        renderWindArrow: 'readonly',
        renderWindBarb: 'readonly',
        renderWindCompassDialInto: 'readonly',
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
    // Other js/*.js modules reference globals from app.js and js/chart-plugins.js
    files: [
      'js/router.js',
      'js/wind-direction.js',
      'js/pressure-inline.js',
      'js/build-info.js',
      'js/dashboard-features.js',
    ],
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
  {
    files: ['js/moon.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: { ...globals.browser, SunCalc: 'readonly' },
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
    files: ['js/fishing-score.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: { ...globals.browser, SunCalc: 'readonly', Chart: 'readonly' },
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
    files: ['js/forecast.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        FishingScore: 'readonly',
        Moon: 'readonly',
        hourlyData: 'readonly',
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
    files: ['js/moon-calendar.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: { ...globals.browser, Moon: 'readonly' },
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
    // js/dashboard.js — widget render functions moved from app.js
    files: ['js/dashboard.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        Chart: 'readonly',
        FishingScore: 'readonly',
        Moon: 'readonly',
        // app.js globals consumed by moved functions
        formatTimestamp: 'readonly',
        computePressureTrend: 'readonly',
        getWindBucket: 'readonly',
        degreesToCompass: 'readonly',
        _currentData: 'readonly',
        hourlyData: 'readonly',
        _themeRerenderCallbacks: 'readonly',
        // js/dashboard-features.js globals consumed by moved functions
        synthesizePressureHistory: 'readonly',
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
