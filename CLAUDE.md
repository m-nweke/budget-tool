# Project conventions

## Documentation workflow

Each commit is one user story. It gets a matching doc pair:

- `docs/stories/NN-short-name.md` — concept-level "how it works": what shipped, code excerpts, and the reasoning behind them. Matches the style of `docs/stories/02-repositories-and-date-math.md`.
- `docs/decisions/NN-short-name.md` — the "why & tradeoffs" companion: what shipped, why this ordering, key tradeoffs named explicitly. Matches the style of `docs/decisions/01-server-foundation.md`.

Numbering continues the existing sequence (stories/decisions 1–7 predate the auth rollout; it starts at 8).

Also maintain a running `docs/FILE_STRUCTURE.md` — one entry per file touched, stating that file's purpose/core functionality. Updated in place, not appended to like a changelog. Any file touched by a story gets an entry.

`docs/stories/`, `docs/decisions/`, and `docs/codebase_teaching_all_stories.txt` are gitignored (`docs/*` + `*.md` excluded except `README.md`) — they're intentionally untracked local references, not missing files.

## Branching

Never push directly to `main`. All work happens on a feature branch with a PR opened against `main` — including small or schema-only changes. `main` has branch protection requiring a passing `test-and-build` check.
