/**
 * @file
 * Modules:
 *  - {@link duck}
 *  - Submodules: Friends, Killers, Record, Stats, Donate, Kill, Reset
 */

import {readFileSync} from 'node:fs';
import * as util from '../../core/util.js';
import {
  APIEmbedField,
  BaseMessageOptions,
  Channel,
  Colors,
  EmbedBuilder,
  Message,
  Snowflake,
  TextChannel,
  User,
} from 'discord.js';
import {Collection, Db} from 'mongodb';

/** The main interface used to store duck records in the DB
 * @param user The user ID
 * @param befriended The number of befriended ducks
 * @param killed The number of killed ducks
 * @param speedRecord The fastest duck interaction for the user
 */
interface DuckUser {
  user: Snowflake;
  befriended: number;
  killed: number;
  speedRecord: number;
}

/** Interface used to store users who missed a duck interaction, important
 * when people are admin and can't be timed out.
 * Values:
 * User id: Unix timestamp of the end of the miss delay
 */
interface MissTimeoutMap {
  [user: Snowflake]: number;
}

/** The root 'duck' module definition */
const duck = new util.RootModule('duck', 'Duck management commands', [
  util.mongo,
]);

// -- Constants --

const DUCK_COLLECTION_NAME = 'ducks';
const DUCK_QUOTES: string[] = JSON.parse(
  readFileSync('./src/modules/duck/duck_quotes.json', 'utf-8')
);

// Config constants
const channelIds: string[] | undefined = duck.config.channels;
const minimumSpawnTime: number | undefined = duck.config.minimumSpawn;
const maximumSpawnTime: number | undefined = duck.config.maximumSpawn;
const runAwayTime: number | undefined = duck.config.runAwayTime;
const missCooldown: number | undefined = duck.config.cooldown;
const failRates = duck.config.failRates;

// Embed constants

const DUCK_PIC_URL =
  'https://cdn.icon-icons.com/icons2/1446/PNG/512/22276duck_98782.png';
const BEFRIEND_PIC_URL =
  'https://cdn.icon-icons.com/icons2/603/PNG/512/heart_love_valentines_relationship_dating_date_icon-icons.com_55985.png';
const KILL_PIC_URL =
  'https://cdn.icon-icons.com/icons2/1919/PNG/512/huntingtarget_122049.png';

const DUCK_EMBED: EmbedBuilder = new EmbedBuilder()
  .setColor(Colors.Green)
  .setTitle('Quack Quack!')
  .setDescription('Befriend the duck with `bef` or shoot it with `bang`')
  .setImage(DUCK_PIC_URL);

const GOT_AWAY_EMBED: EmbedBuilder = new EmbedBuilder()
  .setColor(Colors.Red)
  .setTitle('A duck got away!')
  .setDescription(
    "Then he waddled away, waddle waddle, 'till the very next day"
  );

// -- Helper functions --

/** Function to log a config error, done to save some lines in manual config verification
 * @param message The message to send with the warning
 */
function configFail(message: string) {
  util.logEvent(util.EventCategory.Warning, 'duck', message, 1);
}

/** Function to get a random spawn delay from the config
 * @returns A random delay in seconds between minimumSpawnTime and maximumSpawnTime
 */
function getSpawnDelay(): number {
  // Non null assertion - This is only called when the values aren't undefined
  return (
    Math.random() * (maximumSpawnTime! - minimumSpawnTime!) + minimumSpawnTime!
  );
}

/** Function to get a random quote from the quote file
 * @returns A random duck quote
 */
function getRandomQuote(): string {
  return DUCK_QUOTES[Math.floor(Math.random() * DUCK_QUOTES.length)];
}

/** Function to get the duck record for an user by their ID
 * @param userId The ID of the user to get the record of
 *
 * @returns The DuckUser object, null if it wasn't found
 */
async function getRecord(userId: Snowflake): Promise<DuckUser | null> {
  const db: Db = util.mongo.fetchValue();
  const duckRecords: Collection<DuckUser> = db.collection(DUCK_COLLECTION_NAME);

  return await duckRecords.findOne({
    user: userId,
  });
}

/** Function to upsert a duck record in the DB
 * @param DuckUser The new DuckUser entry
 */
async function updateRecord(newRecord: DuckUser): Promise<void> {
  const db: Db = util.mongo.fetchValue();
  const duckRecords: Collection<DuckUser> = db.collection(DUCK_COLLECTION_NAME);

  await duckRecords.updateOne(
    {user: newRecord.user},
    {
      $set: newRecord,
    },
    {upsert: true}
  );
}

/**
 * @returns The DuckUser object with the record
 */
async function getGlobalSpeedRecord(): Promise<DuckUser | null> {
  const db: Db = util.mongo.fetchValue();
  const duckRecords: Collection<DuckUser> = db.collection(DUCK_COLLECTION_NAME);

  return await duckRecords.find().sort({speedRecord: 1}).limit(1).next();
}

/** Function to get all DuckUser objects from the DB that don't have 0 befriended ducks
 * @returns The array of DuckUser objects, null if none are present
 */
async function getBefriendedRecords(): Promise<DuckUser[]> {
  const db: Db = util.mongo.fetchValue();
  const duckRecords: Collection<DuckUser> = db.collection(DUCK_COLLECTION_NAME);

  return await duckRecords
    .find({befriended: {$ne: 0}})
    .sort({befriended: -1})
    .toArray();
}

/** Function to get all DuckUser objects from the DB that don't have 0 killed ducks
 * @returns The array of DuckUser objects, null if none are present
 */
async function getKilledRecords(): Promise<DuckUser[]> {
  const db: Db = util.mongo.fetchValue();
  const duckRecords: Collection<DuckUser> = db.collection(DUCK_COLLECTION_NAME);

  return await duckRecords
    .find({killed: {$ne: 0}})
    .sort({killed: -1})
    .toArray();
}

// -- Core functions --

/** Function to handle a successful duck befriend event
 * @param message The 'bef' message
 * @param speed The time it took to befriend the duck
 */
async function handleBefriend(message: Message, speed: number) {
  const embed: EmbedBuilder = new EmbedBuilder()
    .setColor(Colors.Blurple)
    .setTitle('Duck befriended!')
    .setThumbnail(BEFRIEND_PIC_URL);

  // Gets the user record from the db
  const db: Db = util.mongo.fetchValue();
  const duckRecords: Collection<DuckUser> = db.collection(DUCK_COLLECTION_NAME);
  const locatedUser: DuckUser | null = await duckRecords.findOne({
    user: message.author.id,
  });

  // If the user record was found, assign the value, otherwise leave it undefined
  // This has to be done because ?? no worky with arithmetics
  let updatedCount: number | undefined;
  if (locatedUser !== null) {
    updatedCount = locatedUser.befriended + 1;
  }

  let updatedSpeed: number | undefined = locatedUser?.speedRecord;

  // The speed wasn't set (the person doesn't have a record) or the new speed record is faster
  if (updatedSpeed === undefined || speed < updatedSpeed) {
    updatedSpeed = speed;

    const oldRecord: number | null | undefined = (await getGlobalSpeedRecord())
      ?.speedRecord;

    if (oldRecord && oldRecord > updatedSpeed) {
      embed.setFooter({
        text: `New personal record! Time: ${speed} seconds\nNew global record! previous global record: ${oldRecord} seconds`,
      });
    } else {
      embed.setFooter({text: `New personal record! Time: ${speed}`});
    }
  }

  // The user has an entry, just append to it
  await duckRecords.updateOne(
    {user: message.author.id},
    {
      $set: {
        user: message.author.id,
        befriended: updatedCount ?? 1,
        killed: locatedUser?.killed ?? 0,
        speedRecord: updatedSpeed,
      },
    },
    {upsert: true}
  );

  embed.setDescription(
    `<@!${message.author.id}> befriended the duck in ${speed} seconds!`
  );
  embed.addFields([
    {name: 'Friends', value: updatedCount?.toString() ?? '1', inline: true},
    {name: 'Kills', value: locatedUser?.killed.toString() ?? '0', inline: true},
  ]);

  await message.reply({embeds: [embed.toJSON()]});
}

/** Function to handle a successful duck kill event
 * @param message The 'bang' message
 * @param speed The time it took to kill the duck
 */
async function handleKill(message: Message, speed: number) {
  const embed: EmbedBuilder = new EmbedBuilder()
    .setColor(Colors.Red)
    .setTitle('Duck killed!')
    .setThumbnail(KILL_PIC_URL);

  // Gets the user record from the db

  const locatedUser: DuckUser | null = await getRecord(message.author.id);

  // If the user record was found, assign the value, otherwise leave it undefined
  // This has to be done because ?? no worky with arithmetics
  let updatedCount: number | undefined;
  if (locatedUser !== null) {
    updatedCount = locatedUser.killed + 1;
  }

  let updatedSpeed: number | undefined = locatedUser?.speedRecord;

  // The speed wasn't set (the person doesn't have a record) or the new speed record is faster
  if (updatedSpeed === undefined || speed < updatedSpeed) {
    updatedSpeed = speed;

    const oldRecord: number | null | undefined = (await getGlobalSpeedRecord())
      ?.speedRecord;

    if (oldRecord && oldRecord > updatedSpeed) {
      embed.setFooter({
        text: `New personal record! Time: ${speed} seconds\nNew global record! previous global record: ${oldRecord} seconds`,
      });
    } else {
      embed.setFooter({text: `New personal record! Time: ${speed}`});
    }
  }

  // Updates the existing record
  await updateRecord({
    user: message.author.id,
    befriended: locatedUser?.befriended ?? 0,
    killed: updatedCount ?? 1,
    speedRecord: updatedSpeed,
  }).catch(err => {
    return util.embed.errorEmbed(
      `Database update call failed with error ${(err as Error).name}`
    );
  });

  embed
    .setDescription(
      `<@!${message.author.id}> killed the duck in ${speed} seconds!`
    )
    .addFields([
      {
        name: 'Friends',
        value: locatedUser?.befriended.toString() ?? '0',
        inline: true,
      },
      {name: 'Kills', value: updatedCount?.toString() ?? '1', inline: true},
    ]);

  await message.reply({embeds: [embed]});
}

/** Function to check whether the 'bef' or 'bang' missed
 * @param message The 'bef' or 'bang' message
 *
 * @returns Whether the attempt missed
 */
async function miss(message: Message): Promise<boolean> {
  if (Math.random() >= failRates.interaction! / 100) {
    return false;
  }
  const embed: EmbedBuilder = new EmbedBuilder()
    .setColor(Colors.Red)
    .setDescription(getRandomQuote())
    .setFooter({text: `Try again in ${missCooldown} seconds`});

  // Times the user out if the bot has sufficient permissions
  const bot = message.guild!.members.cache.get(util.client.user!.id)!;

  if (bot.roles.highest.position > message.member!.roles.highest.position) {
    await message.member!.timeout(missCooldown! * 1000, 'Missed a duck');
  }

  await message.reply({embeds: [embed]});
  return true;
}

/** Function to send a duck and listen for a response
 * @param channel The channel to summon the duck in
 */
async function summonDuck(channel: TextChannel): Promise<void> {
  const duckMessage = await channel.send({embeds: [DUCK_EMBED]});
  const duckCollector = channel.createMessageCollector({
    time: duck.config.runAwayTime * 1_000,
    filter: message => ['bef', 'bang'].includes(message.content),
  });
  const misses: MissTimeoutMap = {};
  let caught = false;

  duckCollector.on('collect', async message => {
    const time =
      (message.createdTimestamp - duckMessage.createdTimestamp) / 1000;

    // The person missed within <missCooldown> seconds ago
    if (
      misses[message.author.id] !== undefined &&
      Date.now() <= misses[message.author.id]
    ) {
      // All errors are catched since the only possible one is that the author has disabled dms
      await message.author
        .send(
          `I said to wait for ${missCooldown!} seconds! Resetting the timer...`
        )
        .catch();
      // This informs the author that they got timed out regardless of their dm status
      await message.react('🕗');
      // Resets the timer
      misses[message.author.id] = Date.now() + missCooldown! * 1_000;
      return;
    }

    // The timeout has passed, just remove the value from the miss cache
    if (misses[message.author.id] !== undefined) {
      delete misses[message.author.id];
    }

    switch (message.content) {
      case 'bef':
        if (await miss(message)) {
          misses[message.author.id] = Date.now() + missCooldown! * 1_000;
          break;
        } else {
          // Catches all errors, since the only possible one is unknownMessage, which would mean
          // that someone else has caught a duck - return early.
          try {
            await duckMessage.delete();
          } catch {
            // Someone caught the duck and the message is unknown, return early
            return;
          }
          caught = true;
          duckCollector.stop();

          await handleBefriend(message, time);
          return;
        }

      case 'bang':
        if (await miss(message)) {
          misses[message.author.id] = Date.now() + missCooldown! * 1_000;
          break;
        } else {
          // Catches all errors, since the only possible one is unknownMessage, which would mean
          // that someone else has caught a duck - return early.
          try {
            await duckMessage.delete();
          } catch {
            // Someone caught the duck and the message is unknown, return early
            return;
          }
          caught = true;
          duckCollector.stop();

          await handleKill(message, time);
          return;
        }
    }
  });
  duckCollector.on('end', async () => {
    // The duck wasn't caught using 'bef' or 'bang'
    if (!caught) {
      await duckMessage.delete();
      await channel.send({embeds: [GOT_AWAY_EMBED]});
    }

    // Restarts the duck loop with a random value
    setTimeout(async () => {
      void (await summonDuck(channel));
    }, getSpawnDelay() * 1_000);
    return;
  });
}

duck.onInitialize(async () => {
  // Verifies all config values are set (When not set, they are undefined)
  // This should get replaced by config verification once it is implemented
  if (
    typeof minimumSpawnTime !== 'number' ||
    typeof maximumSpawnTime !== 'number' ||
    typeof runAwayTime !== 'number' ||
    typeof missCooldown !== 'number' ||
    typeof failRates.interaction !== 'number' ||
    typeof failRates.kill !== 'number' ||
    typeof failRates.donate !== 'number'
  ) {
    configFail(
      'Config error: A config option is not set or is invalid, this module will be disabled.'
    );
    return;
  }
  if (channelIds === undefined) {
    configFail(
      'Config error: There are no valid channels set in the config, this mdule will be disabled.'
    );
    return;
  }

  // Gets all TextChannel objects
  const channels: TextChannel[] = [];

  // Done to make sure all IDs are valid
  for (const id of channelIds) {
    const channel: Channel | undefined = util.client.channels.cache.get(id);

    if (channel === undefined) {
      configFail(
        `Config error: The channel ID ${id} is not a valid channel ID! Skipping it...`
      );
      continue;
    }
    channels.push(channel as TextChannel);
  }

  if (channels.length === 0) {
    configFail(
      'Config error: There are no valid channels set in the config, this mdule will be disabled.'
    );
    return;
  }

  // There are valid channels, start all loops
  for (const channel of channels) {
    setTimeout(async () => {
      void (await summonDuck(channel));
    }, getSpawnDelay() * 1000);
  }
});

// -- Command definitions --

duck.registerSubModule(
  new util.SubModule(
    'stats',
    'Gets your current duck stats',
    [
      {
        type: util.ModuleOptionType.User,
        name: 'user',
        description: 'The user to get the stats of (Defaults to yourself)',
        required: false,
      },
    ],
    async (args, interaction) => {
      const userName: string | undefined = args
        .find(arg => arg.name === 'user')
        ?.value?.toString();

      let user: User;
      user = interaction.user!;
      if (userName !== undefined) {
        user = util.client.users.cache.get(userName)!;
      }

      if (user.bot) {
        return new EmbedBuilder()
          .setColor(Colors.Red)
          .setDescription(
            "If it looks like a duck, quacks like a duck, it's a duck!"
          )
          .toJSON();
      }

      const locatedUser: DuckUser | null = await getRecord(user.id);

      if (locatedUser === null) {
        if (user === interaction.user) {
          return util.embed.errorEmbed(
            'You have not participated in the duck hunt yet'
          );
        }
        return util.embed.errorEmbed(
          `<@!${user.id}> has not participated in the duck hunt yet!`
        );
      }

      const embed: EmbedBuilder = new EmbedBuilder()
        .setColor(Colors.Green)
        .setThumbnail(DUCK_PIC_URL)
        .setTitle('Duck stats')
        .setDescription(`<@!${user.id}>`)
        .setFields([
          {
            name: 'Friends',
            value: locatedUser.befriended.toString(),
            inline: true,
          },
          {name: 'Kills', value: locatedUser.killed.toString(), inline: true},
        ]);

      // The invoker holds the global record
      if (
        (await getGlobalSpeedRecord())?.speedRecord === locatedUser.speedRecord
      ) {
        return embed
          .setFooter({
            text: `Speed record: ${locatedUser.speedRecord} seconds\nYou hold the global record!`,
          })
          .toJSON();
      }

      return embed
        .setFooter({text: `Speed record: ${locatedUser.speedRecord} seconds`})
        .toJSON();
    }
  )
);

duck.registerSubModule(
  new util.SubModule(
    'record',
    'Gets the current global speed record',
    [],
    async () => {
      const speedRecord: DuckUser | null = await getGlobalSpeedRecord();

      if (!speedRecord) {
        return util.embed.errorEmbed('Noone has set a global record yet!');
      }

      const embed: EmbedBuilder = new EmbedBuilder()
        .setColor(Colors.Green)
        .setThumbnail(DUCK_PIC_URL)
        .setTitle('Duck speed record')
        .setFields([
          {
            name: 'Time',
            value: `${speedRecord.speedRecord.toString()} seconds`,
            inline: true,
          },
          {
            name: 'Record holder',
            value: `<@!${speedRecord.user}>`,
            inline: true,
          },
        ]);

      return embed.toJSON();
    }
  )
);

duck.registerSubModule(
  new util.SubModule(
    'friends',
    'Shows the global top befriended counts',
    [],
    async (_, interaction) => {
      const entries: DuckUser[] = await getBefriendedRecords();

      if (entries.length === 0) {
        return util.embed.errorEmbed('Noone has befriended a duck yet!');
      }

      // Gets the payloads for the pagination
      let fieldNumber = 0;
      const payloads: BaseMessageOptions[] = [];

      // The description has to be set to something, the speed record seems like the best choice
      // Non-null assertion - people have befriended ducks, there is a record
      const record: number = (await getGlobalSpeedRecord())!.speedRecord;

      let embed: EmbedBuilder = new EmbedBuilder()
        .setColor(Colors.Green)
        .setThumbnail(DUCK_PIC_URL)
        .setTitle('Duck friendships')
        .setDescription(`The current global record is: ${record} seconds`);
      let fields: APIEmbedField[] = [];

      for (const entry of entries) {
        // Limit of four entries per page
        if (fieldNumber >= 4) {
          embed.setFields(fields);
          payloads.push({embeds: [embed.toJSON()]});

          // Resets the embed and fields so they can be used for the next iteration
          embed = new EmbedBuilder()
            .setColor(Colors.Green)
            .setThumbnail(DUCK_PIC_URL)
            .setTitle('Duck friendships')
            .setDescription(`The current global record is: ${record} seconds`);

          fields = [];
          fieldNumber = 0;
        }

        fieldNumber++;

        const user: User | undefined = util.client.users.cache.get(entry.user);

        // Placeholder for an invalid tag

        let tag = `Failed to get user tag, ID: ${entry.user}`;
        if (user) {
          tag = user.tag;
        }
        fields.push({
          name: tag,
          value: `Friends: \`${entry.befriended}\``,
        });
      }

      // Makes sure fields are added if the iteration didn't finish (the last 1-3 weren't added)
      if (payloads.length <= 4 || payloads.length % 4 !== 0) {
        embed.setFields(fields);
        payloads.push({embeds: [embed.toJSON()]});
      }

      new util.PaginatedMessage(interaction, payloads, 30);
    }
  )
);

duck.registerSubModule(
  new util.SubModule(
    'killers',
    'Shows the global top killer counts',
    [],
    async (_, interaction) => {
      const entries: DuckUser[] = await getKilledRecords();

      if (entries.length === 0) {
        return util.embed.errorEmbed('Noone has killed a duck yet!');
      }

      // Gets the payloads for the pagination
      let fieldNumber = 0;
      const payloads: BaseMessageOptions[] = [];

      // The description has to be set to something, the speed record seems like the best choice
      // Non-null assertion - people have killed ducks, there is a record
      const record: number = (await getGlobalSpeedRecord())!.speedRecord;

      let embed: EmbedBuilder = new EmbedBuilder()
        .setColor(Colors.Green)
        .setThumbnail(DUCK_PIC_URL)
        .setTitle('Duck kills')
        .setDescription(`The current global record is: ${record} seconds`);
      let fields: APIEmbedField[] = [];

      for (const entry of entries) {
        // Limit of four entries per page
        if (fieldNumber >= 4) {
          embed.setFields(fields);
          payloads.push({embeds: [embed.toJSON()]});

          // Resets the embed and fields so they can be used for the next iteration
          embed = new EmbedBuilder()
            .setColor(Colors.Green)
            .setThumbnail(DUCK_PIC_URL)
            .setTitle('Duck kills')
            .setDescription(`The current global record is: ${record} seconds`);

          fields = [];
          fieldNumber = 0;
        }

        fieldNumber++;

        const user: User | undefined = util.client.users.cache.get(entry.user);

        // Placeholder for an invalid tag
        let tag = `Failed to get user tag, ID: ${entry.user}`;
        // The user was found, use their tag
        if (user) {
          tag = user.tag;
        }
        fields.push({
          name: tag,
          value: `Kills: \`${entry.killed}\``,
        });
      }

      // Makes sure fields are added if the iteration didn't finish (the last 1-3 weren't added)
      if (payloads.length <= 4 || payloads.length % 4 !== 0) {
        embed.setFields(fields);
        payloads.push({embeds: [embed.toJSON()]});
      }

      new util.PaginatedMessage(interaction, payloads, 30);
    }
  )
);

duck.registerSubModule(
  new util.SubModule(
    'donate',
    'Kills a befriended duck and adds it to your kill count.',
    [
      {
        type: util.ModuleOptionType.User,
        name: 'user',
        description: 'The user to donate the duck to',
        required: true,
      },
    ],
    async (args, interaction) => {
      const recipeeName: string = args
        .find(arg => arg.name === 'user')!
        .value!.toString();
      const recipee: User = util.client.users.cache.get(recipeeName)!;

      if (recipee.bot) {
        return util.embed.errorEmbed(
          'The only ducks bots accept are plated with gold!'
        );
      }

      const donorRecord: DuckUser | null = await getRecord(interaction.user.id);

      if (!donorRecord) {
        return util.embed.errorEmbed(
          'You have not participated in the duck hunt yet'
        );
      }

      if (donorRecord.befriended === 0) {
        return util.embed.errorEmbed('You have no ducks to donate!');
      }

      const recipeeRecord: DuckUser | null = await getRecord(recipee.id);

      if (!recipeeRecord) {
        return util.embed.errorEmbed(
          `<@!${recipee.id}> has not participated in the duck hunt yet!`
        );
      }

      await updateRecord({
        user: donorRecord.user,
        befriended: donorRecord.befriended - 1,
        killed: donorRecord.killed,
        speedRecord: donorRecord.speedRecord,
      }).catch(err => {
        return util.embed.errorEmbed(
          `Database update call failed with error ${(err as Error).name}`
        );
      });

      // Fail chance
      if (Math.random() <= failRates.donate! / 100) {
        return util.embed.errorEmbed(
          `Oops, the duck flew away before you could donate it. You have ${
            donorRecord.befriended - 1
          } ducks left.`
        );
      }

      await updateRecord({
        user: recipeeRecord.user,
        befriended: recipeeRecord.befriended + 1,
        killed: recipeeRecord.killed,
        speedRecord: recipeeRecord.speedRecord,
      }).catch(err => {
        return util.embed.errorEmbed(
          `Database update call failed with error ${(err as Error).name}`
        );
      });

      return util.embed.successEmbed(
        `How generous! You gave a duck to <@!${recipee.id}> and have ${
          donorRecord.befriended - 1
        } ducks remaning`
      );
    }
  )
);

duck.registerSubModule(
  new util.SubModule(
    'kill',
    'Kills a befriended duck and adds it to your kill count.',
    [],
    async (_, interaction) => {
      const userRecord = await getRecord(interaction.user.id);

      if (!userRecord) {
        return util.embed.errorEmbed(
          'You have not participated in the duck hunt yet'
        );
      }

      if (userRecord.befriended === 0) {
        return util.embed.errorEmbed('You have no ducks left to kill');
      }

      // Fail chance
      if (Math.random() <= failRates.kill! / 100) {
        await updateRecord({
          user: userRecord.user,
          befriended: userRecord.befriended - 1,
          killed: userRecord.killed,
          speedRecord: userRecord.speedRecord,
        }).catch(err => {
          return util.embed.errorEmbed(
            `Database update call failed with error ${(err as Error).name}`
          );
        });

        return util.embed.errorEmbed(
          `Oops, the duck flew away before you could hurt it. You have ${
            userRecord.befriended - 1
          } ducks left.`
        );
      }

      await updateRecord({
        user: userRecord.user,
        befriended: userRecord.befriended - 1,
        killed: userRecord.killed + 1,
        speedRecord: userRecord.speedRecord,
      }).catch(err => {
        return util.embed.errorEmbed(
          `Database update call failed with error ${(err as Error).name}`
        );
      });

      return util.embed.successEmbed(
        `You monster! You have ${
          userRecord.befriended - 1
        } ducks remaning and ${userRecord.killed + 1} kills to your name`
      );
    }
  )
);

duck.registerSubModule(
  new util.SubModule(
    'reset',
    'Resets an users duck stats',
    [
      {
        type: util.ModuleOptionType.User,
        name: 'user',
        description: ' The user to reset the duck stats of',
        required: true,
      },
    ],
    async (args, interaction) => {
      const userName: string = args
        .find(arg => arg.name === 'user')!
        .value!.toString();

      const user: User = util.client.users.cache.get(userName)!;
      const db: Db = util.mongo.fetchValue();
      const duckRecords: Collection<DuckUser> =
        db.collection(DUCK_COLLECTION_NAME);

      switch (
        await util.embed.confirmEmbed(
          `Are you sure you want to reset the duck stats of <@!${user.id}>?`,
          interaction
        )
      ) {
        case util.ConfirmEmbedResponse.Denied:
          return util.embed.infoEmbed('The duck stats were NOT reset.');

        case util.ConfirmEmbedResponse.Confirmed:
          await duckRecords.deleteOne({user: user.id}).catch(err => {
            return util.embed.errorEmbed(
              `Database update call failed with error ${(err as Error).name}`
            );
          });

          return util.embed.successEmbed(
            `Succesfully wiped the duck stats of <@!${user.id}>`
          );
      }
    }
  )
);

export default duck;
