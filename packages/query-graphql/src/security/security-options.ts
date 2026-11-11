export type AuthorizationMode = 'required' | 'optional'

export interface MassMutationSecurityOptions {
  /**
   * Reject updateMany/deleteMany when the client filter has no field comparisons.
   * Auth filters alone do not satisfy this check unless `allowEmptyFilter` is set on the resolver.
   * Default: `true`.
   */
  requireNonEmptyFilter?: boolean
  /**
   * Max items accepted by createMany. Use `false` to disable the limit.
   * Default: `100`.
   */
  maxBatchSize?: number | false
  /**
   * When set, count matching rows before updateMany/deleteMany and reject if the count exceeds this value.
   */
  maxAffected?: number
}

export interface PagingSecurityOptions {
  /**
   * Default / global max page size used when resolvers do not set `maxResultsSize`.
   * Default: `100`.
   */
  maxResultsSize?: number
  /**
   * When `true`, `pagingStrategy: NONE` requires an explicit `allowUnlimited: true`.
   * Default: `true`.
   */
  requireAllowUnlimitedForNone?: boolean
  /**
   * When `true`, `maxResultsSize: -1` (disabled cap) requires `allowUnlimited: true`.
   * Default: `true`.
   */
  requireAllowUnlimitedForDisabledMax?: boolean
}

export interface NestjsQuerySecurityOptions {
  /**
   * When `required`, every DTO registered via `forFeature` must declare `@Authorize`.
   * Missing authorizers fail at bootstrap (fail-closed).
   *
   * Default is `optional` in this alpha for compatibility; prefer `required` for new apps.
   */
  authorization?: AuthorizationMode
  massMutations?: MassMutationSecurityOptions
  paging?: PagingSecurityOptions
}

export type ResolvedMassMutationSecurityOptions = {
  requireNonEmptyFilter: boolean
  maxBatchSize: number | false
  maxAffected?: number
}

export type ResolvedPagingSecurityOptions = {
  maxResultsSize: number
  requireAllowUnlimitedForNone: boolean
  requireAllowUnlimitedForDisabledMax: boolean
}

export type ResolvedNestjsQuerySecurityOptions = {
  authorization: AuthorizationMode
  massMutations: ResolvedMassMutationSecurityOptions
  paging: ResolvedPagingSecurityOptions
}

export const DEFAULT_MASS_MUTATION_SECURITY_OPTIONS: ResolvedMassMutationSecurityOptions = {
  requireNonEmptyFilter: true,
  maxBatchSize: 100,
  maxAffected: undefined
}

export const DEFAULT_PAGING_SECURITY_OPTIONS: ResolvedPagingSecurityOptions = {
  maxResultsSize: 100,
  requireAllowUnlimitedForNone: true,
  requireAllowUnlimitedForDisabledMax: true
}

export const DEFAULT_SECURITY_OPTIONS: ResolvedNestjsQuerySecurityOptions = {
  authorization: 'optional',
  massMutations: { ...DEFAULT_MASS_MUTATION_SECURITY_OPTIONS },
  paging: { ...DEFAULT_PAGING_SECURITY_OPTIONS }
}

export const NESTJS_QUERY_SECURITY_OPTIONS = 'NESTJS_QUERY_SECURITY_OPTIONS'

export const resolveSecurityOptions = (opts?: NestjsQuerySecurityOptions): ResolvedNestjsQuerySecurityOptions => ({
  authorization: opts?.authorization ?? DEFAULT_SECURITY_OPTIONS.authorization,
  massMutations: {
    requireNonEmptyFilter:
      opts?.massMutations?.requireNonEmptyFilter ?? DEFAULT_MASS_MUTATION_SECURITY_OPTIONS.requireNonEmptyFilter,
    maxBatchSize:
      opts?.massMutations?.maxBatchSize === undefined
        ? DEFAULT_MASS_MUTATION_SECURITY_OPTIONS.maxBatchSize
        : opts.massMutations.maxBatchSize,
    maxAffected: opts?.massMutations?.maxAffected
  },
  paging: {
    maxResultsSize: opts?.paging?.maxResultsSize ?? DEFAULT_PAGING_SECURITY_OPTIONS.maxResultsSize,
    requireAllowUnlimitedForNone:
      opts?.paging?.requireAllowUnlimitedForNone ?? DEFAULT_PAGING_SECURITY_OPTIONS.requireAllowUnlimitedForNone,
    requireAllowUnlimitedForDisabledMax:
      opts?.paging?.requireAllowUnlimitedForDisabledMax ?? DEFAULT_PAGING_SECURITY_OPTIONS.requireAllowUnlimitedForDisabledMax
  }
})
