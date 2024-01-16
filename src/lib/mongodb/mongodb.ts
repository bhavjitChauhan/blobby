import { Collection, Db, MongoClient, type WithId } from 'mongodb'
import { performance } from 'perf_hooks'
import config from '../../config'
import { softAssertEnvVars } from '../env-parser'
import type { AuthorDocument, CollectionStatistics, ScratchpadDocument } from './types'

softAssertEnvVars('MONGODB_URI', 'MONGODB_AUTHORS_COLLECTION', 'MONGODB_SCRATCHPADS_COLLECTION')
process.env.MONGODB_URI = process.env.MONGODB_URI as string
process.env.MONGODB_AUTHORS_COLLECTION = process.env.MONGODB_AUTHORS_COLLECTION as string
process.env.MONGODB_SCRATCHPADS_COLLECTION = process.env.MONGODB_SCRATCHPADS_COLLECTION as string

const uri = process.env.MONGODB_URI

export const client = new MongoClient(uri)

const COLLECTIONS = [process.env.MONGODB_AUTHORS_COLLECTION, process.env.MONGODB_SCRATCHPADS_COLLECTION]

export enum Collections {
  Authors,
  Scratchpads,
}

export async function find(enumerator: Collections, query: Parameters<Collection['find']>[0], options: Parameters<Collection['find']>[1] = {}) {
  let results = null
  try {
    const connection = await client.connect()
    const db = connection.db(process.env.MONGODB_DB)
    const collection = db.collection(COLLECTIONS[enumerator])

    results = await collection
      .find(query, {
        maxTimeMS: config.mongodb.timeout,
        limit: config.mongodb.limit,
        ...options,
      })
      .toArray()
  } catch (err) {
    results = null
  } finally {
    await client.close()
  }
  return results
}

export async function aggregate(
  enumerator: Collections,
  pipeline: Parameters<Collection['aggregate']>[0],
  options: Parameters<Collection['aggregate']>[1] = {}
) {
  let results = null
  try {
    const connection = await client.connect()
    const db = connection.db(process.env.MONGODB_DB)
    const collection = db.collection(COLLECTIONS[enumerator])

    results = await collection
      .aggregate(pipeline, {
        maxTimeMS: config.mongodb.timeout,
        ...options,
      })
      .toArray()
  } catch (err) {
    results = null
  } finally {
    await client.close()
  }
  return results
}

export async function command(command: Parameters<Db['command']>[0], options: Parameters<Db['command']>[1] = {}) {
  let results = null
  try {
    const connection = await client.connect()
    const db = connection.db(process.env.MONGODB_DB)
    results = await db.command(command, options)
  } catch (err) {
    results = null
  } finally {
    await client.close()
  }
  return results
}

export async function getLatency() {
  const start = performance.now()
  const results = await command({ ping: 1 })
  if (results === null) return null
  return performance.now() - start
}

export async function latencyStats() {
  const results = (await aggregate(Collections.Authors, [{ $collStats: { latencyStats: {} } }])) as CollectionStatistics[]

  return results[0].latencyStats
}

export async function search(enumerator: Collections.Authors, query: string): Promise<WithId<AuthorDocument>[]>
export async function search(enumerator: Collections.Scratchpads, query: string): Promise<WithId<ScratchpadDocument>[]>
export async function search(enumerator: Collections, query: string) {
  return await find(enumerator, { $text: { $search: query } })
}
