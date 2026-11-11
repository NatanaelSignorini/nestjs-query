import { CallHandler, ExecutionContext, Inject, Injectable, NestInterceptor } from '@nestjs/common'
import { GqlExecutionContext } from '@nestjs/graphql'
import { Class } from '@ptc-org/nestjs-query-core'

import { getHooksForType } from '../decorators'
import { getHookToken, Hook, HookTypes } from '../hooks'

export type HookContext<H extends Hook<unknown>> = {
  hooks?: H[]
  req?: { nestjsQueryHooks?: H[] }
  request?: { nestjsQueryHooks?: H[] }
}

class DefaultHookInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    return next.handle()
  }
}

function attachHooksToContext<H extends Hook<unknown>>(ctx: HookContext<H>, hooks: H[]): void {
  ctx.hooks = hooks
  // Also store on the request object so shallow GraphQL context clones still see hooks.
  if (ctx.req && typeof ctx.req === 'object') {
    ctx.req.nestjsQueryHooks = hooks
  }
  if (ctx.request && typeof ctx.request === 'object') {
    ctx.request.nestjsQueryHooks = hooks
  }
}

export function HookInterceptor(type: HookTypes, ...DTOClasses: Class<unknown>[]): Class<NestInterceptor> {
  const HookedClasses = DTOClasses.find((Cls) => getHooksForType(type, Cls))
  if (!HookedClasses) {
    return DefaultHookInterceptor
  }
  const hookToken = getHookToken(type, HookedClasses)

  @Injectable()
  class Interceptor implements NestInterceptor {
    constructor(@Inject(hookToken) readonly hooks: Hook<typeof HookedClasses>[]) {}

    intercept(context: ExecutionContext, next: CallHandler) {
      const gqlContext = GqlExecutionContext.create(context)
      const ctx = gqlContext.getContext<HookContext<Hook<unknown>>>()
      attachHooksToContext(ctx, this.hooks)
      return next.handle()
    }
  }

  Object.defineProperty(Interceptor, 'name', {
    writable: false,
    // set a unique name otherwise DI does not inject a unique one for each request
    value: `${DTOClasses[0].name}${type}HookInterceptor`
  })

  return Interceptor
}
