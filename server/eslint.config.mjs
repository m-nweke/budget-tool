import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**'] },
  tseslint.configs.recommended,
  {
    rules: {
      // Repositories/routes intentionally destructure DTOs and drop unused
      // fields at call sites; warn instead of erroring so that pattern
      // doesn't need a suppression comment everywhere it's used.
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      // Express's own Request<Params, ResBody, ReqBody> generics use `{}`
      // as the conventional "unused" placeholder (e.g. Request<{}, {}, Dto>)
      // throughout the existing route handlers — not a real "any object" bug.
      '@typescript-eslint/no-empty-object-type': ['error', { allowObjectTypes: 'always' }],
    },
  }
);
