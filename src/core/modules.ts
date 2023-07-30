/**
 * @file
 * This file contains code for defining new modules and anything else directly related to the "module" side of development
 */

import {EventCategory, logEvent} from './logger.js';
import {botConfig} from './config.js';
import {
  APIApplicationCommandOptionChoice,
  APIEmbed,
  ChatInputCommandInteraction,
  CommandInteractionOption,
} from 'discord.js';

/**
 * Possible valid types for a slash command input
 * @see {@link https://discord.js.org/docs/packages/builders/stable/SlashCommandBuilder:Class#/docs/builders/main/class/SlashCommandBuilder}
 *
 * (discord docs)
 *
 * https://discord.com/developers/docs/interactions/application-commands#application-command-object-application-command-option-type
 *
 * Refer to the `.add*Option()` methods
 */
export enum ModuleOptionType {
  Attachment,
  Boolean,
  Channel,
  Integer,
  Mentionable,
  Number,
  Role,
  String,
  User,
}

/**
 * When slash commands are registered, you can have your slash command accept input with an
 * [Option](https://discordjs.guide/slash-commands/advanced-creation.html#adding-options).
 * Any options specified in the module constructor will be passed to the execution function.
 */
export interface ModuleInputOption {
  /**
   * The type of input you'd like the option to receive.
   * You might want to specify a string, or an integer,
   * or any of the other members of {@link ModuleOptionType}
   */
  type: ModuleOptionType;
  /**
   * The `name` field of a slash command option.
   * This option is required.
   *
   * The supplied string **MUST** comply with the following regex:
   *
   * `/^[-_\p{L}\p{N}\p{sc=Deva}\p{sc=Thai}]{1,32}$/u`
   *
   * Test different names [here](https://regexr.com/7gu4v).
   *
   * I'm unsure why Discord requires this, or why discord.js's regex doesn't match
   * Discord's, but see [here](https://discord.com/developers/docs/interactions/application-commands#application-command-object)
   * for the exact phrasing.
   */
  name: string;
  /**
   * A short message that appears below the name of an option.
   */
  description: string;
  /**
   * If set to true, the user won't be allowed to submit the command unless this option is populated.
   *
   * Defaults to `false` if not set.
   */
  required?: boolean;
  /**
   * If you want to allow the user to select from up to 25 different predetermined options,
   * you can define a list of {@link ApplicationCommandOptionChoiceData}s
   *
   * Autocomplete *cannot* be set to true if you have defined choices, and this
   * only applies for string, integer, and number options.
   *
   * **THIS FUNCTIONALITY IS NOT YET IMPLEMENTED**
   */
  choices?: APIApplicationCommandOptionChoice[];
  /**
   * TODO: autocomplete docstring and other thing
   * https://discordjs.guide/slash-commands/autocomplete.html#responding-to-autocomplete-interactions
   */
}

interface ModuleConfig {
  enabled: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [customProperties: string]: any;
}

/** The function run when a command is called. If an embed is returned, it's automatically sent as a response*/
type ModuleCommandFunction = (
  args: CommandInteractionOption[],
  interaction: ChatInputCommandInteraction
) => Promise<void | APIEmbed>;

/**
 * This allows extension of the bot's initial functionality. Almost all discord facing functionality should be implemented as a module
 * @param command The key phrase that references this module. There must be an extension config key matching this, or the module will be disabled.
 * @param helpMessage This message will be referenced when building help embeds, and is displayed to the user.
 * @param options This is an array of ModuleInputOptions, and will be registered with discord, giving you a way to have input
 * to your slash command.
 * @param onCommandExecute This function is run when a slash command is called in discord
 */
export class BaseModule {
  /**
   * The case insensitive name you want to use to trigger the command. If the command was `foo`, you could type the configured prefix, followed by foo
   */
  readonly name: string;

  /**
   * A string under 100 chars that explains your slash command.
   * A good description may read something like "Kick a member",
   * or "Fetch google search results", where a bad description might be vague,
   * and unhelpful, like "The google slash command", or "google".
   */
  readonly description: string;

  /**
   * A list of things needed for this module to run
   *
   * @see {@link Dependency}
   */
  dependencies: Dependency[] = [];

  /**
   * A list of input options that are registered with the slash command, and then passed to the command during execution as args.
   */
  options: ModuleInputOption[] = [];

  /**
   * Call this whenever you want to act on a command use. If you're just developing the module, set this with `onCommandExecute()`, and
   * the actual execution will be handled by the core.
   */
  executeCommand: ModuleCommandFunction = async () => {};

  /**
   * Whether or not the `initialize()` call was completed. If your initialization function never returns, you need to manually
   * set this to true if you want your command to be accessible. It should automatically be set to true by the core if you don't
   * manually set it and your initialization function completes without error.
   */
  initialized = false;

  /**
   * Call this function when you want to initialize a given module. This is defined with `onInitialize` or in the constructor.
   */
  initialize: () => Promise<void> = async () => {};

  /**
   * Subcommands are referenced by typing the base command, then the subcommand. If a command has subcommands, then onCall should not be set,
   * because it will not be executed to prevent unintended behavior
   *
   * EG: if foo has `bar` and `baz` submodules, a call to `foo` will do nothing but return a help message
   */
  submodules: SubModule[] = [];

  /**
   * The config for the *root extension* specified in config.jsonc. The root extension is the first command in the chain,
   * where if you wanted to call `foo bar baz`, the root would be `foo`. This is set in the constructor automatically by specifying `rootModuleName`
   */
  // Definite assignment: This is either set in the constructor or by `registerSubmodule()`.
  config!: ModuleConfig;

  constructor(
    command: string,
    helpMessage: string,
    options?: ModuleInputOption[],
    onCommandExecute?: ModuleCommandFunction
  ) {
    this.name = command;
    this.description = helpMessage;
    this.options = options ?? [];
    // the default behavior for this is to do nothing
    if (this.onCommandExecute) {
      this.onCommandExecute(onCommandExecute!);
    }
  }

  /**
   * If there are no submodules defined, this allows you to define what will be called whenever the command is used. It can either return nothing,
   * or an embed that will be used to respond to the user. You don't need to make use of the response embed, it's there as a
   * quality of life feature. If submodules are defined, a help message will be returned with help strings and usages for each
   * subcommand
   * @param functionToCall this function gets passed the args (everything past past the command usage),
   * and a [message](https://discord.js.org/#/docs/discord.js/main/class/Message) handle
   */
  onCommandExecute(functionToCall: ModuleCommandFunction) {
    // This could be used to wrap extra behavior into command execution
    this.executeCommand = functionToCall;
  }

  // TODO: make use of botConfig.editConfigOption() and add a method to enable editing the local config for a module without specifying the absolute path.
  // this could be thought of similar to `this.config` vs `botConfig.modules["$CONFIG_NAME"]` every time
}

/**
 * This is meant to be the top level module. It exists because some things are grouped by the root module,
 *  and not every module, EG: whether or not a module is enabled or disabled, or the config for a module
 */
export class RootModule extends BaseModule {
  /**
   * Whether or not the command should be accessible. This is false by default, and will be set via config once a config is located.
   */
  enabled = false;

  /***
   * Create a new RootModule
   * @param command The name by which this command will be registered and callable under.
   * @param description A short (under 100 chars) explanation of your command
   * @param dependencies A list of resources that your module needs before it can be safely executed.
   * This might be a database (util.mongo), an API key, or anything else, you can define {@link Dependency}s as needed.
   * @param options A list of {@link ModuleInputOption}s to be registered with discord and passed to your command as input.
   * This should only be defined if you have no subcommands.
   * @param onCommandExecute This function is called when a slash command is sent in discord.
   */
  constructor(
    command: string,
    description: string,
    dependencies: Dependency[],
    options?: ModuleInputOption[],
    onCommandExecute?: ModuleCommandFunction
  ) {
    super(command, description, options ?? [], onCommandExecute);
    this.dependencies = dependencies;
    // the preset for this is a "safe" default,
    // so we just don't set it at all
    if (onCommandExecute !== undefined) {
      this.onCommandExecute(onCommandExecute);
    }
    // make sure the config exists
    if (this.name in botConfig.modules) {
      this.config = botConfig.modules[this.name];
      this.enabled = this.config.enabled;
    } else {
      logEvent(
        EventCategory.Warning,
        'core',
        `No config option found for "${this.name}" in the config,` +
          'this module will be disabled.',
        1
      );
    }
  }

  /**
   * Set a function to call when first loading the module. If you want to have a module with daemon functionality, this would be one way to implement it
   */
  onInitialize(functionToInitializeWith: () => Promise<void>): void {
    this.initialize = functionToInitializeWith;
  }

  /**
   * Add a submodule to the current module
   * @param submoduleToRegister Submodule you'd like to add to the current Module
   */
  registerSubModule(submoduleToRegister: SubModule): void {
    submoduleToRegister.rootModuleName = this.name;
    // sort of a non-null assertion, but null checks happen for the root module,
    // and since all subcommands are disabled, we don't need to worry about initialization.
    submoduleToRegister.config = this.config;
    submoduleToRegister.dependencies = this.dependencies;
    this.submodules.push(submoduleToRegister);
    // also, pass dependencies down the line
  }
}

/**
 * This class can be used to add submodules to a submodule or root module, like a subcommand.
 */
export class SubModule extends BaseModule {
  /**
   * Whatever the top level module for this module is named. If this is not a submodule, this value should be the same as `this.command`.
   *
   * If this is a submodule, it's `this.command`'s value for the default export module
   *
   * This should be set automatically with .registerSubmodule()
   */
  // Definite assignment: Submodules are attached via `registerSubModule()`, which sets this property.
  // without that call, submodules are inaccessible
  rootModuleName!: string;
  /**
   * Create a new SubModule
   * @param command The name by which your module will be referenced, and the name that the slash command will be registered under
   * @param description A short (under 100 chars) description of the command, like a help message.
   * @param options If this module has no submodules, this is a list of options that will be registered with discord,
   * and passed to your command when it's executed
   * @param onCommandExecute This function is called when a user executes a slash command in discord.
   */
  constructor(
    command: string,
    description: string,
    options?: ModuleInputOption[],
    onCommandExecute?: ModuleCommandFunction
  ) {
    super(command, description, options ?? [], onCommandExecute);
  }

  /**
   * Add a submodule to the current module
   * @param submoduleToRegister Submodule you'd like to add to the current Module
   */
  registerSubmodule(submoduleToRegister: SubModule): void {
    submoduleToRegister.rootModuleName = this.rootModuleName;
    // sort of a non-null assertion, but null checks happen for the root module,
    // and since all subcommands are disabled, we don't need to worry about initialization.
    submoduleToRegister.config = this.config;
    submoduleToRegister.dependencies = this.dependencies;
    this.submodules.push(submoduleToRegister);
  }
}

/** This global array is where modules are stored at runtime */
export const modules: RootModule[] = [];

/**
 * The `Dependency` class is meant to provide an elegant way to have "safe" resource access. These resources can be of any type.
 * From strings to objects, you define what you want the dependency's value to be, and it'll be wrapped in easy to use ways to
 * access the value, or check the status of the value (not yet resolved, resolution failed, resolution succeeded)
 *
 * You're probably looking for {@link resolve()} for accessing the value
 *
 * ADR 01 contains a bit more rambling on the topic if you want more
 */
export class Dependency {
  /**
   * The actual "thing" this whole class is talking about. If the dependency is an API key,
   *  then this might be a string containing that API key. If it's a database connection, it may
   * be a client provided by a wrapper library over the API
   * (for example, the [MongoDB client](https://mongodb.github.io/node-mongodb-native/api-generated/mongoclient.html)).
   *
   * This is marked private because we don't want people to directly try to read from the value, because
   * It's preferred that they use "smarter" methods to access this value,
   * use exposed methods like {@link resolve()}
   *
   * The resting state of this value is `null`. This means that no attempt has been made to resolve
   * this dependency.
   *
   * If this value is an error, then an attempt was made to get the resource, but it failed.
   *
   * Otherwise, this is the resource. The resource was already fetched
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private value: null | Error | NonNullable<any> = null;

  /**
   *
   * @param name this value is displayed in error/info/status messages, and should be a short, descriptive term
   * that describes the resource. a good name may be `mongodb` or `google api key`, where a bad name
   * might be `api key`, or `con`.
   * @param attemptResolution This is a developer defined method that tries to resolve the resolution, and return it.
   * This is set and called by {@link resolve()}, but it's called with some extra thorough handling
   * and other stuff that means it should not be called directly. If you realize the resource cannot be retrieved,
   * `throw` an `Error`.
   *
   */
  constructor(
    public name: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private readonly attemptResolution: () => Promise<any>
  ) {}

  /**
   * If an attempt hasn't already been made to resolve this dependency, then try to resolve it.
   * If an attempt has already been made, than it will use whatever was resolved by the first
   * resolution attempt.
   * @returns  This function will return either: The value/result/whatever you want to call it
   * of the dependency, or `null`.
   *
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async resolve(): Promise<any> {
    // if the value is not null, and not an error, then this dependency has already
    // been resolved.
    // see https://stackoverflow.com/questions/30469261/checking-for-typeof-error-in-js
    if (this.value !== null && !this.failed()) {
      return this.value;
    }

    // If there is an error stored, explicitly return `null`.
    // funnily enough, when this value is null, you don't want
    // to return null
    // Ideally, the inside of the module should *never* come into contact with
    // this null value, the module execution code should never be called at all
    if (this.value instanceof Error) {
      return null;
    }
    // if this.value is null no attempt has been made to resolve the value,
    // so try to do that
    try {
      const resolutionResult = await this.attemptResolution();
      this.value = resolutionResult;
      logEvent(
        EventCategory.Info,
        'core',
        'Successfully resolved dependency: ' + this.name,
        3
      );
      return this.value;
    } catch (err) {
      this.value = err;
      logEvent(
        EventCategory.Warning,
        'core',
        `Failed to resolve dependency ${this.name} due to error ${
          (err as Error).name
        }, anything makes use of that dependency will not be available`,
        2
      );
      // if an error is encountered during resolution, null is returned
      return null;
    }
  }

  /**
   * Assertively retrieve the value stored in this dependency. If it has not been resolved yet, an error will be thrown. This is only meant to be used in
   * "safe" contexts, like module execution, because the module has already been successfully resolved
   * @throws Will throw an error if the dependency has not been successfully resolved
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fetchValue(): NonNullable<any> {
    if (this.failed() || !this.resolutionAttempted()) {
      throw new Error(
        `Attempt made to access dependency "${this.name}" that was not resolved`
      );
    }

    return this.value;
  }

  /**
   * Check to see if resolution failed for this dependency.
   */
  failed(): Boolean {
    if (this.value instanceof Error) {
      return true;
    } else {
      return false;
    }
  }

  /**
   * Check to see if an attempt has been made to resolve this dependency
   */
  resolutionAttempted(): Boolean {
    if (this.value !== null) {
      return true;
    } else {
      return false;
    }
  }
}
