import { Class, QueryService } from '@ptc-org/nestjs-query-core'

import { getRelations } from '../../decorators'
import { getReferences } from '../../decorators/reference.decorator'
import { BaseResolverOptions } from '../../decorators/resolver-method.decorator'
import { ServiceResolver } from '../resolver.interface'
import { AggregateRelationsMixin } from './aggregate-relations.resolver'
import { ReadRelationsMixin } from './read-relations.resolver'
import { ReferencesRelationMixin } from './references-relation.resolver'
import { RemoveRelationsMixin } from './remove-relations.resolver'
import { UpdateRelationsMixin } from './update-relations.resolver'

export interface RelatableOpts extends BaseResolverOptions {
  enableTotalCount?: boolean
  enableAggregate?: boolean
  /**
   * When false, skip relation/reference field resolvers on this AutoResolver.
   * Needed when multiple CRUD resolvers share one DTOClass (e.g. alternate paging
   * roots): Nest GraphQL 14 rejects duplicate field resolvers that do not override.
   */
  enableRelations?: boolean
}

export const Relatable =
  <DTO, QS extends QueryService<DTO, unknown, unknown> = QueryService<DTO, unknown, unknown>>(
    DTOClass: Class<DTO>,
    opts: RelatableOpts = {}
  ) =>
  <B extends Class<ServiceResolver<DTO, QS>>>(Base: B): B => {
    if (opts.enableRelations === false) {
      return Base
    }
    const { enableTotalCount, enableAggregate } = opts
    const relations = getRelations(DTOClass, opts)
    const references = getReferences(DTOClass, opts)

    const referencesMixin = ReferencesRelationMixin(DTOClass, references)
    const aggregateRelationsMixin = AggregateRelationsMixin(DTOClass, { ...relations, enableAggregate })
    const readRelationsMixin = ReadRelationsMixin(DTOClass, { ...relations, enableTotalCount })
    const updateRelationsMixin = UpdateRelationsMixin(DTOClass, relations)

    return referencesMixin(
      aggregateRelationsMixin(readRelationsMixin(updateRelationsMixin(RemoveRelationsMixin(DTOClass, relations)(Base))))
    )
  }
