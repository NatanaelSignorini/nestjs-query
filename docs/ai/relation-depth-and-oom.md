# Relation depth, cycles, and Node OOM

TypeORM + GraphQL can exhaust Node heap when a client walks related tables deeply, especially through **cycles**, **deep filters with JOINs**, **`@UnPagedRelation`**, or aggressive **look-ahead joins**. DataLoader prevents classic N+1; it does **not** cap tree depth or SQL cartesian size.

This playbook is for maintainers and agents. Public guidance also lives in [SECURITY.md](../../SECURITY.md), [docs/graphql/relations.mdx](../graphql/relations.mdx), and [docs/faq.mdx](../faq.mdx).

## Symptoms

- `JavaScript heap out of memory` / process killed under a single GraphQL query
- Query “gets lost” across entities (A → B → A → …) until memory grows without bound
- DB/driver returns a huge row set for a filter that looked small in GraphQL terms
- Workaround that “fixed” it was hand-written SQL with fewer joins or explicit depth

## Four vectors

### 1. Nested GraphQL cycles

Bidirectional relations (for example `TodoItem ↔ SubTask`, `User ↔ Post`) expose field resolvers on both sides (`packages/query-graphql/src/resolvers/relations/read-relations.resolver.ts`). The client controls nesting depth. Without a complexity or depth plugin, a document can recurse until the heap fills.

DataLoader (`DataLoaderFactory` + relation loaders) batches per request; batching does not stop cycles.

**In-repo example:** `examples/complexity` sets `complexity` on fields/connections and rejects queries above a max via `ComplexityPlugin` (`examples/complexity/src/complexity.plugin.ts`). E2E: nested `todoItems → subTasks` fails when complexity ≥ 30.

### 2. Deep filters → recursive TypeORM JOINs

`FilterType` honors `@QueryOptions({ filterDepth })` (default **1**). `filterDepth: Number.POSITIVE_INFINITY` allows unbounded nested relation filters in the schema.

- Schema bootstrap is protected by an internal cache in `packages/query-graphql/src/types/query/filter.type.ts` so `User → Post → User → …` does not infinite-loop while building InputTypes.
- At **runtime**, TypeORM `FilterQueryBuilder.applyRelationJoinsRecursive` / `getReferencedRelationsRecursive` add `leftJoin` / `leftJoinAndSelect` for every referenced relation. Crossing several to-many associations produces a **cartesian product** of SQL rows → large buffers in the driver and Node.

**In-repo example:** `examples/filters-deep` uses `filterDepth: Number.POSITIVE_INFINITY` on `UserEntity` with `@FilterableUnPagedRelation('posts')`, and posts link back to authors/categories. That example is for deep-filter demos; treat it as a **risk showcase**, not a production template.

### 3. `@UnPagedRelation` / unlimited collections

`UnPagedRelation` / `FilterableUnPagedRelation` set `pagingStrategy: NONE` and inject `allowUnlimited: true` (`relation.decorator.ts`). Paging security requires that opt-in; it does **not** cap how many related rows load per parent.

Large collections × nested selection × many parents → heap pressure even without a cycle.

Prefer `@OffsetConnection` / `@CursorConnection` (and existing `security.paging.maxResultsSize`) for public APIs.

### 4. Look-ahead / `leftJoinAndSelect`

`enableLookAhead` is applied only for **to-one** relations (`GraphQLResultInfo` filters `enableLookAhead && !relation.isMany`). Look-ahead folds selected relations into the parent query via joins. Nested filters or selecting wide graphs in one SELECT can still inflate the SQL result before field resolvers run.

`selectFromResolveInfo` (column projection) reduces selected columns; it does not limit depth or join fan-out.

## What this fork already does

| Control | Effect |
| ------- | ------ |
| DataLoader per request | Batches relation loads; no depth cap |
| `filterDepth` default `1` | Limits filter schema nesting unless raised |
| FilterType internal cache | Stops infinite InputType generation at bootstrap |
| `security.paging` | Caps connection page size; UnPaged stays unlimited when opted in |
| `complexity` decorator option | Metadata only until the **app** installs a complexity plugin |
| Roadmap item 4 in `SECURITY.md` | Complexity + filter-depth hardening — **documented guidance first**; library guards optional later |

## Mitigations (application)

1. Install a complexity plugin (copy/adapt `examples/complexity`) and set `complexity` on relations/connections/fields.
2. Add a GraphQL **depth** validation rule (Apollo/Nest) so cyclic nesting fails fast.
3. Keep `filterDepth` small (`1`–`2`). Do not use `Number.POSITIVE_INFINITY` on public APIs.
4. Prefer Connection decorators over `@UnPagedRelation` except for small, trusted collections.
5. Use `enableLookAhead` only on to-one relations; avoid folding to-many into the same SELECT.
6. Keep `security.paging.maxResultsSize` enabled (default `100`).

## Library follow-ups (optional, separate PR)

- Configurable max `filterDepth` under `security` (reject Infinity without an explicit allow)
- Documented reusable complexity helper extracted from the example
- Relation resolve-path depth guard (needs careful design; can break legitimate deep reads)

Do not claim those are implemented until code + tests land on `dev`.

## Quick repro shapes

**Cycle (GraphQL):**

```graphql
{
  todoItems(paging: { first: 10 }) {
    edges {
      node {
        subTasks(paging: { first: 10 }) {
          edges {
            node {
              todoItem {
                subTasks(paging: { first: 10 }) {
                  edges { node { id } }
                }
              }
            }
          }
        }
      }
    }
  }
}
```

**Deep filter (filters-deep style):** filter parents by nested relation fields across multiple to-many hops; inspect SQL JOIN count and row count vs distinct parent ids.

**UnPaged:** select `allSubTasks` / unpaged `posts` on many parents in one query; watch heap and payload size.

## Related files

- `packages/query-graphql/src/resolvers/relations/read-relations.resolver.ts`
- `packages/query-graphql/src/types/query/filter.type.ts`
- `packages/query-graphql/src/decorators/relation.decorator.ts`
- `packages/query-graphql/src/decorators/graphql-resolve-info.decorator.ts`
- `packages/query-typeorm/src/query/filter-query.builder.ts` (`applyRelationJoinsRecursive`)
- `examples/complexity`, `examples/filters-deep`, `examples/basic` (`@UnPagedRelation`)
