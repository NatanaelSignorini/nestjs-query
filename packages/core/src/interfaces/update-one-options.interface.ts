import { Filter } from './filter.interface'

/**
 * How persistence adapters should apply `updateOne`.
 *
 * - `save` — load, merge, and save (default). Preserves ORM entity listeners/subscribers,
 *   relation cascades on save, and typical `@VersionColumn` / optimistic-lock behaviour.
 * - `execute` — run an UPDATE query then reload. Skips entity-level save listeners, does not
 *   apply the same cascade / version semantics as `save`; prefer for simple hot-path column updates.
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
