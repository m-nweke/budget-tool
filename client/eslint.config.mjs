import tseslint from 'typescript-eslint';
import pluginVue from 'eslint-plugin-vue';

export default tseslint.config(
  // vite-env.d.ts is Vite's own generated boilerplate (the `*.vue` module
  // declaration it scaffolds), not app code — not worth hand-editing to
  // satisfy a rule it was never written against.
  { ignores: ['dist/**', 'src/vite-env.d.ts'] },
  tseslint.configs.recommended,
  // 'essential' (bug-prevention rules) rather than 'recommended' (which
  // also pulls in Vue's stylistic conventions — attribute-per-line,
  // self-closing tags, etc.) — this codebase has no existing style
  // convention to match, so pulling those in now would force a
  // codebase-wide reformat unrelated to adding linting.
  pluginVue.configs['flat/essential'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  }
);
