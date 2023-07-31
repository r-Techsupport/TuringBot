/**
 * @file
 *
 * This file contains helper utilities for embed generation and general formatting.
 *
 * Possible examples may include error embeds, success embeds, confirm/deny embeds
 */

import {
  APIEmbed,
  ChatInputCommandInteraction,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  InteractionResponse,
  Message,
} from 'discord.js';
import {replyToInteraction} from './slash_commands.js';

/**
 * Used in pairing with `{@link confirmEmbed()}`, this is a way to indicate whether or not the user confirmed a choice, and is passed as
 * the contents of the Promise returned by `{@link confirmEmbed()}`.
 */
export enum ConfirmEmbedResponse {
  Confirmed = 'confirmed',
  Denied = 'denied',
}
/**
 * Helper utilities used to speed up embed work
 */
export const embed = {
  /**
   * simple function that generates a minimal APIEmbed with only the `description` set.
   *  Other options can be set with `otherOptions`
   *
   * @param displayText The text you'd like the embed to contain
   *
   * @param otherOptions Any custom changes you'd like to make to the embed.
   * @see {@link https://discordjs.guide/popular-topics/embeds.html#using-an-embed-object} for specific options
   *
   * @example
   * // Just the description set
   * simpleEmbed("they don't did make em like they anymore these days do");
   * // Maybe you want to make the embed red
   * simpleEmbed("they don't did make em like they anymore these days do", { color: 0xFF0000 });
   */
  simpleEmbed(displayText: string, otherOptions: APIEmbed = {}): APIEmbed {
    otherOptions.description = displayText;
    return otherOptions;
  },

  /**
   * A preformatted embed that should be used to indicate command failure
   */
  errorEmbed(errorText: string): APIEmbed {
    const responseEmbed: APIEmbed = {
      description: '❌ ' + errorText,
      color: 0xf92f60,
      footer: {
        text: 'Operation failed.',
      },
    };
    return responseEmbed;
  },

  successEmbed(successText: string): APIEmbed {
    const responseEmbed: APIEmbed = {
      color: 0x379c6f,
      description: '✅ ' + successText,
    };
    return responseEmbed;
  },

  infoEmbed(infoText: string): APIEmbed {
    const responseEmbed: APIEmbed = {
      color: 0x2e8eea,
      description: infoText,
    };
    return responseEmbed;
  },

  /**
   * This provides a graceful way to ask a user whether or not they want something to happen.
   * @param prompt will be displayed in the embed with the `description` field
   */
  async confirmEmbed(
    prompt: string,
    // this might break if reply() is called twice
    interaction: ChatInputCommandInteraction,
    timeout = 60
  ): Promise<ConfirmEmbedResponse> {
    // https://discordjs.guide/message-components/action-rows.html
    const confirm = new ButtonBuilder()
      .setCustomId(ConfirmEmbedResponse.Confirmed)
      .setLabel('Confirm')
      .setStyle(ButtonStyle.Success);
    const deny = new ButtonBuilder()
      .setCustomId(ConfirmEmbedResponse.Denied)
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary);

    const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      confirm,
      deny
    );

    // send the confirmation
    const response: InteractionResponse<boolean> | Message =
      await replyToInteraction(interaction, {
        embeds: [this.infoEmbed(prompt)],
        components: [actionRow],
      });

    // listen for a button interaction
    try {
      const buttonInteraction = await response.awaitMessageComponent({
        filter: i => i.user.id === interaction.member?.user.id,
        time: timeout * 1000,
      });
      response.delete();
      return buttonInteraction.customId as ConfirmEmbedResponse;
    } catch {
      // awaitMessageComponent throws an error when the timeout was reached, so this behavior assumes
      // that no other errors were thrown
      response.edit({
        embeds: [
          this.errorEmbed(
            'No interaction was made by the timeout limit, cancelling.'
          ),
        ],
        components: [],
      });
      // delete the embed after 15 seconds
      setTimeout(() => {
        response.delete();
      }, 15_000);
      return ConfirmEmbedResponse.Denied;
    }
  },
};
