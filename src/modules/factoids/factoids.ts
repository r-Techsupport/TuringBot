/**
 * @file
 * This file contains the `factoid` module definition.
 */
import {ObjectId} from 'mongodb';
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
  // The ID used as a primary reference for factoids
  _id: string;
  // The triggers (names) for this factoid
  triggers: string[];
  /** Whether or not the factoid will show up in lists */
  hidden: boolean;
  /** The message you'd like to be sent when the factoid is triggered. While preferably an embed, this could be any valid form of message */
  message: BaseMessageOptions;
}

/**
 * A write through LRU factoid cache that stores the most recently used factoids in memory.
 * This should only be used in checked environments, where it's asserted that a valid mongodb
 * connection has been made.
 *
 * https://medium.com/sparkles-blog/a-simple-lru-cache-in-typescript-cba0d9807c40
 */
class FactoidCache {
  /** A Map containing the most recent  */
  private cache: Map<string, Factoid> = new Map<string, Factoid>();

  /**
   * The maximum size that this cache will grow to before evicting stale factoids
   */
  private maxSize = 30;

  /** A reference to the mongo factoid {@link Collection} */
  factoidCollection: Collection<Factoid> = util.mongo
    .fetchValue()
    .collection(FACTOID_COLLECTION_NAME);

  /**
   * Fetch an item from the cache, retrieving it from the DB if it's not already stored in the cache.
   * Will return `null` if no factoids were found
   * @param key A factoid trigger
   */
  async get(key: string): Promise<Readonly<Factoid> | null> {
    /** Returns the factoid if it is in the cache, otherwise returns null */
    let factoidReference: string | null = null;

    // Searches by the trigger
    for (const [id, factoid] of this.cache) {
      if (factoid.triggers.includes(key)) {
        factoidReference = id;
        break;
      }
    }

    // a reference to the value used for re-insertion
    let entry: Factoid;
    // return the value in mem if it's in mem
    if (factoidReference !== null) {
      // non null assertion(s). It's proven that the value
      // is not null with the above if statement

      // re-insert the factoid to mark it as
      // 'used most recently'
      entry = this.cache.get(factoidReference)!;
      this.cache.delete(factoidReference);
      this.cache.set(factoidReference, entry);
      return this.cache.get(factoidReference)! as Readonly<Factoid>;
    }

    // this query checks to see if the key matches a trigger
    // https://www.mongodb.com/docs/manual/tutorial/query-arrays/#query-an-array-for-an-element
    // apparently that's how you query an array for one item
    const dbResult: Factoid | null = await this.factoidCollection.findOne({
      triggers: key,
    });

    // The factoid was not found
    if (dbResult === null) {
      return null;
    }

    // If the cache is at the maximum size, evict the
    // least recently used item in the cache
    if (this.cache.size === this.maxSize) {
      // evict the oldest item in the cache to make room for the found item
      // next will return the item with the oldest insertion
      const keyToRemove = this.cache.keys().next().value;
      this.cache.delete(keyToRemove);
    }

    // add the item to the cache, and then return the value
    this.cache.set(dbResult._id, dbResult);
    return dbResult;
  }

  /**
   * Add an item to the database, overwrite it if it exists already
   */
  async set(factoid: Factoid) {
    // overwrite the value in cache if it's set
    if (this.cache.has(factoid._id)) {
      this.cache.delete(factoid._id);
      this.cache.set(factoid._id, factoid);
    }

    // If the factoid already exists in the db, delete it
    const dbResult: Factoid | null = await this.factoidCollection.findOne({
      _id: factoid._id,
    });
    if (dbResult !== null) {
      await this.delete(dbResult);
    }

    // Finally, write the factoid to the db
    await this.factoidCollection.insertOne(factoid);
  }

  /**
   * Remove an item from the database and clear it from the cache, if necessary
   * @param factoid: The factoid to remove
   * @returns whether or not the provided factoid was removed
   */
  async delete(factoid: Factoid): Promise<boolean> {
    /** If the factoid is in the cache,
     * this is the name of that factoid. If it's not, this is `null`.
     */
    let factoidReference: string | null = null;
    // search by name
    if (this.cache.has(factoid._id)) {
      factoidReference = factoid._id;
    }

    // removing from cache, if it exists.
    if (factoidReference !== null) {
      this.cache.delete(factoidReference);
    }

    // Removes the factoid from the db by its id
    // https://www.mongodb.com/docs/manual/tutorial/query-arrays/#query-an-array-for-an-element
    // apparently that's how you query an array for one item
    const deletionResult = await this.factoidCollection.deleteOne({
      _id: factoid._id,
    });
    // return true or false depending on whether or not a factoid was deleted
    if (deletionResult.deletedCount === 1) {
      // The factoid was succesfully deleted
      return true;
    }
    // Nothing got deleted
    return false;
  }
}

/** The name of the MongoDB collection where factoids should be stored */
const FACTOID_COLLECTION_NAME = 'factoids';
/** The root factoid command group */
const factoid = new util.RootModule(
  'factoid',
  'Manage or fetch user generated messages',
  [util.mongo]
);

/** A caching layer that sits between the program and mongodb */
// this is set in the init function because it requires dependencies
let factoidCache: FactoidCache | undefined;

factoid.onInitialize(async () => {
  factoidCache = new FactoidCache();
  // Defined outside the event listener so that they don't get redefined every time a message is sent
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
    // Remove the prefix, split by spaces, and query the DB
    const queryArguments: string[] = message.content.slice(1).split(' ');
    const queryResult = await factoidCache!.get(queryArguments[0]);
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

/**
 * @param interaction The interaction to send the confirmation to
 * @param factoidName The factoid name to confirm the deletion of
 * @param formatting The formatting to use for the question
 */
async function confirmDeletion(
  interaction: ChatInputCommandInteraction,
  factoidName: string,
  formatting: string
): Promise<boolean> {
  switch (
    await util.embed.confirmEmbed(
      `The factoid \`${factoidName}\` already exists! Do you want to ${formatting} it?`,
      interaction
    )
  ) {
    case util.ConfirmEmbedResponse.Denied:
      return false;

    case util.ConfirmEmbedResponse.Confirmed:
      return true;
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
      const factoidName: string = args
        .find(arg => arg.name === 'factoid')!
        .value!.toString()!;

      // Gets the factoid
      const locatedFactoid: Factoid | null = await factoidCache!.get(
        factoidName!
      );

      if (locatedFactoid === null) {
        return util.embed.errorEmbed(
          'Unable to located the factoid specified.'
        );
      }

      // Sends the matched factoid
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
        name: 'embed',
        description: 'A .json describing a valid factoid embed',
        required: true,
      },
    ],
    async (args, interaction) => {
      const factoidName = args.find(arg => arg.name === 'name')!
        .value as string;

      // Makes sure the factoid doesn't exist already
      const locatedFactoid: Factoid | null = await factoidCache!.get(
        factoidName
      );
      let triggers: string[] = [factoidName];

      // The factoid already exists
      if (locatedFactoid !== null) {
        triggers = locatedFactoid.triggers;
        // Deletion confirmation
        if (!(await confirmDeletion(interaction, factoidName, 'overwrite'))) {
          await util.replyToInteraction(interaction, {
            embeds: [
              util.embed.infoEmbed(
                `The factoid \`${factoidName}\` was not overwritten`
              ),
            ],
          });
          return;
          // Doesn't have to delete it here, because .set() overwrites the entry
        }
      }

      // fetch the first attachment, ignore the rest
      const uploadedFactoid: Attachment = args.find(
        arg => arg.name === 'embed'
      )!.attachment!;

      const {body} = await request(uploadedFactoid.url);
      // The embed json as a string
      let serializedFactoid: string = await body.text();

      // JSON is parsed to make sure the contents are valid
      for (const key in JSON.parse(serializedFactoid)) {
        if (['embeds', 'contents', 'files'].includes(key)) {
          continue;
        }

        // Invalid argument, assume this is a legacy r/TS formatted json

        await util.replyToInteraction(interaction, {
          embeds: [
            util.embed.infoEmbed(
              `Warning: The provided JSON has an invalid key \`${key}\`, forcing legacy format (This is temporary, please use the new one)`
            ),
          ],
        });
        serializedFactoid = `{ "embeds" : [${serializedFactoid}]}`;
        break;
      }

      // Validate the JSON
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
      // if any errors were found with the factoid embed return early
      if (messageIssues.length > 0) {
        return util.embed.errorEmbed(
          `Unable to proceed, the following issues were found with the attached json :\n - ${messageIssues.join(
            '\n- '
          )}`
        );
      }

      // Defines the structure sent to the DB
      const factoid: Factoid = {
        _id: new ObjectId().toHexString(),
        triggers: triggers,
        hidden: false,
        message: JSON.parse(serializedFactoid),
      };
      // strip all mentions from the factoid
      // https://discord.com/developers/docs/resources/channel#allowed-mentions-object
      factoid.message.allowedMentions = {
        parse: [],
      };
      // TODO: allow plain text factoids by taking everything after the argument

      await factoidCache!.set(factoid).catch(err => {
        return util.embed.errorEmbed(
          `Database call failed with error ${(err as Error).name}`
        );
      });

      return util.embed.successEmbed(
        `Factoid \`${factoidName}\` was successfully registered`
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
    async (args, interaction) => {
      const factoidName = args.find(arg => arg.name === 'factoid')!
        .value as string;

      // Makes sure the factoid exists
      const locatedFactoid = await factoidCache!.get(factoidName);

      if (locatedFactoid === null) {
        return util.embed.errorEmbed(
          `Unable to find the factoid \`${factoidName}\``
        );
      }

      if (!(await confirmDeletion(interaction, factoidName, 'delete'))) {
        await util.replyToInteraction(interaction, {
          embeds: [
            util.embed.infoEmbed(
              `The factoid \`${factoidName}\` was not deleted`
            ),
          ],
        });
        return;
      }

      await factoidCache!.delete(locatedFactoid);

      return util.embed.successEmbed(
        `Factoid \`${factoidName}\` successfully deleted`
      );
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
      const factoidName: string = args.find(arg => arg.name === 'factoid')!
        .value as string;

      // Makes sure the factoid exists
      const locatedFactoid: Factoid | null = await factoidCache!.get(
        factoidName
      );
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

/** The trigger modification subcommand group */
const trigger = new util.SubModule('trigger', 'Manage factoid triggers');

trigger.registerSubmodule(
  new util.SubModule(
    'add',
    'Add an alternate way to call a factoid',
    [
      {
        type: util.ModuleOptionType.String,
        name: 'factoid',
        description: 'The factoid to add the trigger to',
        required: true,
      },
      {
        type: util.ModuleOptionType.String,
        name: 'trigger',
        description: 'The trigger to add to the group',
        required: true,
      },
    ],
    async (args, interaction) => {
      const factoidName = args[0].options!.find(arg => arg.name === 'factoid')!
        .value as string;

      const triggerName = args[0].options!.find(arg => arg.name === 'trigger')!
        .value as string;

      // - Checks -
      if (factoidName === triggerName) {
        return util.embed.errorEmbed('Cannot add a trigger for itself!');
      }

      // Makes sure the factoid exists
      const locatedFactoid: Factoid | null = await factoidCache!.get(
        factoidName
      );

      if (locatedFactoid === null) {
        return util.embed.errorEmbed(
          `Couldn't find the factoid \`${factoidName}\``
        );
      }

      if (locatedFactoid.triggers.includes(triggerName)) {
        return util.embed.errorEmbed(
          `The factoid \`${factoidName}\` already has \`${triggerName}\` as a trigger!`
        );
      }

      // Makes sure the alias entry doesn't exist already
      const triggerEntry: Factoid | null = await factoidCache!.get(triggerName);

      // Handling if the alias entry already exists
      if (triggerEntry !== null) {
        // It shouldn't be deleted, return early
        if (!(await confirmDeletion(interaction, triggerName, 'replace'))) {
          await util.replyToInteraction(interaction, {
            embeds: [
              util.embed.infoEmbed(
                `The factoid \`${triggerName}\` was not replaced`
              ),
            ],
          });
          return;
        }

        // If there is no trigger left after deleting the target one, just delete the factoid

        if (triggerEntry.triggers.length === 1) {
          await factoidCache!.delete(triggerEntry);
        }
        // There is a trigger left after deleting the target trigger
        else {
          // Removes the target trigger from the triggerEntry
          triggerEntry.triggers.pop()!;

          await factoidCache!.set(triggerEntry);
        }
      }

      // Finally push the modified factoid to the DB
      locatedFactoid.triggers.push(triggerName);

      await factoidCache!.set(locatedFactoid).catch(err => {
        return util.embed.errorEmbed(
          `Database call failed with error ${(err as Error).name}`
        );
      });

      return util.embed.successEmbed(
        `\`${triggerName}\` was succesfully added as a trigger for \`${factoidName}\``
      );
    }
  )
);

trigger.registerSubmodule(
  new util.SubModule(
    'remove',
    'Remove a factoid trigger',
    [
      {
        type: util.ModuleOptionType.String,
        name: 'trigger',
        description: 'The trigger to remove',
        required: true,
      },
    ],
    async args => {
      const trigger = args[0].options!.find(arg => arg.name === 'trigger')!
        .value as string;

      // Makes sure the factoid exists
      const locatedFactoid: Factoid | null = await factoidCache!.get(trigger);

      if (locatedFactoid === null) {
        return util.embed.errorEmbed(
          `Couldn't find the factoid \`${trigger}\``
        );
      }
      // If there is no trigger left after deleting the target one, just delete the factoid
      if (locatedFactoid.triggers.length === 1) {
        await factoidCache!.delete(locatedFactoid);
      } else {
        locatedFactoid.triggers = locatedFactoid.triggers.filter(
          item => item !== trigger
        );

        // Finally push the modified factoid to the DB
        await factoidCache!.set(locatedFactoid).catch(err => {
          return util.embed.errorEmbed(
            `Database call failed with error ${(err as Error).name}`
          );
        });
      }
      return util.embed.successEmbed(
        `The trigger \`${trigger}\` was successfully removed.`
      );
    }
  )
);

// Registers the trigger submodule group
factoid.registerSubModule(trigger);

// TODO: do
factoid.registerSubModule(
  new util.SubModule('preview', 'Preview a factoid json without remembering it')
);
factoid.registerSubModule(
  new util.SubModule('all', 'Generate a list of all factoids as a webpage')
);

export default factoid;
