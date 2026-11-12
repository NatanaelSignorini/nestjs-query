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

### Notes

- **`createMany` existence check** (TypeORM): one batched `count` (`In(ids)` or OR of composite id maps) plus rejection of duplicate primary keys **inside the same batch**. Still best-effort under concurrency — database unique / primary-key constraints remain the authoritative guard (PostgreSQL and others).
- **`updateStrategy: 'execute'`**: SQL `UPDATE` + reload. Skips TypeORM `save` listeners; does not mirror relation cascades or typical `@VersionColumn` behaviour of `save`. Keep default `save` unless the update is a simple column hot path.
- **`selectFromResolveInfo`**: opt-in on GraphQL **read** only; partial entities may have unrequested properties as `undefined`.

User-facing docs: `docs/graphql/relations.mdx`, `docs/graphql/dataloaders.mdx`, `docs/graphql/resolvers.mdx` (`selectFromResolveInfo`), `docs/graphql/hooks.mdx`, `docs/persistence/typeorm/custom-service.mdx`.
