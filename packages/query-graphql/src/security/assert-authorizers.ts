import { Class } from '@ptc-org/nestjs-query-core'

import { getAuthorizer } from '../decorators'
import { AuthorizationMode } from './security-options'

export class MissingAuthorizerError extends Error {
  constructor(dtoNames: string[]) {
    super(
      `NestJS Query security: authorization is required but the following DTO(s) are missing @Authorize: ${dtoNames.join(
        ', '
      )}. Add @Authorize(...) to each DTO, or set security.authorization to 'optional'.`
    )
    this.name = 'MissingAuthorizerError'
  }
}

export function assertAuthorizersConfigured(DTOClasses: Class<unknown>[], authorization: AuthorizationMode = 'required'): void {
  if (authorization !== 'required') {
    return
  }

  const missing = [...new Set(DTOClasses.filter((DTOClass) => !getAuthorizer(DTOClass)).map((DTOClass) => DTOClass.name))]

  if (missing.length > 0) {
    throw new MissingAuthorizerError(missing)
  }
}
