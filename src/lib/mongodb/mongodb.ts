import { Collection, MongoClient, WithId } from 'mongodb'
import config from '../../config'
import type { AuthorDocument, CollectionStatistics, ScratchpadDocument } from './types'

if (!process.env.MONGODB_URI) throw new Error('The MONGODB_URI environment variable must be set')
if (!process.env.MONGODB_AUTHORS_COLLECTION || !process.env.MONGODB_SCRATCHPADS_COLLECTION)
  throw new Error('The MONGODB_AUTHORS_COLLECTION and MONGODB_SCRATCHPADS_COLLECTION environment variables must be set')

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

export async function latencyStats() {
  const results = (await aggregate(Collections.Authors, [{ $collStats: { latencyStats: {} } }])) as CollectionStatistics[]

  return results[0].latencyStats
}

export async function search(enumerator: Collections.Authors, query: string): Promise<WithId<AuthorDocument>[]>
export async function search(enumerator: Collections.Scratchpads, query: string): Promise<WithId<ScratchpadDocument>[]>
export async function search(enumerator: Collections, query: string) {
  return await find(enumerator, { $text: { $search: query } })
}
