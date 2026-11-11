import { Injectable } from '@nestjs/common'
import { Class } from '@ptc-org/nestjs-query-core'

import { Hook } from './hooks'

let defaultHookId = 0

export const createDefaultHook = <T>(func: Hook<T>['run']): Class<Hook<T>> => {
  @Injectable()
  class DefaultHook implements Hook<T> {
    get run() {
      return func
    }
  }

  Object.defineProperty(DefaultHook, 'name', {
    value: `DefaultHook_${++defaultHookId}`
  })

  return DefaultHook
}
