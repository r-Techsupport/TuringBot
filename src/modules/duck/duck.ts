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
  Channel,
  Colors,
  EmbedBuilder,
  GuildMember,
  Snowflake,
  TextChannel,
  User,
} from 'discord.js';
import {Collection, Db} from 'mongodb';

/** The main interface used in the DB
 * @param user The user ID
 * @param befriended The number of befriended ducks
 * @param killed The number of killed ducks
 * @param speedRecord The fastest duck interaction for the user
 */
interface duckUser {
  user: Snowflake;
  befriended: number;
  killed: number;
  speedRecord: number;
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
const CHANNEL_IDS: string[] | undefined = duck.config.channels;
const MINIMUM_SPAWN: number | undefined = duck.config.minimumSpawn;
const MAXIMUM_SPAWN: number | undefined = duck.config.maximumSpawn;
const RUN_AWAY_TIME: number | undefined = duck.config.runAwayTime;
const COOLDOWN: number | undefined = duck.config.cooldown;
const FAIL_RATES = duck.config.failRates;

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

/** Function to log a config error, done to save some lines
 * @param message The message to send with the warning
 */
function configFail(message: string) {
  util.logEvent(util.EventCategory.Warning, 'duck', message, 1);
}

/** Function to get a random delay from the globally configured constants
 * @returns A random delay between Max_spawn and Min_spawn
 */
function getRandomDelay(): number {
  // Non null assertion - This is only called when the values aren't undefined
  return Math.random() * (MAXIMUM_SPAWN! - MINIMUM_SPAWN!) + MINIMUM_SPAWN!;
}

/** Function to get a random quote from the quote file
 * @returns A random duck quote
 */
function getRandomQuote(): string {
  return DUCK_QUOTES[Math.floor(Math.random() * DUCK_QUOTES.length)];
}

/** Function to get the duck record for an user by ID
 * @param userId The ID of the user to get the record of
 *
 * @returns The record object if there is one, or null
 */
async function getRecord(userId: Snowflake): Promise<duckUser | null> {
  const db: Db = util.mongo.fetchValue();
  const duckRecords: Collection<duckUser> = db.collection(DUCK_COLLECTION_NAME);

  return await duckRecords.findOne({
    user: userId,
  });
}

/** Function to upsert a duck record in the DB
 * @param duckUser The new entry
 */
async function updateRecord(newRecord: duckUser): Promise<void> {
  const db: Db = util.mongo.fetchValue();
  const duckRecords: Collection<duckUser> = db.collection(DUCK_COLLECTION_NAME);

  await duckRecords.updateOne(
    {user: newRecord.user},
    {
      $set: newRecord,
    },
    {upsert: true}
  );
}

/** Function to get the global speed record
 * @returns The duckUser object with the record
 */
async function getGlobalSpeedRecord(): Promise<duckUser | null> {
  const db: Db = util.mongo.fetchValue();
  const duckRecords: Collection<duckUser> = db.collection(DUCK_COLLECTION_NAME);

  return await duckRecords.find().sort({speedRecord: 1}).limit(1).next();
}

/** Function to get all befriended duck entries from the DB that don't equate to 0
 * @returns The array of duckUser objects, null if none are present
 */
async function getBefriendedRecords(): Promise<duckUser[]> {
  const db: Db = util.mongo.fetchValue();
  const duckRecords: Collection<duckUser> = db.collection(DUCK_COLLECTION_NAME);

  return await duckRecords
    .find({befriended: {$ne: 0}})
    .sort({befriended: -1})
    .toArray();
}

/** Function to get all killed duck entries from the DB that don't equate to 0
 * @returns The array of duckUser objects, null if none are present
 */
async function getKilledRecords(): Promise<duckUser[]> {
  const db: Db = util.mongo.fetchValue();
  const duckRecords: Collection<duckUser> = db.collection(DUCK_COLLECTION_NAME);

  return await duckRecords
    .find({killed: {$ne: 0}})
    .sort({killed: -1})
    .toArray();
}

// -- Core functions --

/** Function to add a befriended duck to the DB
 * @param user The user who befriended the duck
 * @param speed The time it took to befriend the duck
 * @param channel The channel the duck was befriended in
 */
async function handleBefriend(user: User, speed: number, channel: TextChannel) {
  const embed: EmbedBuilder = new EmbedBuilder()
    .setColor(Colors.Blurple)
    .setTitle('Duck befriended!')
    .setThumbnail(BEFRIEND_PIC_URL);

  // Gets the user record from the db
  const db: Db = util.mongo.fetchValue();
  const duckRecords: Collection<duckUser> = db.collection(DUCK_COLLECTION_NAME);
  const locatedUser: duckUser | null = await duckRecords.findOne({
    user: user.id,
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
    {user: user.id},
    {
      $set: {
        user: user.id,
        befriended: updatedCount ?? 1,
        killed: locatedUser?.killed ?? 0,
        speedRecord: updatedSpeed,
      },
    },
    {upsert: true}
  );

  embed.setDescription(
    `<@!${user.id}> befriended the duck in ${speed} seconds!`
  );
  embed.addFields([
    {name: 'Friends', value: updatedCount?.toString() ?? '1', inline: true},
    {name: 'Kills', value: locatedUser?.killed.toString() ?? '0', inline: true},
  ]);
  duck.registerSubModule(
    new util.SubModule(
      'record',
      'Gets the current global speed record',
      [],
      async () => {
        const speedRecord: duckUser | null = await getGlobalSpeedRecord();

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

        await channel.send({embeds: [embed]});
      }
    )
  );
}

/** Function to add a killed duck to the DB
 * @param user The user who killed the duck
 * @param speed The time it took to kill the duck
 * @param channel The channel the duck was killed in
 */
async function handleKill(user: User, speed: number, channel: TextChannel) {
  const embed: EmbedBuilder = new EmbedBuilder()
    .setColor(Colors.Red)
    .setTitle('Duck killed!')
    .setThumbnail(KILL_PIC_URL);

  // Gets the user record from the db

  const locatedUser: duckUser | null = await getRecord(user.id);

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
    user: user.id,
    befriended: locatedUser?.befriended ?? 0,
    killed: updatedCount ?? 1,
    speedRecord: updatedSpeed,
  }).catch(err => {
    return util.embed.errorEmbed(
      `Database update call failed with error ${(err as Error).name}`
    );
  });

  embed
    .setDescription(`<@!${user.id}> killed the duck in ${speed} seconds!`)
    .addFields([
      {
        name: 'Friends',
        value: locatedUser?.befriended.toString() ?? '0',
        inline: true,
      },
      {name: 'Kills', value: updatedCount?.toString() ?? '1', inline: true},
    ]);

  await channel.send({embeds: [embed]});
}

/** Function to check whether the 'bef' or 'bang' missed
 * @returns Whether the attempt missed
 */
async function miss(
  member: GuildMember,
  channel: TextChannel
): Promise<boolean> {
  if (Math.random() <= FAIL_RATES.interaction! / 100) {
    return false;
  }
  const embed: EmbedBuilder = new EmbedBuilder()
    .setColor(Colors.Red)
    .setDescription(getRandomQuote())
    .setFooter({text: `Try again in ${COOLDOWN} seconds`});

  const bot = channel.guild.members.cache.get(util.client.user!.id)!;

  if (bot.roles.highest.position > member.roles.highest.position) {
    await member.timeout(COOLDOWN! * 1000, 'Missed a duck');
  }

  const timeoutMessage = await channel.send({embeds: [embed]});

  // Deleted the timeout message after 5 seconds
  setTimeout(async () => await timeoutMessage.delete(), COOLDOWN! * 1_000!);
  return true;
}

/** Function to send a duck and listen for a response */
async function summonDuck(channel: TextChannel): Promise<void> {
  const duckMessage = await channel.send({embeds: [DUCK_EMBED]});
  const duckCollector = channel.createMessageCollector({
    time: duck.config.runAwayTime * 1_000,
    filter: message => ['bef', 'bang'].includes(message.content),
  });
  let caught = false;

  duckCollector.on('collect', async message => {
    const time =
      (message.createdTimestamp - duckMessage.createdTimestamp) / 1000;

    switch (message.content) {
      case 'bef':
        if (await miss(message.member!, channel)) {
          break;
        } else {
          await duckMessage.delete();
          caught = true;
          duckCollector.stop();

          await handleBefriend(message.author, time, channel);
          return;
        }

      case 'bang':
        if (await miss(message.member!, channel)) {
          break;
        } else {
          await duckMessage.delete();
          caught = true;
          duckCollector.stop();

          await handleKill(message.author, time, channel);
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
    }, getRandomDelay() * 1_000);
    return;
  });
}

duck.onInitialize(async () => {
  // Verifies all config values are set (When not set, they are undefined)
  if (
    typeof MINIMUM_SPAWN !== 'number' ||
    typeof MAXIMUM_SPAWN !== 'number' ||
    typeof RUN_AWAY_TIME !== 'number' ||
    typeof COOLDOWN !== 'number' ||
    typeof FAIL_RATES.interaction !== 'number' ||
    typeof FAIL_RATES.kill !== 'number' ||
    typeof FAIL_RATES.donate !== 'number'
  ) {
    configFail(
      'Config error: A config option is not set or is invalid, this module will be disabled.'
    );
    return;
  }
  if (CHANNEL_IDS === undefined) {
    configFail(
      'Config error: There are no valid channels set in the config, this mdule will be disabled.'
    );
    return;
  }

  // Gets all TextChannel objects
  const channels: TextChannel[] = [];

  // Done to make sure all IDs are valid
  for (const id of CHANNEL_IDS) {
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
    }, getRandomDelay() * 1000);
  }
});

// -- Module definitions --

duck.registerSubModule(
  new util.SubModule(
    'stats',
    'Gets your current duck stats',
    [
      {
        type: util.ModuleOptionType.User,
        name: 'user',
        description: 'The user to get the stats of (Default: Yourself)',
        required: false,
      },
    ],
    async (args, interaction) => {
      let user: User;

      const userName: string | undefined = args
        .find(arg => arg.name === 'user')
        ?.value?.toString();

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

      const locatedUser: duckUser | null = await getRecord(user.id);

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
      const speedRecord: duckUser | null = await getGlobalSpeedRecord();

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
      const entries: duckUser[] = await getBefriendedRecords();

      if (entries.length === 0) {
        return util.embed.errorEmbed('Noone has befriended a duck yet!');
      }

      // Gets the payloads for the pagination
      let fieldNumber = 0;
      const payloads = [];

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

        // Tries to get the user tag
        const user: User | undefined = util.client.users.cache.get(entry.user);

        let tag = `Failed to get user tag, ID: ${entry.user}`;
        // The user exists, use their tag
        if (user) {
          tag = user.tag;
        }
        fields.push({
          name: tag,
          value: `Friends: \`${entry.befriended}\``,
        });
      }

      // Makes sure fields are set if the iteration didn't finish
      if (payloads.length % 4 !== 0) {
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
      const entries: duckUser[] = await getKilledRecords();

      if (entries.length === 0) {
        return util.embed.errorEmbed('Noone has killed a duck yet!');
      }

      // Gets the payloads for the pagination
      let fieldNumber = 0;
      const payloads = [];

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

        // Tries to get the user tag
        const user: User | undefined = util.client.users.cache.get(entry.user);

        let tag = `Failed to get user tag, ID: ${entry.user}`;
        // The user exists, use their tag
        if (user) {
          tag = user.tag;
        }
        fields.push({
          name: tag,
          value: `Kills: \`${entry.killed}\``,
        });
      }

      // Makes sure fields are set if the iteration didn't finish
      if (payloads.length % 4 !== 0) {
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

      const donorRecord = await getRecord(interaction.user.id);
      const recipeeRecord = await getRecord(recipee.id);

      // Makes sure the command can be executed

      if (!donorRecord) {
        return util.embed.errorEmbed(
          'You have not participated in the duck hunt yet'
        );
      }

      if (!recipeeRecord) {
        return util.embed.errorEmbed(
          `<@!${recipee.id}> has not participated in the duck hunt yet!`
        );
      }

      if (donorRecord.befriended === 0) {
        return util.embed.errorEmbed('You have no ducks to donate!');
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
      if (Math.random() <= FAIL_RATES.donate! / 100) {
        return util.embed.errorEmbed(
          `Oops, the duck broke out of its cage before it arrived. You have ${
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

      // Makes sure the command can be executed

      if (!userRecord) {
        return util.embed.errorEmbed(
          'You have not participated in the duck hunt yet'
        );
      }

      if (userRecord.befriended === 0) {
        return util.embed.errorEmbed('You have no ducks left to kill');
      }

      // Fail chance
      if (Math.random() <= FAIL_RATES.kill! / 100) {
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
          `Oops, the duck ran away before you could hurt it. You have ${
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
    'Resets an users duck commands',
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
      const duckRecords: Collection<duckUser> =
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
          await duckRecords.deleteOne({user: user.id});
          return util.embed.successEmbed(
            `Succesfully wiped the duck stats of <@!${user.id}>`
          );
      }
    }
  )
);

export default duck;
