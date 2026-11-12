# Branch flow and CI

## Branches

| Branch | Role                                                                            |
| ------ | ------------------------------------------------------------------------------- |
| `dev`  | Default. Day-to-day integration. Feature/chore PRs target here.                 |
| `main` | Production. Updated only via promote PR from `dev` (or rare CI/promote wiring). |

- Protection on `dev`: require PR; required status check **`check (dev)`** (strict); `enforce_admins`; approvals 0 (solo maintainer).
- Protection on `main`: same shape with required check **`check (main)`**.
- `delete_branch_on_merge` is enabled.
- `CODEOWNERS`: `* @NatanaelSignorini`.

### Allowed PR directions

| From → To | Allowed? | How |
| --------- | -------- | --- |
| feature/chore → **`dev`** | Yes | Normal PRs |
| **`dev` → `main`** | Yes | Auto after green **CI (dev)** on push to `dev` (Promote workflow); manual dispatch as escape hatch |
| feature → **`main`** | No (rare exception) | Only when changing promote/CI wiring itself |
| **`main` → `dev`** | **No** (do not open by hand) | See below |

**Do not open GitHub PRs `main` → `dev`.** After a promote, the UI may offer “sync” / compare `main` into `dev`. That creates empty or noise PRs (example: PR #29 titled “Main”, 0 files) whose merge commit message looks like `Merge pull request #N from …/main`. Code scanning / `CI (dev)` then correctly run on **`dev`**, but the run title still shows `/main` because that string is the merge commit subject — not because the gate targeted `main`.

If `dev` falls behind `main` (unusual with this flow), sync with a **local merge or rebase of `main` into a short-lived branch**, open that branch → `dev`, and explain why in the PR body. Prefer fixing the promote path over habitual `main` → `dev` PRs.

When reading Actions notifications: trust the run’s **branch** field (`dev` vs `main`) and the workflow name (`CI (dev)` / `CI (main)` / `Code scanning`), not only the commit title.

## Workflows

Active definitions live under `.github/workflows/`. **Light and full gates are separate workflow files** so a push to `dev` never posts a skipped check named `check (main)` on the same SHA (that footgun let promote PR #14 auto-merge without a real full gate).

- **`ci-dev.yml`** — name **`CI (dev)`**
  - Triggers: `push` / `pull_request` to **`dev` only**.
  - Jobs: `setup` → `check-dev` (Node `24.x` × `build` / `test` / `lint`) → aggregator **`check (dev)`**.
  - Concurrency: `ci-dev-${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}`.
- **`ci.yml`** — name **`CI (main)`**
  - Triggers: `push` / `pull_request` to **`main` / `master` / `releases/*`**, plus `workflow_dispatch`.
  - Jobs: `setup` → `check` (Node `24.x`/`26.x` × build/test/lint) + `e2e-test` (postgres/mysql) + `federation-e2e-test` → aggregator **`check (main)`**.
  - Concurrency: `ci-${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}`.
- **`promote-dev.yml`** — automatic after **`CI (dev)`** succeeds on a **`push`** to **`dev`** (`workflow_run`), plus manual **`workflow_dispatch`** escape hatch. Creates/refreshes PR `dev` → `main` with title `chore(release): promote dev to main (<sha7>)`, updates the body (commits ahead + CI (dev) run link), and enables auto-merge. Full **`check (main)`** from workflow `CI (main)` on that PR must pass; then GitHub merges into `main`.
  - Job `if`: `workflow_dispatch` **or** (`workflow_run.conclusion == success` && `event == push` && `head_branch == dev`). Does **not** promote on PR-targeted `CI (dev)` runs.
  - Requires repo Actions setting **Allow GitHub Actions to create and approve pull requests** (`can_approve_pull_request_reviews: true` on `/actions/permissions/workflow`), plus workflow `permissions: pull-requests: write`.
  - Set Actions secret **`PROMOTE_TOKEN`** to a maintainer PAT (repo `contents` + `pull_requests`). Promote uses it instead of `GITHUB_TOKEN` so the PR is not opened as `github-actions[bot]`. Bot-authored PRs leave CI / Code scanning in **`action_required`** until someone clicks **Approve and run workflows** (or `POST .../actions/runs/{id}/approve`).
  - If the promote PR is **BEHIND** `main` (strict checks), sync `main` into `dev` first (via a normal PR into `dev`); the next green push-to-`dev` promote (or manual dispatch) refreshes auto-merge.
- **`codeql-analysis.yml`** — name **`Code scanning`** (GitHub CodeQL engine). Runs on `main` / `master` / `dev`.
- **Publish / release** — `workflow_dispatch` only (see [publishing.md](publishing.md)).
- Legacy **`test.yml`** remains disabled manually; do not re-enable without replacing these workflows.

`cancel-in-progress: true` on both CI workflows. Ghost queued runs from old workflow names can block progress; prefer bumping the concurrency group (or workflow display name) over endless cancel retries. See notes below.

### Why two workflows

GitHub associates check runs with the **commit SHA**. When light and full gates lived in one workflow, push-to-`dev` posted **`ci` = skipped**. A promote PR (`dev` → `main`) reused that SHA; required check `ci` looked “present” as skipped and auto-merge could proceed without e2e/federation. Splitting files means `dev` only ever gets `check (dev)`, and `main` PRs only ever get `check (main)`.

## What each gate runs

### `check-dev` / `check (dev)`

- `yarn nx run-many --target=lint|test|build --all` (build uses `--parallel=1`, cleans `dist`, retries once on failure).
- Tests set `NODE_OPTIONS=--experimental-vm-modules`.
- Setup action: Yarn install (immutable on PRs), cache, `npm rebuild better-sqlite3` (native modules; install may skip scripts).

### Full `check` / `e2e-test` / `federation-e2e-test` / `check (main)`

- Same lint/build/test matrix on Node 24 and 26.
- E2E: `NESTJS_QUERY_DB_TYPE` postgres or mysql; needs services from examples Docker Compose.
- Federation: `examples/federation-v2-e2e` compose `--profile test`.
- Aggregator `check (main)` uses `if: always()` and fails unless all needed jobs succeeded — use **`check (main)`** (and **`check (dev)`** on `dev`) as the single required check names in branch protection.

## Agent checklist for a typical change

1. Branch from `dev`.
2. Implement + unit tests; run smallest `yarn nx lint|test|build <project>`.
3. Open PR → `dev` **manually**; wait for **`check (dev)`**.
4. Merge when green. Push to `dev` runs **`CI (dev)`** again.
5. On successful **`CI (dev)`** for that push, **Promote dev to main** opens/refreshes PR `dev` → `main` (`chore(release): promote dev to main (<sha7>)`) with auto-merge. Watch that PR for full **`check (main)`** (e2e/federation); auto-merge lands on `main` when green. If promote CI fails, fix on a follow-up PR into `dev` (next green push re-promotes). Manual dispatch remains available. Do not bypass `main` protection casually.

## Stuck Actions / ghost runs

Symptoms: runs stay `queued` with `jobs` empty / `in_progress` count 0; `gh run cancel` claims completed while list still shows queued; DELETE run returns 403; force-cancel 409.

Mitigations (in order):

1. Wait / check [GitHub Status](https://www.githubstatus.com/) — do not spam empty commits while nothing is executing.
2. If cancel-in-progress is wedged on an old concurrency key, bump the concurrency group string in `ci.yml` / `ci-dev.yml` and push once.
3. Empty commit only when a live run needs cancel-in-progress to replace it: `HUSKY=0 git commit --allow-empty` then push.
4. Admin merge when protection blocks a known-good PR: temporarily `DELETE .../branches/<branch>/protection/enforce_admins`, `gh pr merge N --merge --admin`, then `POST` enforce_admins back. Prefer this only when Actions cannot complete required checks.

## Yarn on public PRs

`yarn install --immutable` fails with **YN0028** if `package.json` changes are missing from `yarn.lock`. Always commit a coherent lockfile with dependency edits.
