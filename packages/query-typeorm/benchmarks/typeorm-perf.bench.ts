/**
 * Manual TypeORM microbenchmark for this fork's perf knobs.
 *
 * Not part of CI. Run:
 *   yarn nx bench query-typeorm
 *
 * Compares wall-clock time (median of iterations) for:
 * - createMany existence: legacy N×findOne vs batched count (current)
 * - query: selectFromResolveInfo off vs on
 * - updateOne: save vs execute
 */
import { DataSource, In, Logger, Repository } from 'typeorm'

import { CONNECTION_OPTIONS, truncate } from '../__tests__/__fixtures__/connection.fixture'
import { TestEntity } from '../__tests__/__fixtures__/test.entity'
import { TypeOrmQueryService } from '../src'

type Row = {
  scenario: string
  n: number
  variant: string
  ms: number
  queries: number
}

const SIZES = [100, 1000] as const
const ITERATIONS = 5
const WARMUP = 1

function makeEntities(n: number, prefix: string): TestEntity[] {
  return Array.from({ length: n }, (_, i) => {
    const entity = new TestEntity()
    entity.testEntityPk = `${prefix}-${i}`
    entity.stringType = `str-${i}`
    entity.boolType = i % 2 === 0
    entity.numberType = i
    entity.dateType = new Date(`2020-01-01T00:00:00.000Z`)
    return entity
  })
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

class CountingLogger implements Logger {
  count = 0

  // TypeORM Logger requires this arity; arguments are unused.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  logQuery(..._args: any[]): void {
    void _args
    this.count += 1
  }

  logQueryError(): void {
    return undefined
  }

  logQuerySlow(): void {
    return undefined
  }

  logSchemaBuild(): void {
    return undefined
  }

  logMigration(): void {
    return undefined
  }

  log(): void {
    return undefined
  }
}

async function createDataSource(): Promise<{ dataSource: DataSource; logger: CountingLogger }> {
  const logger = new CountingLogger()
  const dataSource = new DataSource({
    ...CONNECTION_OPTIONS,
    logging: true,
    logger
  })
  await dataSource.initialize()
  return { dataSource, logger }
}

/** Pre-fork behaviour: one findOne per entity that already carries an id. */
async function createManyLegacy(repo: Repository<TestEntity>, records: TestEntity[]): Promise<TestEntity[]> {
  for (const entity of records) {
    if (repo.hasId(entity)) {
      const existing = await repo.findOne({ where: { testEntityPk: entity.testEntityPk } })
      if (existing) {
        throw new Error('Entity already exists')
      }
    }
  }
  return repo.save(records)
}

async function timeAsync(logger: CountingLogger, fn: () => Promise<void>): Promise<{ ms: number; queries: number }> {
  logger.count = 0
  const start = performance.now()
  await fn()
  const ms = performance.now() - start
  return { ms, queries: logger.count }
}

async function measure(logger: CountingLogger, run: () => Promise<void>): Promise<{ ms: number; queries: number }> {
  for (let i = 0; i < WARMUP; i += 1) {
    await run()
  }
  const samples: number[] = []
  const querySamples: number[] = []
  for (let i = 0; i < ITERATIONS; i += 1) {
    const sample = await timeAsync(logger, run)
    samples.push(sample.ms)
    querySamples.push(sample.queries)
  }
  return { ms: median(samples), queries: median(querySamples) }
}

describe('TypeORM perf microbench (manual)', () => {
  jest.setTimeout(120_000)

  it('prints median timings for createMany / select / updateOne', async () => {
    const rows: Row[] = []

    for (const n of SIZES) {
      // --- createMany: legacy N findOne vs current batched count ---
      {
        const { dataSource, logger } = await createDataSource()
        const repo = dataSource.getRepository(TestEntity)
        const service = new TypeOrmQueryService(repo)

        const legacy = await measure(logger, async () => {
          await truncate(dataSource)
          await createManyLegacy(repo, makeEntities(n, 'legacy'))
        })
        rows.push({
          scenario: 'createMany (ids pre-set, empty table)',
          n,
          variant: 'legacy N×findOne + save',
          ms: legacy.ms,
          queries: legacy.queries
        })

        const current = await measure(logger, async () => {
          await truncate(dataSource)
          await service.createMany(makeEntities(n, 'batch'))
        })
        rows.push({
          scenario: 'createMany (ids pre-set, empty table)',
          n,
          variant: 'batched count + save',
          ms: current.ms,
          queries: current.queries
        })

        await dataSource.destroy()
      }

      // --- query: selectFromResolveInfo off vs on ---
      {
        const { dataSource, logger } = await createDataSource()
        const repo = dataSource.getRepository(TestEntity)
        const service = new TypeOrmQueryService(repo)
        await truncate(dataSource)
        await service.createMany(makeEntities(n, 'sel'))

        const off = await measure(logger, async () => {
          await service.query({ filter: { numberType: { gte: 0 } }, paging: { limit: n } }, { selectFromResolveInfo: false })
        })
        rows.push({
          scenario: 'query (all columns vs projected)',
          n,
          variant: 'selectFromResolveInfo=false',
          ms: off.ms,
          queries: off.queries
        })

        const on = await measure(logger, async () => {
          await service.query(
            { filter: { numberType: { gte: 0 } }, paging: { limit: n } },
            {
              selectFromResolveInfo: true,
              resolveInfo: {
                name: 'testEntities',
                alias: 'testEntities',
                fields: {
                  stringType: { name: 'stringType', alias: 'stringType', fields: {} as never }
                } as never
              }
            }
          )
        })
        rows.push({
          scenario: 'query (all columns vs projected)',
          n,
          variant: 'selectFromResolveInfo=true (pk+stringType)',
          ms: on.ms,
          queries: on.queries
        })

        await dataSource.destroy()
      }

      // --- updateOne: save vs execute ---
      {
        const { dataSource, logger } = await createDataSource()
        const repo = dataSource.getRepository(TestEntity)
        const saveService = new TypeOrmQueryService(repo, { updateStrategy: 'save' })
        const executeService = new TypeOrmQueryService(repo, { updateStrategy: 'execute' })
        await truncate(dataSource)
        const entities = makeEntities(n, 'upd')
        await saveService.createMany(entities)
        const ids = entities.map((e) => e.testEntityPk)

        const save = await measure(logger, async () => {
          for (const id of ids) {
            await saveService.updateOne(id, { stringType: `save-${Date.now()}` })
          }
        })
        rows.push({
          scenario: 'updateOne × N (sequential)',
          n,
          variant: 'updateStrategy=save',
          ms: save.ms,
          queries: save.queries
        })

        await repo.update({ testEntityPk: In(ids) }, { stringType: 'reset' })

        const execute = await measure(logger, async () => {
          for (const id of ids) {
            await executeService.updateOne(id, { stringType: `exec-${Date.now()}` })
          }
        })
        rows.push({
          scenario: 'updateOne × N (sequential)',
          n,
          variant: 'updateStrategy=execute',
          ms: execute.ms,
          queries: execute.queries
        })

        await dataSource.destroy()
      }
    }

    const header = '| scenario | N | variant | median ms | approx SQL statements |'
    const sep = '| --- | ---: | --- | ---: | ---: |'
    const body = rows
      .map((r) => `| ${r.scenario} | ${r.n} | ${r.variant} | ${r.ms.toFixed(1)} | ${Math.round(r.queries)} |`)
      .join('\n')

    // eslint-disable-next-line no-console
    console.log(`\n## TypeORM microbench results\n\n${header}\n${sep}\n${body}\n`)

    expect(rows.length).toBeGreaterThan(0)
  })
})
