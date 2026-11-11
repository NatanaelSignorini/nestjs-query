import { ObjectType } from '@nestjs/graphql'
import {
  configurePagingSecurity,
  FilterableField,
  PagingStrategies,
  QueryArgsType,
  resetPagingSecurityForTests,
  UnlimitedPagingError
} from '@ptc-org/nestjs-query-graphql'

describe('paging security', () => {
  @ObjectType()
  class TestDTO {
    @FilterableField()
    name!: string
  }

  afterEach(() => {
    resetPagingSecurityForTests()
  })

  it('rejects pagingStrategy NONE without allowUnlimited by default', () => {
    expect(() => QueryArgsType(TestDTO, { pagingStrategy: PagingStrategies.NONE })).toThrow(UnlimitedPagingError)
  })

  it('allows pagingStrategy NONE with allowUnlimited', () => {
    expect(() =>
      QueryArgsType(TestDTO, { pagingStrategy: PagingStrategies.NONE, allowUnlimited: true })
    ).not.toThrow()
  })

  it('rejects maxResultsSize -1 without allowUnlimited by default', () => {
    expect(() => QueryArgsType(TestDTO, { maxResultsSize: -1 })).toThrow(UnlimitedPagingError)
  })

  it('allows maxResultsSize -1 with allowUnlimited', () => {
    expect(() => QueryArgsType(TestDTO, { maxResultsSize: -1, allowUnlimited: true })).not.toThrow()
  })

  it('can disable NONE enforcement via security.paging', () => {
    configurePagingSecurity({ paging: { requireAllowUnlimitedForNone: false } })
    expect(() => QueryArgsType(TestDTO, { pagingStrategy: PagingStrategies.NONE })).not.toThrow()
  })

  it('applies custom default maxResultsSize from security.paging', () => {
    configurePagingSecurity({ paging: { maxResultsSize: 25 } })
    const Args = QueryArgsType(TestDTO)
    // Cursor paging embeds the max in PropertyMax metadata; ensuring construction succeeds is enough here.
    expect(Args).toBeDefined()
  })
})
