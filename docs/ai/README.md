# AI / maintainer playbooks

Operating notes for this NestJS Query fork. The root [AGENTS.md](../../AGENTS.md) is the always-on summary. Use these pages when the task touches CI, Nest 12 GraphQL behavior, dependency upgrades, line endings, flaky tests, or publishing.

| Playbook                                             | When to open                                                       |
| ---------------------------------------------------- | ------------------------------------------------------------------ |
| [branch-and-ci.md](branch-and-ci.md)                 | PRs, required checks, promote `dev` → `main`, stuck Actions        |
| [nestjs-12-pitfalls.md](nestjs-12-pitfalls.md)       | Hooks, aggregates, multi-resolver paging, ValidationPipe, ESM Jest |
| [updating-dependencies.md](updating-dependencies.md) | Dependabot, pins, Prettier bumps, lockfile                         |
| [line-endings.md](line-endings.md)                   | LF standard, Windows `autocrlf`, Prettier `Delete ␍`               |
| [testing-mongo-e2e.md](testing-mongo-e2e.md)         | typegoose/mongoose unit flakes, e2e Docker, federation             |
| [publishing.md](publishing.md)                       | Manual npm publish / release                                       |
| [performance-and-hooks.md](performance-and-hooks.md) | After hooks no-go, selectFromResolveInfo, updateStrategy, look-ahead |
| [relation-depth-and-oom.md](relation-depth-and-oom.md) | GraphQL cycles, deep filters/JOINs, UnPagedRelation, look-ahead OOM |

These files are **not** part of the Mintlify site (`docs/docs.json`). Do not add them there unless the maintainer wants them public.

When behavior documented here changes, update the playbook in the same PR as the code or workflow change.
