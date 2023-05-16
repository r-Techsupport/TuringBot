import { copyFile, copyFileSync, read, readdir, readdirSync } from "fs";
import path from "path";
import { Client, Events, GatewayIntentBits } from "discord.js";

import { botConfig } from "./config.js";
import { EventCategory, eventLogger } from "./logger.js";
import { Module } from "./modules.js";
import type { Module as TModule } from "./modules.js";

export const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

botConfig.readConfigFromFileSystem();

let modules: TModule[] = [];

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

    await initializeModules();
});

/**
 * Start a listener that checks to see if a user called a command, and then check
 *  `modules` for the appropriate code to run
 */
function listen() {
    client.on(Events.MessageCreate, async (message) => {
        // Check to see if the message starts with the correct prefix and wasn't sent by the bot (test user aside)
        if (message.author.bot && message.author.id != botConfig.testing.userID) return;
        if (!(message.content[0] in botConfig.prefixes)) return;

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

        /** the module being checked against, this value is updated as we iterate over nested modules */
        let currentModule: Module;
        // first check and see if the first token references a module or any of its aliases
        // if it's not, stop doing anything and return
        for (const mod of modules) {
            if (tokens[0].toLowerCase() === mod.command || tokens[0].toLowerCase() in mod.aliases) {
                currentModule = mod;

                // remove the first token from tokens
                // non-null assertion: this code is only reachable if tokens[0] is set
                commandUsed.push(tokens.shift()!);
            } else {
                return;
            }
        }
        // at this point, assume the user is referencing a valid command

        // If it's not enabled, return and log an event
        // TODO: let the user know that they tried to use a disabled command
        // non-null assertion: The code returns prior to this point if currentModule isn't set. This also applies for the rest of the function below
        if (!currentModule!.enabled) {
            eventLogger.logEvent(
                {
                    category: EventCategory.Warning,
                    description: `Attempt made to use disabled command: ${commandUsed.join(" ")}`,
                    location: "core",
                },
                2
            );
            return;
        }

        // If there are no submodules, execute the command and be on your merry way
        if (currentModule!.submodules.length === 0) {
            currentModule!.executeCommand();
        }

        if (tokens[0].toLowerCase() === currentModule!.command || tokens[0].toLowerCase() in currentModule!.aliases) {
        }
    });
}

async function initializeModules() {
    for (let mod of modules) {
        if (mod.enabled === true) {
            mod.initialize();
        }
    }
}

//Login to discord
client.login(botConfig.authToken);
