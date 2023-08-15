/**
 * @file
 * Modules:
 *  - {@link googleModule}
 *  - Submodules: Search, image
 *  - {@link youtube}
 */

import {APIEmbed, BaseMessageOptions, Colors} from 'discord.js';
import * as util from '../core/util.js';
import {google} from 'googleapis';

// The search engines used, both of these need their respective APIs to be enabled
const customSearch = google.customsearch('v1'); // 100/day limit
const youtubeSearch = google.youtube('v3'); // 10k/day limit

const GOOGLE_ICON_URL =
  'https://cdn.icon-icons.com/icons2/673/PNG/512/Google_icon-icons.com_60497.png';

/** The root Google module definition */
const googleModule = new util.RootModule(
  'google',
  'Manages google commands',
  []
);

googleModule.registerSubModule(
  new util.SubModule(
    'search',
    'Searches google and returns the first 10 results',
    [
      {
        type: util.ModuleOptionType.String,
        name: 'query',
        description: 'The search query',
        required: true,
      },
    ],
    async (args, interaction) => {
      // Key checks
      const API_KEY: string | undefined = googleModule.config.ApiKey;
      const CSE_ID: string | undefined = googleModule.config.CseId;

      if (
        [undefined, ''].includes(API_KEY) ||
        [undefined, ''].includes(CSE_ID)
      ) {
        util.logEvent(
          util.EventCategory.Warning,
          'google',
          'Config error: The API key / CSE id is not set!',
          1
        );

        return util.embed.errorEmbed(
          'Config error: The API key / CSE id is not set!'
        );
      }

      const query: string = args
        .find(arg => arg.name === 'query')!
        .value!.toString();

      const results = await customSearch.cse.list({
        cx: CSE_ID,
        q: query,
        auth: API_KEY,
      });

      // Creates payloads for pagination
      const payloads: BaseMessageOptions[] = [];

      for (const resultIndex in results.data.items) {
        const result = results.data.items[parseInt(resultIndex)];

        const embed: APIEmbed = util.embed.manualEmbed({
          color: Colors.Blurple,
          thumbnail: GOOGLE_ICON_URL,
          title: `Results for ${query}`,
          description: `${result.link!}\n${result.snippet!}`,
        });

        payloads.push({embeds: [embed]});
      }

      await util.paginatePayloads(interaction, payloads, 60, false);
    }
  )
);

/** The root conch command definition */
googleModule.registerSubModule(
  new util.SubModule(
    'image',
    'Searches google for images and returns the first 10 results',
    [
      {
        type: util.ModuleOptionType.String,
        name: 'query',
        description: 'The search query',
        required: true,
      },
    ],
    async (args, interaction) => {
      // Key checks
      const API_KEY: string | undefined = googleModule.config.ApiKey;
      const CSE_ID: string | undefined = googleModule.config.CseId;

      if (
        [undefined, ''].includes(API_KEY) ||
        [undefined, ''].includes(CSE_ID)
      ) {
        util.logEvent(
          util.EventCategory.Warning,
          'google',
          'Config error: The API key / CSE id is not set!',
          1
        );
        return util.embed.errorEmbed(
          'Config error: The API key / CSE id is not set!'
        );
      }

      const query: string = args
        .find(arg => arg.name === 'query')!
        .value!.toString();

      const results = await customSearch.cse.list({
        cx: CSE_ID,
        q: query,
        auth: API_KEY,
        searchType: 'image',
      });

      // Creates payloads for pagination
      const payloads: BaseMessageOptions[] = [];

      for (const resultIndex in results.data.items) {
        const result = results.data.items[parseInt(resultIndex)];

        payloads.push({content: result.link!});
      }

      await util.paginatePayloads(interaction, payloads, 60, false);
    }
  )
);

/** The root Youtube module definition */
const youtube = new util.RootModule(
  'youtube',
  'Searches youtube videos based on a query',
  [],
  [
    {
      type: util.ModuleOptionType.String,
      name: 'query',
      description: 'The search query',
      required: true,
    },
  ],
  async (args, interaction) => {
    const API_KEY: string | undefined = googleModule.config.ApiKey;

    if ([undefined, ''].includes(API_KEY)) {
      util.logEvent(
        util.EventCategory.Warning,
        'google',
        'Config error: The API key is not set!',
        1
      );
      return util.embed.errorEmbed(
        'Config error: The Google API key is not set!'
      );
    }

    const query: string = args
      .find(arg => arg.name === 'query')!
      .value!.toString();

    const results = await youtubeSearch.search.list({
      part: ['snippet'],
      q: query,
      auth: API_KEY,
    });

    // Creates payloads for pagination
    const payloads: BaseMessageOptions[] = [];

    for (const resultIndex in results.data.items) {
      const result = results.data.items[parseInt(resultIndex)];

      payloads.push({content: `https://youtu.be/${result.id!.videoId}`});
    }

    await util.paginatePayloads(interaction, payloads, 60, false);
  }
);

export default [googleModule, youtube];
