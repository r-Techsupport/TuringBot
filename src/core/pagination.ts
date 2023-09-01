/**
 *@file This file contains the code to send a paginated array of payloads.
 */

import {
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ComponentType,
  ButtonInteraction,
  ButtonComponent,
  ButtonBuilder,
  ButtonStyle,
  BaseMessageOptions,
} from 'discord.js';
import * as util from '../core/util.js';

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
          util.embed.errorEmbed(
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
          util.embed.errorEmbed(
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
    let botResponse = await util.replyToInteraction(interaction, payload);

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
