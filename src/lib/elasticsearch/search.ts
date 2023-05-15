import { isKaid } from '@bhavjit/khan-api'
import type { SearchResponse, AggregationsAggregate, QueryDslQueryContainer } from '@elastic/elasticsearch/lib/api/types'
import { Indices, client, IndexNames } from './client'
import type { AuthorField, AuthorDocument, ScratchpadField, Field, ScratchpadDocument } from './types'
import { container } from '@sapphire/framework'

export async function search(
  index: Indices.Authors,
  query: string,
  fields: AuthorField[],
  sort?: Partial<Record<AuthorField, 'asc' | 'desc'>>,
  size?: number,
  from?: number
): Promise<SearchResponse<AuthorDocument, Record<string, AggregationsAggregate>> | null>
export async function search(
  index: Indices.Scratchpads,
  query: string,
  fields: ScratchpadField[],
  sort?: Partial<Record<ScratchpadField, 'asc' | 'desc'>>,
  size?: number,
  from?: number
): Promise<SearchResponse<AuthorDocument, Record<string, AggregationsAggregate>> | null>
export async function search(
  index: Indices,
  query: string,
  fields: Field[],
  sort?: Partial<Record<Field, 'asc' | 'desc'>>,
  size?: number,
  from?: number
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
        size,
        from,
        query: {
          simple_query_string: {
            query,
            fields,
          },
        },
        sort:
          typeof sort !== 'undefined'
            ? Object.keys(sort).map((key: string) => ({
                [key]: { order: sort[key as Field] },
              }))
            : [],
      },
    })
  } catch (err) {
    container.logger.error(err)
    results = null
  }
  return results
}

export async function searchBoolean(
  index: Indices.Authors,
  queries: QueryDslQueryContainer[],
  sort?: Partial<Record<AuthorField, 'asc' | 'desc'>>,
  size?: number,
  from?: number
): Promise<SearchResponse<AuthorDocument, Record<string, AggregationsAggregate>> | null>
export async function searchBoolean(
  index: Indices.Scratchpads,
  queries: QueryDslQueryContainer[],
  sort?: Partial<Record<ScratchpadField, 'asc' | 'desc'>>,
  size?: number,
  from?: number
): Promise<SearchResponse<ScratchpadDocument, Record<string, AggregationsAggregate>> | null>
export async function searchBoolean(
  index: Indices,
  queries: QueryDslQueryContainer[],
  sort?: Partial<Record<Field, 'asc' | 'desc'>>,
  size?: number,
  from?: number
) {
  const indexName = IndexNames[index]
  let results = null
  try {
    results = await client.search({
      index: indexName,
      body: {
        size,
        from,
        query: {
          bool: {
            must: queries,
          },
        },
        sort: typeof sort !== 'undefined' ? Object.keys(sort).map((key: string) => ({ [key]: { order: sort[key as Field] } })) : [],
      },
    })
  } catch (err) {
    container.logger.error(err)
    results = null
  }
  return results
}

export function searchUser(query: string, sort?: Partial<Record<AuthorField, 'asc' | 'desc'>>, size?: number, from?: number) {
  if (isKaid(query)) query = query.slice(5)
  return search(Indices.Authors, query, ['nickname', 'username'], sort, size, from)
}
