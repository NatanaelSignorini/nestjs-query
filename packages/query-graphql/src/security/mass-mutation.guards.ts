import { BadRequestException } from '@nestjs/common'
import { Filter, isEmptyFilter } from '@ptc-org/nestjs-query-core'

import {
  DEFAULT_SECURITY_OPTIONS,
  NestjsQuerySecurityOptions,
  ResolvedMassMutationSecurityOptions,
  resolveSecurityOptions
} from './security-options'

export type MassMutationResolverSecurityOpts = {
  allowEmptyFilter?: boolean
}

export const resolveMassMutationSecurity = (security?: NestjsQuerySecurityOptions): ResolvedMassMutationSecurityOptions =>
  resolveSecurityOptions(security).massMutations

export function assertNonEmptyClientFilter<DTO>(
  filter: Filter<DTO> | undefined,
  security?: NestjsQuerySecurityOptions,
  resolverOpts?: MassMutationResolverSecurityOpts
): void {
  const massMutations = resolveMassMutationSecurity(security)
  if (!massMutations.requireNonEmptyFilter || resolverOpts?.allowEmptyFilter) {
    return
  }

  if (isEmptyFilter(filter)) {
    throw new BadRequestException(
      'NestJS Query security: updateMany/deleteMany require a non-empty client filter. ' +
        'Pass field comparisons in `filter`, or set many.allowEmptyFilter / security.massMutations.requireNonEmptyFilter.'
    )
  }
}

export function assertCreateManyBatchSize(itemCount: number, security?: NestjsQuerySecurityOptions): void {
  const { maxBatchSize } = resolveMassMutationSecurity(security)
  if (maxBatchSize === false) {
    return
  }

  if (itemCount > maxBatchSize) {
    throw new BadRequestException(
      `NestJS Query security: createMany batch size ${itemCount} exceeds maxBatchSize ${maxBatchSize}.`
    )
  }
}

export function assertMaxAffected(affectedCount: number, security?: NestjsQuerySecurityOptions): void {
  const { maxAffected } = resolveMassMutationSecurity(security)
  if (maxAffected === undefined) {
    return
  }

  if (affectedCount > maxAffected) {
    throw new BadRequestException(
      `NestJS Query security: operation would affect ${affectedCount} records, exceeding maxAffected ${maxAffected}.`
    )
  }
}

/**
 * Runs a count only when `maxAffected` is configured, so services that do not
 * implement `count` (e.g. NoOpQueryService wrappers) keep working by default.
 */
export async function assertMaxAffectedFromCount(
  count: () => Promise<number>,
  security?: NestjsQuerySecurityOptions
): Promise<void> {
  const { maxAffected } = resolveMassMutationSecurity(security)
  if (maxAffected === undefined) {
    return
  }
  assertMaxAffected(await count(), security)
}

export const getSecurityOrDefault = (security?: NestjsQuerySecurityOptions): NestjsQuerySecurityOptions =>
  security ?? DEFAULT_SECURITY_OPTIONS
