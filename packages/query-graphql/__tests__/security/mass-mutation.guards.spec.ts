import { BadRequestException } from '@nestjs/common'

import {
  assertCreateManyBatchSize,
  assertMaxAffected,
  assertMaxAffectedFromCount,
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
      expect(() => assertNonEmptyClientFilter({}, { massMutations: { requireNonEmptyFilter: false } })).not.toThrow()
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
    it('no-ops when maxAffected is unset', () => {
      expect(() => assertMaxAffected(10_000)).not.toThrow()
    })

    it('rejects when the count exceeds maxAffected', () => {
      expect(() => assertMaxAffected(11, { massMutations: { maxAffected: 10 } })).toThrow(BadRequestException)
    })

    it('allows counts within maxAffected', () => {
      expect(() => assertMaxAffected(10, { massMutations: { maxAffected: 10 } })).not.toThrow()
    })
  })

  describe('assertMaxAffectedFromCount', () => {
    it('skips count when maxAffected is unset', async () => {
      const count = jest.fn(() => Promise.resolve(10_000))
      await expect(assertMaxAffectedFromCount(count)).resolves.toBeUndefined()
      expect(count).not.toHaveBeenCalled()
    })

    it('counts and rejects when over maxAffected', async () => {
      const count = jest.fn(() => Promise.resolve(11))
      await expect(assertMaxAffectedFromCount(count, { massMutations: { maxAffected: 10 } })).rejects.toBeInstanceOf(
        BadRequestException
      )
      expect(count).toHaveBeenCalledTimes(1)
    })

    it('counts and allows values within maxAffected', async () => {
      const count = jest.fn(() => Promise.resolve(10))
      await expect(assertMaxAffectedFromCount(count, { massMutations: { maxAffected: 10 } })).resolves.toBeUndefined()
      expect(count).toHaveBeenCalledTimes(1)
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
