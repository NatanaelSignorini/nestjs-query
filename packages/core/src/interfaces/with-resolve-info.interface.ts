import { QueryResolveTree } from './query-resolve-info.interface'

export interface WithResolveInfo<DTO> {
  /**
   * Complete GraphQL resolve tree of the request.
   * When used with {@link selectFromResolveInfo}, pass the DTO/node-level tree
   * (paging wrappers such as `edges`/`nodes` already removed).
   */
  resolveInfo?: QueryResolveTree<DTO>

  /**
   * When `true`, persistence adapters may restrict selected columns to fields
   * present in {@link resolveInfo}, plus primary keys, sort fields, and soft-delete columns.
   *
   * Default is `false` (full entity rows) for backward compatibility.
   * Partial entities can leave unrequested properties `undefined`.
   */
  selectFromResolveInfo?: boolean
}
