# Story 7: CI Pipeline & Coverage Gate — How It Works

## Concept: the workflow file

```yaml
jobs:
  server:
    defaults: { run: { working-directory: server } }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm install
      - run: npm test
      - run: npm run build

  client:
    defaults: { run: { working-directory: client } }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm install
      - run: npm run build
```

`defaults.run.working-directory` scopes every `run:` step in that job to the given subfolder, so `npm test` and `npm run build` execute against `server/package.json` (or `client/package.json`) without needing `cd server &&` prefixed onto every command. The two jobs have no `needs:` dependency between them, so GitHub Actions runs them concurrently — total pipeline time is roughly the slower of the two jobs, not their sum.

## Concept: coverage thresholds as a CI-enforced gate, not just a report

```ts
// vitest.config.ts
coverage: {
  provider: 'v8',
  include: ['src/**/*.ts'],
  exclude: ['src/**/*.test.ts', 'src/types/**', 'src/server.ts'],
  thresholds: { lines: 80, statements: 80 },
},
```

With `thresholds` set, `vitest run --coverage` doesn't just print a report — it **exits non-zero** if actual coverage falls below the configured numbers, which is what makes this an enforceable gate rather than an informational number nobody looks at. Running `npx vitest run --coverage` locally before pushing confirmed 91% statements against the 80% floor:

```
All files          |   91.01 |    71.21 |    92.5 |   91.01 |
 repositories       |   95.89 |    71.05 |    91.3 |   95.89 |
 routes             |   90.74 |    68.85 |     100 |   90.74 |
 utils              |    96.8 |     87.5 |   91.66 |    96.8 |
```

Note `npm test` in CI (`vitest run`, no `--coverage` flag) runs the *functional* suite without the coverage instrumentation overhead — the coverage check is a separate, deliberate local/pre-push verification rather than wired into every CI run, since re-computing coverage on every push adds runtime cost without changing whether the tests themselves pass.
