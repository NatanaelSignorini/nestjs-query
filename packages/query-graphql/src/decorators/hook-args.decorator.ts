import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants'
import { Args, GqlExecutionContext } from '@nestjs/graphql'
import { Class } from '@ptc-org/nestjs-query-core'
import { plainToInstance } from 'class-transformer'

import { Hook } from '../hooks'
import { HookContext } from '../interceptors'
import { MutationArgsType } from '../types'

/**
 * Nest GraphQL `@Args()` registers pipes metadata under GqlParamtype.ARGS (3).
 * Combined with `createParamDecorator` on the same parameter index that creates
 * two extractors; Nest resolves them with `Promise.all` and the last write wins.
 * On Nest 12 / GraphQL 14 the raw `@Args()` value often wins, so hooks never apply.
 */
const GQL_ARGS_PARAM_TYPE = 3

function transformValue<T>(value: T, type?: Class<T>): T {
  if (type && !(value instanceof type)) {
    return plainToInstance<T, unknown>(type, value)
  }
  return value
}

function removeGqlArgsPipesMetadata(target: object, methodName: string | symbol, paramIndex: number): void {
  const metadata = Reflect.getMetadata(ROUTE_ARGS_METADATA, target.constructor, methodName) as
    | Record<string, { index: number }>
    | undefined
  if (!metadata) {
    return
  }
  const argsKey = `${GQL_ARGS_PARAM_TYPE}:${paramIndex}`
  if (!(argsKey in metadata)) {
    return
  }
  const rest = { ...metadata }
  delete rest[argsKey]
  Reflect.defineMetadata(ROUTE_ARGS_METADATA, rest, target.constructor, methodName)
}

function createArgsDecorator<T, C = unknown>(fn: (arg: T, context: C) => T | Promise<T>): ParameterDecorator {
  return (target: object, methodName: string | symbol | undefined, paramIndex: number): void => {
    if (typeof methodName === 'undefined') {
      return
    }
    const params = Reflect.getMetadata('design:paramtypes', target, methodName) as Class<T>[] | undefined
    const ArgType = params?.[paramIndex]

    // Keep GraphQL schema registration from `@Args()`, then drop its value extractor
    // so only the hooked `createParamDecorator` below populates the parameter.
    Args()(target, methodName, paramIndex)
    removeGqlArgsPipesMetadata(target, methodName, paramIndex)

    createParamDecorator(async (data: unknown, executionContext: ExecutionContext) => {
      const gqlExecutionContext = GqlExecutionContext.create(executionContext)
      const gqlContext = gqlExecutionContext.getContext<C>()
      const args = gqlExecutionContext.getArgs<T>()
      return fn(transformValue(args, ArgType), gqlContext)
    })()(target, methodName, paramIndex)
  }
}

function getHooksFromContext(context: HookContext<Hook<unknown>>): Hook<unknown>[] | undefined {
  if (context.hooks && context.hooks.length > 0) {
    return context.hooks
  }
  const fromReq = context.req?.nestjsQueryHooks
  if (fromReq && fromReq.length > 0) {
    return fromReq
  }
  const fromRequest = context.request?.nestjsQueryHooks
  if (fromRequest && fromRequest.length > 0) {
    return fromRequest
  }
  return undefined
}

export const HookArgs = <T>(): ParameterDecorator =>
  createArgsDecorator(async (data: T, context: HookContext<Hook<unknown>>) => {
    const hooks = getHooksFromContext(context)
    if (hooks && hooks.length > 0) {
      let hookedArgs = data
      for (const hook of hooks) {
        hookedArgs = (await hook.run(hookedArgs, context)) as T
      }
      return hookedArgs
    }
    return data
  })

export const MutationHookArgs = <T extends MutationArgsType<unknown>>(): ParameterDecorator =>
  createArgsDecorator(async (data: T, context: HookContext<Hook<unknown>>) => {
    const hooks = getHooksFromContext(context)
    if (hooks && hooks.length > 0) {
      let hookedArgs = data.input
      for (const hook of hooks) {
        hookedArgs = (await hook.run(hookedArgs, context)) as T['input']
      }
      return { input: hookedArgs }
    }
    return data
  })
