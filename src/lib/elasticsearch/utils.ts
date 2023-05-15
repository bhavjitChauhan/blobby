import type { SearchHitsMetadata } from '@elastic/elasticsearch/lib/api/types'

export function resolveTotalHits(hits: SearchHitsMetadata) {
  return typeof hits.total === 'number' ? hits.total : hits.total?.value
}

export function formatTotalHits(hits: SearchHitsMetadata) {
  return `${(resolveTotalHits(hits)?.toLocaleString() ?? 'Unknown') + (typeof hits?.total !== 'number' && hits.total?.relation === 'gte' ? '+' : '')}`
}
