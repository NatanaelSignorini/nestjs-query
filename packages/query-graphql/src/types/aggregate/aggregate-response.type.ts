import { Args, Field, Float, Int, ObjectType } from '@nestjs/graphql'
import { AggregateResponse, Class, GroupBy, MapReflector, NumberAggregate, TypeAggregate } from '@ptc-org/nestjs-query-core'
import { GraphQLScalarType } from 'graphql'

import { getGraphqlObjectName } from '../../common'
import { FilterableFieldDescriptor, getFilterableFields, SkipIf } from '../../decorators'

const reflector = new MapReflector('nestjs-query:aggregate-response-type')

function NumberAggregatedType<DTO>(
  name: string,
  fields: FilterableFieldDescriptor[],
  NumberType: GraphQLScalarType
): Class<NumberAggregate<DTO>> {
  @ObjectType(name)
  class Aggregated {}

  fields.forEach(({ propertyName, schemaName }) => {
    Field(() => NumberType, { name: schemaName, nullable: true })(Aggregated.prototype, propertyName)
  })

  return Aggregated
}

function AggregateGroupByType<DTO>(name: string, fields: FilterableFieldDescriptor[]): Class<TypeAggregate<DTO>> {
  @ObjectType(name)
  class Aggregated {}

  fields.forEach(({ propertyName, schemaName, target, returnTypeFunc }) => {
    const rt = returnTypeFunc ? returnTypeFunc() : target
    Field(() => rt, { name: schemaName, nullable: true })(Aggregated.prototype, propertyName)
    // Nest GraphQL 14 binds inherited @ResolveField handlers to the nearest concrete
    // @Resolver() type (usually the DTO), so date `by` args must live on the ObjectType
    // itself for TagAggregateGroupBy.fakeDate(by: MONTH) to validate.
    if (target === Date) {
      Args('by', {
        type: () => GroupBy,
        defaultValue: GroupBy.DAY
      })(Aggregated.prototype, propertyName, 0)
    }
  })

  return Aggregated
}

function AggregatedType<DTO>(name: string, fields: FilterableFieldDescriptor[]): Class<TypeAggregate<DTO>> {
  @ObjectType(name)
  class Aggregated {}

  fields.forEach(({ propertyName, schemaName, target, returnTypeFunc }) => {
    const rt = returnTypeFunc ? returnTypeFunc() : target
    Field(() => rt, { name: schemaName, nullable: true })(Aggregated.prototype, propertyName)
  })

  return Aggregated
}

export type AggregateResponseOpts = { prefix: string }

export function AggregateResponseType<DTO>(
  DTOClass: Class<DTO>,
  opts?: AggregateResponseOpts
): [Class<AggregateResponse<DTO>>, Class<TypeAggregate<DTO>>] {
  const objName = getGraphqlObjectName(DTOClass, 'Unable to make AggregationResponseType.')
  const prefix = opts?.prefix ?? objName
  const aggName = `${prefix}AggregateResponse`
  return reflector.memoize(DTOClass, aggName, () => {
    const fields = getFilterableFields(DTOClass)
    if (!fields.length) {
      throw new Error(
        `No fields found to create AggregationResponseType for ${DTOClass.name}. Ensure fields are annotated with @FilterableField`
      )
    }
    const numberFields = fields.filter(({ target }) => target === Number)
    const minMaxFields = fields.filter(({ target }) => target !== Boolean)
    const GroupType = AggregateGroupByType(`${prefix}AggregateGroupBy`, fields)
    const CountType = NumberAggregatedType(`${prefix}CountAggregate`, fields, Int)
    const SumType = NumberAggregatedType(`${prefix}SumAggregate`, numberFields, Float)
    const AvgType = NumberAggregatedType(`${prefix}AvgAggregate`, numberFields, Float)
    const MinType = AggregatedType(`${prefix}MinAggregate`, minMaxFields)
    const MaxType = AggregatedType(`${prefix}MaxAggregate`, minMaxFields)

    @ObjectType(aggName)
    class AggResponse {
      @Field(() => GroupType, { nullable: true })
      groupBy?: Partial<DTO>

      @Field(() => CountType, { nullable: true })
      count?: NumberAggregate<DTO>

      @SkipIf(() => numberFields.length === 0, Field(() => SumType, { nullable: true }))
      sum?: NumberAggregate<DTO>

      @SkipIf(() => numberFields.length === 0, Field(() => AvgType, { nullable: true }))
      avg?: NumberAggregate<DTO>

      @SkipIf(() => minMaxFields.length === 0, Field(() => MinType, { nullable: true }))
      min?: TypeAggregate<DTO>

      @SkipIf(() => minMaxFields.length === 0, Field(() => MaxType, { nullable: true }))
      max?: TypeAggregate<DTO>
    }

    return [AggResponse, GroupType]
  })
}
