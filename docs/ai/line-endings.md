# Line endings (LF)

## Standard

This repository stores and lint-checks **LF** only.

- `.prettierrc` sets `"endOfLine": "lf"`.
- `.gitattributes` sets `* text=auto eol=lf` (with common text globs and binary exceptions).

CI runs on Ubuntu. CRLF in the working tree fails `prettier/prettier` with thousands of `Delete ␍` findings and is **not** a signal that Linux CI is red — but after `endOfLine: lf` is pinned, both local and CI must agree on LF.

## Windows setup (this clone)

Global `core.autocrlf=true` converts LF → CRLF on checkout and fights Prettier.

For **this repo only**:

```sh
git config core.autocrlf false
git config core.eol lf
git reset --hard HEAD
```

Verify:

```sh
git ls-files --eol package.json AGENTS.md
# expect: i/lf  w/lf  attr/... eol=lf
```

Editors (VS Code/Cursor) should use LF for this workspace. If status still shows `w/crlf` after pulling `.gitattributes`, re-run the reset above or re-clone.

## After Prettier upgrades

Prettier minor releases can change formatting (unions, JSON, no-semi edge cases). Combined with LF:

1. Bump Prettier to an **exact** version.
2. `yarn prettier --write` on affected trees (`packages/**`, configs).
3. Confirm `yarn prettier --check "packages/**/*.{ts,js,json}"` passes on LF files.
4. Land format + version bump in the same PR so `check-dev` lint stays green.

## Agent tip

If local lint is only `Delete ␍` and `git ls-files --eol` shows `w/crlf`, fix the working tree EOL before chasing logic bugs. Reproduce format failures with a clean LF tree (Linux CI, or `git archive` / checkout-index with `autocrlf=false`) when diagnosing Prettier version drift.
