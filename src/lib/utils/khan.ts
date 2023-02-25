import { bold, hyperlink } from '@discordjs/builders'
import { EmbedLimits, HttpUrlRegex } from '@sapphire/discord-utilities'
import { BULLET_SEPARATOR } from '../constants'
import { isIntegerString, parseKeyPath, truncate } from './general'
import { ProgramIDRegex, ProgramURLRegex } from '@bhavjit/khan-api'

export function parseProgram(program: string) {
  let id: number
  if (isIntegerString(program!)) {
    id = parseInt(program!, 10)
  } else {
    if (ProgramURLRegex.test(program)) id = parseInt(program.match(ProgramURLRegex)![1], 10)
    else return null
  }
  if (!ProgramIDRegex.test(id.toString())) return null
  return id
}

export function displayName(
  nickname: string | null | undefined,
  username: string | null | undefined,
  kaid: string,
  limit = Infinity,
  secondaryKaid = true
) {
  const primary = displayNamePrimary(nickname, username, kaid)
  const secondary = displayNameSecondary(nickname, username, kaid, primary)
  if (secondary && secondaryKaid ? true : secondary !== kaid) {
    const name = `${bold(primary)} (${secondary})`
    if (name.length < limit) return name
  }
  return truncate(primary, limit)
}

export function displayNamePrimary(nickname: string | null | undefined, username: string | null | undefined, kaid: string, limit = Infinity) {
  if (nickname) return truncate(nickname, limit)
  if (username && username !== '') return truncate('@' + username, limit)
  return kaid
}

function displayNameSecondary(
  nickname: string | null | undefined,
  username: string | null | undefined,
  kaid: string,
  primaryName: string = displayNamePrimary(nickname, username, kaid)
) {
  if (primaryName === nickname) return username ? '@' + username : kaid
  else if (primaryName === username) return kaid
  else return null
}

export function displayNameFooter(username: string | null | undefined, kaid: string) {
  if (username && username !== '') {
    const name = [`@${username}`, kaid].join(BULLET_SEPARATOR)
    if (name.length < EmbedLimits.MaximumFooterLength) return name
  }
  return kaid
}

export function profileURL(username: string | null | undefined, kaid: string, limit = Infinity) {
  if (username && username !== '') {
    const url = 'https://www.khanacademy.org/profile/' + username
    if (url.length < limit) return url
  }
  return 'https://www.khanacademy.org/profile/' + kaid
}

export function avatarURL(avatarOrAvatarURL: string) {
  if (HttpUrlRegex.test(avatarOrAvatarURL)) return avatarOrAvatarURL.replace('/svg', '').replace('.svg', '.png')
  return `https://cdn.kastatic.org${avatarOrAvatarURL.replace('/svg', '').replace('.svg', '.png')}`
}

export function truncateScratchpadHyperlink(title: string, slug: string, id: number, limit: number) {
  const withoutSlugLength = `[${title}](https://www.khanacademy.org/computer-programming//${id})`.length
  if (slug.length > limit - withoutSlugLength) slug = truncate(slug, limit - withoutSlugLength, '')
  if (slug === '') slug = '-'
  const withoutTitleLength = `[](https://www.khanacademy.org/computer-programming/${slug}/${id})`.length
  if (title.length > limit - withoutTitleLength) title = truncate(title, limit - withoutTitleLength)

  return hyperlink(title, `https://www.khanacademy.org/computer-programming/${slug}/${id}`)
}

export function sortScratchpadsByDate(scratchpads: Record<string, unknown>[], createdKeyPath: string, updatedKeyPath: string, ascending = true) {
  return scratchpads.sort((a, b) => {
    const aCreated = parseKeyPath(a, createdKeyPath),
      aUpdated = parseKeyPath(a, updatedKeyPath),
      bCreated = parseKeyPath(b, createdKeyPath),
      bUpdated = parseKeyPath(b, updatedKeyPath)
    const aTime = Math.min(
      aCreated instanceof Date ? aCreated.getTime() : new Date(aCreated).getTime(),
      aUpdated instanceof Date ? aUpdated.getTime() : new Date(aUpdated).getTime()
    )
    const bTime = Math.min(
      bCreated instanceof Date ? bCreated.getTime() : new Date(bCreated).getTime(),
      bUpdated instanceof Date ? bUpdated.getTime() : new Date(bUpdated).getTime()
    )
    return ascending ? aTime - bTime : bTime - aTime
  })
}
