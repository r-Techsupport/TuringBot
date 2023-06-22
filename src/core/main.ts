import {readdirSync, Dirent} from 'fs';
import {
  APIEmbedField,
  Client,
  Events,
  GatewayIntentBits,
  APIEmbed,
  Guild,
} from 'discord.js';

import {botConfig} from './config.js';
import {EventCategory, eventLogger} from './logger.js';
import {RootModule, SubModule} from './modules.js';
import {embed} from './discord.js';
import path from 'path';
import {fileURLToPath} from 'url';

// TODO: re-organize the core to take advantage of typescript namespaces (https://www.typescriptlang.org/docs/handbook/namespaces.html).

/** @see {@link https://discord.js.org/docs/packages/builders/stable/RoleSelectMenuBuilder:Class#/docs/discord.js/main/class/Client } */
export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

/**
 * `GuildMember` is the server specific object for a `User`, so that's fetched
 * to get info like nickname, and perform administrative tasks  on a user.
 *
 * `Guild` is the way to interact with server specific functionality.
 *
 * This makes the assumption that the bot is deployed to 1 guild.
 *
 * @see {@link https://discord.js.org/#/docs/discord.js/main/class/Guild}
 */
// non-null assertion: if the bot isn't in a server, than throwing an error can be considered reasonable behavior
export let guild: Guild = botConfig.readConfigFromFileSystem();

const modules: RootModule[] = [];

// This allows catching and handling of async errors, which would normally fully error
process.on('unhandledRejection', (error: Error) => {
  eventLogger.logEvent(
    {
      category: EventCategory.Error,
      location: 'core',
      description: `An unhandled async error occurred: \`\`\`\n${error.name}\n${error.stack}\`\`\``,
    },
    1
  );
});

// When the bot initializes a connection with the discord API
client.once(Events.ClientReady, async clientEvent => {
  // let the logger know it's ok to try and start logging events in Discord
  eventLogger.discordInitialized = true;
  guild = client.guilds.cache.first()!;
  eventLogger.logEvent(
    {
      category: EventCategory.Info,
      location: 'core',
      description: 'Initialized Discord connection',
    },
    2
  );

  // annoyingly, readdir() calls are relative to the node process, not the file making the call,
  // so it's resolved manually to make this more robust
  const moduleLocation = fileURLToPath(
    path.dirname(import.meta.url) + '/../modules'
  );
  const files: Dirent[] = readdirSync(moduleLocation, {withFileTypes: true});
  for (const file of files) {
    // If we've hit a directory, then attempt to fetch the modules from a file with the same name
    // as the directory found
    // TODO: use Promise.all to speed up module imports
    if (file.isDirectory()) {
      const subDirectory = readdirSync(moduleLocation + '/' + file.name);
      // look for a file with the same name as the directory encountered
      for (const subFile of subDirectory) {
        if (subFile.startsWith(file.name)) {
          await importModulesFromFile(
            '../modules/' + file.name + '/' + subFile
          );
          break;
        }
      }
    } else {
      // Prevent map files from being loaded as modules, they're used to allow the debugger
      // to point to the typescript files with errors
      if (!file.name.endsWith('.map')) {
        await importModulesFromFile('../modules/' + file.name);
      }
    }
  }

  await initializeModules();
  listen();
});

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
 * Start a listener that checks to see if a user called a command, and then check
 *  `modules` for the appropriate code to run
 */
function listen(): void {
  client.on(Events.MessageCreate, async message => {
    // Check to see if the message starts with the correct prefix and wasn't sent by the bot (test user aside)
    if (message.author.bot && message.author.id != botConfig.testing.userID)
      return;
    if (!botConfig.prefixes.includes(message.content.charAt(0))) return;

    // message content split by spaces, with the prefix removed from the first item
    const tokens = message.content.split(' ');
    tokens[0] = tokens[0].substring(1);

    /*
     * If tokens[0] a valid reference to the top level of any module in modules,
     * set currentMod to the matching module.
     * Check tokens[1] against all submodules of currentMod.
     * If match, increment token checker and set currentMod to that submodule
     * if no match is found, or a module has no more submodules, attempt to execute that command
     */

    /**
     * As the command is processed, the command used is dumped here.
     */
    const commandUsed: string[] = [];

    // initial check to see if first term refers to a module in the `modules` array
    /**
     * Try to get a module from the `modules` list with the first token. If it's found, the first token is removed.
     *
     * @returns Will return nothing if it doesn't find a module, or return the module it found
     */
    function getModWithFirstToken(): RootModule | void {
      const token = tokens[0].toLowerCase();
      for (const mod of modules) {
        if (token === mod.command || mod.aliases.includes(token)) {
          commandUsed.push(tokens.shift()!);
          return mod;
        }
      }
    }

    const foundRootModule = getModWithFirstToken();
    if (foundRootModule == null) {
      return;
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
      // first check to see if the first token in the list references a module or any of its aliases
      for (const mod of currentModule.submodules) {
        if (token === mod.command || mod.aliases.includes(token)) {
          currentModule = mod;
          // remove the first token from tokens
          // non-null assertion: this code is only reachable if tokens[0] is set
          // the first element in the tokens array is used over `token` because the array preserves case,
          // while `token` does not
          commandUsed.push(tokens.shift()!);
          continue;
        }
      }
      // the token doesn't reference a command, move on, stop trying to resolve
      break;
    }

    // if we've reached this point, then everything in `commandUsed` points to a valid command,
    /*
     * There are two logical flows that should take place now:
     * - Display help message if the last valid found module (currentModule) has submodules (don't execute to prevent unintended behavior)
     * - If the last valid found module (currentModule) has *no* submodules, then the user is referencing it as a command,
     * and everything after it is a command argument
     */
    if (currentModule.submodules.length === 0) {
      // TODO: move this to a separate function
      // no submodules, it's safe to execute the command and return
      // first iterate over all dependencies and resolve them. if resolution fails, then return an error message
      for (const dep of currentModule.dependencies) {
        const depResult: any = await dep.resolve();
        // .resolve() returns null if resolution failed
        if (depResult === null) {
          void message.reply({
            embeds: [
              embed.errorEmbed(
                `Unable to execute command because dependency "${dep.name}" could not be resolved`
              ),
            ],
          });
          return;
        }
      }
      currentModule
        .executeCommand(tokens.join(' '), message)
        .then((value: void | APIEmbed) => {
          // enable modules to return an embed
          if (value !== null) {
            void message.reply({embeds: [value!]});
          }
        })
        .catch((err: Error) => {
          eventLogger.logEvent(
            {
              category: EventCategory.Error,
              location: 'core',
              description:
                `Encountered an error running command ${currentModule.command}:` +
                '```' +
                err.name +
                '\n' +
                err.stack +
                '```',
            },
            3
          );
          void message.reply({
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
          });
        });
    } else {
      // there are submodules, display help message
      void message.reply({
        embeds: [
          generateHelpMessageForModule(currentModule, commandUsed.join(' ')),
        ],
      });
    }
  });
}

/**
 * Generate an embed that contains a neatly formatted help message for the specified module,
 * telling the user they didn't use that command correctly.
 * @param mod The module to generate documentation for. This function assumes that this module has subcommands
 * @param priorCommands If specified, this will format the help message to make the command include these.
 * So if the user typed `foo bar baz`, and you want to generate a help message, you can make help strings
 * include the full command
 */
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
      name: `\`${priorCommands} ${submod.command}\``,
      value: `${submod.helpMessage} \n(${submod.submodules.length} subcommands)`,
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
  for (const mod of modules) {
    /** If a dependency fails to resolve, this is set to true and the module is not initialized */
    const missingDependency = false;
    // by starting all of the functions at once then awaiting completion, it's considerably more efficient
    const jobs: Array<Promise<any>> = [];
    for (const dependency of mod.dependencies) {
      jobs.push(dependency.resolve());
    }
    const jobResults = await Promise.all(jobs);
    if (jobResults.includes(null)) {
      continue;
    }
    if (mod.enabled) {
      eventLogger.logEvent(
        {
          category: EventCategory.Info,
          location: 'core',
          description: `Initializing module: ${mod.command}`,
        },
        3
      );
      mod.initialize().catch(() => {
        eventLogger.logEvent(
          {
            category: EventCategory.Error,
            location: 'core',
            description: `Module \`${mod.command}\` ran into an error during initialization call. This module will be disabled`,
          },
          1
        );
      });
    } else {
      eventLogger.logEvent(
        {
          category: EventCategory.Info,
          location: 'core',
          description: 'Encountered disabled module: ' + mod.command,
        },
        3
      );
    }
  }
}

// Login to discord
client.login(botConfig.authToken);
