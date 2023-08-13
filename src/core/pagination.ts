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

let currentPage = 1;
let stoppedManually = false;

const prevButton: ButtonBuilder = new ButtonBuilder()
  .setCustomId('prevButton')
  .setLabel('<')
  .setStyle(ButtonStyle.Primary);

const currentPageComponent: ButtonBuilder = new ButtonBuilder()
  .setCustomId('currentPage')
  .setDisabled(true)
  .setStyle(ButtonStyle.Secondary);

const nextButton: ButtonBuilder = new ButtonBuilder()
  .setCustomId('nextButton')
  .setLabel('>')
  .setStyle(ButtonStyle.Primary);

const stopButton: ButtonBuilder = new ButtonBuilder()
  .setCustomId('stopButton')
  .setLabel('🛑')
  .setStyle(ButtonStyle.Danger);

const trashButton: ButtonBuilder = new ButtonBuilder()
  .setCustomId('trashButton')
  .setLabel('🗑️')
  .setStyle(ButtonStyle.Danger);

/**
 * Function to get the pagination action row with buttons set up properly
 * @param payloads The payloads used, used to make sure the arrows are disabled properly
 * @returns The configured action row
 */
function getRow(payloads: BaseMessageOptions[]): ActionRowBuilder {
  // If the current page is the first one, disable the back button
  let prevButtonDisabled = false;
  if (currentPage === 1) {
    prevButtonDisabled = true;
  }

  // If the current page is the last one, disable the forward button
  let nextButtonDisabled = false;
  if (payloads.length === currentPage) {
    nextButtonDisabled = true;
  }

  const row: ActionRowBuilder = new ActionRowBuilder().addComponents(
    prevButton.setDisabled(prevButtonDisabled),
    currentPageComponent.setLabel(`${currentPage}/${payloads.length}`),
    nextButton.setDisabled(nextButtonDisabled),
    stopButton,
    trashButton
  );

  return row;
}

/**
 * Function to get the payload with action rows
 * @param payloads The payloads to be paginated
 * @param paginationRow The pagination action row containing the components. Set to any because typescript doesn't recognize ActionRowBuilder as a valid object.
 * @returns The message payload to sent
 */
function getPayload(
  payloads: BaseMessageOptions[],
  paginationRow: any = null
): BaseMessageOptions {
  // Makes a structured clone (deep copy) of the payload so it can be modified without modifying the
  // actual entry, since JavaScript works by reference not value.
  const payload: BaseMessageOptions = structuredClone(
    payloads[currentPage - 1]
  );

  // If there isn't a pagination row and the old components don't exist, set components to an empty array
  // This is the case because the final .editReply() would keep the old components,
  // the component attribute has to be set to edit the response properly.
  // Returns early, no further component management is needed.
  if (paginationRow === null && payload.components === undefined) {
    payload.components = [];
    return payload;
  }

  if (paginationRow === null) {
    return {
      embeds: [
        util.embed.errorEmbed(
          'Pagination error: The pagination row is null, payload preparation failed'
        ),
      ],
    };
  }

  // If there ARE existing payload components, append the pagination action row.
  if (payload.components !== undefined) {
    payload.components.push(paginationRow);
  }
  // If there are NOT any existing payload components, set the pagination action row to be the whole array.
  // Has to be done like this since the attribute is undefined prior to this assignment.
  else {
    payload.components = [paginationRow];
  }

  return payload;
}

/**
 * Function to paginate a set of payloads that times out after a given time.
 * @param interaction The interaction to respond to
 * @param payloads An array of message payloads to send
 * @param time The time in seconds to time out after
 * @param deleteAfter Whether to delete the message after it times out
 */
async function paginate(
  interaction: ChatInputCommandInteraction,
  payloads: BaseMessageOptions[],
  time: number,
  deleteAfter: boolean
) {
  // Initial reply, sends the first payload.
  let payload = getPayload(payloads, getRow(payloads));
  let botResponse = await util.replyToInteraction(interaction, payload);

  // Sets up a listener to listen for button pushes
  const continueButtonListener = botResponse.createMessageComponentCollector({
    componentType: ComponentType.Button,
    filter: i => interaction.user.id === i.user.id,
    time: time * 1000,
  });

  // Executed every time a button is pushed
  continueButtonListener.on(
    'collect',
    async (buttonInteraction: ButtonInteraction) => {
      if (buttonInteraction.component instanceof ButtonComponent) {
        switch (buttonInteraction.component.customId) {
          case 'prevButton': {
            await buttonInteraction.deferUpdate();
            currentPage--;

            // Prepares the payload to send and sends it
            payload = getPayload(payloads, getRow(payloads));
            botResponse = await interaction.editReply(payload);

            break;
          }
          case 'nextButton': {
            await buttonInteraction.deferUpdate();
            currentPage++;

            // Prepares the payload to send and sends it
            payload = getPayload(payloads, getRow(payloads));
            botResponse = await interaction.editReply(payload);

            break;
          }
          case 'stopButton': {
            await buttonInteraction.deferUpdate();

            stoppedManually = true;
            continueButtonListener.stop();
            return;
          }
          case 'trashButton': {
            await buttonInteraction.deferUpdate();

            await interaction.deleteReply();

            continueButtonListener.stop();
            return;
          }
        }
      }
    }
  );

  // Executed when the collector is stopped or times out.
  continueButtonListener.on('end', async () => {
    // If the interaction is supposed to be deleted afterwards and wasn't stopped manually, delete it
    if (!stoppedManually && deleteAfter) {
      await interaction.deleteReply();
    }
    // Otherwise just remove the buttons
    else {
      const payload = await getPayload(payloads);
      await interaction.editReply(payload);
    }
    // Resets the page counter for further uses
    currentPage = 1;
    // Resets the manual stop marker as well
    stoppedManually = false;
  });
}

/**
 * Function to paginate an array of message payloads with a variable timeout
 * @param interaction The interaction to respond to
 * @param payloads An array of message payloads to paginate
 * @param time The time in seconds to time out after
 * @param deleteAfter Whether to delete the message after it times out
 */
export async function paginatePayloads(
  interaction: ChatInputCommandInteraction,
  payloads: BaseMessageOptions[],
  time: number,
  deleteAfter: boolean
): Promise<void> {
  if (payloads.length === 0) {
    console.log('No embeds were supplied to the pagination function!');
    return;
  }

  // Makes sure that the 5x5 grid isn't filled so the pagination controls can be added
  for (const payload of payloads) {
    if (payload.components !== undefined && payload.components.length > 5) {
      console.log('A payload has more than 5 action rows, unable to paginate!');
      return;
    }
  }

  await paginate(interaction, payloads, time, deleteAfter);
  return;
}
