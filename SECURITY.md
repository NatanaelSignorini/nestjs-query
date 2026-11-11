# Security Policy

## Supported versions

Security fixes target the current `main` / latest alpha of this fork (NestJS 12 + TypeORM 1.x).

## Reporting a vulnerability

Please open a private security advisory on the repository, or email the maintainers with:

- affected package(s) and version
- reproduction steps or PoC
- impact (auth bypass, mass mutation, filter injection, DoS, etc.)

Do not open a public issue for unpatched vulnerabilities.

## Authorization fail-closed (Phase 2.1)

By default, `@Authorize` remains **optional** for compatibility with existing apps.

Enable fail-closed authorization so every GraphQL DTO registered with NestJS Query must declare `@Authorize`:

```ts
// App-wide (recommended)
NestjsQueryGraphQLModule.forRoot({
  security: { authorization: 'required' }
})

// Or per feature module
NestjsQueryGraphQLModule.forFeature({
  security: { authorization: 'required' },
  resolvers: [
    {
      DTOClass: TodoItemDTO,
      EntityClass: TodoItemEntity
    }
  ]
})
```

When `authorization: 'required'`:

- DTOs without `@Authorize` fail at bootstrap (`MissingAuthorizerError`)
- The authorizer interceptor also rejects requests for DTOs missing `@Authorize`

In a future major release, `required` is expected to become the default.

## Mass-mutation guards (Phase 2.2)

Defaults (also applied when `forRoot` is omitted):

| Option | Default | Effect |
|---|---|---|
| `massMutations.requireNonEmptyFilter` | `true` | `updateMany` / `deleteMany` need a client filter with field comparisons (auth-only filters are not enough) |
| `massMutations.maxBatchSize` | `100` | Max items in `createMany` (`false` disables) |
| `massMutations.maxAffected` | unset | Optional pre-count cap for `updateMany` / `deleteMany` |

```ts
NestjsQueryGraphQLModule.forRoot({
  security: {
    massMutations: {
      requireNonEmptyFilter: true,
      maxBatchSize: 100,
      maxAffected: 1000
    }
  }
})

// Per-resolver escape hatch for admin-style empty filters:
// update: { many: { allowEmptyFilter: true } }
// delete: { many: { allowEmptyFilter: true } }
```

## Hardening roadmap

This fork prioritizes:

1. Authorization fail-closed defaults — **available** (`security.authorization`)
2. Guards against empty `updateMany` / `deleteMany` filters — **available** (`security.massMutations`)
3. Global max page / batch sizes — paging caps still pending (createMany batch cap is in 2.2)
4. GraphQL query complexity and filter depth limits
5. TypeORM filter allowlisting and safe operators

See the project plan / changelog for status.
