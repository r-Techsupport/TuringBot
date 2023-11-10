/**
 * @file
 * Modules:
 *  - {@link joke}
 * Description:
 *  Uses the joke api provided by arc to parse a response and send it as a discord embed
 */

import * as util from '../core/util.js';

const joke = new util.RootModule(
  'joke', // command name
  'Get a funny joke from the bot', // command description
  [], // dependencies
  [], // options

  async (args, interaction) => {
    fetchJoke()
      .then(joke => {
        util.replyToInteraction(interaction, {
          embeds: [util.embed.infoEmbed(`${joke}`)],
        });
      })
      .catch(error => {
        console.error('Error:', error);
      });
  }
);

async function fetchJoke(): Promise<string> {
    const apiUrl =
    'https://v2.jokeapi.dev/joke/Any?blacklistFlags=nsfw,religious,political,racist,sexist,explicit&type=single';

  try {
    const response = await fetch(apiUrl);
    1;
    if (response.ok) {
      const data = await response.json();
      return data.joke;
    } else {
      throw new Error(`Failed to fetch joke.`);
    }
  } catch (error) {
    console.error('Error fetching joke');
    throw error;
  }
}

export default joke;
