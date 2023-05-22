import { readdirSync } from "fs";
import { APIEmbedField, Client, Events, GatewayIntentBits, Message, APIEmbed } from "discord.js";

import { botConfig } from "./config.js";
import { EventCategory, eventLogger } from "./logger.js";
import { RootModule, SubModule } from "./modules.js";
import { quickEmbed } from "./discord.js";
import { describe } from "node:test";

export const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

botConfig.readConfigFromFileSystem();

let modules: RootModule[] = [];

// When the bot initializes a connection with the discord API
client.once(Events.ClientReady, async (clientEvent) => {
    // let the logger know it's ok to try and start logging events in Discord
    eventLogger.discordInitialized = true;
    eventLogger.logEvent(
        {
            category: EventCategory.Info,
            location: "core",
            description: "Initialized Discord connection",
        },
        2
    );

    // `readdir` relative paths are based on the pwd of the node process
    let files = readdirSync("./target/modules");
    for (const file of files) {
        // Prevent map files from being loaded as modules, they're used to allow the debugger
        // to point to the typescript files with errors
        if (!file.endsWith(".map")) {
            // get the default import from each file and add it to the array of modules
            // dynamic imports import relative to the path of the file being run
            let mod = await import("../modules/" + file);
            modules.push(mod.default);
        }
    }

    initializeModules();
    listen();
});

/**
 * Start a listener that checks to see if a user called a command, and then check
 *  `modules` for the appropriate code to run
 */
function listen() {
    client.on(Events.MessageCreate, async (message) => {
        // Check to see if the message starts with the correct prefix and wasn't sent by the bot (test user aside)
        if (message.author.bot && message.author.id != botConfig.testing.userID) return;
        if (!botConfig.prefixes.includes(message.content.charAt(0))) return;

        // message content split by spaces, with the prefix removed from the first item
        let tokens = message.content.split(" ");
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
        let commandUsed: string[] = [];

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

        let foundRootModule = getModWithFirstToken();
        if (!foundRootModule) {
            return;
        }

        /**
         * This module is recursively set as submodules are searched for
         */
        let currentModule: RootModule | SubModule = foundRootModule;

        // this code will resolve currentModule to the last valid module in the list of tokens,
        // removing the first token and adding it to
        while (tokens.length > 0) {
            const token = tokens[0].toLowerCase();
            // first check to see if the first token in the list references a module or any of its aliases
            for (const mod of currentModule.submodules) {
                if (token === mod.command || mod.aliases.includes(token)) {
                    currentModule = mod;
                    // remove the first token from tokens
                    // non-null assertion: this code is only reachable if tokens[0] is set
                    // `token` is not used here because it doesn't match the command used casewise, and was just defined for comparison purposes
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
            // no submodules, it's safe to execute the command and return
            currentModule
                .executeCommand(commandUsed.join(" "), message)
                .then((value: void | APIEmbed) => {
                    // enable modules to return an embed
                    if (value) {
                        message.reply({ embeds: [value] });
                    }
                })
                .catch((err: Error) => {
                    message.reply({
                        embeds: [quickEmbed.errorEmbed("Command returned an error:\n" + "```" + err + "```")],
                    });
                });
            return;
        } else {
            // there are submodules, display help message
            message.reply({ embeds: [generateHelpMessageForModule(currentModule, commandUsed.join(" "))] });
            return;
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
function generateHelpMessageForModule(mod: SubModule | RootModule, priorCommands: string = ""): APIEmbed {
    // make a list of fields to use  based off of commands and help strings
    // TODO: possibly make it exclude the subcommands bit if there are none, or change it to indicate
    // that it's a subcommand
    let helpFields: APIEmbedField[] = [];
    for (let submod of mod.submodules) {
        helpFields.push({
            name: `\`${priorCommands} ${submod.command}\``,
            value: `${submod.helpMessage} \n(${submod.submodules.length} subcommands)`,
        });
    }

    return {
        title: "Invalid command usage. Subcommands for current command:",
        fields: helpFields,
        color: 0xff0000,
    };
}

/**
 * Iterate over the `modules` list and call `initialize()` on each module in the list
 */
function initializeModules() {
    for (let mod of modules) {
        if (mod.enabled === true) {
            eventLogger.logEvent(
                {
                    category: EventCategory.Info,
                    location: "core",
                    description: `Initializing module: ${mod.command}`,
                },
                3
            );
            mod.initialize().catch(() => {
                eventLogger.logEvent(
                    {
                        category: EventCategory.Error,
                        location: "core",
                        description: `Module \`${mod.command}\` ran into an error during initialization call. This module will be disabled`,
                    },
                    1
                );
            });
        } else {
            eventLogger.logEvent({category: EventCategory.Info, location: "core", description: "Encountered disabled module: " + mod.command}, 3)
        }
    }
}

//Login to discord
client.login(botConfig.authToken);
