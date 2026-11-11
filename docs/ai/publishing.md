# Publishing

## Policy

**Do not auto-publish** npm packages from this fork. Publish and release workflows are **`workflow_dispatch` only**.

Intent: keep accidental publishes off the public registry while the fork evolves (Nest 12 alpha line, security hardening). `package.json` may show versions such as `11.0.0-alpha.0`; treat that as workspace metadata until a deliberate release.

## Workflows

- **publish-preview** — manual. Requires appropriate secrets (for example `NPM_TOKEN`) when used.
- **release** — manual; typically requires typing a confirmation phrase (`PUBLISH`) before the npm job runs.

Agents must not:

- Add `push` / `release` triggers that publish on merge to `main` or `dev`.
- Commit real tokens, `.npmrc` auth, or expand Actions secrets in docs.

## Before a human-triggered publish

1. `main` is green on full **`check (main)`** (lint/build/test matrix, e2e, federation).
2. CHANGELOG / version bumps reviewed.
3. Confirm which packages and tags are intended (`@ptc-org/*` naming vs fork scope — follow maintainer instruction).
4. Run the workflow from the GitHub Actions UI (or `gh workflow run`) with the required confirmation input.

## Actions permissions (context)

The repo may restrict Actions to GitHub-owned and verified actions. Changing `allowed_actions` or disabling Actions needs the Actions API with real JSON booleans (PowerShell: prefer `--input` with a temp file). That is maintainer ops, not part of a normal library PR.
