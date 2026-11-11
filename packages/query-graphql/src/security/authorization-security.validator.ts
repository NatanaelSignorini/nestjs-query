import { Inject, Injectable, OnModuleInit, Optional, Provider } from '@nestjs/common'
import { Class } from '@ptc-org/nestjs-query-core'

import { assertAuthorizersConfigured } from './assert-authorizers'
import {
  DEFAULT_SECURITY_OPTIONS,
  NESTJS_QUERY_SECURITY_OPTIONS,
  NestjsQuerySecurityOptions
} from './security-options'

export function createAuthorizationSecurityValidator(DTOClasses: Class<unknown>[]): Provider {
  @Injectable()
  class AuthorizationSecurityValidator implements OnModuleInit {
    constructor(
      @Optional()
      @Inject(NESTJS_QUERY_SECURITY_OPTIONS)
      private readonly security: NestjsQuerySecurityOptions | undefined
    ) {}

    onModuleInit(): void {
      const authorization = this.security?.authorization ?? DEFAULT_SECURITY_OPTIONS.authorization
      assertAuthorizersConfigured(DTOClasses, authorization)
    }
  }

  Object.defineProperty(AuthorizationSecurityValidator, 'name', {
    writable: false,
    value: `AuthorizationSecurityValidator_${DTOClasses.map((dto) => dto.name).join('_') || 'Empty'}`
  })

  return {
    provide: AuthorizationSecurityValidator,
    useClass: AuthorizationSecurityValidator
  }
}
