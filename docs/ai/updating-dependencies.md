# Updating dependencies

## Principles

- Prefer **small, reviewable** bumps. Group Dependabot PRs; do not land TypeScript 7 + ESLint 10 + Nx 24 + MikroORM 7 in one blind merge.
- Always update **`yarn.lock`** with `package.json`. Public CI uses `yarn install --immutable` (YN0028 if out of sync).
- After any **Prettier** minor/major bump, run Prettier across the repo (or at least packages) and commit formatting in the same PR. Prettier 3.9 changed union/JSON layout here and broke `check-dev` lint until formatted (PR #12).
- Validate in order: **lint → build → unit test → e2e/federation** (federation only when adapters or GraphQL peers move).

## Known safe pins (this fork)

Treat these as intentional until the maintainer approves a major migration:

| Area                   | Pin / guidance                                                                                           |
| ---------------------- | -------------------------------------------------------------------------------------------------------- |
| TypeScript             | `~5.9.x` (not 7.x yet)                                                                                   |
| ESLint                 | `8.57.x` (not 10.x yet)                                                                                  |
| `@typescript-eslint/*` | 7.x with ESLint 8                                                                                        |
| Nx / `@nx/*`           | 22.7.x (not 24.x yet)                                                                                    |
| MikroORM               | 6.6.x (not 7.x yet)                                                                                      |
| Prettier               | exact version in `package.json` (for example `3.9.10`); never `^` for Prettier                           |
| NestJS                 | 12.x line aligned across `@nestjs/*`                                                                     |
| `@nestjs/graphql`      | 14.x                                                                                                     |
| mongoose / typegoose   | keep peer-compatible (see package peers); recent safe set included mongoose `9.9.x` + typegoose `13.5.x` |
| `better-sqlite3`       | `^12` via resolutions/root as needed for Node 24 native builds                                           |

Dependabot may open grouped PRs under `dependabot/npm_and_yarn/development-dependencies-*` or `production-dependencies-*`. Close or reshape majors that break peers instead of force-merging red CI.

## Safe bump playbook

1. Branch from `dev` (or use the Dependabot branch).
2. Apply patch/minor updates; **pin back** high-risk majors unless this PR’s goal is that major.
3. `yarn install` and commit `yarn.lock`.
4. If Prettier changed: `yarn prettier --write` on packages (and configs), with LF ([line-endings.md](line-endings.md)).
5. Local gate:

   ```sh
   yarn nx run-many --target=lint --all
   yarn nx run-many --target=build --all --parallel=1
   NODE_OPTIONS=--experimental-vm-modules yarn nx run-many --target=test --all
   ```

6. PR → `dev`; wait for **`check (dev)`**.
7. After merge, watch promote PR for full **`check (main)`** (e2e/federation often break on GraphQL/Apollo/Babel peer drift).

## Federation / Babel

`examples/federation-v2-e2e` uses npm lockfiles inside services. Unpinned `@babel/types@^7.29` has failed Docker `npm ci`. Keep Babel overrides pinned (types/core/traverse/generator/parser/template/helpers) as in those `package.json` files. Use `--legacy-peer-deps` where TypeScript 5.9 conflicts with `@nestjs/schematics` peers. Regenerate a workspace lockfile with:

```sh
cd examples/federation-v2-e2e/e2e-test
npm install --legacy-peer-deps --package-lock-only --ignore-scripts --no-workspaces
```

## What not to do

- Do not run `npm install` at the monorepo root for day-to-day work (Yarn owns the root lockfile).
- Do not leave `package-lock.json` churn at the root unless intentionally documenting npm-only tooling.
- Do not auto-publish after bumps ([publishing.md](publishing.md)).
