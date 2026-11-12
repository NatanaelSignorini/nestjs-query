import { MethodNotAllowedException, NotFoundException } from '@nestjs/common'
import {
  AggregateOptions,
  AggregateQuery,
  AggregateResponse,
  Class,
  CountOptions,
  CreateManyOptions,
  CreateOneOptions,
  DeepPartial,
  DeleteManyOptions,
  DeleteManyResponse,
  DeleteOneOptions,
  ensureMatchesCreationFilter,
  Filter,
  Filterable,
  filterCreatableRecords,
  FindByIdOptions,
  GetByIdOptions,
  mergeFilter,
  Query,
  QueryOptions,
  QueryService,
  UpdateManyResponse,
  UpdateOneOptions,
  UpdateOneStrategy
} from '@ptc-org/nestjs-query-core'
import { DeleteResult, FindOptionsWhere, In, ObjectLiteral, Repository } from 'typeorm'
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity'
import { UpdateResult } from 'typeorm/query-builder/result/UpdateResult'

import { AggregateBuilder, FilterQueryBuilder } from '../query'
import { RelationQueryService } from './relation-query.service'

export interface TypeOrmQueryServiceOpts<Entity extends ObjectLiteral> {
  useSoftDelete?: boolean
  filterQueryBuilder?: FilterQueryBuilder<Entity>
  /**
   * Default strategy for {@link TypeOrmQueryService.updateOne}. Per-call `opts.updateStrategy` wins.
   * Default: `save`.
   */
  updateStrategy?: UpdateOneStrategy
}

/**
 * Base class for all query services that use a `typeorm` Repository.
 *
 * @example
 *
 * ```ts
 * @QueryService(TodoItemEntity)
 * export class TodoItemService extends TypeOrmQueryService<TodoItemEntity> {
 *   constructor(
 *      @InjectRepository(TodoItemEntity) repo: Repository<TodoItemEntity>,
 *   ) {
 *     super(repo);
 *   }
 * }
 * ```
 */
export class TypeOrmQueryService<Entity extends ObjectLiteral>
  extends RelationQueryService<Entity>
  implements QueryService<Entity, DeepPartial<Entity>, DeepPartial<Entity>>
{
  readonly filterQueryBuilder: FilterQueryBuilder<Entity>

  readonly useSoftDelete: boolean

  readonly updateStrategy: UpdateOneStrategy

  constructor(
    readonly repo: Repository<Entity>,
    opts?: TypeOrmQueryServiceOpts<Entity>
  ) {
    super()

    this.filterQueryBuilder = opts?.filterQueryBuilder ?? new FilterQueryBuilder<Entity>(this.repo)
    this.useSoftDelete = opts?.useSoftDelete ?? false
    this.updateStrategy = opts?.updateStrategy ?? 'save'
  }

  // eslint-disable-next-line @typescript-eslint/naming-convention
  public get EntityClass(): Class<Entity> {
    return this.repo.target as Class<Entity>
  }

  /**
   * Query for multiple entities, using a Query from `@ptc-org/nestjs-query-core`.
   *
   * @example
   * ```ts
   * const todoItems = await this.service.query({
   *   filter: { title: { eq: 'Foo' } },
   *   paging: { limit: 10 },
   *   sorting: [{ field: "create", direction: SortDirection.DESC }],
   * });
   * ```
   * @param query - The Query used to filter, page, and sort rows.
   */
  public async query(query: Query<Entity>, opts?: QueryOptions<Entity>): Promise<Entity[]> {
    const qb = this.filterQueryBuilder.select(query, this.getSelectColumns(query, opts))

    if (opts?.withDeleted) {
      qb.withDeleted()
    }

    return qb.getMany()
  }

  public exportMany(query: Query<Entity>, opts?: QueryOptions<Entity>): Promise<Entity[]> {
    return this.query(query, opts)
  }

  public async aggregate(
    filter: Filter<Entity>,
    aggregate: AggregateQuery<Entity>,
    opts?: AggregateOptions
  ): Promise<AggregateResponse<Entity>[]> {
    const qb = this.filterQueryBuilder.aggregate({ filter }, aggregate)

    if (opts?.withDeleted) {
      qb.withDeleted()
    }

    const resultPromise = qb.getRawMany<Record<string, unknown>>()
    return AggregateBuilder.asyncConvertToAggregateResponse(resultPromise)
  }

  public async count(filter: Filter<Entity>, opts?: CountOptions): Promise<number> {
    const qb = this.filterQueryBuilder.select({ filter })

    if (opts?.withDeleted) {
      qb.withDeleted()
    }

    // Check if we have any relation that could cause the same record to be returned twice, if not then we create
    // our own count as TypeORM still decides to add "DISTINCT" to it, which makes it slow
    if (qb.expressionMap.joinAttributes.some((join) => join.isMany)) {
      // If we have relations than do what TypeORM does
      return qb.getCount()
    }

    // This is the same as TypeORM does it with the exception that the select is always COUNT(1)
    const result = (await qb
      .orderBy()
      .groupBy()
      .offset(undefined)
      .limit(undefined)
      .skip(undefined)
      .take(undefined)
      .select('COUNT(1)', 'cnt')
      .setOption('disable-global-order')
      .execute()) as { cnt?: number }[]

    return parseInt(`${result?.[0]?.cnt ?? 0}`)
  }

  /**
   * Find an entity by it's `id`.
   *
   * @example
   * ```ts
   * const todoItem = await this.service.findById(1);
   * ```
   * @param id - The id of the record to find.
   * @param opts
   */
  public async findById(id: string | number, opts?: FindByIdOptions<Entity>): Promise<Entity | undefined> {
    const query = opts ?? {}
    const qb = this.filterQueryBuilder.selectById(id, query, this.getSelectColumns(query, opts))

    if (opts?.withDeleted) {
      qb.withDeleted()
    }

    const result = await qb.getOne()
    return result === null ? undefined : result
  }

  /**
   * Gets an entity by it's `id`. If the entity is not found a rejected promise is returned.
   *
   * @example
   * ```ts
   * try {
   *   const todoItem = await this.service.getById(1);
   * } catch(e) {
   *   console.error('Unable to find entity with id = 1');
   * }
   * ```
   * @param id - The id of the record to find.
   * @param opts
   */
  public async getById(id: string | number, opts?: GetByIdOptions<Entity>): Promise<Entity> {
    const entity = await this.findById(id, opts)

    if (!entity) {
      throw new NotFoundException(`Unable to find ${this.EntityClass.name} with id: ${id}`)
    }

    return entity
  }

  /**
   * Creates a single entity.
   *
   * @example
   * ```ts
   * const todoItem = await this.service.createOne({title: 'Todo Item', completed: false });
   * ```
   * @param record - The entity to create.
   * @param opts - Additional options.
   */
  public async createOne(record: DeepPartial<Entity>, opts?: CreateOneOptions<Entity>): Promise<Entity> {
    ensureMatchesCreationFilter(record as Entity, opts?.filter)
    const entity = await this.ensureIsEntityAndDoesNotExist(record)

    return this.repo.save(entity)
  }

  /**
   * Create multiple entities.
   *
   * @example
   * ```ts
   * const todoItem = await this.service.createMany([
   *   {title: 'Todo Item 1', completed: false },
   *   {title: 'Todo Item 2', completed: true },
   * ]);
   * ```
   * @param records - The entities to create.
   * @param opts - Additional options.
   */
  public async createMany(records: DeepPartial<Entity>[], opts?: CreateManyOptions<Entity>): Promise<Entity[]> {
    const creatableRecords = filterCreatableRecords(records as Entity[], opts?.filter)
    const entities = creatableRecords.map((creatableRecord) => this.toEntity(creatableRecord as DeepPartial<Entity>))
    await this.ensureEntitiesDoNotExist(entities)
    return this.repo.save(entities)
  }

  /**
   * Update an entity.
   *
   * @example
   * ```ts
   * const updatedEntity = await this.service.updateOne(1, { completed: true });
   * ```
   * @param id - The `id` of the record.
   * @param update - A `Partial` of the entity with fields to update.
   * @param opts - Additional options.
   */
  async updateOne(id: number | string, update: DeepPartial<Entity>, opts?: UpdateOneOptions<Entity>): Promise<Entity> {
    this.ensureIdIsNotPresent(update)
    const strategy = opts?.updateStrategy ?? this.updateStrategy
    if (strategy === 'execute') {
      return this.updateOneExecute(id, update, opts)
    }
    const entity = await this.getById(id, opts)
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return this.repo.save(this.repo.merge(entity, update))
  }

  /**
   * UPDATE via QueryBuilder then reload. Does not run TypeORM `save` listeners.
   */
  private async updateOneExecute(
    id: number | string,
    update: DeepPartial<Entity>,
    opts?: UpdateOneOptions<Entity>
  ): Promise<Entity> {
    if (this.repo.metadata.primaryColumns.length !== 1) {
      // Composite PKs: fall back to save path for correct id targeting.
      const entity = await this.getById(id, opts)
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      return this.repo.save(this.repo.merge(entity, update))
    }

    const idProperty = this.repo.metadata.primaryColumns[0].propertyName
    const idFilter = { [idProperty]: { eq: id } } as Filter<Entity>
    const filter = mergeFilter(idFilter, opts?.filter ?? {})
    const updateResult = await this.filterQueryBuilder
      .update({ filter })
      .set({ ...(update as QueryDeepPartialEntity<Entity>) })
      .execute()

    if (!updateResult.affected) {
      throw new NotFoundException(`Unable to find ${this.EntityClass.name} with id: ${id}`)
    }

    return this.getById(id, opts)
  }

  /**
   * Update multiple entities with a `@ptc-org/nestjs-query-core` Filter.
   *
   * @example
   * ```ts
   * const { updatedCount } = await this.service.updateMany(
   *   { completed: true }, // the update to apply
   *   { title: { eq: 'Foo Title' } } // Filter to find records to update
   * );
   * ```
   * @param update - A `Partial` of entity with the fields to update
   * @param filter - A Filter used to find the records to update
   */
  public async updateMany(update: DeepPartial<Entity>, filter: Filter<Entity>): Promise<UpdateManyResponse> {
    this.ensureIdIsNotPresent(update)
    let updateResult: UpdateResult

    // If the update has relations, then fetch all the id's and then do an update on the ids returned
    if (this.filterQueryBuilder.filterHasRelations(filter)) {
      const builder = this.filterQueryBuilder.select({ filter }).distinct(true)

      const distinctRecords = await builder.select(`${builder.alias}.id AS id`).getRawMany()

      const ids: unknown[] = distinctRecords.map(({ id }) => id as unknown)
      const idsFilter = { id: { in: ids } } as unknown as Filter<Entity>

      updateResult = await this.filterQueryBuilder
        .update({ filter: idsFilter })
        .set({ ...(update as QueryDeepPartialEntity<Entity>) })
        .execute()
    } else {
      updateResult = await this.filterQueryBuilder
        .update({ filter })
        .set({ ...(update as QueryDeepPartialEntity<Entity>) })
        .execute()
    }

    return { updatedCount: updateResult.affected || 0 }
  }

  /**
   * Delete an entity by `id`.
   *
   * @example
   *
   * ```ts
   * const deletedTodo = await this.service.deleteOne(1);
   * ```
   *
   * @param id - The `id` of the entity to delete.
   * @param filter Additional filter to use when finding the entity to delete.
   * @param opts - Additional options.
   */
  public async deleteOne(id: string | number, opts?: DeleteOneOptions<Entity>): Promise<Entity> {
    const entity = await this.getById(id, opts)
    if (this.useSoftDelete || opts?.useSoftDelete) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      return this.repo.softRemove(entity)
    }

    return this.repo.remove(entity)
  }

  /**
   * Delete multiple records with a `@ptc-org/nestjs-query-core` `Filter`.
   *
   * @example
   *
   * ```ts
   * const { deletedCount } = this.service.deleteMany({
   *   created: { lte: new Date('2020-1-1') }
   * });
   * ```
   *
   * @param filter - A `Filter` to find records to delete.
   * @param opts - Additional delete many options
   */
  public async deleteMany(filter: Filter<Entity>, opts?: DeleteManyOptions<Entity>): Promise<DeleteManyResponse> {
    let deleteResult = {} as DeleteResult

    if (this.filterQueryBuilder.filterHasRelations(filter)) {
      const builder = this.filterQueryBuilder.select({ filter }).distinct(true)

      const distinctRecords = await builder.addSelect(`${builder.alias}.id`).getRawMany()

      const ids: unknown[] = distinctRecords.map(({ id }) => id as unknown)
      const idsFilter = { id: { in: ids } } as unknown as Filter<Entity>

      if (ids.length > 0) {
        if (this.useSoftDelete || opts?.useSoftDelete) {
          deleteResult = await this.filterQueryBuilder.softDelete({ filter: idsFilter }).execute()
        } else {
          deleteResult = await this.filterQueryBuilder.delete({ filter: idsFilter }).execute()
        }
      }
    } else {
      if (this.useSoftDelete || opts?.useSoftDelete) {
        deleteResult = await this.filterQueryBuilder.softDelete({ filter }).execute()
      } else {
        deleteResult = await this.filterQueryBuilder.delete({ filter }).execute()
      }
    }

    return { deletedCount: deleteResult?.affected || 0 }
  }

  /**
   * Restore an entity by `id`.
   *
   * @example
   *
   * ```ts
   * const restoredTodo = await this.service.restoreOne(1);
   * ```
   *
   * @param id - The `id` of the entity to restore.
   * @param opts Additional filter to use when finding the entity to restore.
   */
  public async restoreOne(id: string | number, opts?: Filterable<Entity>): Promise<Entity> {
    this.ensureSoftDeleteEnabled()
    await this.repo.restore(id)
    return this.getById(id, opts)
  }

  /**
   * Restores multiple records with a `@ptc-org/nestjs-query-core` `Filter`.
   *
   * @example
   *
   * ```ts
   * const { updatedCount } = this.service.restoreMany({
   *   created: { lte: new Date('2020-1-1') }
   * });
   * ```
   *
   * @param filter - A `Filter` to find records to delete.
   */
  public async restoreMany(filter: Filter<Entity>): Promise<UpdateManyResponse> {
    this.ensureSoftDeleteEnabled()
    const result = await this.filterQueryBuilder.softDelete({ filter }).restore().execute()
    return { updatedCount: result.affected || 0 }
  }

  /**
   * Builds a root-entity column list from GraphQL resolveInfo when opt-in is enabled.
   * Always includes primary keys; adds soft-delete and sort columns when relevant.
   */
  private getSelectColumns(query: Query<Entity>, opts?: QueryOptions<Entity> | FindByIdOptions<Entity>): string[] | undefined {
    if (!opts?.selectFromResolveInfo || !opts.resolveInfo?.fields) {
      return undefined
    }

    const selected = new Set<string>()
    this.repo.metadata.primaryColumns.forEach((column) => {
      selected.add(column.propertyName)
    })

    const deleteDateColumn = this.repo.metadata.deleteDateColumn
    if (deleteDateColumn && (this.useSoftDelete || opts.withDeleted)) {
      selected.add(deleteDateColumn.propertyName)
    }

    for (const field of Object.values(opts.resolveInfo.fields)) {
      if (!field || typeof field !== 'object' || !('name' in field)) {
        continue
      }
      const fieldName = String((field as { name: unknown }).name)
      if (!fieldName || !this.repo.metadata.findColumnWithPropertyName(fieldName)) {
        continue
      }
      selected.add(fieldName)
    }

    query.sorting?.forEach((sort) => {
      selected.add(String(sort.field))
    })

    return [...selected]
  }

  private async ensureIsEntityAndDoesNotExist(entity: DeepPartial<Entity>): Promise<Entity> {
    const instance = this.toEntity(entity)
    await this.ensureEntitiesDoNotExist([instance])
    return instance
  }

  private toEntity(entity: DeepPartial<Entity>): Entity {
    if (entity instanceof this.EntityClass) {
      return entity
    }
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return this.repo.create(entity)
  }

  /**
   * Rejects when any entity that already has an id is present in the database,
   * or when the batch itself contains duplicate primary keys.
   * Uses a single batched lookup for createMany instead of one findOne per record.
   *
   * Best-effort only: concurrent creates can still race past this check; rely on
   * database unique / primary-key constraints as the authoritative guard.
   */
  private async ensureEntitiesDoNotExist(entities: Entity[]): Promise<void> {
    const entitiesWithIds = entities.filter((entity) => this.repo.hasId(entity))
    if (entitiesWithIds.length === 0) {
      return
    }

    const primaryColumns = this.repo.metadata.primaryColumns
    if (primaryColumns.length === 1) {
      const idProperty = primaryColumns[0].propertyName
      const ids = entitiesWithIds.map((entity) => (entity as Record<string, unknown>)[idProperty])
      if (ids.length !== new Set(ids).size) {
        throw new Error('Entity already exists')
      }
      const existingCount = await this.repo.count({
        where: { [idProperty]: In(ids) } as FindOptionsWhere<Entity>
      })
      if (existingCount > 0) {
        throw new Error('Entity already exists')
      }
      return
    }

    const idKeys = entitiesWithIds.map((entity) =>
      primaryColumns.map((column) => String((entity as Record<string, unknown>)[column.propertyName])).join('\0')
    )
    if (idKeys.length !== new Set(idKeys).size) {
      throw new Error('Entity already exists')
    }

    const where = entitiesWithIds.map((entity) => this.repo.metadata.getEntityIdMap(entity) as FindOptionsWhere<Entity>)
    const existingCount = await this.repo.count({ where })
    if (existingCount > 0) {
      throw new Error('Entity already exists')
    }
  }

  private ensureIdIsNotPresent(e: DeepPartial<Entity>): void {
    if (this.repo.hasId(e as unknown as Entity)) {
      throw new Error('Id cannot be specified when updating')
    }
  }

  private ensureSoftDeleteEnabled(): void {
    if (!this.useSoftDelete) {
      throw new MethodNotAllowedException(`Restore not allowed for non soft deleted entity ${this.EntityClass.name}.`)
    }
  }
}
