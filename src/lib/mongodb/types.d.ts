import type { Document, WithId } from 'mongodb'

export interface CollectionStatistics extends Document {
  ns: string
  host: string
  localTime: Date
  latencyStats: LatencyStats
}

interface LatencyStats {
  reads: LatencyStatsField
  writes: LatencyStatsField
  commands: LatencyStatsField
  transactions: LatencyStatsField
}

interface LatencyStatsField {
  latency: number
  ops: number
}

export interface AuthorDocument extends WithId<Document> {
  authorID: string
  username: string
  nickname: string
  bio: string
  canAccessDistrictsHomepage: boolean
  includesDistrictOwnedData: boolean
  isMidsignupPhantom: boolean
  isPhantom: boolean
  accessLevel: string
  answers: number
  comments: number
  flags: number
  projectanswers: number
  projectquestions: number
  questions: number
  replies: number
  votes: number
  dbUpdated: Date
}

export interface ScratchpadDocument extends WithId<Document> {
  title: string | null
  scratchpadID: number
  scratchpadKey: string
  authorID: string
  updated: Date
  created: Date
  votes: number
  forks: number
  type: string
  hidden: boolean
  approved: boolean
  official: boolean
  flagCount: number
  flags: string[]
  description: string | null
  originID: number | null
  originSimilarity: number
  width: number
  height: number
  code: string
  dbUpdated: Date
}
