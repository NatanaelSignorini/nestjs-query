# NestJS 12 / GraphQL 14 pitfalls

Hard-won behavior in this fork. Change these areas carefully and keep unit/e2e coverage.

## ESM Jest

Nest 12 ships ESM-friendly packages. Unit and e2e Jest need:

```text
NODE_OPTIONS=--experimental-vm-modules
```

CI sets this on `check-dev`/`check` test matrix jobs and e2e. Local PowerShell:

```powershell
$env:NODE_OPTIONS='--experimental-vm-modules'; yarn nx test query-graphql
```

## Mutation hooks (`MutationHookArgs`)

File: `packages/query-graphql/src/decorators/hook-args.decorator.ts`.

Nest can attach both `@Args()` (`GqlParamtype.ARGS`) and a `createParamDecorator` extractor on the **same parameter index**, then `Promise.all` them. Raw GraphQL args can win, so `BeforeCreate` / `BeforeUpdate` hooks never see transformed input.

**Pattern used here:**

1. Register schema with `@Args()` as usual.
2. Remove the `ROUTE_ARGS_METADATA` entry for that index (`3:index` style key) so only the custom extractor runs.
3. Validate inside the extractor with a dedicated `ValidationPipe` **before** hooks run.

`ARGS_VALIDATION_PIPE` uses `transform: true`, `whitelist: false`, `forbidNonWhitelisted: false`, `forbidUnknownValues: false`. Many GraphQL Create DTOs only have `@Field()` metadata; enabling whitelist rejects Field-only inputs (for example typegoose-discriminators `CreateTodoTaskInput` → “property title should not exist”). GraphQL already enforces schema shape; class-validator `@Is*` rules still run.

Hook-injected DTO fields that must survive whitelist-style pipes need `@Allow()` when whitelist is enabled elsewhere.

## Aggregate date group-by

Nest GraphQL 14 binds inherited `@ResolveField` handlers to the nearest concrete `@Resolver()` on the AutoResolver chain (often the DTO). Date aggregate `by` args then never appear on types like `TagAggregateGroupBy` if registration goes only through mixin inheritance.

**Pattern used here:**

- Dedicated `@Resolver(() => AggregateGroupBy)` provider from `createGroupByDateFieldsResolver`.
- `createResolvers` flatMaps that provider when `enableAggregate` is on.
- `GroupByAggregateMixin` remains a no-op for call-site compatibility.
- In `AggregateGroupByType`, Date fields use an internal method key `${propertyName}GroupBy` with `Field(schemaName)` plus `Args('by', GroupBy, default DAY)`, and return `this[propertyName]` to avoid recursion.

Unit tests should assert the schema contains `fakeDate(by: GroupBy! = DAY)` (or the real field name under test). Missing `by` showed up as HTTP 400 in e2e.

## Multiple AutoResolvers / paging roots

Multiple AutoResolvers for one `DTOClass` must not each register the same relation fields (`keepsPrecedence` throws).

- Set `enableRelations: false` on alternate paging roots.
- AutoResolver class names are uniqued by `read.connectionName` / many name / `pagingStrategy`.

## Mass-mutation guards

Security paging / mass mutation paths use count-based limits (`assertMaxAffectedFromCount` and related guards). Prefer fixing guard logic over widening limits. Keep security-oriented specs green when touching delete/update-many resolvers.

## Lint rules that fail CI

Warnings can fail the lint target. Common trips:

- `@typescript-eslint/no-unused-vars` — underscore prefixes are **not** ignored; use `void x` or a targeted eslint-disable.
- `simple-import-sort/imports`
- `@typescript-eslint/no-unnecessary-type-assertion`
- `@typescript-eslint/no-unsafe-enum-comparison` — compare mongoose `readyState` to `ConnectionStates.connected`, not a raw magic number when the enum type is required.
- `prettier/prettier` — after Prettier bumps, run format (see [updating-dependencies.md](updating-dependencies.md) and [line-endings.md](line-endings.md)).

## Build flake (`ENOTEMPTY`)

Parallel `nx` builds on Node 24 can hit `ENOTEMPTY` when clearing `dist/packages/query-graphql`. CI mitigates with `rm -rf dist`, `--parallel=1`, and one retry. Prefer the same locally if you see that error.
