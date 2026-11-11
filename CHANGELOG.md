# Changelog

## 11.0.0-alpha.0

Fork baseline from TriPSs/`@ptc-org` with NestJS 12 and TypeORM 1.x targets.

### Breaking

- Peer NestJS packages require **^12.0.0** (was ^10 || ^11).
- `@nestjs/graphql` peer requires **^14.0.0**.
- `@nestjs/typeorm` peer requires **^12.0.0**.
- `typeorm` peer requires **^1.0.0** only (0.3 support removed).
- Engines: Node `>=20.19.0 || >=22.12.0` (recommend Node 24).

### Packages updated

| Package | Peers / notes |
|---|---|
| `@ptc-org/nestjs-query-core` | `@nestjs/common` ^12 |
| `@ptc-org/nestjs-query-graphql` | Nest 12 + GraphQL 14 |
| `@ptc-org/nestjs-query-typeorm` | Nest 12 + TypeORM 1.x (`ObjectLiteral` constraints) |
| `@ptc-org/nestjs-query-rest` | Nest 12 + Swagger 12 |
| `@ptc-org/nestjs-query-mongoose` | Nest 12 + `@nestjs/mongoose` ^12 |
| `@ptc-org/nestjs-query-sequelize` | Nest 12 + `@nestjs/sequelize` ^12 |
| `@ptc-org/nestjs-query-typegoose` | Nest 12 |
| `@ptc-org/nestjs-query-mikro-orm` | Nest 12 |

### Tooling

- Root deps: Nest 12.4.x, TypeORM 1.1.2, TypeScript 5.9.x (TS 6 deferred until stricter typings are cleaned).
- Jest requires `node --experimental-vm-modules` for Nest 12 ESM (`yarn test` / `yarn test:core`).
- Native `better-sqlite3` build needs Python + build tools on Windows (TypeORM unit tests).

### Security (planned next)

See `SECURITY.md` and the project plan: AuthZ fail-closed, mass-mutation guards, query limits, filter hardening, CASL.
