import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { MessageActionRow, Modal, ModalActionRowComponent, TextInputComponent } from 'discord.js';
import { pjsKeys } from '../../lib/constants';
import { serialize } from '../../lib/utils';

@ApplyOptions<Command.Options>({
	description: 'Run Processing.js code in the Khan Academy environment'
})
export class UserCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand(
			(builder) =>
				builder
					.setName(this.name)
					.setDescription(this.description)
					.addIntegerOption((option) =>
						option //
							.setName('width')
							.setDescription('Width of the canvas')
					)
					.addIntegerOption((option) =>
						option //
							.setName('height')
							.setDescription('Height of the canvas')
					)
					.addNumberOption((option) =>
						option //
							.setName('delay')
							.setDescription('Delay in milliseconds before the result is retrieved')
					)
					.addBooleanOption((option) =>
						option //
							.setName('canvas')
							.setDescription('Whether to show the canvas')
					)
					.addBooleanOption((option) =>
						option //
							.setName('loop-protector')
							.setDescription('Whether to enable the loop protector')
					),
			{ idHints: ['1012899131301318676'] }
		);
	}
	public async chatInputRun(interaction: Command.ChatInputInteraction) {
		const options = {
			width: interaction.options.getInteger('width'),
			height: interaction.options.getInteger('height'),
			delay: interaction.options.getNumber('delay'),
			canvas: interaction.options.getBoolean('canvas'),
			loopProtector: interaction.options.getBoolean('loop-protector')
		};
		const modal = new Modal()
			.setCustomId(`pjs${serialize(options, pjsKeys)}`)
			.setTitle('Processing.js Input')
			.setComponents(
				new MessageActionRow<ModalActionRowComponent>().addComponents(
					new TextInputComponent() //
						.setCustomId('code')
						.setLabel('Code')
						.setStyle('PARAGRAPH')
				)
			);

		await interaction.showModal(modal).catch((err) => this.container.client.logger.error(err));
	}
}
