/*
 * This file contains utilities and abstractions to make interacting with discord easier and more convenient.
 */

import { APIEmbed } from "discord.js";

/**
 * Helper utilities used to speed up embed work
 */
export const quickEmbed = {
    /**
     * simple function that generates a minimal APIEmbed with only the `description` set.
     *  Other options can be set with `otherOptions`
     *
     * @param displayText The text you'd like the embed to contain
     *
     * @param otherOptions Any custom changes you'd like to make to the embed.
     * See https://discordjs.guide/popular-topics/embeds.html#using-an-embed-object for specific options
     *
     * @example
     * // Just the description set
     * simpleEmbed("they don't did make em like they anymore these days do");
     * // Maybe you want to make the embed red
     * simpleEmbed("they don't did make em like they anymore these days do", { color: 0xFF0000 });
     */
    simpleEmbed(displayText: string, otherOptions: APIEmbed = {}): APIEmbed {
        otherOptions.description = displayText;
        return otherOptions;
    },

    /**
     * A pre-formatted embed that should be used to indicate command failure
     */
    errorEmbed(errorText: string): APIEmbed {
        let responseEmbed: APIEmbed = {
            description: "❌ " + errorText,
            color: 0xff0000,
            footer: {
                text: "Operation failed.",
            },
        };
        return responseEmbed;
    },
};
