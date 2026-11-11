import { MongoMemoryServer } from 'mongodb-memory-server'
import { Connection, connections, ConnectionStates } from 'mongoose'

import { seed } from './seeds'

export class MongoServer {
  private mongod?: MongoMemoryServer

  async init() {
    this.mongod = await MongoMemoryServer.create()
  }

  getConnectionUri(): string {
    if (this.mongod) {
      return this.mongod.getUri()
    }
  }

  private getActiveConnection(): Connection | undefined {
    for (let i = connections.length - 1; i >= 0; i -= 1) {
      const connection = connections[i]
      if (connection?.readyState === ConnectionStates.connected && connection.db) {
        return connection
      }
    }
    return undefined
  }

  async clearDatabase(): Promise<void> {
    const connection = this.getActiveConnection()
    if (!connection?.db) {
      return
    }
    const collections = await connection.db.collections()
    await Promise.all(collections.map((collection) => collection.deleteMany({})))
  }

  async prepareDb(): Promise<void> {
    const connection = this.getActiveConnection()
    if (!connection) {
      throw new Error('MongoServer: no active mongoose connection to seed')
    }
    await seed(connection)
  }

  async closeDbConnection(): Promise<void> {
    const connection = this.getActiveConnection()
    if (connection) {
      await connection.close()
    }

    if (this.mongod) {
      await this.mongod.stop()
    }
  }
}
