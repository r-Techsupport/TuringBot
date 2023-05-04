/*
 * This file contains utilities and abstractions to make interacting with discord easier and more convenient.
 */

import { APIEmbed } from "discord.js";

/**
 * Helper utilities used to speed up embed work
 */
export const quickEmbed = {
    /**
     * simple function that generates a minimal DiscordEmbed with only the `description` set. Other options can be set with `otherOptions`
     *
     * ```
     * // Just the description set
     * simpleEmbed("they don't did make em like they anymore these days do")
     * // Maybe you want a color
     * simpleEmbed("they don't did make em like they anymore these days do", { color: 0xFF0000 })
     * ```
     * @param displayText The text you'd like the embed to contain
     * @param otherOptions Any other options, specified in an object
     * @returns DiscordEmbed
     */
    simpleEmbed(displayText: string, otherOptions: APIEmbed = {}): APIEmbed {
        otherOptions.description = displayText;
        return otherOptions;
    },
};
