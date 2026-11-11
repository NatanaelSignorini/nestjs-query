import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants'
import { ArgsType, Field, InputType } from '@nestjs/graphql'

import { MutationHookArgs } from '../../src/decorators'

@InputType()
class TestCreateInput {
  @Field()
  title!: string
}

@ArgsType()
class TestMutationArgs {
  @Field(() => TestCreateInput)
  input!: { input: TestCreateInput }
}

describe('MutationHookArgs', () => {
  it('registers a single route-args extractor for the parameter index', () => {
    class TestResolver {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      create(@MutationHookArgs() input: TestMutationArgs): void {
        return undefined
      }
    }

    const metadata = Reflect.getMetadata(ROUTE_ARGS_METADATA, TestResolver, 'create') as Record<
      string,
      { index: number; factory?: unknown }
    >

    expect(metadata).toBeDefined()
    const entries = Object.entries(metadata).filter(([, value]) => value.index === 0)
    // Only the custom hooked extractor — not a competing GqlParamtype.ARGS entry.
    expect(entries).toHaveLength(1)
    expect(entries[0][0]).toContain('__customRouteArgs__')
    expect(typeof entries[0][1].factory).toBe('function')
  })
})
