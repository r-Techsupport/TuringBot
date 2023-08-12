/**
 * @file
 * This file contains code for generating slash command structures, registering slash commands,
 * and other misc slash command helper code.
 */

import {
  SlashCommandAttachmentOption,
  SlashCommandBooleanOption,
  SlashCommandChannelOption,
  SlashCommandIntegerOption,
  SlashCommandMentionableOption,
  SlashCommandNumberOption,
  SlashCommandRoleOption,
  SlashCommandStringOption,
  SlashCommandUserOption,
  Collection,
  ApplicationCommand,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
  APIApplicationCommandOptionChoice,
  REST,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
  Routes,
  ChatInputCommandInteraction,
  MessagePayload,
  InteractionReplyOptions,
  BaseMessageOptions,
  Message,
  InteractionResponse,
  TextInputBuilder,
  ModalBuilder,
  TextInputStyle,
  ActionRowBuilder,
  RestOrArray,
  ModalActionRowComponentBuilder,
} from 'discord.js';
import {client} from './api.js';
import {botConfig} from './config.js';
import {logEvent, EventCategory} from './logger.js';
import {
  RootModule,
  modules,
  ModuleInputOption,
  ModuleOptionType,
} from './modules.js';

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
  // https://discord.js.org/#/docs/discord.js/main/class/Guild
  // non-null assertion: the bot not functioning correctly if it's not in any servers is reasonable behavior
  const guild = client.guilds.cache.first()!;
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
  if (module.submodules.length === 0) {
    slashCommand.setName(module.name);
    slashCommand.setDescription(module.description);
    for (const option of module.options) {
      addOptionToCommand(slashCommand, option);
    }
    slashCommand;
  }

  return slashCommand;
}
/**
 * Given a SlashCommand(Subcommand)Builder, mutate the provided command to have the given {@link ModuleInputOption}.
 * This function returns nothing.
 * @param command The command you'd like to add
 * @param option The option to bake into the provided command
 */
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
  const guild = client.guilds.cache.first()!;
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

/** Function to reply to an interaction with provided arguments, uses followup() or editReply() accordingly
 * @param interaction: The interaction to respond to
 * @param payload: The payload to send
 */
export async function replyToInteraction(
  interaction: ChatInputCommandInteraction,
  payload:
    | string
    | MessagePayload
    | InteractionReplyOptions
    | BaseMessageOptions
): Promise<InteractionResponse<boolean> | Message<boolean>> {
  if (interaction.replied) {
    return await interaction.followUp(payload);
  }

  if (interaction.deferred) {
    return await interaction.editReply(payload);
  }

  return await interaction.reply(payload);
}

/**
 * A single modals input field
 * @param id The ID to refer to the input field as
 * @param label The label of the input field
 * @param style The style to use (Short or Paragraph)
 * @param maxLength The maximum input length
 */
interface inputFieldOptions {
  id: string;
  label: string;
  style: TextInputStyle;
  maxLength: number;
}

/**
 * The modal generation options
 * @param id The ID to refer to the modal as
 * @param title The title of the modal
 * @param fields An array of inputFieldOptions
 */
interface modalOptions {
  id: string;
  title: string;
  fields: inputFieldOptions[];
}

/**
 * Generates a modal from args
 * Takes a {@link inputFieldOptions} object as an argument
 * @returns The finished modal object
 */
export function generateModal({id, title, fields}: modalOptions): ModalBuilder {
  const modal: ModalBuilder = new ModalBuilder()
    .setCustomId(id)
    .setTitle(title);

  const components: RestOrArray<ActionRowBuilder<TextInputBuilder>> = [];

  // Adds all components to the modal
  for (const field of fields) {
    const modalComponent: TextInputBuilder = new TextInputBuilder()
      .setCustomId(field.id)
      .setLabel(field.label)
      .setStyle(field.style)
      .setMaxLength(field.maxLength);

    const actionRow =
      new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
        modalComponent
      );
    components.push(actionRow);
  }
  modal.addComponents(components);

  return modal;
}
