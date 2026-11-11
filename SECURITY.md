# Security Policy

## Supported versions

Security fixes target the current `main` / latest alpha of this fork (NestJS 12 + TypeORM 1.x).

## Reporting a vulnerability

Please open a private security advisory on the repository, or email the maintainers with:

- affected package(s) and version
- reproduction steps or PoC
- impact (auth bypass, mass mutation, filter injection, DoS, etc.)

Do not open a public issue for unpatched vulnerabilities.

## Hardening roadmap

This fork prioritizes:

1. Authorization fail-closed defaults
2. Guards against empty `updateMany` / `deleteMany` filters
3. Global max page / batch sizes
4. GraphQL query complexity and filter depth limits
5. TypeORM filter allowlisting and safe operators

See the project plan / changelog for status.
