import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

// There was no linter. That is how four pieces of dead code and two stale
// effect dependency lists survived in a codebase small enough to read in an
// afternoon — and one of those was a real bug: turning the phone inside an
// open chapter left the turntable aimed at the old ring's angle.
//
// Two rules earn their keep more than the rest:
//   react-hooks/exhaustive-deps, which is the one above, and
//   no-unused-vars, which is every leftover from a change that moved on.
//
// Flat config merges in order, so anything that turns a rule off has to sit
// after the block that turned it on. The main.jsx override at the bottom is
// there for that reason, not as an afterthought.
export default [
  { ignores: ['**/dist/**', '**/node_modules/**', 'client/src/hub/india*.json'] },

  js.configs.recommended,

  {
    files: ['**/*.{js,jsx,mjs}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Without this, every component is "unused" — no-unused-vars does
      // not know that <Figure /> is a reference to Figure.
      'react/jsx-uses-vars': 'error',
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      // Caught-and-ignored is deliberate in one place: setPointerCapture
      // throws on a pointer that has already gone, and losing the gesture
      // to that is worse than the throw.
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  {
    // The entry point exports nothing and is not a module fast refresh can
    // swap. The rule is only right about files that export components.
    files: ['client/src/main.jsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
]
