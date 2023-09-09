/**
 * @file
 * Modules:
 *  - {@link warn}
 *  - {@link warns}
 *  - {@link unwarn}
 */

import {
  GuildMember,
  Snowflake,
  TextChannel,
  User,
  PermissionsBitField,
  EmbedBuilder,
  Colors,
  EmbedField,
} from 'discord.js';
import * as util from '../core/util.js';
import {Collection, Db} from 'mongodb';

/** DB Warning structure */
interface Warning {
  /** The user who was warned */
  user: Snowflake;
  /** The user who warned them */
  author: Snowflake;
  /** The warn reason */
  reason: string;
  /** Date of the warn in YYYY-MM-DD HH:MM:SS */
  date: string;
}

const WARNING_COLLECTION_NAME = 'warnings';

/**
 * Formats the current date to YYYY-MM-DD HH:MM:SS
 * @param The date to format
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = (1 + date.getMonth()).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hour = date.getHours().toString().padStart(2, '0');
  const minute = date.getMinutes().toString().padStart(2, '0');
  const second = date.getSeconds().toString().padStart(2, '0');

  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

/**
 * Function to get an array of all warns of a user by their id
 *
 * @param id The id of the user
 * @returns A list of Warning objects, [] if none were found
 */
export async function getWarns(id: Snowflake): Promise<Warning[]> {
  const db: Db = util.mongo.fetchValue();
  const warnCollection: Collection<Warning> = db.collection(
    WARNING_COLLECTION_NAME
  );

  return (await warnCollection.find({user: id}).toArray()) ?? [];
}

/**
 * Function to warn an user
 *
 * @param member The member to warn
 * @param author The author of the warn
 * @param reason The warn reason
 * @param channel The channel to send the warn to
 * @param banOnLimit Whether to ban the user if the warn limit is reached
 */
export async function warnUser(
  member: GuildMember,
  author: User,
  reason: string,
  channel: TextChannel,
  banOnLimit: boolean
): Promise<void> {
  const db: Db = util.mongo.fetchValue();
  const warnCollection: Collection<Warning> = db.collection(
    WARNING_COLLECTION_NAME
  );

  // Add the warn to the DB
  warnCollection.insertOne({
    user: member.id,
    author: author.id,
    reason: reason,
    date: formatDate(new Date()),
  });

  const existingWarns: Warning[] = await getWarns(member.id);

  // The max limit was reached and banOnLimit is set to true, ban 'em
  if (banOnLimit && existingWarns.length + 1 >= warn.config.maxWarns) {
    await member.ban({
      reason: `Max warning number reached (${existingWarns.length + 1}`,
    });
    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setThumbnail(member.displayAvatarURL())
          .setColor(Colors.Yellow)
          .setTitle('Chat protection')
          .setDescription(`BAN \`${member.user.username}\``)
          .setFooter({
            text: `Reason: ${reason} (Max warning number reached (${
              existingWarns.length + 1
            })`,
          }),
      ],
    });
    return;
  }

  // User wasn't banned, return the standard warn message
  const embed: EmbedBuilder = new EmbedBuilder()
    .setThumbnail(member.displayAvatarURL())
    .setColor(Colors.Yellow)
    .setTitle('Chat protection')
    .setDescription(`WARN \`${member.user.username}\``)
    .setFooter({
      text: `Reason: ${reason} (${existingWarns.length + 1} total warnings)`,
    });

  await (channel as TextChannel).send({
    content: member.user.toString(),
    embeds: [embed],
  });
}

/** The root warn command definition */
const warn = new util.RootModule(
  'warn',
  'Warn an user',
  [util.mongo],
  [
    {
      type: util.ModuleOptionType.User,
      name: 'user',
      description: 'The user to warn',
      required: true,
    },
    {
      type: util.ModuleOptionType.String,
      name: 'reason',
      description: 'The warn reason',
      required: true,
    },
  ],
  async (args, interaction) => {
    await interaction.deferReply({ephemeral: true});
    const userName: string = args
      .find(arg => arg.name === 'user')!
      .value!.toString();

    const reason: string = args
      .find(arg => arg.name === 'reason')!
      .value!.toString();

    const member: GuildMember | undefined =
      interaction.guild!.members.cache.get(userName);

    if (!member) {
      return util.embed.errorEmbed(`${userName} has left the guild!`);
    }

    if (member.user === util.client.user) {
      return util.embed.errorEmbed('It would be silly to warn myself');
    }

    // Makes sure the user has access to the interaction channel
    const channel: TextChannel = interaction.channel as TextChannel;

    if (
      !channel.permissionsFor(member).has(PermissionsBitField.Flags.ViewChannel)
    ) {
      return util.embed.errorEmbed(
        `${userName} doesn't have access to this channel!`
      );
    }

    const existingWarns: Warning[] = await getWarns(member.id);

    // The max warn limit has been reached, check whether the user should be banned instead
    if (existingWarns.length + 1 >= warn.config.maxWarns) {
      switch (
        await util.embed.confirmEmbed(
          `${member} has ${warn.config.maxWarns} or more warns, would you like to ban them instead?`,
          interaction
        )
      ) {
        case util.ConfirmEmbedResponse.Confirmed:
          // Don't ban, just proceed with the normal warn
          await warnUser(member, interaction.user, reason, channel, true);
          return;
        case util.ConfirmEmbedResponse.Denied:
          break;
      }
    }

    // The interaction is ephemeral, so the embed from confirmEmbed has to be deleted manually
    await interaction.deleteReply();

    // Warns the user but doesn't ban if the limit is reached
    await warnUser(member, interaction.user, reason, channel, false);
  },
  // Defers the reply manually to make it ephemeral
  false
);

/** The root warns command definition */
const warns = new util.RootModule(
  'warns',
  'Lists all warns of a user',
  [util.mongo],
  [
    {
      type: util.ModuleOptionType.User,
      name: 'user',
      description: 'The user to get the warns of',
      required: true,
    },
  ],
  async args => {
    const userName: string = args
      .find(arg => arg.name === 'user')!
      .value!.toString();

    const user: User = util.client.users.cache.get(userName)!;

    const db: Db = util.mongo.fetchValue();
    const warnCollection: Collection<Warning> = db.collection(
      WARNING_COLLECTION_NAME
    );

    const existingWarns: Warning[] = await warnCollection
      .find({user: user.id})
      .toArray();

    if (existingWarns.length === 0) {
      return util.embed.errorEmbed(`${user} has no warnings`);
    }

    const fields: EmbedField[] = [];

    for (const warn of existingWarns) {
      const author: User | undefined = util.client.users.cache.get(warn.author);

      fields.push({
        name: `${author?.username ?? `Couldn't fetch, id: ${warn.author}`} - ${
          warn.date
        }`,
        value: warn.reason,
        inline: false,
      });
    }
    const embed: EmbedBuilder = new EmbedBuilder()
      .setColor(Colors.Red)
      .setThumbnail(user.displayAvatarURL())
      .setTitle(`Warnings for ${user.username}`)
      .setFields(fields);

    return embed.toJSON();
  }
);

/** The root unwarn command definition */
const unwarn = new util.RootModule(
  'unwarn',
  'Removes the latest warning from a user',
  [util.mongo],
  [
    {
      type: util.ModuleOptionType.User,
      name: 'user',
      description: 'The user to remove the latest warning from',
      required: true,
    },
  ],
  async (args, interaction) => {
    const userName: string = args
      .find(arg => arg.name === 'user')!
      .value!.toString();

    const user: User = util.client.users.cache.get(userName)!;

    // Defines the DB structures
    const db: Db = util.mongo.fetchValue();
    const warnCollection: Collection<Warning> = db.collection(
      WARNING_COLLECTION_NAME
    );

    switch (
      await util.embed.confirmEmbed(
        `Remove the latest warning from ${user}?`,
        interaction
      )
    ) {
      case util.ConfirmEmbedResponse.Denied:
        return;

      case util.ConfirmEmbedResponse.Confirmed:
        // Removes the latest entry from the db
        await warnCollection
          .findOneAndDelete({user: user.id}, {sort: {_id: -1}})
          .catch(err => {
            return util.embed.errorEmbed(
              `Database call failed with error ${(err as Error).name}`
            );
          });

        return util.embed.successEmbed(
          `Succesfully removed the latest warning from ${user}!`
        );
    }
  }
);

export default [warn, warns, unwarn];
