import { BadRequestException } from '@nestjs/common'

import {
  assertCreateManyBatchSize,
  assertMaxAffected,
  assertNonEmptyClientFilter,
  resolveMassMutationSecurity
} from '../../src/security'

describe('mass mutation security guards', () => {
  describe('assertNonEmptyClientFilter', () => {
    it('rejects empty client filters by default', () => {
      expect(() => assertNonEmptyClientFilter({})).toThrow(BadRequestException)
      expect(() => assertNonEmptyClientFilter({ and: [] })).toThrow(BadRequestException)
      expect(() => assertNonEmptyClientFilter({ or: [{}] })).toThrow(BadRequestException)
    })

    it('allows field comparisons', () => {
      expect(() => assertNonEmptyClientFilter({ id: { eq: 1 } })).not.toThrow()
    })

    it('allows empty filters when requireNonEmptyFilter is false', () => {
      expect(() =>
        assertNonEmptyClientFilter({}, { massMutations: { requireNonEmptyFilter: false } })
      ).not.toThrow()
    })

    it('allows empty filters when resolver sets allowEmptyFilter', () => {
      expect(() => assertNonEmptyClientFilter({}, undefined, { allowEmptyFilter: true })).not.toThrow()
    })
  })

  describe('assertCreateManyBatchSize', () => {
    it('rejects batches over the default max of 100', () => {
      expect(() => assertCreateManyBatchSize(101)).toThrow(BadRequestException)
      expect(() => assertCreateManyBatchSize(100)).not.toThrow()
    })

    it('respects a custom maxBatchSize', () => {
      expect(() => assertCreateManyBatchSize(3, { massMutations: { maxBatchSize: 2 } })).toThrow(BadRequestException)
    })

    it('disables the limit when maxBatchSize is false', () => {
      expect(() => assertCreateManyBatchSize(500, { massMutations: { maxBatchSize: false } })).not.toThrow()
    })
  })

  describe('assertMaxAffected', () => {
    it('no-ops when maxAffected is unset', async () => {
      await expect(assertMaxAffected(10_000)).resolves.toBeUndefined()
    })

    it('rejects when the count exceeds maxAffected', async () => {
      await expect(assertMaxAffected(11, { massMutations: { maxAffected: 10 } })).rejects.toThrow(BadRequestException)
    })

    it('allows counts within maxAffected', async () => {
      await expect(assertMaxAffected(10, { massMutations: { maxAffected: 10 } })).resolves.toBeUndefined()
    })
  })

  describe('resolveMassMutationSecurity', () => {
    it('applies defaults', () => {
      expect(resolveMassMutationSecurity()).toEqual({
        requireNonEmptyFilter: true,
        maxBatchSize: 100,
        maxAffected: undefined
      })
    })
  })
})
