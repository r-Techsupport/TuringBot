/**
 * @file
 * This file contains code for defining new modules and anything else directly related to the "module" side of development
 */

import {EventCategory, logEvent} from './logger.js';
import {botConfig} from './config.js';
import {APIEmbed, Message} from 'discord.js';

interface ModuleConfig {
  enabled: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [customProperties: string]: any;
}

/**
 * This allows extension of the bot's initial functionality. Almost all discord facing functionality should be implemented as a module
 * @param command The key phrase that references this module. There must be an extension config key matching this, or the module will be disabled.
 * @param helpMessage This message will be referenced when building help embeds, and is displayed to the user.
 * @param onCommandExecute
 * @param rootModuleName
 */
export class BaseModule {
  /**
   * The case insensitive name you want to use to trigger the command. If the command was `foo`, you could type the configured prefix, followed by foo
   */
  readonly command: string;

  /**
   * Any alternative phrases you want to trigger the command. If the command was `foobar` you could maybe use `fb` or `f`
   */
  readonly aliases: string[] = [];

  /**
   * This message will be displayed when the `help` utility is called, and when a command that has subcommands is referenced
   */
  readonly helpMessage: string;

  /**
   * A list of things needed for this module to run
   *
   * @see {@link Dependency}
   */
  dependencies: Dependency[] = [];

  /**
   * Call this whenever you want to act on a command use. If you're just developing the module, set this with `onCommandExecute()`, and
   * the actual execution will be handled by the core.
   */
  executeCommand: (
    args: string | undefined,
    msg: Message
  ) => Promise<void | APIEmbed> = async () => {};

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
    onCommandExecute?: (
      args: string | undefined,
      msg: Message
    ) => Promise<void | APIEmbed>
    //       rootModuleName?: string
  ) {
    this.command = command;
    this.helpMessage = helpMessage;
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
  onCommandExecute(
    functionToCall: (
      args: string | undefined,
      msg: Message
    ) => Promise<void | APIEmbed>
  ) {
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

  // TODO: docstrings
  constructor(
    command: string,
    helpMessage: string,
    dependencies: Dependency[],
    onCommandExecute?: (
      args: string | undefined,
      msg: Message
    ) => Promise<void | APIEmbed>
  ) {
    super(command, helpMessage, onCommandExecute);
    this.dependencies = dependencies;
    // the preset for this is a "safe" default,
    // so we just don't set it at all
    if (onCommandExecute !== undefined) {
      this.onCommandExecute(onCommandExecute);
    }
    // make sure the config exists
    if (this.command in botConfig.modules) {
      this.config = botConfig.modules[this.command];
      this.enabled = this.config.enabled;
    } else {
      logEvent(
        EventCategory.Warning,
        'core',
        `No config option found for "${this.command}" in the config,` +
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
    submoduleToRegister.rootModuleName = this.command;
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
   */
  // Definite assignment: Submodules are attached via `registerSubModule()`, which sets this property.
  // without that call, submodules are inaccessible
  rootModuleName!: string;

  constructor(
    command: string,
    helpMessage: string,
    onCommandExecute?: (
      args: string | undefined,
      msg: Message
    ) => Promise<void | APIEmbed>
  ) {
    super(command, helpMessage, onCommandExecute);
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
   * be the client provided by a wrapper library over the API
   * (for example, the [MongoDB client](https://mongodb.github.io/node-mongodb-native/api-generated/mongoclient.html)).
   *
   * This is marked private because we don't want people to directly try to read from the value, because
   * then it won't go through all of the robust checks and such. To access this value,
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
