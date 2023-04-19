import "fs";
import { readdir } from "fs";
import { Worker } from "worker_threads";
import { Client, Events, GatewayIntentBits } from "discord.js";

import { botConfig } from "./config.js";
import { eventLogger }from "./logger.js";
import { formatDiagnosticsWithColorAndContext } from "typescript";

botConfig.readConfigFromFileSystem();
eventLogger.logEvent({ category: "II", location: "core", description: "Loaded config" }, 2);
export const client: any = new Client({ intents: [GatewayIntentBits.Guilds] });

// When the bot initializes a connection with the discord API
client.once(Events.ClientReady, (clientEvent) => {
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
});

let moduleWorkers = [];

readdir("./modules/", (err, files) => {
    if (err !== null) { throw err; }
    for (const file of files) {

        moduleWorkers.push(new Worker("./modules/" + file));
        // Prevent the .ts extension from being passed to the constructor
        // because extensions are mutable and do impact state, but aren't needed
        //moduleWorkers.push(new Worker(`./modules/` + file.slice(0, -3) + ".js"));
        //moduleWorkers.push(new Worker(`./modules/` + file));
        console.log(moduleWorkers);
    }
});
console.log(moduleWorkers);

//Login to discord
client.login(botConfig.authToken);
