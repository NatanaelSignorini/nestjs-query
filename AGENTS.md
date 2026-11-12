# AGENTS.md

Guidance for AI agents and humans working in this repository. Read this file first. Open the linked playbooks in `docs/ai/` only when the task needs that depth. When you change CI, Nest GraphQL behavior, dependency pins, or test strategy, update the matching playbook in the same PR.

Human contributor setup and PR etiquette also live in [CONTRIBUTING.md](CONTRIBUTING.md).

## Repository identity

- **Package:** NestJS Query — TypeScript monorepo (Yarn 4 workspaces + Nx).
- **This fork:** [NatanaelSignorini/nestjs-query](https://github.com/NatanaelSignorini/nestjs-query), NestJS **12** / `@nestjs/graphql` **14**, public Free-plan hardening.
- **Upstream lineage:** TriPSs/nestjs-query (from doug-martin/nestjs-query). Keep LICENSE and NOTICE with MIT attribution.
- **Default branch:** `dev` (integration). **`main` is production.**
- **Node:** `>=20.19.0 || >=22.12.0` (CI uses Node 24; full `check (main)` also runs 26). Nest 12 ESM Jest needs Node 24.9+.

## AI playbooks (detail)

| Topic                               | Path                                                                 |
| ----------------------------------- | -------------------------------------------------------------------- |
| Index                               | [docs/ai/README.md](docs/ai/README.md)                               |
| Branch flow and CI                  | [docs/ai/branch-and-ci.md](docs/ai/branch-and-ci.md)                 |
| Nest 12 / GraphQL 14 pitfalls       | [docs/ai/nestjs-12-pitfalls.md](docs/ai/nestjs-12-pitfalls.md)       |
| Performance and After hooks         | [docs/ai/performance-and-hooks.md](docs/ai/performance-and-hooks.md) |
| Updating dependencies               | [docs/ai/updating-dependencies.md](docs/ai/updating-dependencies.md) |
| Line endings (LF)                   | [docs/ai/line-endings.md](docs/ai/line-endings.md)                   |
| Mongo unit tests and e2e/federation | [docs/ai/testing-mongo-e2e.md](docs/ai/testing-mongo-e2e.md)         |
| Publishing                          | [docs/ai/publishing.md](docs/ai/publishing.md)                       |

These files are **not** registered in Mintlify `docs/docs.json`. They are for agents and maintainers only.

## Branch flow (summary)

- Open feature and chore PRs against **`dev`**.
- PRs/pushes to `dev` run workflow **`check (dev)`** and must pass required check **`check (dev)`** (Node 24: lint + build + unit test). No e2e or federation on that gate.
- After a **push** to `dev` (typically merge of a feature PR) and **`CI (dev)`** / **`check (dev)`** succeed, workflow **Promote dev to main** opens/refreshes PR `dev` → `main` automatically (title `chore(release): promote dev to main (<sha7>)`) and enables auto-merge. Manual **workflow_dispatch** remains as an escape hatch.
- That promote PR runs workflow **`CI (main)`** and must pass required check **`check (main)`** (Node 24/26 matrix, e2e postgres/mysql, federation); GitHub then auto-merges into `main`.
- Promote does **not** run on `pull_request` CI (dev) completions — only on successful **push** to `dev` (plus manual dispatch).
- **`CI (main)` and `CI (dev)` are separate workflow files** so push-to-`dev` never posts a skipped check named `check (main)` on the same SHA.
- Do not open feature PRs directly to `main` unless you are changing promote/CI wiring itself.
- **Do not open PRs `main` → `dev`** (including GitHub “sync” after promote). That produces noise merges whose Actions titles say `/main` while the push is still to `dev`. Details: [docs/ai/branch-and-ci.md](docs/ai/branch-and-ci.md).

Details: [docs/ai/branch-and-ci.md](docs/ai/branch-and-ci.md).

## Working conventions

- Use **Yarn**, not npm, for dependency and Nx commands: `yarn nx <target> <project>`.
- Keep changes narrowly scoped. Do not overwrite or revert unrelated working-tree changes. One concern per commit/PR when practical (for example fix typegoose without breaking federation).
- TypeScript style: **no semicolons**, **no default exports**. Prettier and ESLint own formatting and import order (`simple-import-sort`).
- Line endings: **LF** everywhere (`.prettierrc` `endOfLine: lf`, `.gitattributes`). On Windows set repo-local `core.autocrlf=false`. See [docs/ai/line-endings.md](docs/ai/line-endings.md).
- Add or update tests with production-code changes. Unit tests live under `__tests__/` as `*.spec.ts`.
- Update Mintlify docs for user-facing features and register new pages in `docs/docs.json`.
- Conventional Commits, for example `fix(core): handle empty filters`.
- Prefer dedicated branches for CI/docs vs feature WIP.

## Validation

Prefer the smallest relevant check before broader validation:

```sh
yarn nx lint <project>
yarn nx test <project>
yarn nx build <project>
```

For unit tests under Nest 12 ESM:

```sh
# Unix
NODE_OPTIONS=--experimental-vm-modules yarn nx test <project>

# PowerShell
$env:NODE_OPTIONS='--experimental-vm-modules'; yarn nx test <project>
```

Common projects: `core`, `query-graphql`, `query-rest`, `query-typeorm`, `query-mongoose`, `query-sequelize`, `query-mikro-orm`, `query-typegoose`. List with `yarn nx show projects`.

All packages (mirrors light CI):

```sh
yarn nx run-many --target=lint --all
yarn nx run-many --target=build --all --parallel=1
NODE_OPTIONS=--experimental-vm-modules yarn nx run-many --target=test --all
```

E2E needs Docker from `examples/docker-compose.yml` (`yarn docker up -d`, then `yarn nx e2e examples`). Federation e2e: see [docs/ai/testing-mongo-e2e.md](docs/ai/testing-mongo-e2e.md).

After dependency bumps, run Prettier if the Prettier major/minor changed, and keep `yarn.lock` in sync (`yarn install --immutable` must pass on public PRs).

## Project structure

- `packages/core`: framework-independent query, service, and DTO primitives.
- `packages/query-*`: GraphQL, REST, and persistence adapters (`query-graphql`, `query-rest`, `query-typeorm`, `query-mongoose`, `query-sequelize`, `query-mikro-orm`, `query-typegoose`).
- `examples`: integration and end-to-end apps (including `federation-v2-e2e`).
- `docs`: Mintlify user documentation (`docs.json` navigation).
- `docs/ai`: agent/maintainer playbooks (this fork’s operating manual).
- `tools`: shared tooling and custom ESLint rules.
- `.github/workflows`: `ci-dev.yml` (`CI (dev)`), `ci.yml` (`CI (main)` + `workflow_dispatch`), `promote-dev.yml` (`workflow_run` on successful CI (dev) push to `dev` + `workflow_dispatch`), `codeql-analysis.yml` (`Code scanning`), publish/release (`workflow_dispatch` only).

## Hard constraints for agents

1. **Do not auto-publish** npm packages. Publish/release are manual. See [docs/ai/publishing.md](docs/ai/publishing.md).
2. **Do not silently bump** TypeScript 7, ESLint 10, Nx 24, or MikroORM 7 without an explicit maintainer decision — see [docs/ai/updating-dependencies.md](docs/ai/updating-dependencies.md).
3. Before changing GraphQL hooks, aggregates, or multi-resolver paging, read [docs/ai/nestjs-12-pitfalls.md](docs/ai/nestjs-12-pitfalls.md).
4. Fix root causes in CI (lint/format, flakes, peers). Avoid one-off suppressions that hide regressions.
5. Say something is fixed or tested only when you have command or CI evidence.
