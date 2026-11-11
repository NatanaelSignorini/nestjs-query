// eslint-disable-next-line max-classes-per-file
import { ObjectType } from '@nestjs/graphql'
import { Test } from '@nestjs/testing'
import { Authorize, FilterableField, MissingAuthorizerError, NestjsQueryGraphQLModule } from '@ptc-org/nestjs-query-graphql'

describe('security.authorization required', () => {
  @ObjectType()
  class UnsecuredDTO {
    @FilterableField()
    name!: string
  }

  @Authorize({ authorize: () => ({ name: { eq: 'allowed' } }) })
  @ObjectType()
  class SecuredDTO {
    @FilterableField()
    name!: string
  }

  describe('forFeature security override', () => {
    it('throws when authorization is required and DTO lacks @Authorize', () => {
      expect(() =>
        NestjsQueryGraphQLModule.forFeature({
          security: { authorization: 'required' },
          resolvers: [{ DTOClass: UnsecuredDTO, EntityClass: UnsecuredDTO }]
        })
      ).toThrow(MissingAuthorizerError)
    })

    it('creates the module when authorization is required and DTO has @Authorize', () => {
      const graphqlModule = NestjsQueryGraphQLModule.forFeature({
        security: { authorization: 'required' },
        resolvers: [{ DTOClass: SecuredDTO, EntityClass: SecuredDTO }]
      })

      expect(graphqlModule.module).toBe(NestjsQueryGraphQLModule)
      expect(graphqlModule.providers?.length).toBeGreaterThan(0)
    })

    it('keeps optional behavior by default for DTOs without @Authorize', () => {
      expect(() =>
        NestjsQueryGraphQLModule.forFeature({
          resolvers: [{ DTOClass: UnsecuredDTO, EntityClass: UnsecuredDTO }]
        })
      ).not.toThrow()
    })
  })

  describe('forRoot security options', () => {
    // Use `dtos` (no auto-resolvers) so the Nest testing module does not need a QueryService.
    it('fails on module init when root requires authorization and DTO lacks @Authorize', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [
          NestjsQueryGraphQLModule.forRoot({ security: { authorization: 'required' } }),
          NestjsQueryGraphQLModule.forFeature({
            dtos: [{ DTOClass: UnsecuredDTO }]
          })
        ]
      }).compile()

      await expect(moduleRef.init()).rejects.toThrow(MissingAuthorizerError)
      await moduleRef.close()
    })

    it('boots when root requires authorization and DTO has @Authorize', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [
          NestjsQueryGraphQLModule.forRoot({ security: { authorization: 'required' } }),
          NestjsQueryGraphQLModule.forFeature({
            dtos: [{ DTOClass: SecuredDTO }]
          })
        ]
      }).compile()

      await expect(moduleRef.init()).resolves.toBeDefined()
      await moduleRef.close()
    })

    it('boots with optional authorization when DTO lacks @Authorize', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [
          NestjsQueryGraphQLModule.forRoot({ security: { authorization: 'optional' } }),
          NestjsQueryGraphQLModule.forFeature({
            dtos: [{ DTOClass: UnsecuredDTO }]
          })
        ]
      }).compile()

      await expect(moduleRef.init()).resolves.toBeDefined()
      await moduleRef.close()
    })
  })
})
