import "fs";
import { Client, Events, GatewayIntentBits } from "discord.js";

import { botConfig } from "./config";
import { eventLogger } from "./logger";

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

//Login to discord
client.login(botConfig.authToken);
