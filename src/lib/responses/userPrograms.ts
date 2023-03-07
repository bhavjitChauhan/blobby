import { AvatarSVG, convertAvatarSVGToPNG, ListProgramSortOrder, Program, User } from '@bhavjit/khan-api'
import { EmbedLimits } from '@sapphire/discord-utilities'
import { PaginatedMessageEmbedFields } from '@sapphire/discord.js-utilities'
import type { Subcommand } from '@sapphire/plugin-subcommands'
import { Stopwatch } from '@sapphire/stopwatch'
import { ButtonInteraction, EmbedBuilder, hyperlink, inlineCode } from 'discord.js'
import config from '../../config'
import { EN_SPACE_CHAR, BULLET_SEPARATOR } from '../constants'
import { khanClient } from '../khan-cookies'
import { deferReply, formatFieldWarning, formatStopwatch } from '../utils/discord'
import { truncate } from '../utils/general'
import { profileURL } from '../utils/khan'
import { SapphirePaginatedMessageLimits } from '../utils/limits'

const MAX_PROGRAMS = SapphirePaginatedMessageLimits.MaximumPages * config.itemsPerPage

export async function userPrograms(
  interaction: ButtonInteraction | Subcommand.ChatInputCommandInteraction,
  identifier: string,
  sort = ListProgramSortOrder.TOP
) {
  await deferReply(interaction)

  const stopwatch = new Stopwatch()

  const kaid = await khanClient.resolveCachedKaid(identifier)
  let tooManyPrograms = false
  const programs: Program[] = []
  for await (const page of khanClient.getUserPrograms(kaid, sort, 100)) {
    programs.push(...page)
    if (programs.length >= MAX_PROGRAMS) {
      tooManyPrograms = true
      break
    }
  }
  if (programs.length === 0) return interaction.editReply(`No programs found by ${inlineCode(identifier)}`)

  const author = programs[0].author!
  await author?.getAvatar()
  const paginatedMessage = paginatedMessagePrograms(programs, author, identifier, tooManyPrograms, stopwatch)

  return paginatedMessage.run(interaction, interaction.user)
}

function paginatedMessagePrograms(programs: Program[], author: User, identifier: string, tooManyPrograms: boolean, stopwatch: Stopwatch) {
  if (programs.length > MAX_PROGRAMS) {
    programs = programs.slice(0, MAX_PROGRAMS)
    tooManyPrograms = true
  }

  return new PaginatedMessageEmbedFields()
    .setTemplate(
      new EmbedBuilder() //
        .setColor('Green')
        .setAuthor({
          name: author.nickname ?? author.kaid!,
          url: profileURL(null, author.kaid!),
          iconURL: convertAvatarSVGToPNG(author.avatar as AvatarSVG)!,
        })
        .setTitle(`${programs.length + (tooManyPrograms ? '+' : '')} programs by ${inlineCode(identifier)}`)
        .addFields(tooManyPrograms ? [formatFieldWarning(`Only the first ${programs.length} programs are shown`)] : [])
        .setFooter({
          text: formatStopwatch(stopwatch),
        })
    )
    .setItems(
      programs.map((program) => {
        const fieldValueArr = [`${program.votes?.toLocaleString() ?? '❓'} votes`, `${program.spinOffCount?.toLocaleString() ?? '❓'} spin-offs`]

        return {
          name: truncate(program.title ?? 'Untitled', EmbedLimits.MaximumFieldNameLength),
          value: hyperlink('🔗', program.url!) + EN_SPACE_CHAR + fieldValueArr.join(BULLET_SEPARATOR),
          inline: false,
        }
      })
    )
    .setItemsPerPage(config.itemsPerPage)
    .make()
}
