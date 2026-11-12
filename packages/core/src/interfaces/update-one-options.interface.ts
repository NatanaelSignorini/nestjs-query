import { Filter } from './filter.interface'

/**
 * How persistence adapters should apply `updateOne`.
 *
 * - `save` — load, merge, and save (default). Preserves ORM entity listeners/subscribers.
 * - `execute` — run an UPDATE query then reload. Skips entity-level save listeners; prefer for hot paths.
 */
export type UpdateOneStrategy = 'save' | 'execute'

export interface UpdateOneOptions<DTO> {
  /**
   * Additional filter to use when updating an entity by id. This could be used to apply an additional filter to ensure
   * that the entity belongs to a particular user.
   */
  filter?: Filter<DTO>

  /**
   * Persistence strategy for this update. Adapters that do not support `execute` ignore the option and use `save`.
   */
  updateStrategy?: UpdateOneStrategy
}
