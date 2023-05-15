export interface AuthorDocument {
  answers: number
  authorID: string
  bio: string
  comments: number
  flags: number
  nickname: string
  questions: number
  points: number
  projectanswers: number
  projectquestions: number
  replies: number
  username?: string
  votes: number
}

export interface ScratchpadDocument {
  authorID: string
  description: string
  created: string
  forks: number
  height: number
  scratchpadID: number
  scratchpadKey: string
  title: string
  type: 'pjs' | 'PJS' | 'WEBPAGE' | 'webpage' | 'SQL' | 'sql'
  updated: string
  votes: number
  width: number
}

export type AuthorField = keyof AuthorDocument
export type ScratchpadField = keyof ScratchpadDocument | 'code'
export type Field = AuthorFields | ScratchpadFields
