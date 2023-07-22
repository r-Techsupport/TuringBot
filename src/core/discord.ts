/**
 * @file
 * This file contains utilities and abstractions to make interacting with discord easier
 */
import {
  APIApplicationCommandOptionChoice,
  APIEmbed,
  ActionRowBuilder,
  ApplicationCommand,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  Collection,
  Client,
  Message,
  InteractionResponse,
  REST,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
  Routes,
  GatewayIntentBits,
  SlashCommandAttachmentOption,
  SlashCommandBooleanOption,
  SlashCommandBuilder,
  SlashCommandChannelOption,
  SlashCommandIntegerOption,
  SlashCommandMentionableOption,
  SlashCommandNumberOption,
  SlashCommandRoleOption,
  SlashCommandStringOption,
  SlashCommandSubcommandBuilder,
  SlashCommandUserOption,
} from 'discord.js';

import {modules, guild} from './main.js';
import {ModuleInputOption, ModuleOptionType, RootModule} from './modules.js';
import {botConfig} from './config.js';
import {EventCategory, logEvent} from './logger.js';

/**
 * Used in pairing with `{@link confirmEmbed()}`, this is a way to indicate whether or not the user confirmed a choice, and is passed as
 * the contents of the Promise returned by `{@link confirmEmbed()}`.
 */
export enum ConfirmEmbedResponse {
  Confirmed = 'confirmed',
  Denied = 'denied',
}

type SlashCommandOption =
  | SlashCommandAttachmentOption
  | SlashCommandBooleanOption
  | SlashCommandChannelOption
  | SlashCommandIntegerOption
  | SlashCommandMentionableOption
  | SlashCommandNumberOption
  | SlashCommandRoleOption
  | SlashCommandStringOption
  | SlashCommandUserOption;

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

/**
 * Helper utilities used to speed up embed work
 */
export const embed = {
  /**
   * simple function that generates a minimal APIEmbed with only the `description` set.
   *  Other options can be set with `otherOptions`
   *
   * @param displayText The text you'd like the embed to contain
   *
   * @param otherOptions Any custom changes you'd like to make to the embed.
   * @see {@link https://discordjs.guide/popular-topics/embeds.html#using-an-embed-object} for specific options
   *
   * @example
   * // Just the description set
   * simpleEmbed("they don't did make em like they anymore these days do");
   * // Maybe you want to make the embed red
   * simpleEmbed("they don't did make em like they anymore these days do", { color: 0xFF0000 });
   */
  simpleEmbed(displayText: string, otherOptions: APIEmbed = {}): APIEmbed {
    otherOptions.description = displayText;
    return otherOptions;
  },

  /**
   * A preformatted embed that should be used to indicate command failure
   */
  errorEmbed(errorText: string): APIEmbed {
    const responseEmbed: APIEmbed = {
      description: '❌ ' + errorText,
      color: 0xf92f60,
      footer: {
        text: 'Operation failed.',
      },
    };
    return responseEmbed;
  },

  successEmbed(successText: string): APIEmbed {
    const responseEmbed: APIEmbed = {
      color: 0x379c6f,
      description: '✅ ' + successText,
    };
    return responseEmbed;
  },

  infoEmbed(infoText: string): APIEmbed {
    const responseEmbed: APIEmbed = {
      color: 0x2e8eea,
      description: infoText,
    };
    return responseEmbed;
  },

  /**
   * This provides a graceful way to ask a user whether or not they want something to happen.
   * @param prompt will be displayed in the embed with the `description` field
   */
  async confirmEmbed(
    prompt: string,
    // this might break if reply() is called twice
    message: ChatInputCommandInteraction,
    timeout = 60
  ): Promise<ConfirmEmbedResponse> {
    // https://discordjs.guide/message-components/action-rows.html
    const confirm = new ButtonBuilder()
      .setCustomId(ConfirmEmbedResponse.Confirmed)
      .setLabel('Confirm')
      .setStyle(ButtonStyle.Success);
    const deny = new ButtonBuilder()
      .setCustomId(ConfirmEmbedResponse.Denied)
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary);

    const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      confirm,
      deny
    );

    let response: InteractionResponse<boolean> | Message;
    // send the confirmation
    if (!message.replied) {
      response = await message.reply({
        embeds: [this.infoEmbed(prompt)],
        components: [actionRow],
      });
    } else {
      response = await message.followUp({
        embeds: [this.infoEmbed(prompt)],
        components: [actionRow],
      });
    }

    // listen for a button interaction
    try {
      const interaction = await response.awaitMessageComponent({
        filter: i => i.user.id === message.member?.user.id,
        time: timeout * 1000,
      });
      response.delete();
      return interaction.customId as ConfirmEmbedResponse;
    } catch {
      // awaitMessageComponent throws an error when the timeout was reached, so this behavior assumes
      // that no other errors were thrown
      response.edit({
        embeds: [
          this.errorEmbed(
            'No interaction was made by the timeout limit, cancelling.'
          ),
        ],
        components: [],
      });
      // delete the embed after 15 seconds
      setTimeout(() => {
        response.delete();
      }, 15_000);
      return ConfirmEmbedResponse.Denied;
    }
  },
};

/**
 * Obtain a list of all commands in {@link modules} that have not been registered yet
 * @throws Will throw an error if the discord client has not been instantiated
 */
export async function getUnregisteredSlashCommands(): Promise<RootModule[]> {
  if (!client.isReady) {
    throw new Error(
      'Attempt made to get slash commands before client was initialized'
    );
  }
  /** A list of every root module without a slash command registered */
  const unregisteredSlashCommands: RootModule[] = [];
  /** A discord.js collection of every command registered */
  const allSlashCommands: Collection<string, ApplicationCommand> =
    await guild.commands.fetch();
  for (const module of modules) {
    /** This value is either undefined, or the thing find() found */
    const searchResult = allSlashCommands.find(
      slashCommand => slashCommand.name === module.name
    );
    // if it's undefined, than assume a slash command was not registered for that module
    if (searchResult === undefined) {
      unregisteredSlashCommands.push(module);
    }
  }
  return unregisteredSlashCommands;
}

// there's a lot of deep nesting and misdirection going on down here, this could probably be greatly improved
/**
 * Register a root module as a [discord slash command](https://discordjs.guide/creating-your-bot/command-deployment.html#guild-commands)
 * @param module The root module to register as a slash command.
 * All subcommands will also be registered
 */
export async function generateSlashCommandForModule(
  module: RootModule
): Promise<SlashCommandBuilder> {
  // translate the module to slash command form
  const slashCommand = new SlashCommandBuilder()
    .setName(module.name)
    .setDescription(module.description);

  // if the module has submodules, than register those as subcommands
  // https://discord.com/developers/docs/interactions/application-commands#subcommands-and-subcommand-groups
  // Commands can only be nested 3 layers deep, so command -> subcommand group -> subcommand
  for (const submodule of module.submodules) {
    // If a submodule has submodules, than it should be treated as a subcommand group.
    if (submodule.submodules.length > 0) {
      slashCommand.addSubcommandGroup(subcg => {
        // apparently this all needs to be set inside of this callback to work?
        subcg.setName(submodule.name).setDescription(submodule.description);
        const submodulesInGroup = submodule.submodules;
        for (const submoduleInGroup of submodulesInGroup) {
          // options may need to be added inside of the addSubcommand block
          subcg.addSubcommand(subc => {
            subc
              .setName(submoduleInGroup.name)
              .setDescription(submoduleInGroup.description);
            for (const option of submoduleInGroup.options) {
              addOptionToCommand(subc, option);
            }
            return subc;
          });
        }
        return subcg;
      });
    }
    // if a submodule does not have submodules, it is treated as an executable subcommand instead of a group
    else {
      slashCommand.addSubcommand(subcommand => {
        subcommand.setName(submodule.name);
        subcommand.setDescription(submodule.description);
        for (const option of submodule.options) {
          addOptionToCommand(subcommand, option);
        }
        return subcommand;
      });
    }
  }
  return slashCommand;
}
/** TODO: fill out docs */
function addOptionToCommand(
  command: SlashCommandBuilder | SlashCommandSubcommandBuilder,
  option: ModuleInputOption
): void {
  switch (option.type) {
    case ModuleOptionType.Attachment:
      command.addAttachmentOption(
        newOption =>
          setOptionFieldsForCommand(
            newOption,
            option
          ) as SlashCommandAttachmentOption
      );
      break;
    case ModuleOptionType.Boolean:
      command.addBooleanOption(
        newOption =>
          setOptionFieldsForCommand(
            newOption,
            option
          ) as SlashCommandBooleanOption
      );
      break;
    case ModuleOptionType.Channel:
      command.addChannelOption(
        newOption =>
          setOptionFieldsForCommand(
            newOption,
            option
          ) as SlashCommandChannelOption
      );
      break;
    case ModuleOptionType.Integer:
      command.addIntegerOption(
        newOption =>
          setOptionFieldsForCommand(
            newOption,
            option
          ) as SlashCommandIntegerOption
      );
      break;
    case ModuleOptionType.Mentionable:
      command.addMentionableOption(
        newOption =>
          setOptionFieldsForCommand(
            newOption,
            option
          ) as SlashCommandMentionableOption
      );
      break;
    case ModuleOptionType.Number:
      command.addNumberOption(
        newOption =>
          setOptionFieldsForCommand(
            newOption,
            option
          ) as SlashCommandNumberOption
      );
      break;
    case ModuleOptionType.Role:
      command.addRoleOption(
        newOption =>
          setOptionFieldsForCommand(newOption, option) as SlashCommandRoleOption
      );
      break;
    case ModuleOptionType.String:
      command.addStringOption(
        newOption =>
          setOptionFieldsForCommand(
            newOption,
            option
          ) as SlashCommandStringOption
      );
      break;
    case ModuleOptionType.User:
      command.addUserOption(
        newOption =>
          setOptionFieldsForCommand(newOption, option) as SlashCommandUserOption
      );
      break;
  }
}

/**
 * Set the name, description, and whether or not the option is required
 * @param option The option to set fields on
 * @param setFromModuleOption The {@link ModuleInputOption} to read from
 */
function setOptionFieldsForCommand(
  option: SlashCommandOption,
  setFromModuleOption: ModuleInputOption
) {
  // TODO: length and regex validation for the name and description fields,
  // so that you can return a concise error
  option
    .setName(setFromModuleOption.name)
    .setDescription(setFromModuleOption.description)
    .setRequired(setFromModuleOption.required ?? false);
  if (
    setFromModuleOption.choices !== undefined &&
    [
      ModuleOptionType.Integer,
      ModuleOptionType.Number,
      ModuleOptionType.String,
    ].includes(setFromModuleOption.type)
  ) {
    // this could be integer, number, or string
    (option as SlashCommandStringOption).addChoices(
      ...(setFromModuleOption.choices! as APIApplicationCommandOptionChoice<string>[])
    );
  }
  return option;
}

/** Register the passed list of slash commands to discord, completely overwriting the previous version. There is no way to register a single new slash command. */
// TODO: maybe there is (https://discord.com/developers/docs/interactions/application-commands#create-guild-application-command)
export async function registerSlashCommandSet(
  commandSet: SlashCommandBuilder[]
) {
  // ship the provided list off to discord to discord
  // https://discordjs.guide/creating-your-bot/command-deployment.html#guild-commands
  const rest = new REST().setToken(botConfig.authToken);
  /** list of slash commands, converted to json, to be sent off to discord */
  const commands: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [];
  for (const command of commandSet) {
    commands.push(command.toJSON());
  }
  // send everything to discord
  // The put method is used to fully refresh all commands in the guild with the current set
  await rest.put(
    Routes.applicationGuildCommands(botConfig.applicationId, guild.id),
    {
      body: commands,
    }
  );
  logEvent(EventCategory.Info, 'core', 'Slash commands refreshed.', 2);
}
