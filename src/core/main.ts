import {readdirSync, Dirent} from 'fs';
import {
  APIEmbedField,
  Events,
  APIEmbed,
  ChatInputCommandInteraction,
  CommandInteractionOption,
} from 'discord.js';

import {botConfig} from './config.js';
import {EventCategory, logEvent} from './logger.js';
import {DependencyStatus, RootModule, SubModule, modules} from './modules.js';
import {client} from './api.js';
import path from 'path';
import {fileURLToPath} from 'url';
import {embed} from './embed.js';
import {
  generateSlashCommandForModule,
  registerSlashCommandSet,
  replyToInteraction,
} from './slash_commands.js';
import {checkInteractionAgainstPermissionConfig} from './permissions.js';

// load the config from config.default.jsonc
botConfig.readConfigFromFileSystem();

logEvent(EventCategory.Info, 'core', 'Starting...', 2);

// This allows catching and handling of async errors, which would normally fully error
process.on('unhandledRejection', (error: Error) => {
  logEvent(
    EventCategory.Error,
    'core',
    `An unhandled async error occurred: \`\`\`\n${error.name}\n${error.stack}\`\`\``,
    1
  );
});

// When the bot initializes a connection with the discord API
client.once(Events.ClientReady, async () => {
  logEvent(EventCategory.Info, 'core', 'Initialized Discord connection', 2);

  await importModules();
  const newSlashCommands = [];
  for (const module of modules) {
    newSlashCommands.push(generateSlashCommandForModule(module));
  }
  // TODO: unregister slash commands if disabled, and detect any changes to slash commands
  await registerSlashCommandSet(await Promise.all(newSlashCommands));
  await initializeModules();
  listenForSlashCommands();
  logEvent(
    EventCategory.Info,
    'core',
    'Initialization completed, ready to receive commands.',
    2
  );
});

// Login to discord
client.login(botConfig.authToken);

/**
 * This function imports the default export from the file specified, and pushes each module to
 * {@link modules}
 * @param path The location of the file to import module(s) from
 */
async function importModulesFromFile(path: string): Promise<void> {
  // get the *default* export from each file and add it to the array of modules
  // dynamic imports import relative to the path of the file being run
  const fileExport = await import(path);
  // to allow multiple module exports from the same file, if they exported an array, then iterate over it
  if (Array.isArray(fileExport.default)) {
    for (const module of fileExport.default) {
      modules.push(module);
    }
  } else {
    // there's only one module
    modules.push(fileExport.default);
  }
}

/**
 * Start an event listener that executes received slash commands
 * https://discordjs.guide/creating-your-bot/command-handling.html#receiving-command-interactions */
function listenForSlashCommands() {
  client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) {
      return;
    }
    const command = interaction.commandName;
    const group = interaction.options.getSubcommandGroup();
    const subcommand = interaction.options.getSubcommand(false);

    const commandPath: string[] = [];
    commandPath.push(command);
    if (group !== null) {
      commandPath.push(group);
    }
    if (subcommand !== null) {
      commandPath.push(subcommand);
    }
    const resolutionResult = resolveModule(commandPath);
    if (resolutionResult.foundModule !== null) {
      // validate permissions
      // if a permission config was not defined, treat it as empty
      const permissionConfig =
        resolutionResult.foundModule.config.permissions ?? {};
      // this returns a list of reasons not to run the command, so if the list is empty,
      // continue with execution
      let deniedReasons: string[] = checkInteractionAgainstPermissionConfig(
        interaction,
        permissionConfig
      );
      // it's also possible to specify permissions per-submodule, and per submodule group
      // checking 2 layers deep, eg `/foo bar`
      if (resolutionResult.modulePath.length === 2) {
        const submodulePermissionResults =
          checkInteractionAgainstPermissionConfig(
            interaction,
            permissionConfig.submodulePermissions[
              resolutionResult.modulePath[1]
            ] ?? {}
          );
        deniedReasons = deniedReasons.concat(submodulePermissionResults);
      }

      // 3 layers deep, EG `/foo bar bat`
      if (resolutionResult.modulePath.length === 3) {
        const subSubmodulePermissionResults =
          checkInteractionAgainstPermissionConfig(
            interaction,
            permissionConfig.submodulePermissions[
              resolutionResult.modulePath[1]
            ].submodulePermissions[resolutionResult.modulePath[2]]
          );
        deniedReasons = deniedReasons.concat(subSubmodulePermissionResults);
      }

      if (deniedReasons.length > 0) {
        await replyToInteraction(interaction, {
          embeds: [
            embed.errorEmbed(
              'You are unable to execute this command for the following reasons:\n- ' +
                deniedReasons.join('\n- ')
            ),
          ],
        });
        return;
      }
      executeModule(resolutionResult.foundModule, interaction);
    }
  });
}

interface ModuleResolutionResult {
  /** The module found, or null, if no module was found at all */
  foundModule: RootModule | SubModule | null;
  /** The list of tokens that points to the module */
  modulePath: string[];
  /** Everything after the module path that is not a part of the path, should be treated as module arguments. */
  leftoverTokens: string[];
}

/** Sort of like a file path, given a list of tokens, look through the modules array and find the module the list points to */
export function resolveModule(tokens: string[]): ModuleResolutionResult {
  /*
   * If tokens[0] a valid reference to the top level of any module in modules,
   * set currentMod to the matching module.
   * Check tokens[1] against all submodules of currentMod.
   * If match, increment token checker and set currentMod to that submodule
   * if no match is found, or a module has no more submodules, attempt to execute that command
   */

  /**
   * As the command is processed, every time the next token points to a valid module, it's dumped here
   */
  const modulePath: string[] = [];

  // initial check to see if first term refers to a module in the `modules` array
  /**
   * Try to get a module from the `modules` list with the first token. If it's found, the first token is removed.
   *
   * @returns Will return nothing if it doesn't find a module, or return the module it found
   */
  function getModWithFirstToken(): RootModule | void {
    const token = tokens[0].toLowerCase();
    for (const mod of modules) {
      if (token === mod.name) {
        modulePath.push(tokens.shift()!);
        return mod;
      }
    }
  }

  const foundRootModule = getModWithFirstToken();
  if (foundRootModule === undefined) {
    return {
      foundModule: null,
      modulePath: modulePath,
      leftoverTokens: tokens,
    };
  }

  /**
   * This module is recursively set as submodules are searched for
   */
  let currentModule: RootModule | SubModule = foundRootModule;

  // this code will resolve currentModule to the last valid module in the list of tokens,
  // removing the first token and adding it to
  while (tokens.length > 0) {
    // lowercase version of the token used for module resolution
    const token = tokens[0].toLowerCase();
    let moduleFound = false;
    // first check to see if the first token in the list references a module
    // The below check is needed because it's apparently a 'design limitation' of typescript.
    // https://github.com/microsoft/TypeScript/issues/43047
    // @ts-expect-error 7022
    for (const mod of currentModule.submodules) {
      if (token === mod.name) {
        currentModule = mod;
        // remove the first token from tokens
        // non-null assertion: this code is only reachable if tokens[0] is set
        // the first element in the tokens array is used over `token` because the array preserves case,
        // while `token` does not
        modulePath.push(tokens.shift()!);
        moduleFound = true;
        break;
      }
    }
    // the token doesn't reference a command, move on, stop trying to resolve
    if (!moduleFound) {
      break;
    }
  }

  return {
    foundModule: currentModule,
    modulePath: modulePath,
    leftoverTokens: tokens,
  };
}

/** Resolve all dependencies for a module, and then execute it, responding to the user with an error if needed */
async function executeModule(
  module: RootModule | SubModule,
  interaction: ChatInputCommandInteraction
) {
  // deferReply wasn't set or it is false
  if (module.deferReply === true) {
    await interaction.deferReply();
  }

  // TODO: move this to a separate function
  // no submodules, it's safe to execute the command and return
  // first iterate over all dependencies and resolve them. if resolution fails, then return an error message
  for (const dep of module.dependencies) {
    if (dep.status === DependencyStatus.Failed) {
      void replyToInteraction(interaction, {
        embeds: [
          embed.errorEmbed(
            `Unable to execute command because resolution failed for dependency "${dep.name}"`
          ),
        ],
      });
      return;
    }
  }

  // next figure out where the correct options are located, to pass to the module
  // could be considered for minor optimizations
  let options: CommandInteractionOption[];
  // though a bit odd, the options are actually located at a different place in the object
  // tree when a subcommand is used
  const foundSubcommand = interaction.options.getSubcommand(false);
  if (foundSubcommand !== null) {
    options = interaction.options.data[0].options!;
  } else {
    options = Array.from(interaction.options.data);
  }

  // execute the command
  // There may be possible minor perf/mem overhead from calling Array.from to un-readonly the array,
  module
    .executeCommand(Array.from(options), interaction)
    .then((value: void | APIEmbed) => {
      // enable modules to return an embed
      if (value !== undefined) {
        void replyToInteraction(interaction, {embeds: [value!]});
      }
    })
    .catch((err: Error) => {
      logEvent(
        EventCategory.Error,
        'core',
        `Encountered an error running command ${module.name}:` +
          '```' +
          err.name +
          '\n' +
          err.stack +
          '```',
        3
      );
      void replyToInteraction(interaction, {
        embeds: [
          embed.errorEmbed(
            'Command returned an error:\n' +
              '```' +
              err.name +
              '\n' +
              err.stack +
              '```'
          ),
        ],
      })
        // If the command times out, it would return an error which would call this and make an infinite recursion loop
        .catch((err: Error) => {
          logEvent(
            EventCategory.Error,
            'core',
            `Couldn't respond message with error! Trace: \`${err.message}\``,
            3
          );
        });
    });
}

/**
 * Generate an embed that contains a neatly formatted help message for the specified module,
 * telling the user they didn't use that command correctly.
 * @param mod The module to generate documentation for. This function assumes that this module has subcommands
 * @param priorCommands If specified, this will format the help message to make the command include these.
 * So if the user typed `foo bar baz`, and you want to generate a help message, you can make help strings
 * include the full command
 * @deprecated I don't think this is needed anymore with the slash command migration
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function generateHelpMessageForModule(
  mod: SubModule | RootModule,
  priorCommands = ''
): APIEmbed {
  // make a list of fields to use  based off of commands and help strings
  // TODO: possibly make it exclude the subcommands bit if there are none, or change it to indicate
  // that it's a subcommand
  const helpFields: APIEmbedField[] = [];
  for (const submod of mod.submodules) {
    helpFields.push({
      name: `\`${priorCommands} ${submod.name}\``,
      value: `${submod.description} \n(${submod.submodules.length} subcommands)`,
    });
  }

  return {
    title: 'Invalid command usage. Subcommands for current command:',
    fields: helpFields,
    color: 0x2e8eea,
  };
}

/**
 * Iterate over the `modules` list and call `initialize()` on each module in the list
 */
async function initializeModules(): Promise<void> {
  // enable concurrent initialization
  const initializationJobs: Promise<void>[] = [];
  for (const mod of modules) {
    initializationJobs.push(initializeModule(mod));
  }
  await Promise.allSettled(initializationJobs);
}

/** Given a root module, initialize dependencies and call .initialize(), if the module is enabled. */
async function initializeModule(module: RootModule): Promise<void> {
  if (module.enabled) {
    // by starting all of the resolve() calls at once then awaiting completion, it's considerably more efficient
    const dependencyJobs: Array<Promise<unknown>> = [];
    for (const dependency of module.dependencies) {
      dependencyJobs.push(dependency.resolve());
    }
    const jobResults = await Promise.all(dependencyJobs);
    // if resolution failed
    if (jobResults.includes(DependencyStatus.Failed)) {
      logEvent(
        EventCategory.Warning,
        'core',
        `Initialization of one of the dependencies for "${module.name}" did not complete successfully, this module will not be accessible`,
        1
      );
      return;
    }
    await module
      .initialize()
      .then(() => {
        logEvent(
          EventCategory.Info,
          'core',
          `Initialized module: ${module.name}`,
          2
        );
      })
      .catch(() => {
        logEvent(
          EventCategory.Error,
          'core',
          `Module \`${module.name}\` ran into an error during initialization call. This module will be disabled`,
          1
        );
        module.config.enabled = false;
      });
  } else {
    logEvent(
      EventCategory.Info,
      'core',
      'Encountered disabled module: ' + module.name,
      3
    );
  }
}

/** Function to import all modules. */
async function importModules() {
  // Get a list of commands and subcommands to register
  const moduleLocation = fileURLToPath(
    path.dirname(import.meta.url) + '/../modules'
  );
  const files: Dirent[] = readdirSync(moduleLocation, {withFileTypes: true});

  // Used to accelerate the speed of the imports
  const importPromises = [];

  for (const file of files) {
    // If we've hit a directory, then attempt to fetch the modules from a file with the same name
    // as the directory found
    if (file.isDirectory()) {
      const subDirectory = readdirSync(moduleLocation + '/' + file.name);
      // look for a file with the same name as the directory encountered
      for (const subFile of subDirectory) {
        if (subFile.startsWith(file.name)) {
          importPromises.push(
            importModulesFromFile('../modules/' + file.name + '/' + subFile)
          );
          break;
        }
      }
    } else {
      // Prevent map files from being loaded as modules, they're used to allow the debugger
      // to point to the typescript files with errors
      if (!file.name.endsWith('.map')) {
        importPromises.push(importModulesFromFile('../modules/' + file.name));
      }
    }
  }
  // Runs all import tasks
  await Promise.all(importPromises);
}
