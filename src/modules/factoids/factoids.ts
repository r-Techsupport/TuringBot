/**
 * @file
 * This file contains the `factoid` module definition.
 */
import {Db, Filter, InsertOneResult} from 'mongodb';
import type {Collection} from 'mongodb';
import {request} from 'undici';

import * as util from '../../core/util.js';
import {
  Attachment,
  BaseMessageOptions,
  ChatInputCommandInteraction,
  Events,
  Message,
} from 'discord.js';
import {validateMessage} from './factoid_validation.js';

interface Factoid {
  /** The primary term used to refer to the factoid */
  name: string;
  /** Any alternative terms used to refer to the factoid */
  aliases: string[];
  /** Whether or not the factoid will show up in lists */
  hidden: boolean;
  /** The message you'd like to be sent when the factoid is triggered. While preferably an embed, this could be any valid form of message */
  message: BaseMessageOptions;
}
/** The name of the MongoDB collection where factoids should be stored */
const FACTOID_COLLECTION_NAME = 'factoids';
const factoid = new util.RootModule(
  'factoid',
  'Manage or fetch user generated messages',
  [util.mongo]
);
// TODO: implement an LRU factoid cache

factoid.onInitialize(async () => {
  // Defined outside so that they don't get redefined every time a message is sent
  const prefixes: string[] = factoid.config.prefixes;
  // listen for a message sent by any of a few prefixes
  // only register a listener if at least one prefix was specified
  if (prefixes.length === 0) {
    return;
  }

  util.client.on(Events.MessageCreate, async (message: Message<boolean>) => {
    // Anything that doesn't include the prefix or was sent by a bot gets excluded
    if (!prefixes.includes(message.content.charAt(0)) || message.author.bot) {
      return;
    }
    //remove the prefix, split by spaces, and query the DB
    const queryArguments: string[] = message.content.slice(1).split(' ');
    const queryResult = await getFactoid({
      name: queryArguments[0],
    });
    // no match found
    if (queryResult === null) {
      return;
    }
    // match found, send factoid
    await message.reply(queryResult.message).catch(err => {
      util.logEvent(
        util.EventCategory.Error,
        'factoid',
        `An error was encountered sending factoid: ${(err as Error).name}`,
        3
      );
    });
  });
});

/** Function to get a factoid by any set of filters
 * @param filter: The filter to use when calling the DB
 * @returns: The located factoid (null if not found)
 */
async function getFactoid(filter: Filter<Factoid>): Promise<Factoid | null> {
  const db: Db = util.mongo.fetchValue();
  const factoids: Collection<Factoid> = db.collection(FACTOID_COLLECTION_NAME);
  return await factoids.findOne(filter);
}

/** Function to delete a factoid by a filter
 * @param filter: The filter to use to get the factoid to delete
 * @returns: The number of factoids that got deleted
 */
async function deleteFactoid(filter: Filter<Factoid>): Promise<number> {
  const db: Db = util.mongo.fetchValue();
  const factoids: Collection<Factoid> = db.collection(FACTOID_COLLECTION_NAME);
  return (await factoids.deleteOne(filter)).deletedCount;
}

/** Function to add a factoid
 * @param factoid: The factoid to add
 * @returns: The result of the DB call
 */
async function addFactoid(factoid: Factoid): Promise<InsertOneResult<Factoid>> {
  const db: Db = util.mongo.fetchValue();
  const factoids: Collection<Factoid> = db.collection(FACTOID_COLLECTION_NAME);
  return await factoids.insertOne(factoid);
}

async function confirmDeletion(
  interaction: ChatInputCommandInteraction,
  factoidName: string
): Promise<boolean> {
  switch (
    await util.embed.confirmEmbed(
      `The factoid \`${factoidName}\` already exists! Overwrite it?`,
      interaction
    )
  ) {
    case util.ConfirmEmbedResponse.Denied: {
      await util.replyToInteraction(
        interaction,
        `The factoid \`${factoidName}\` was not overwritten`
      );
      return false;
    }

    case util.ConfirmEmbedResponse.Confirmed: {
      return true;
    }
  }
}

factoid.registerSubModule(
  new util.SubModule(
    'get',
    'Fetch a factoid from the database and return it',
    [
      {
        type: util.ModuleOptionType.String,
        name: 'factoid',
        description: 'The factoid to fetch',
        required: true,
      },
    ],
    async (args, interaction) => {
      const factoidName = args
        .find(arg => arg.name === 'factoid')!
        .value?.toString();

      const locatedFactoid = await getFactoid({name: factoidName});

      if (locatedFactoid === null) {
        return util.embed.errorEmbed(
          'Unable to located the factoid specified.'
        );
      }

      await util
        .replyToInteraction(interaction, locatedFactoid.message)
        .catch(err => {
          util.logEvent(
            util.EventCategory.Error,
            'factoid',
            `An error was encountered sending factoid: ${(err as Error).name}`,
            3
          );
        });
    }
  )
);

factoid.registerSubModule(
  new util.SubModule(
    'remember',
    'Register a new factoid',
    [
      {
        type: util.ModuleOptionType.String,
        name: 'name',
        description: 'The name of the factoid',
        required: true,
      },
      {
        type: util.ModuleOptionType.Attachment,
        name: 'factoid',
        description: 'A .json describing a valid factoid',
        required: true,
      },
    ],
    async (args, interaction) => {
      // Get the JSON
      const uploadedFactoid: Attachment = args.find(
        arg => arg.name === 'factoid'
      )!.attachment!;

      // fetch the first attachment, ignore the rest
      // non-null assertion: we've verified that there's at least one attachment

      const {body} = await request(uploadedFactoid.url);
      // the factoid as a string
      const serializedFactoid = await body.text();
      // then validate it
      let messageIssues: string[] = [];
      try {
        for (const issues of validateMessage(serializedFactoid)) {
          messageIssues = issues;
        }
      } catch (err) {
        messageIssues.push(
          `Factoid validation failed with error: ${(err as Error).name}`
        );
      }
      // if any errors were found with the factoid to remember, return early
      if (messageIssues.length > 0) {
        return util.embed.errorEmbed(
          `Unable to proceed, the following issues were found with the attached json :\n - ${messageIssues.join(
            '\n- '
          )}`
        );
      }
      // if no name was specified, return early
      if (args === undefined) {
        return util.embed.errorEmbed('Please specify a factoid name.');
      }

      const factoidName = args.find(arg => arg.name === 'name')!
        .value as string;

      // Makes sure the factoid doesn't exist already
      const locatedFactoid: Factoid | null = await getFactoid({
        name: factoidName,
      });

      // The factoid already exists
      if (locatedFactoid !== null) {
        // Deletion confirmation
        if (!(await confirmDeletion(interaction, factoidName))) {
          return;
        }

        // Delete the factoid
        const deletedFactoids: number = await deleteFactoid({
          name: factoidName,
        });

        // If nothing got deleted, something done broke
        if (deletedFactoids === 0) {
          return util.embed.errorEmbed(
            `Deletion failed, unable to find the factoid \`${factoidName}\``
          );
        }
      }
      // Defines the structure sent to the DB
      const factoid: Factoid = {
        name: factoidName,
        aliases: [],
        hidden: false,
        message: JSON.parse(serializedFactoid),
      };
      // strip all mentions from the factoid
      // https://discord.com/developers/docs/resources/channel#allowed-mentions-object
      factoid.message.allowedMentions = {
        parse: [],
      };
      // TODO: allow plain text factoids by taking everything after the argument

      await addFactoid(factoid).catch(err => {
        return util.embed.errorEmbed(
          `Database call failed with error ${(err as Error).name}`
        );
      });

      return util.embed.successEmbed(
        `Factoid \`${factoidName}\` was succesfully registered`
      );
    }
  )
);

factoid.registerSubModule(
  new util.SubModule(
    'forget',
    'Remove a factoid',
    [
      {
        type: util.ModuleOptionType.String,
        name: 'factoid',
        description: 'The factoid to forget',
        required: true,
      },
    ],
    async args => {
      const factoidName = args.find(arg => arg.name === 'factoid')!
        .value as string;
      const deletedFactoids: number = await deleteFactoid({
        name: factoidName,
      });

      if (deletedFactoids === 0) {
        return util.embed.errorEmbed(
          `Deletion failed, unable to find the factoid \`${factoidName}\``
        );
      } else {
        // if stuff was deleted, than we probably found the factoid, return success
        return util.embed.successEmbed(
          `Factoid \`${factoidName}\` successfully deleted`
        );
      }
    }
  )
);

factoid.registerSubModule(
  new util.SubModule(
    'json',
    'Fetch a factoids json config from the database and return it',
    [
      {
        type: util.ModuleOptionType.String,
        name: 'factoid',
        description: 'The factoid to fetch the json of',
        required: true,
      },
    ],
    async (args, interaction) => {
      const factoidName: string =
        (args.filter(arg => arg.name === 'factoid')[0].value as string) ?? '';

      // findOne returns null if it doesn't find the thing
      const locatedFactoid: Factoid | null = await getFactoid({
        name: factoidName,
      });
      if (locatedFactoid === null) {
        return util.embed.errorEmbed(
          `Couldn't find the factoid \`${factoidName}\``
        );
      }

      // Converts the JSON contents to a buffer so it can be sent as an attachment
      const serializedFactoid = JSON.stringify(locatedFactoid);
      const files = Buffer.from(serializedFactoid);

      await util
        .replyToInteraction(interaction, {
          files: [{attachment: files, name: 'factoid.json'}],
        })
        .catch(err => {
          util.logEvent(
            util.EventCategory.Error,
            'factoid',
            `An error was encountered sending factoid: ${(err as Error).name}`,
            3
          );
        });
    }
  )
);

factoid.registerSubModule(
  new util.SubModule('preview', 'Preview a factoid json without remembering it')
);
factoid.registerSubModule(
  new util.SubModule('all', 'Generate a list of all factoids as a webpage')
);

// NOTE: THE BELOW IS TEMPORARY AS A TEST
const ping = new util.SubModule('ping', 'ping the ping');
const pong = new util.SubModule('pong', 'pong the pong', [], async () => {
  console.log('hee hee');
});
factoid.registerSubModule(ping);
ping.registerSubmodule(pong);

export default factoid;
