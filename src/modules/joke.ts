/**
 * @file
 * Modules:
 *  - {@link joke}
 *  - Submodules: TODO:
 *
 *  - {@link joke}
 */

import * as util from '../core/util.js';

const joke = new util.RootModule(
  'joke', // command name
  'Get a funny joke from the bot', // command description
  [], // dependencies
  [], // options

  async (args, interaction) => {
    const username = interaction.user.username;
    util.replyToInteraction(interaction, {
      embeds: [
        util.embed.infoEmbed(
          `I have a fish that can breakdance! Only for 20 seconds though, and only once. ${username}!`
        ),
      ],
    });
  }
);

export default joke;
