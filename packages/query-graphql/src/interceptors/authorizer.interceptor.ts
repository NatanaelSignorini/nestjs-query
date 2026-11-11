import {
  CallHandler,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  NestInterceptor,
  Optional
} from '@nestjs/common'
import { GqlExecutionContext } from '@nestjs/graphql'
import { Class } from '@ptc-org/nestjs-query-core'

import { Authorizer } from '../auth'
import { getAuthorizer, InjectAuthorizer } from '../decorators'
import { DEFAULT_SECURITY_OPTIONS, NESTJS_QUERY_SECURITY_OPTIONS, NestjsQuerySecurityOptions } from '../security'

export type AuthorizerContext<DTO> = { authorizer: Authorizer<DTO> }

export function AuthorizerInterceptor<DTO>(DTOClass: Class<DTO>): Class<NestInterceptor> {
  @Injectable()
  class Interceptor implements NestInterceptor {
    constructor(
      @InjectAuthorizer(DTOClass) readonly authorizer: Authorizer<DTO>,
      @Optional()
      @Inject(NESTJS_QUERY_SECURITY_OPTIONS)
      private readonly security?: NestjsQuerySecurityOptions
    ) {}

    intercept(context: ExecutionContext, next: CallHandler) {
      const authorization = this.security?.authorization ?? DEFAULT_SECURITY_OPTIONS.authorization
      if (authorization === 'required' && !getAuthorizer(DTOClass)) {
        throw new ForbiddenException(
          `NestJS Query security: authorization is required but ${DTOClass.name} is missing @Authorize.`
        )
      }

      const gqlContext = GqlExecutionContext.create(context)
      const ctx = gqlContext.getContext<AuthorizerContext<DTO>>()
      ctx.authorizer = this.authorizer
      return next.handle()
    }
  }

  Object.defineProperty(Interceptor, 'name', {
    writable: false,
    // set a unique name otherwise DI does not inject a unique one for each request
    value: `${DTOClass.name}AuthorizerInterceptor`
  })

  return Interceptor
}
