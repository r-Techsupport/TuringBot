/**
 * @file
 * Modules:
 *  - {@link joke}
 * Description:
 *  Uses the joke api provided by arc to parse a response and send it as a discord embed
 * @throws will throw an error if the api call fails
 */

import * as util from '../core/util.js';
import {botConfig} from '../core/config.js';

// Config manager for nsfw detection
const jokeConfig = botConfig.modules.joke;
let jokeApiUrl = 'https://v2.jokeapi.dev/joke/Any';
const blacklistFlags = [
  'religious',
  'political',
  'racist',
  'sexist',
  'explicit',
];
if (!jokeConfig.nsfw) {
  blacklistFlags.push('nsfw');
}
jokeApiUrl += `?blacklistFlags=${blacklistFlags.join(',')}&type=single'}`;

const joke = new util.RootModule(
  'joke',
  'Get a funny joke from the bot',
  [],
  [],

  async (args, interaction) => {
    util.replyToInteraction(interaction, {
      embeds: [util.embed.infoEmbed(await fetchJoke())],
    });
  }
);

async function fetchJoke(): Promise<string> {
  try {
    const response = await fetch(jokeApiUrl);
    if (response.ok) {
      const data = await response.json();
      return data.joke;
    } else {
      throw new Error('Failed to fetch joke');
    }
  } catch (error) {
    throw new Error('Failed to fetch joke');
  }
}

export default joke;