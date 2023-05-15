import type { QueryDslQueryContainer } from '@elastic/elasticsearch/lib/api/types'
import type { Field } from './types'

export function termQuery(field: string, value: string) {
  return {
    term: {
      [field]: {
        value,
      },
    },
  }
}

export function termsQuery(field: Field, values: string[]) {
  return {
    terms: {
      [field]: values,
    },
  }
}

export function matchQuery(field: Field, text: string) {
  return {
    match: {
      [field]: text,
    },
  }
}

export function simpleQueryStringQuery(query: string, field: Field): QueryDslQueryContainer
export function simpleQueryStringQuery(query: string, fields: Field[]): QueryDslQueryContainer
export function simpleQueryStringQuery(query: string, fieldOrFields: Field | Field[]) {
  return {
    simple_query_string: {
      query,
      fields: Array.isArray(fieldOrFields) ? fieldOrFields : [fieldOrFields],
    },
  }
}
