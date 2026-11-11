export type AuthorizationMode = 'required' | 'optional'

export interface NestjsQuerySecurityOptions {
  /**
   * When `required`, every DTO registered via `forFeature` must declare `@Authorize`.
   * Missing authorizers fail at bootstrap (fail-closed).
   *
   * Default is `optional` in this alpha for compatibility; prefer `required` for new apps.
   */
  authorization?: AuthorizationMode
}

export const DEFAULT_SECURITY_OPTIONS: Required<NestjsQuerySecurityOptions> = {
  authorization: 'optional'
}

export const NESTJS_QUERY_SECURITY_OPTIONS = 'NESTJS_QUERY_SECURITY_OPTIONS'

export const resolveSecurityOptions = (opts?: NestjsQuerySecurityOptions): Required<NestjsQuerySecurityOptions> => ({
  authorization: opts?.authorization ?? DEFAULT_SECURITY_OPTIONS.authorization
})
