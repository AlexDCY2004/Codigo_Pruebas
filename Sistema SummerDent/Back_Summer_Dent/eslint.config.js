import pluginStandard from 'eslint-config-standard'
import pluginImport from 'eslint-plugin-import'
import pluginN from 'eslint-plugin-n'
import pluginPromise from 'eslint-plugin-promise'
import globals from 'globals'

export default [
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.es2021
      }
    },
    plugins: {
      import: pluginImport,
      n: pluginN,
      promise: pluginPromise
    },
    rules: {
      ...pluginStandard.rules,
      camelcase: ['warm', { properties: 'never', ignoreDestructuring: true }],
      'no-unused-vars': ['warn', { caughtErrors: 'none' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-console': 'off',
      semi: 'off'
    }
  }
]
