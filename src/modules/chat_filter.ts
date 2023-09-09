/**
 * @file
 * Modules:
 *  - {@link chatFilter}
 */

import {
  TextChannel,
  EmbedBuilder,
  Colors,
  ApplicationCommandOptionChoiceData,
  Message,
  Events,
  EmbedField,
  BaseMessageOptions,
  CommandInteractionOption,
} from 'discord.js';
import * as util from '../core/util.js';
import {warnUser} from './warn.js';
import {Collection, Db} from 'mongodb';

/** DB Filter structure */
interface Filter {
  /** The trigger for the filter */
  regex: string;
  /** What to do when it is triggered */
  punishment: string;
  /** What to include in the response message */
  responseMessage: string;
}

// Used for slash command choices as well as assigning the proper db entry
const punishmentChoices = [
  {name: 'ban', value: 'Bans the user'},
  {name: 'kick', value: 'Kicks the user'},
  {name: 'timeout', value: 'Times the user out'},
  {name: 'warn', value: 'Warns the user'},
  {name: 'nothing', value: 'Just sends the embed'},
];

const FILTER_COLLECTION_NAME = 'chat_filters';

/** The root filter command group definition */
const chatFilter = new util.RootModule(
  'filter',
  'Manages filters to delete a message with matching regex',
  [util.mongo]
);

/** This function is used for the slash command option autocomplete */
async function filterAutocomplete(
  input: string
): Promise<ApplicationCommandOptionChoiceData[]> {
  const db: Db = util.mongo.fetchValue();
  const filterCollection: Collection<Filter> = db.collection(
    FILTER_COLLECTION_NAME
  );

  // https://www.mongodb.com/docs/manual/reference/operator/query/regex/#perform-case-insensitive-regular-expression-match
  const matches = filterCollection.find({
    regex: {$regex: `(${input})(.*)`},
  });

  // format results in the appropriate autocomplete format
  const formattedMatches = await matches
    .map(filter => ({
      name: filter.regex,
      value: filter.regex,
    }))
    .toArray();
  return formattedMatches;
}

chatFilter.registerSubModule(
  new util.SubModule(
    'add',
    'Adds a message filter',
    [
      {
        type: util.ModuleOptionType.String,
        name: 'regex',
        description: 'The regex of the new filter',
        required: true,
      },
      {
        type: util.ModuleOptionType.String,
        name: 'punishment',
        description: 'The punishment if the filter is triggered',
        choices: punishmentChoices,
        required: true,
      },
      {
        type: util.ModuleOptionType.String,
        name: 'response',
        description: 'The message to include in the chat protection embed',
        required: true,
      },
    ],
    async (args, interaction) => {
      const regex: string = args
        .find(arg => arg.name === 'regex')!
        .value!.toString();

      const punishment: CommandInteractionOption = args.find(
        arg => arg.name === 'punishment'
      )!;

      const reseponseMessage: string = args
        .find(arg => arg.name === 'response')!
        .value!.toString();

      // Makes sure the regex is valid
      let valid = true;
      try {
        new RegExp(regex);
      } catch (e) {
        valid = false;
      }

      if (!valid) {
        return util.embed.errorEmbed('The provided regex is not valid');
      }

      const db: Db = util.mongo.fetchValue();
      const filterCollection: Collection<Filter> = db.collection(
        FILTER_COLLECTION_NAME
      );

      await filterCollection.insertOne({
        regex: regex,
        // Gets the proper punishment from punishmentChoices
        punishment: punishmentChoices.find(
          choice => choice.value === punishment.value
        )!.name,
        responseMessage: reseponseMessage,
      });

      await interaction.editReply({
        components: [],
        embeds: [
          util.embed.successEmbed(
            `Succesfully added a filter that **${punishment.value!.toString()}** when the regex \`${regex}\` is triggered`
          ),
        ],
      });
    }
  )
);

chatFilter.registerSubModule(
  new util.SubModule(
    'list',
    'Lists all existing filters',
    [],
    async (_, interaction) => {
      const db: Db = util.mongo.fetchValue();
      const filterCollection: Collection<Filter> = db.collection(
        FILTER_COLLECTION_NAME
      );

      const filterList: Filter[] = await filterCollection.find().toArray();

      if (filterList.length === 0) {
        return util.embed.errorEmbed('There are no filters currently defined');
      }

      const fields: EmbedField[] = [];

      for (const filter of filterList) {
        fields.push({
          name: `${filter.punishment} - \`${filter.regex}\``,
          value: filter.responseMessage,
          inline: false,
        });
      }

      // Payloads used for pagination
      const payloads: BaseMessageOptions[] = util.createEmbedFieldPayloads(
        fields,
        fieldSet => {
          return new EmbedBuilder()
            .setColor(Colors.Blurple)
            .setDescription(`### Filter list for ${interaction.guild!.name}`)
            .setFooter({
              text: `${filterList.length} filter(s) currently active`,
            })
            .setFields(fieldSet);
        },
        5
      );

      new util.PaginatedMessage(interaction, payloads, 60, true);
    }
  )
);

chatFilter.registerSubModule(
  new util.SubModule(
    'remove',
    'Removes a filter',
    // Doesn't use autocomplete since RegExp objects are stored instead of strings
    [
      {
        type: util.ModuleOptionType.String,
        name: 'filter',
        description: 'Regex of the filter to remove',
        required: true,
        autocomplete: filterAutocomplete,
      },
    ],
    async (args, interaction) => {
      const regex = args.find(arg => arg.name === 'filter')!.value!.toString();

      console.log(regex);

      const db: Db = util.mongo.fetchValue();
      const filterCollection: Collection<Filter> = db.collection(
        FILTER_COLLECTION_NAME
      );

      const locatedFilter: Filter | null = await filterCollection.findOne({
        regex: regex,
      });

      if (locatedFilter === null) {
        return util.embed.errorEmbed(
          `Couldn't find a filter with the regex \`${regex}\``
        );
      }

      switch (
        await util.embed.confirmEmbed(
          `Are you sure you want to delete the \`${regex}\` filter?`,
          interaction
        )
      ) {
        case util.ConfirmEmbedResponse.Denied:
          return;

        case util.ConfirmEmbedResponse.Confirmed:
          await filterCollection.deleteOne({regex: regex});
          return util.embed.successEmbed(
            `Succesfully deleted the \`${regex}\` filter`
          );
      }
    }
  )
);

// Starts the listener
chatFilter.onInitialize(async () => {
  util.client.on(Events.MessageCreate, async (message: Message<boolean>) => {
    // Bots don't have to follow rules
    if (message.author.bot) {
      return;
    }

    // Make sure the person isn't exempt from the rules of the world
    for (const roleId of chatFilter.config.exemptRoles) {
      if (message.member!.roles.cache.has(roleId)) {
        return;
      }
    }

    const db: Db = util.mongo.fetchValue();
    const filterCollection: Collection<Filter> = db.collection(
      FILTER_COLLECTION_NAME
    );

    let trippedFilter: Filter | undefined;

    for (const filter of await filterCollection.find().toArray()) {
      if (new RegExp(filter.regex).test(message.content)) {
        trippedFilter = filter;
        break;
      }
    }

    // No filters tripped, return early
    if (trippedFilter === undefined || trippedFilter.punishment === 'nothing') {
      return;
    }

    // Returns early if the bot doesn't have sufficient permissions to do anything else
    const bot = message.guild!.members.cache.get(util.client.user!.id)!;
    if (bot.roles.highest.position <= message.member!.roles.highest.position) {
      return;
    }

    // A filter got triggered and the bot has permissions, have fun
    await message.delete();

    const embed: EmbedBuilder = new EmbedBuilder()
      .setColor(Colors.Yellow)
      .setTitle('Chat protection');

    const channel: TextChannel = message.channel as TextChannel;

    switch (trippedFilter.punishment) {
      case 'ban':
        await message.member!.ban({
          reason: `Chat protection trigger for \`${trippedFilter.regex}\``,
        });

        channel.send({
          content: message.author.toString(),
          embeds: [
            embed
              .setThumbnail(message.author.displayAvatarURL())
              .setDescription(`BAN: \`${message.author.username}\``)
              .setFooter({
                text: `Reason: Chat protection trigger for \`${trippedFilter.regex}\``,
              }),
          ],
        });
        return;

      case 'kick':
        await message.member!.kick();

        channel.send({
          content: message.author.toString(),
          embeds: [
            embed
              .setThumbnail(message.author.displayAvatarURL())
              .setDescription(`KICK: \`${message.author.username}\``)
              .setFooter({
                text: `Reason: Chat protection trigger for \`${trippedFilter.regex}\``,
              }),
          ],
        });
        return;

      case 'timeout':
        // One hour timeout
        await message.member!.timeout(3_600_000);

        channel.send({
          content: message.author.toString(),
          embeds: [
            embed
              .setThumbnail(message.author.displayAvatarURL())
              .setDescription(`TIMEOUT: \`${message.author.username}\``)
              .setFooter({
                text: `Reason: Chat protection trigger for \`${trippedFilter.regex}\``,
              }),
          ],
        });
        return;

      case 'warn':
        await warnUser(
          message.member!,
          util.client.user!,
          `Reason: Chat protection trigger for \`${trippedFilter.regex}\``,
          message.channel as TextChannel,
          true
        );
    }
  });
});

export default chatFilter;
