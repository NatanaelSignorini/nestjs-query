# Performance and hooks decisions

Maintainer notes for this fork. Update this file when the decisions below change.

## After hooks — **no-go** (for now)

**Decision:** do **not** add `@AfterCreate*` / `@AfterUpdate*` / `@AfterDelete*` / `@AfterQueryMany` / `@AfterFindOne` to the public API yet.

**Why**

- Before hooks already cover input shaping; post-result needs are covered by custom `QueryService`, `@ResolveField`, and Nest interceptors (same guidance as upstream discussion [#176](https://github.com/TriPSs/nestjs-query/discussions/176)).
- After hooks run **after** persistence. Failures do not roll back the mutation without a first-class transaction API.
- `updateMany` / `deleteMany` only return counts, so After on those endpoints is weak without fetching affected rows.
- Nest 12 / GraphQL 14 already has a delicate Before-hook path (`MutationHookArgs`); After needs a second execution path in every resolver mixin.

**Revisit when**

- There are concrete apps in this fork that need DTO-decorator After more than service overrides, **and**
- Transaction support (or an explicit “fire-and-forget After” contract) is designed.

## Performance features in this fork

| Feature | Where | Default |
| ------- | ----- | ------- |
| Batched `createMany` existence check | `TypeOrmQueryService` | always on |
| `selectFromResolveInfo` | GraphQL `read` opts → TypeORM `query` / `findById` | **off** |
| `updateStrategy: 'save' \| 'execute'` | `TypeOrmQueryService` / `UpdateOneOptions` | `save` |
| `assertMaxAffectedFromCount` | mass mutations | skips count when `maxAffected` is unset |
| Look-ahead / DataLoader | GraphQL relations | look-ahead opt-in for `@Relation`; DataLoader for many |

### Microbenchmark (manual, not CI)

Harness: `packages/query-typeorm/benchmarks/typeorm-perf.bench.ts`  
Command:

```sh
# Unix
NODE_OPTIONS=--experimental-vm-modules yarn nx bench query-typeorm

# PowerShell
$env:NODE_OPTIONS='--experimental-vm-modules'; yarn nx bench query-typeorm
```

Scope is intentionally narrow: TypeORM `QueryService` against in-memory **sql.js**, sizes **100** and **1000**, median of 5 iterations after 1 warmup. It does **not** exercise GraphQL HTTP, deep relation graphs, or 10k batches (those mix unrelated costs and fight `maxBatchSize`).

Example run (Node **24.19.0**, Windows, sql.js `:memory:`):

| scenario | N | variant | median ms | approx SQL statements |
| --- | ---: | --- | ---: | ---: |
| createMany (ids pre-set, empty table) | 100 | legacy N×findOne + save | 13.5 | 111 |
| createMany (ids pre-set, empty table) | 100 | batched count + save | 5.1 | 12 |
| query (all columns vs projected) | 100 | selectFromResolveInfo=false | 1.1 | 1 |
| query (all columns vs projected) | 100 | selectFromResolveInfo=true (pk+stringType) | 0.5 | 1 |
| updateOne × N (sequential) | 100 | updateStrategy=save | 42.5 | 500 |
| updateOne × N (sequential) | 100 | updateStrategy=execute | 25.3 | 200 |
| createMany (ids pre-set, empty table) | 1000 | legacy N×findOne + save | 88.2 | 1011 |
| createMany (ids pre-set, empty table) | 1000 | batched count + save | 42.8 | 12 |
| query (all columns vs projected) | 1000 | selectFromResolveInfo=false | 9.6 | 1 |
| query (all columns vs projected) | 1000 | selectFromResolveInfo=true (pk+stringType) | 3.1 | 1 |
| updateOne × N (sequential) | 1000 | updateStrategy=save | 336.9 | 5000 |
| updateOne × N (sequential) | 1000 | updateStrategy=execute | 203.4 | 2000 |

Reading the numbers:

- **createMany**: SQL statements drop from ~N+save overhead to a single existence `count` + save (~**1011 → 12** at N=1000). Wall time roughly halves on sql.js; the round-trip win is larger on a remote PostgreSQL.
- **selectFromResolveInfo**: same statement count (1), lower ms from less row materialization (entity is narrow here; gains grow with wide rows / network).
- **execute vs save**: fewer statements (~**2N vs ~5N** here: UPDATE+reload vs load+save patterns) and lower median ms; use only when listeners/cascades/versioning of `save` are not required.

Re-run after meaningful TypeORM or Node changes and replace the table above.

User-facing docs: `docs/graphql/relations.mdx`, `docs/graphql/dataloaders.mdx`, `docs/graphql/resolvers.mdx` (`selectFromResolveInfo`), `docs/graphql/hooks.mdx`, `docs/persistence/typeorm/custom-service.mdx`.
