# Mongo unit tests, e2e, and federation

## Typegoose / mongoose unit tests

Flakes on CI Node 24 usually come from shared mongoose connections + parallel `MongoMemoryServer` instances.

### Required patterns

- Jest **`maxWorkers: 1`** for `query-typegoose` and `query-mongoose`.
- Raised timeouts (`testTimeout` / `beforeAll` around **120000** ms) — MMS download/start exceeds the default 10s under CI load.
- Bind fixtures to **this server’s URI** (host/port). Do **not** use `mongoose.connections[connections.length - 1]` (races and wrong connection).
- `getActiveConnection()` (or equivalent) should pick `readyState === ConnectionStates.connected` **and** a defined `connection.db`. Avoid raw numeric `1` when it trips `@typescript-eslint/no-unsafe-enum-comparison`.
- With `@m8a/nestjs-typegoose`, `mongoose.createConnection()` may still be connecting when hooks run — `await connection.asPromise()` before seed/clear.

### mongodb-memory-server cache

Binary cache dirs that matter:

- `~/.cache/mongodb-binaries`
- `**/node_modules/.cache`

Not `~/.cache/mongodb-memory-server`. Wrong cache paths force re-downloads (~100MB+) and amplify `ECONNRESET`. CI `setup-step` should cache the real paths alongside `node_modules`.

## Examples e2e

```sh
yarn docker up -d
NODE_OPTIONS=--experimental-vm-modules yarn nx e2e examples
yarn docker down
```

Compose file: `examples/docker-compose.yml`. CI e2e matrix sets `NESTJS_QUERY_DB_TYPE` to `postgres` or `mysql` on Node 24.x and 26.x.

## Federation e2e

Path: `examples/federation-v2-e2e`.

- CI job runs Docker Compose with `--profile test`.
- Service/e2e-test Dockerfiles use **npm ci** with committed lockfiles (not the root Yarn lock).
- Pin Babel via `overrides` (`@babel/types`, `core`, `traverse`, `generator`, `parser`, `template`, `helpers`) — unpinned `@babel/types@^7.29` has failed install with ETARGET.
- Keep `--legacy-peer-deps` where TypeScript 5.9 conflicts with `@nestjs/schematics` peer `typescript>=6`.
- `user` / `todo` / `tag` services depend on `graphql-subscriptions` ^3 (peer of `@ptc-org/nestjs-query-graphql`); gateway may omit it.

Regenerate e2e-test lockfile without walking the Yarn workspace root:

```sh
cd examples/federation-v2-e2e/e2e-test
npm install --legacy-peer-deps --package-lock-only --ignore-scripts --no-workspaces
```

## Interpreting CI

- E2e green + **`check`/`check-dev` red** is common: look at `query-graphql:lint`, `query-typegoose:test`, `query-mongoose:test` on Node 24 first.
- Build-only red with `ENOTEMPTY` under `dist/` is often parallel tsc cleanup — retry with clean `dist` and `--parallel=1` ([nestjs-12-pitfalls.md](nestjs-12-pitfalls.md)).
