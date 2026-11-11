import { DynamicModule, ForwardReference, Global, Module, Provider } from '@nestjs/common'
import { Assembler, Class, NestjsQueryCoreModule } from '@ptc-org/nestjs-query-core'

import { DataLoaderOptions, dataLoaderOptionsToken } from './pipes/inject-data-loader-config.pipe'
import { AutoResolverOpts, createAuthorizerProviders, createHookProviders, createResolvers } from './providers'
import { ReadResolverOpts } from './resolvers'
import {
  assertAuthorizersConfigured,
  createAuthorizationSecurityValidator,
  NESTJS_QUERY_SECURITY_OPTIONS,
  NestjsQuerySecurityOptions,
  resolveSecurityOptions
} from './security'
import { defaultPubSub, GraphQLPubSub, pubSubToken } from './subscription'
import { PagingStrategies } from './types/query/paging'

interface DTOModuleOpts<DTO> {
  DTOClass: Class<DTO>
  CreateDTOClass?: Class<DTO>
  UpdateDTOClass?: Class<DTO>
}

export interface NestjsQueryGraphqlModuleRootOpts {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dataLoader?: DataLoaderOptions
  security?: NestjsQuerySecurityOptions
}

export interface NestjsQueryGraphqlModuleFeatureOpts {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  imports?: Array<Class<any> | DynamicModule | ForwardReference>
  services?: Provider[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  assemblers?: Class<Assembler<any, any, any, any, any, any>>[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  resolvers?: AutoResolverOpts<any, any, unknown, unknown, ReadResolverOpts<any>, PagingStrategies>[]
  dtos?: DTOModuleOpts<unknown>[]
  pubSub?: Provider<GraphQLPubSub>
  /**
   * Feature-level security override. When `authorization: 'required'`, DTOs are validated
   * immediately in `forFeature`. Root `forRoot({ security })` still applies via OnModuleInit.
   */
  security?: NestjsQuerySecurityOptions
}

@Global()
@Module({})
export class NestjsQueryGraphQLCoreModule {
  public static forRoot(opts: NestjsQueryGraphqlModuleRootOpts): DynamicModule {
    const providers = [
      { provide: dataLoaderOptionsToken, useValue: opts.dataLoader ?? {} },
      { provide: NESTJS_QUERY_SECURITY_OPTIONS, useValue: resolveSecurityOptions(opts.security) }
    ]

    return {
      module: NestjsQueryGraphQLCoreModule,
      providers,
      exports: providers
    }
  }
}

export class NestjsQueryGraphQLModule {
  public static forRoot(opts: NestjsQueryGraphqlModuleRootOpts): DynamicModule {
    return {
      module: NestjsQueryGraphQLModule,
      imports: [NestjsQueryGraphQLCoreModule.forRoot(opts)]
    }
  }

  public static forFeature(opts: NestjsQueryGraphqlModuleFeatureOpts): DynamicModule {
    const dtoClasses = this.getDTOClasses(opts)

    // Fail early when the feature module itself requests required authorization.
    if (opts.security?.authorization === 'required') {
      assertAuthorizersConfigured(dtoClasses, 'required')
    }

    const coreModule = this.getCoreModule(opts)
    const providers = this.getProviders(opts, dtoClasses)
    const imports = opts.imports ?? []

    return {
      module: NestjsQueryGraphQLModule,
      imports: [...imports, coreModule],
      providers: [...providers],
      exports: [...providers, ...imports, coreModule]
    }
  }

  public static defaultPubSubProvider(): Provider<GraphQLPubSub> {
    return { provide: pubSubToken(), useValue: defaultPubSub() }
  }

  private static getDTOClasses(opts: NestjsQueryGraphqlModuleFeatureOpts): Class<unknown>[] {
    const resolverDTOs = opts.resolvers?.map((r) => r.DTOClass) ?? []
    const dtos = opts.dtos?.map((o) => o.DTOClass) ?? []
    return [...resolverDTOs, ...dtos]
  }

  private static getCoreModule(opts: NestjsQueryGraphqlModuleFeatureOpts): DynamicModule {
    return NestjsQueryCoreModule.forFeature({
      assemblers: opts.assemblers,
      imports: opts.imports ?? []
    })
  }

  private static getProviders(opts: NestjsQueryGraphqlModuleFeatureOpts, dtoClasses: Class<unknown>[]): Provider<unknown>[] {
    return [
      ...this.getServicesProviders(opts),
      ...this.getPubSubProviders(opts),
      ...this.getAuthorizerProviders(dtoClasses),
      ...this.getHookProviders(opts),
      ...this.getResolverProviders(opts),
      createAuthorizationSecurityValidator(dtoClasses)
    ]
  }

  private static getPubSubProviders(opts: NestjsQueryGraphqlModuleFeatureOpts): Provider<GraphQLPubSub>[] {
    return [opts.pubSub ?? this.defaultPubSubProvider()]
  }

  private static getServicesProviders(opts: NestjsQueryGraphqlModuleFeatureOpts): Provider<unknown>[] {
    return opts.services ?? []
  }

  private static getResolverProviders(opts: NestjsQueryGraphqlModuleFeatureOpts): Provider<unknown>[] {
    return createResolvers(opts.resolvers ?? [])
  }

  private static getAuthorizerProviders(dtoClasses: Class<unknown>[]): Provider<unknown>[] {
    return createAuthorizerProviders(dtoClasses)
  }

  private static getHookProviders(opts: NestjsQueryGraphqlModuleFeatureOpts): Provider<unknown>[] {
    return createHookProviders([...(opts.resolvers ?? []), ...(opts.dtos ?? [])])
  }
}
