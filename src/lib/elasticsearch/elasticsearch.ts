import { Client } from '@elastic/elasticsearch'
import type { SearchResponse, AggregationsAggregate } from '@elastic/elasticsearch/lib/api/types'
import { assertEnvVars } from '../env-parser'
import type { AuthorDocument } from './types'

assertEnvVars('ELASTICSEARCH_URI', 'ELASTICSEARCH_AUTHORS_INDEX', 'ELASTICSEARCH_SCRATCHPADS_INDEX', 'ELASTICSEARCH_MESSAGES_INDEX')
process.env.ELASTICSEARCH_URI = process.env.ELASTICSEARCH_URI as string
process.env.ELASTICSEARCH_AUTHORS_INDEX = process.env.ELASTICSEARCH_AUTHORS_INDEX as string
process.env.ELASTICSEARCH_SCRATCHPADS_INDEX = process.env.ELASTICSEARCH_SCRATCHPADS_INDEX as string
process.env.ELASTICSEARCH_MESSAGES_INDEX = process.env.ELASTICSEARCH_MESSAGES_INDEX as string

export const client = new Client({
  node: process.env.ELASTICSEARCH_URI,
})

export enum Indices {
  Authors,
  Scratchpads,
  Messages,
}

export async function search(
  index: Indices.Authors,
  query: string,
  fields: (keyof AuthorDocument)[],
  sort?: Partial<Record<keyof AuthorDocument, 'asc' | 'desc'>>
): Promise<SearchResponse<AuthorDocument, Record<string, AggregationsAggregate>> | null>
export async function search(
  index: Indices,
  query: string,
  fields: (keyof AuthorDocument)[],
  sort?: Partial<Record<keyof AuthorDocument, 'asc' | 'desc'>>
) {
  let results = null
  let indexName
  switch (index) {
    case Indices.Authors:
      indexName = process.env.ELASTICSEARCH_AUTHORS_INDEX
      break
    case Indices.Scratchpads:
      indexName = process.env.ELASTICSEARCH_SCRATCHPADS_INDEX
      break
    case Indices.Messages:
      indexName = process.env.ELASTICSEARCH_MESSAGES_INDEX
      break
  }
  try {
    results = await client.search({
      index: indexName,
      body: {
        query: {
          simple_query_string: {
            query,
            fields,
          },
        },
        sort:
          typeof sort !== 'undefined'
            ? Object.keys(sort).map((key: string) => ({
                [key]: { order: sort[key as keyof AuthorDocument] },
              }))
            : [],
      },
    })
  } catch (err) {
    console.error(err)
    results = null
  }
  return results
}

export function searchUser(query: string, sort?: Partial<Record<keyof AuthorDocument, 'asc' | 'desc'>>) {
  return search(Indices.Authors, query, ['authorID', 'nickname', 'username'], sort)
}
