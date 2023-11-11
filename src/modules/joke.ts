/**
 * @file
 * Modules:
 *  - {@link joke}
 * Description:
 *  Uses the joke api provided by arc to parse a response and send it as a discord embed
 */

import * as util from '../core/util.js';
import {botConfig} from '../core/config.js';

// Config manager for nsfw detection
const jokeConfig = botConfig.modules.joke;
let JOKE_API_URL = '';
if (jokeConfig.nsfw) {
  JOKE_API_URL =
    'https://v2.jokeapi.dev/joke/Any?blacklistFlags=religious,political,racist,sexist,explicit&type=single';
} else {
  JOKE_API_URL =
    'https://v2.jokeapi.dev/joke/Any?blacklistFlags=nsfw,religious,political,racist,sexist,explicit&type=single';
}

console.log(jokeConfig.nsfw);

const joke = new util.RootModule(
  'joke', // command name
  'Get a funny joke from the bot', // command description
  [], // dependencies
  [], // options

  async (args, interaction) => {
    fetchJoke()
      .then(joke => {
        if (joke == 'Failed to find joke') {
          util.replyToInteraction(interaction, {
            embeds: [util.embed.errorEmbed(`${joke}`)],
          });
        } else {
          util.replyToInteraction(interaction, {
            embeds: [util.embed.infoEmbed(`${joke}`)],
          });
        }
      })
      .catch(error => {
        util.replyToInteraction(interaction, {
          embeds: [util.embed.errorEmbed(`${joke}`)],
        });
      });
  }
);

async function fetchJoke(): Promise<string> {
  try {
    const response = await fetch(JOKE_API_URL);
    if (response.ok) {
      const data = await response.json();
      return data.joke;
    } else {
      return 'Failed to find joke';
    }
  } catch (error) {
    return 'Failed to find joke';
  }
}

export default joke;
