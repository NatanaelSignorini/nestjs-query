import { MongoMemoryServer } from 'mongodb-memory-server'
import { Connection, connections, ConnectionStates } from 'mongoose'

import { seed } from './seeds'

export class MongoServer {
  private mongod?: MongoMemoryServer

  private uri?: string

  async init() {
    this.mongod = await MongoMemoryServer.create()
    this.uri = this.mongod.getUri()
  }

  getConnectionUri(): string {
    if (!this.uri) {
      throw new Error('MongoServer not initialized')
    }
    return this.uri
  }

  /**
   * Resolve the mongoose connection opened for this server's URI.
   * Never use `connections[connections.length - 1]` — parallel suites share that array.
   *
   * `@m8a/nestjs-typegoose` uses `mongoose.createConnection()` which may still be
   * `connecting` when hooks run, so wait with `asPromise()` when needed.
   */
  private async requireOwnConnection(): Promise<Connection> {
    if (!this.uri) {
      throw new Error('MongoServer not initialized')
    }

    let host: string
    let port: number
    try {
      const parsed = new URL(this.uri)
      host = parsed.hostname
      port = Number(parsed.port)
    } catch {
      throw new Error(`MongoServer: invalid uri ${this.uri}`)
    }

    const matchesUri = (connection: Connection): boolean => {
      const samePort = connection.port === port
      const sameHost =
        connection.host === host ||
        (host === '127.0.0.1' && connection.host === 'localhost') ||
        (host === 'localhost' && connection.host === '127.0.0.1')
      return samePort && sameHost
    }

    let connection = connections.find(
      (candidate) =>
        matchesUri(candidate) &&
        candidate.readyState !== ConnectionStates.disconnected &&
        candidate.readyState !== ConnectionStates.disconnecting
    )

    // createConnection may register before host/port are populated — fall back to
    // the newest non-closed connection opened for this process when URI match fails.
    if (!connection) {
      for (let i = connections.length - 1; i >= 0; i -= 1) {
        const candidate = connections[i]
        if (
          candidate &&
          candidate.readyState !== ConnectionStates.disconnected &&
          candidate.readyState !== ConnectionStates.disconnecting
        ) {
          connection = candidate
          break
        }
      }
    }

    if (!connection) {
      throw new Error(`MongoServer: no mongoose connection for ${this.uri}`)
    }

    if (connection.readyState !== ConnectionStates.connected) {
      await connection.asPromise()
    }

    if (!connection.db) {
      throw new Error(`MongoServer: connection for ${this.uri} has no db handle`)
    }

    return connection
  }

  async clearDatabase(): Promise<void> {
    const connection = await this.requireOwnConnection()
    const collections = await connection.db.collections()
    await Promise.all(collections.map((collection) => collection.deleteMany({})))
  }

  async prepareDb(): Promise<void> {
    const connection = await this.requireOwnConnection()
    await seed(connection)
  }

  async closeDbConnection(): Promise<void> {
    try {
      const connection = await this.requireOwnConnection()
      await connection.close()
    } catch {
      // Suite teardown should not fail if the connection was already closed.
    }

    if (this.mongod) {
      await this.mongod.stop()
      this.mongod = undefined
      this.uri = undefined
    }
  }
}
