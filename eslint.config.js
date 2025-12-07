import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default [
  // Ignore non-app code and static files
  { ignores: ['google-apps-script/**', 'public/**'] },

  // Lint only source files
  ...tseslint.config(
    {
      files: ['src/**/*.{ts,tsx,js,jsx}'],
      languageOptions: {
        parser: tseslint.parser,
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      plugins: {
        'react-hooks': reactHooks,
        'react-refresh': reactRefresh,
      },
      rules: {
        'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
        'react-hooks/rules-of-hooks': 'error',
        'react-hooks/exhaustive-deps': 'warn',
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
    {
      files: ['src/**/*.{js,jsx}'],
      ...js.configs.recommended,
    }
  ),
]
