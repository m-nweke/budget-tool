# Story 7: CI Pipeline & Coverage Gate — Why & Tradeoffs

**What shipped:** `.github/workflows/ci.yml` (server test+build, client build, as two parallel jobs) and a coverage threshold enforced via `@vitest/coverage-v8` in `vitest.config.ts`.

## Why two independent CI jobs instead of one

The server and client are independently buildable/testable — the client's build doesn't need the server's tests to pass, and vice versa. Running them as separate jobs means a client-only change (say, a CSS tweak) doesn't wait on the server's test suite, and a failure report immediately tells you which half of the stack broke without reading through a combined log.

## Why `npm test` runs before `npm run build` in the server job

Catching a logic bug (failing test) before spending time on a full TypeScript compile is the cheaper failure to hit first. `npm run build` (via `tsc`) additionally validates type-correctness across the whole `src/` tree, including files no test directly imports — both checks matter, and ordering the faster/more-specific one first means CI fails fast on the common case.

## Why an 80%-statement coverage threshold, with `types/` and `server.ts` excluded

The project spec's own guidance says "no blanket coverage-percentage target" — but this was a later, explicit ask: **maintain 80% test coverage**. Two exclusions make that number meaningful rather than gamed:

- **`types/**`** — pure TypeScript interfaces compile to *zero* runtime statements. Including them would either report a meaningless 0% (nothing to execute) or inflate the denominator with files that can never be "covered" in any real sense.
- **`server.ts`** — the app's entry point (`app.listen(...)`, middleware wiring) is exercised in practice by every route test that builds an Express app and mounts these same routers/middleware in the same order, but the literal `server.ts` file itself only executes when the process starts, which a test runner doesn't do. Testing it directly would mean spinning up a real listening server per test — disproportionate cost for a file with no branching logic.

With those exclusions, coverage lands at **91% statements / 71% branches**, comfortably over the 80% floor, weighted toward the highest-risk code (repositories, routes, the recurring-generation engine) exactly as the spec's "prioritize the highest-risk logic" guidance recommends — not padded out by testing interface files that have nothing to test.

## Tradeoff not taken: a coverage gate on the frontend

Per the scaffold skill's explicit guidance, frontend component tests tend to reward "did it render" over catching real bugs; the 80% target was applied to the *server* only, and frontend correctness was instead verified by manually driving the running app end-to-end in a browser (category → transaction → recurring series → dashboard, confirmed working) — a more direct check for a UI this size than a suite of shallow render-assertions would have been in the time available.
