# Branch flow and CI

## Branches

| Branch | Role                                                                            |
| ------ | ------------------------------------------------------------------------------- |
| `dev`  | Default. Day-to-day integration. Feature/chore PRs target here.                 |
| `main` | Production. Updated only via promote PR from `dev` (or rare CI/promote wiring). |

- Protection on `dev`: require PR; required status check **`ci-dev`** (strict); `enforce_admins`; approvals 0 (solo maintainer).
- Protection on `main`: same shape with required check **`ci`**.
- `delete_branch_on_merge` is enabled.
- `CODEOWNERS`: `* @NatanaelSignorini`.

## Workflows

Active definitions live under `.github/workflows/`. **Light and full gates are separate workflow files** so a push to `dev` never posts a skipped check named `ci` on the same SHA (that footgun let promote PR #14 auto-merge without a real full gate).

- **`ci-dev.yml`** — name **`CI Dev`**
  - Triggers: `push` / `pull_request` to **`dev` only**.
  - Jobs: `setup` → `check-dev` (Node `24.x` × `build` / `test` / `lint`) → aggregator **`ci-dev`**.
  - Concurrency: `ci-dev-${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}`.
- **`ci.yml`** — name **`CI`**
  - Triggers: `push` / `pull_request` to **`main` / `master` / `releases/*`**, plus `workflow_dispatch`.
  - Jobs: `setup` → `check` (Node `24.x`/`26.x` × build/test/lint) + `e2e-test` (postgres/mysql) + `federation-e2e-test` → aggregator **`ci`**.
  - Concurrency: `ci-${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}`.
- **`promote-dev.yml`** — on `workflow_run` of **`CI Dev`** completed with `conclusion == success`, event `push`, branch `dev`: create/refresh PR `dev` → `main` and enable auto-merge. Full **`ci`** from workflow `CI` on that PR gates merge into `main`.
  - Requires repo Actions setting **Allow GitHub Actions to create and approve pull requests** (`can_approve_pull_request_reviews: true` on `/actions/permissions/workflow`), plus workflow `permissions: pull-requests: write`. Without that, promote fails with `GitHub Actions is not permitted to create or approve pull requests`.
  - Set Actions secret **`PROMOTE_TOKEN`** to a maintainer PAT (repo `contents` + `pull_requests`). Promote uses it instead of `GITHUB_TOKEN` so the PR is not opened as `github-actions[bot]`. Bot-authored PRs leave CI/CodeQL in **`action_required`** until someone clicks **Approve and run workflows** (or `POST .../actions/runs/{id}/approve`).
  - If the promote PR is **BEHIND** `main` (strict checks), sync `main` into `dev` first, then re-promote.
- **CodeQL** — runs on `main` / `master` / `dev`.
- **Publish / release** — `workflow_dispatch` only (see [publishing.md](publishing.md)).
- Legacy **`test.yml`** remains disabled manually; do not re-enable without replacing these workflows.

`cancel-in-progress: true` on both CI workflows. Ghost queued runs from old workflow names can block progress; prefer bumping the concurrency group (or workflow display name) over endless cancel retries. See notes below.

### Why two workflows

GitHub associates check runs with the **commit SHA**. When light and full gates lived in one workflow, push-to-`dev` posted **`ci` = skipped**. A promote PR (`dev` → `main`) reused that SHA; required check `ci` looked “present” as skipped and auto-merge could proceed without e2e/federation. Splitting files means `dev` only ever gets `ci-dev`, and `main` PRs only ever get `ci`.

## What each gate runs

### `check-dev` / `ci-dev`

- `yarn nx run-many --target=lint|test|build --all` (build uses `--parallel=1`, cleans `dist`, retries once on failure).
- Tests set `NODE_OPTIONS=--experimental-vm-modules`.
- Setup action: Yarn install (immutable on PRs), cache, `npm rebuild better-sqlite3` (native modules; install may skip scripts).

### Full `check` / `e2e-test` / `federation-e2e-test` / `ci`

- Same lint/build/test matrix on Node 24 and 26.
- E2E: `NESTJS_QUERY_DB_TYPE` postgres or mysql; needs services from examples Docker Compose.
- Federation: `examples/federation-v2-e2e` compose `--profile test`.
- Aggregator `ci` uses `if: always()` and fails unless all needed jobs succeeded — use **`ci`** (and **`ci-dev`** on `dev`) as the single required check names in branch protection.

## Agent checklist for a typical change

1. Branch from `dev`.
2. Implement + unit tests; run smallest `yarn nx lint|test|build <project>`.
3. Open PR → `dev`; wait for **`ci-dev`**.
4. Merge when green. Push to `dev` triggers promote when light CI succeeds.
5. Watch the promote PR on `main` for full **`ci`** (e2e/federation). Fix on a follow-up PR into `dev` if promote fails; do not bypass `main` protection casually.

## Stuck Actions / ghost runs

Symptoms: runs stay `queued` with `jobs` empty / `in_progress` count 0; `gh run cancel` claims completed while list still shows queued; DELETE run returns 403; force-cancel 409.

Mitigations (in order):

1. Wait / check [GitHub Status](https://www.githubstatus.com/) — do not spam empty commits while nothing is executing.
2. If cancel-in-progress is wedged on an old concurrency key, bump the concurrency group string in `ci.yml` and push once.
3. Empty commit only when a live run needs cancel-in-progress to replace it: `HUSKY=0 git commit --allow-empty` then push.
4. Admin merge when protection blocks a known-good PR: temporarily `DELETE .../branches/<branch>/protection/enforce_admins`, `gh pr merge N --merge --admin`, then `POST` enforce_admins back. Prefer this only when Actions cannot complete required checks.

## Yarn on public PRs

`yarn install --immutable` fails with **YN0028** if `package.json` changes are missing from `yarn.lock`. Always commit a coherent lockfile with dependency edits.
