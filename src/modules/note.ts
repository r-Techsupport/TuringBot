/**
 * @file
 * Modules:
 *  - {@link notes}
 *  - Submodules: Add, Clear, Get
 *
 *  - {@link whois}
 */

import type {Collection, Db} from 'mongodb';
import * as util from '../core/util.js';
import {getWarns} from './warn.js';
import type {Snowflake, User} from 'discord.js';
import {Colors, EmbedBuilder} from 'discord.js';

/** A note added to a user */
interface Note {
  contents: string;
  addedBy: Snowflake;
  date: string;
}

/** The main DB structure for notes */
interface UserRecord {
  user: Snowflake;
  notes: Note[];
}

/** The name of the MongoFB collection where notes are stored */
const NOTE_COLLECTION_NAME = 'notes';

/**
 * @param user The user to get the DB record of
 */
async function getRecord(user: User): Promise<UserRecord | null> {
  const db: Db = util.mongo.fetchValue();
  const records: Collection<UserRecord> = db.collection(NOTE_COLLECTION_NAME);

  return await records.findOne({user: user.id});
}

/**
 * @param user The user to delete the record of
 */
async function deleteRecord(user: User): Promise<void> {
  const db: Db = util.mongo.fetchValue();
  const records: Collection<UserRecord> = db.collection(NOTE_COLLECTION_NAME);

  await records.deleteOne({user: user.id});
}

/** The root note command group */
const notes = new util.RootModule('note', 'Add or delete notes from users', [
  util.mongo,
]);

notes.registerSubModule(
  new util.SubModule(
    'add',
    'Add a note to someone',
    [
      {
        type: util.ModuleOptionType.User,
        name: 'user',
        description: 'The user to add the note to',
        required: true,
      },
      {
        type: util.ModuleOptionType.String,
        name: 'note',
        description: 'The note to add',
        required: true,
      },
    ],
    async (args, interaction) => {
      const targetId: string = args
        .find(arg => arg.name === 'user')!
        .value!.toString();

      const noteContents: string = args
        .find(arg => arg.name === 'note')!
        .value!.toString();

      const target = await util.client.users.fetch(targetId);

      if (interaction.user.id === target.id) {
        return util.embed.errorEmbed('You cannot add a note for yourself');
      }

      const note: Note = {
        contents: noteContents,
        addedBy: interaction.user.id,
        date: util.formatDate(new Date()),
      };

      const db: Db = util.mongo.fetchValue();
      const records: Collection<UserRecord> =
        db.collection(NOTE_COLLECTION_NAME);

      const record: UserRecord | null = await getRecord(target);

      // The user already has notes, just append the new one and return early
      if (record !== null) {
        record.notes.push(note);

        await records
          .updateOne(
            {user: target.id},
            {$set: {notes: record.notes}},
            {upsert: true}
          )
          .catch(err => {
            return util.embed.errorEmbed(
              `Database call failed with error ${(err as Error).name}`
            );
          });
        return util.embed.successEmbed('Succesfully added that note');
      }

      // The user didn't have an existing record, so create one
      const structuredRecord: UserRecord = {
        user: target.id,
        notes: [note],
      };

      await records.insertOne(structuredRecord).catch(err => {
        return util.embed.errorEmbed(
          `Database call failed with erorr ${(err as Error).name}`
        );
      });

      return util.embed.successEmbed('Succesfully added that note');
    }
  )
);

notes.registerSubModule(
  new util.SubModule(
    'clear',
    'Clear someones notes',
    [
      {
        type: util.ModuleOptionType.User,
        name: 'user',
        description: 'The user to clear the notes of',
        required: true,
      },
    ],
    async args => {
      const targetId: string = args
        .find(arg => arg.name === 'user')!
        .value!.toString();
      const target = await util.client.users.fetch(targetId);

      const record: UserRecord | null = await getRecord(target);

      if (record === null) {
        return util.embed.errorEmbed(
          `\`${target.tag}\` doesn't have any notes`
        );
      }

      await deleteRecord(target).catch(err => {
        return util.embed.errorEmbed(
          `Database call failed with error ${(err as Error).name}`
        );
      });

      return util.embed.successEmbed(
        `Succesfully removed notes for \`${target.tag}\``
      );
    }
  )
);

notes.registerSubModule(
  new util.SubModule(
    'get',
    'Gets an users notes and returns them as a json',
    [
      {
        type: util.ModuleOptionType.User,
        name: 'user',
        description: 'The user to get the notes of',
        required: true,
      },
    ],
    async (args, interaction) => {
      const targetId: string = args
        .find(arg => arg.name === 'user')!
        .value!.toString();
      const target = await util.client.users.fetch(targetId);

      const record: UserRecord | null = await getRecord(target);

      if (record === null) {
        return util.embed.errorEmbed(
          `\`${target.tag}\` doesn't have any notes`
        );
      }

      // Shoves the notes into a JSON string, then into a buffer to send as an attachment
      const json: string = JSON.stringify({notes: record.notes}, null, 2);
      const file = Buffer.from(json);

      await util.replyToInteraction(interaction, {
        files: [
          {
            attachment: file,
            name: `notes_for_${target.id}_${util.formatDate(new Date())}.json`,
          },
        ],
      });
    }
  )
);

/** The root whois command definition */
const whois = new util.RootModule(
  'whois',
  'Displays information about an user',
  [util.mongo],
  [
    {
      type: util.ModuleOptionType.User,
      name: 'user',
      description: 'The user to get the info about',
      required: true,
    },
  ],
  async (args, interaction) => {
    const targetId: string = args
      .find(arg => arg.name === 'user')!
      .value!.toString();
    const member = await interaction.guild!.members.fetch(targetId);

    const embed: EmbedBuilder = new EmbedBuilder()
      .setColor(Colors.DarkBlue)
      .setTitle(`User info for \`${member.user.tag}\``)
      .setThumbnail(member.displayAvatarURL());

    if (member.user.bot) {
      embed.setDescription('**Note: This is a bot account!**');
    }

    const fields = [
      {
        name: 'Created at',
        value: util.formatDate(member.user.createdAt),
        inline: true,
      },
      {
        name: 'Joined at',
        value: util.formatDate(member.joinedAt!),
        inline: true,
      },
      {
        name: 'Status',
        value: member.presence?.status ?? 'offline',
        inline: true,
      },
      {
        name: 'Nickname',
        value: member.displayName,
        inline: true,
      },
    ];

    let roles: string = member.roles.cache
      .filter(role => role.name !== '@everyone')
      .map(role => role.name)
      .join(', ');

    if (roles === '') {
      roles = 'None';
    }
    fields.push({name: 'Roles', value: roles, inline: true});

    // If the invoker is able to kick members, list warnings as well
    if (interaction.memberPermissions!.has('KickMembers')) {
      const warnings = await getWarns(member.id);

      for (const warning of warnings) {
        const author: User | undefined = util.client.users.cache.get(
          warning.author
        );
        fields.push({
          name: `Warning from ${author?.username ?? warning.author} at ${
            warning.date
          }`,
          value: warning.reason,
          inline: false,
        });
      }
    }

    // Finally, list notes
    const record: UserRecord | null = await getRecord(member.user);
    // Is left undefined if there aren't any notes, otherwise is used in the footer to list
    // the amount of notes as well as any potential trimming that happened
    let footerText;
    let noteCount = 0;

    if (record !== null) {
      footerText = `${record.notes.length} total notes`;
      // Iterate through all notes and add them to the embed
      for (const note of record.notes.reverse()) {
        noteCount++;
        // Limit of four notes so the embed isn't too long
        if (noteCount > 4) {
          footerText += ` ${
            record.notes.length - 4
          } more notes trimmed, use \`/note get <user>\` to get them`;
          break;
        }
        const noteAuthor: User = await util.client.users.fetch(note.addedBy);

        fields.push({
          name: `Note from ${noteAuthor.username} at ${note.date}`,
          value: `*${note.contents}*`,
          inline: false,
        });
      }
    }

    // Only set if there were notes
    if (footerText) {
      embed.setFooter({text: footerText});
    }
    embed.setFields(fields);

    return embed.toJSON();
  }
);

export default [notes, whois];
