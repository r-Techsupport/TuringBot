import { copyFile, copyFileSync, read, readdir, readdirSync } from "fs";
import path from "path";
import { Client, Events, GatewayIntentBits } from "discord.js";

import { botConfig } from "./config.js";
import { eventLogger } from "./logger.js";
import { Module } from "module";

export const client: any = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});
botConfig.readConfigFromFileSystem();

let modules = [];

// When the bot initializes a connection with the discord API
client.once(Events.ClientReady, async (clientEvent) => {
    // let the logger know it's ok to try and start logging events in Discord
    eventLogger.discordInitialized = true;
    eventLogger.logEvent(
        {
            category: "II",
            location: "core",
            description: "Initialized Discord connection",
        },
        2
    );

    // `readdir` relative paths are based on the pwd of the node process
    let files = readdirSync("./modules");
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

async function initializeModules() {
    for (let mod of modules) {
        mod.initialize();
    }
}

//Login to discord
client.login(botConfig.authToken);
