import { readdirSync, readFileSync } from 'fs'
import matter from 'gray-matter'
import path from 'path'
import { MessageLimits } from '@sapphire/discord-utilities'
import { client } from '../index'

export function parseInfoTopics(dirname: string) {
  const files = readdirSync(dirname)
  const topics = files.map((file) => {
    const content = readFileSync(path.join(dirname, file), 'utf8')

    const topic = matter(content)
    if (!topic.data.title) throw new Error(`Topic ${file} is missing a title`)
    if (!topic.data.keywords) throw new Error(`Topic ${file} is missing keywords`)
    if (topic.content.length > MessageLimits.MaximumLength) client.logger.warn(`Topic ${topic.data.title} content is too long`)

    return topic
  })
  return topics as unknown as InfoTopic[]
}

export interface InfoTopic {
  content: string
  data: InfoTopicData
}

interface InfoTopicData {
  title: string
  keywords: string[]
  resources?: InfoTopicResource[]
}

interface InfoTopicResource {
  name: string
  url: string
}
