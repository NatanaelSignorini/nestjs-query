import { PagingStrategies } from '../types/query/paging'
import { QueryArgsTypeOpts } from '../types/query/query-args/interfaces'
import {
  DEFAULT_PAGING_SECURITY_OPTIONS,
  NestjsQuerySecurityOptions,
  ResolvedPagingSecurityOptions,
  resolveSecurityOptions
} from './security-options'

let configuredPagingSecurity: ResolvedPagingSecurityOptions = { ...DEFAULT_PAGING_SECURITY_OPTIONS }

export class UnlimitedPagingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UnlimitedPagingError'
  }
}

export const configurePagingSecurity = (security?: NestjsQuerySecurityOptions): ResolvedPagingSecurityOptions => {
  configuredPagingSecurity = resolveSecurityOptions(security).paging
  return configuredPagingSecurity
}

export const getPagingSecurity = (): ResolvedPagingSecurityOptions => configuredPagingSecurity

export const getEffectiveDefaultMaxResultsSize = (): number => getPagingSecurity().maxResultsSize

export function assertPagingOptsAllowed<DTO>(opts: QueryArgsTypeOpts<DTO>): void {
  const pagingSecurity = getPagingSecurity()
  const allowUnlimited = Boolean((opts as { allowUnlimited?: boolean }).allowUnlimited)

  if (opts.pagingStrategy === PagingStrategies.NONE && pagingSecurity.requireAllowUnlimitedForNone && !allowUnlimited) {
    throw new UnlimitedPagingError(
      'NestJS Query security: pagingStrategy NONE requires allowUnlimited: true ' +
        '(or set security.paging.requireAllowUnlimitedForNone to false).'
    )
  }

  if (opts.maxResultsSize === -1 && pagingSecurity.requireAllowUnlimitedForDisabledMax && !allowUnlimited) {
    throw new UnlimitedPagingError(
      'NestJS Query security: maxResultsSize -1 requires allowUnlimited: true ' +
        '(or set security.paging.requireAllowUnlimitedForDisabledMax to false).'
    )
  }
}

/** Test helper to restore defaults between suites. */
export const resetPagingSecurityForTests = (): void => {
  configuredPagingSecurity = { ...DEFAULT_PAGING_SECURITY_OPTIONS }
}
