import { Client } from '@elastic/elasticsearch'
import { softAssertEnvVars } from '../env-parser'
import { Program, ProgramType } from '@bhavjit/khan-api'
import type { ScratchpadDocument } from './types'

softAssertEnvVars('ELASTICSEARCH_URI', 'ELASTICSEARCH_AUTHORS_INDEX', 'ELASTICSEARCH_SCRATCHPADS_INDEX', 'ELASTICSEARCH_MESSAGES_INDEX')
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
export const IndexNames = {
  [Indices.Authors]: process.env.ELASTICSEARCH_AUTHORS_INDEX,
  [Indices.Scratchpads]: process.env.ELASTICSEARCH_SCRATCHPADS_INDEX,
  [Indices.Messages]: process.env.ELASTICSEARCH_MESSAGES_INDEX,
} as const

export const ProgramTypeScratchpadType: Record<ProgramType, readonly ScratchpadDocument['type'][]> = {
  [Program.Type.ProcessingJS]: ['pjs', 'PJS'],
  [Program.Type.HTML]: ['webpage', 'WEBPAGE'],
  [Program.Type.SQL]: ['sql', 'SQL'],
  [Program.Type.Other]: [],
} as const
