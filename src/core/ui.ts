/**
 * @file
 * This file contains code for all ui related elements such as modals, response embeds and pagination.
 */

import {
  APIEmbed,
  ChatInputCommandInteraction,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ButtonInteraction,
  BaseMessageOptions,
  TextInputStyle,
  InteractionResponse,
  ButtonComponent,
  ModalActionRowComponentBuilder,
  RestOrArray,
  TextInputBuilder,
  ComponentType,
  ModalBuilder,
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

/**
 * A paginated message, implemented with a row of buttons that flip between various "pages"
 */
export class PaginatedMessage {
  /**
   * A list of sendable messages, where each item is a "page"
   */
  private readonly payloads: BaseMessageOptions[];

  /**
   * A one based index indicating which page is currently being displayed
   */
  private currentPage = 1;

  /**
   * whether or not the stop button was pressed. If true,
   * the pagination controls should be removed.
   */
  private stoppedManually = false;

  /**
   * Whether or not the message was deleted with the delete button. If true,
   * the message no longer exists
   */
  private deletedManually = false;

  /**
   * If set to true, the response will be deleted after the timeout
   */
  private deleteAfter: boolean;

  private readonly controlButtons = {
    previous: new ButtonBuilder()
      .setCustomId('prevButton')
      .setLabel('<')
      .setStyle(ButtonStyle.Primary),

    currentPageDisplay: new ButtonBuilder()
      .setCustomId('currentPage')
      .setDisabled(true)
      .setStyle(ButtonStyle.Secondary),

    next: new ButtonBuilder()
      .setCustomId('nextButton')
      .setLabel('>')
      .setStyle(ButtonStyle.Primary),

    stop: new ButtonBuilder()
      .setCustomId('stopButton')
      .setLabel('🛑')
      .setStyle(ButtonStyle.Danger),

    trash: new ButtonBuilder()
      .setCustomId('trashButton')
      .setLabel('🗑️')
      .setStyle(ButtonStyle.Danger),
  };
  /**
   * Called when instantiating a new instance of {@link PaginatedMessage}, this will respond to
   * the provided interaction with the first payload, and the pagination controls. The pagination controls
   * will auto-hide after `time`
   *
   * **The interaction will be replied to when the constructor is called, no further work is necessary**
   * @param interaction The interaction to reply to
   * @param payloads An array of {@link BaseMessageOptions}, each one a "page" to flip between
   * @param timeout After this time, pagination controls will auto-hide. Defaults to 60 seconds.
   * @param deleteAfter If true, the response will be deleted after the timeout. Defaults to false.
   */
  constructor(
    interaction: ChatInputCommandInteraction,
    payloads: BaseMessageOptions[],
    timeout = 60,
    deleteAfter = false
  ) {
    this.payloads = payloads;
    this.deleteAfter = deleteAfter;
    // Initial reply, sends the first payload.
    this.replyAndRegisterListener(interaction, timeout);
  }

  /**
   * Create an action row containing all of the pagination buttons (left, right, back, etc),
   * for the currently displayed payload.
   * */
  private generateControlRow() {
    // If the current page is the first one, disable the back button
    let prevButtonDisabled = false;
    if (this.currentPage === 1) {
      prevButtonDisabled = true;
    }

    // If the current page is the last one, disable the forward button
    let nextButtonDisabled = false;
    if (this.payloads.length === this.currentPage) {
      nextButtonDisabled = true;
    }

    const row: ActionRowBuilder = new ActionRowBuilder().addComponents(
      this.controlButtons.previous.setDisabled(prevButtonDisabled),
      this.controlButtons.currentPageDisplay.setLabel(
        `${this.currentPage}/${this.payloads.length}`
      ),
      this.controlButtons.next.setDisabled(nextButtonDisabled),
      this.controlButtons.stop,
      this.controlButtons.trash
    );

    return row;
  }

  /**
   * Take the {@link currentPage}, add a control row to it, and return the newly
   * generated page, complete with controls
   */
  private renderCurrentPage(): BaseMessageOptions {
    // Makes a structured clone (deep copy) of the payload so it can be modified without modifying the
    // actual entry, since JavaScript works by reference not value.
    const payload: BaseMessageOptions = structuredClone(
      this.payloads[this.currentPage - 1]
    );
    const paginationRow: ActionRowBuilder<ButtonBuilder> =
      this.generateControlRow() as ActionRowBuilder<ButtonBuilder>;

    // If payloads is null or empty, someone provided incorrect arguments to this class, return early
    if (this.payloads === null || this.payloads.length === 0) {
      return {
        embeds: [
          embed.errorEmbed(
            'Pagination error: No payloads were provided to paginate'
          ),
        ],
      };
    }

    // If there isn't a pagination row to append and the old components don't exist, set components to an empty array
    // This is handled because the final .editReply() would keep the old components,
    // the component attribute has to be set to edit the response properly.
    // Returns early, no further component management is needed.
    if (paginationRow === null && payload.components === undefined) {
      payload.components = [];
      return payload;
    }

    // If it is null but there weren't existing action rows, something went wrong with pagination as this isn't supposed to happen.
    if (paginationRow === null) {
      // Returns an error in place of the actual payload
      return {
        embeds: [
          embed.errorEmbed(
            'Pagination error: The pagination row is null, payload preparation failed'
          ),
        ],
      };
    }

    // If there ARE existing payload components, append the pagination control row.
    if (payload.components !== undefined) {
      payload.components.push(paginationRow);
    }
    // If there are NOT any existing payload components, set the attribute to the control row.
    // Has to be done like this since the attribute is undefined prior to this assignment.
    else {
      payload.components = [paginationRow];
    }

    return payload;
  }

  /**
   * Respond to the provided interaction with the first page, and create an event listener
   * @param interaction The interaction to reply to
   * @param timeout The amount of time in seconds before the listener stops and the pagination buttons
   * are removed.
   * @param deleteAfter If set to true, the response will be deleted after the timout
   */
  private async replyAndRegisterListener(
    interaction: ChatInputCommandInteraction,
    timeout: number
  ) {
    let payload = this.renderCurrentPage();
    let botResponse = await replyToInteraction(interaction, payload);

    // Sets up a listener to listen for control button pushes
    const continueButtonListener = botResponse.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: i => interaction.user.id === i.user.id,
      time: timeout * 1000,
    });

    // Executed every time a button is pressed
    continueButtonListener.on(
      'collect',
      async (buttonInteraction: ButtonInteraction) => {
        if (buttonInteraction.component instanceof ButtonComponent) {
          switch (buttonInteraction.component.customId) {
            case 'prevButton':
              await buttonInteraction.deferUpdate();
              this.currentPage--;

              payload = this.renderCurrentPage();
              botResponse = await interaction.editReply(payload);

              break;

            case 'nextButton':
              await buttonInteraction.deferUpdate();
              this.currentPage++;

              payload = this.renderCurrentPage();
              botResponse = await interaction.editReply(payload);

              break;

            case 'stopButton':
              await buttonInteraction.deferUpdate();

              this.stoppedManually = true;
              // buttons are removed when the listener ends
              continueButtonListener.stop();
              return;

            case 'trashButton':
              await buttonInteraction.deferUpdate();

              this.deletedManually = true;
              await interaction.deleteReply();

              continueButtonListener.stop();
              return;
          }
        }
      }
    );

    // Executed when the collector is stopped or times out.
    continueButtonListener.on('end', async () => {
      // If payloads is null or empty, someone provided incorrect arguments, return early
      if (this.payloads === null || this.payloads.length === 0) {
        return;
      }

      // If the interaction is supposed to be deleted afterwards and wasn't stopped manually, delete it
      if (this.deleteAfter && !this.stoppedManually) {
        await interaction.deleteReply();
      }
      // Otherwise just remove the buttons
      else if (!this.deletedManually) {
        const payload = this.payloads[this.currentPage - 1];
        // editreply won't remove components unless they're explicitly redefined in the reply
        if (payload.components === undefined) {
          payload.components = [];
        }
        await interaction.editReply(payload);
      }
    });
  }
}

/**
 * A single input field of a modal
 */
interface InputFieldOptions {
  /** The ID to refer to the input field as */
  id: string;
  /** The lavel of the input field */
  label: string;
  /** The style to use (Short/Paragraph) */
  style: TextInputStyle;
  /** The maximum length of the input */
  maxLength: number;
}

/**
 * The modal generation options
 */
interface ModalOptions {
  /** The ID to refer to the modal as */
  id: string;
  /** The title of the modal */
  title: string;
  /** The fields of the modal */
  fields: InputFieldOptions[];
}

/**
 * Generates a modal from args
 * Takes a {@link inputFieldOptions} object as an argument
 * @returns The finished modal object
 */
export function generateModal({id, title, fields}: ModalOptions): ModalBuilder {
  const modal: ModalBuilder = new ModalBuilder()
    .setCustomId(id)
    .setTitle(title);

  const components: RestOrArray<ActionRowBuilder<TextInputBuilder>> = [];

  // Adds all components to the modal
  for (const field of fields) {
    const modalComponent: TextInputBuilder = new TextInputBuilder()
      .setCustomId(field.id)
      .setLabel(field.label)
      .setStyle(field.style)
      .setMaxLength(field.maxLength);

    const actionRow =
      new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
        modalComponent
      );
    components.push(actionRow);
  }
  modal.addComponents(components);

  return modal;
}
