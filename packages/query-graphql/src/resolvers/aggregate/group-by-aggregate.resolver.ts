import { Args, Parent, registerEnumType, Resolver } from '@nestjs/graphql'
import { Class, GroupBy } from '@ptc-org/nestjs-query-core'

import { getGraphqlObjectName } from '../../common'
import { getFilterableFields, ResolverField } from '../../decorators'
import { AggregateResponseType } from '../../types'

registerEnumType(GroupBy, {
  name: 'GroupBy',
  description: 'Group by'
})

/**
 * Nest GraphQL 14 binds inherited `@ResolveField` handlers to the nearest concrete
 * `@Resolver()` type on the AutoResolver chain (the DTO). Date group-by `by` args
 * must therefore live on a dedicated `@Resolver(() => AggregateGroupBy)` provider.
 */
export function createGroupByDateFieldsResolver<DTO>(
  DTOClass: Class<DTO>,
  opts?: { enabled?: boolean; AggregateDTOClass?: Class<DTO> }
): Class<unknown> | undefined {
  if (!opts?.enabled) {
    return undefined
  }

  const fieldDTOClass = opts.AggregateDTOClass || DTOClass
  const dateFields = getFilterableFields(fieldDTOClass).filter((field) => field.target === Date)
  if (!dateFields.length) {
    return undefined
  }

  const [, GroupByType] = AggregateResponseType(DTOClass)

  const ResolverClass = dateFields.reduce(
    (Base, field) => {
      @Resolver(() => GroupByType)
      class GroupByDateFieldResolver extends Base {
        @ResolverField(field.schemaName, () => field.returnTypeFunc?.() ?? field.target, { nullable: true })
        [field.schemaName](
          @Parent() parent: DTO,
          @Args('by', {
            type: () => GroupBy,
            defaultValue: GroupBy.DAY
          })
          by: GroupBy
        ): unknown {
          void by
          return (parent as Record<string, unknown>)[field.propertyName]
        }
      }

      return GroupByDateFieldResolver
    },
    class GroupByDateFieldsResolverBase {}
  )

  Object.defineProperty(ResolverClass, 'name', {
    value: `${getGraphqlObjectName(DTOClass, 'Unable to make AggregationResponseType.')}AggregateGroupByResolver`,
    writable: false
  })

  return ResolverClass
}
