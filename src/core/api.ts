/**
 * This file contains definitions of discord.js code meant for meshing with the API
 *
 * Specifically the `client`.
 */

import {GatewayIntentBits, Client} from 'discord.js';

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildPresences,
  ],
});
