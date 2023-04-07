/*
 * This file contains QuickEmbed helper utilities, used for building and sending embeds
 */

/**
 * https://discordjs.guide/popular-topics/embeds.html#using-an-embed-object
 *
 * https://leovoel.github.io/embed-visualizer/
 *
 * This is a typed interface of a discord embed object
 */
export interface DiscordEmbed {
    color?: number;
    title?: string;
    url?: string;
    author?: {
        name?: string;
        icon_url?: string;
        url?: string;
    };
    description?: string;
    thumbnail?: {
        url: string;
    };
    fields?: {
        name: string;
        value: string;
        inline?: boolean;
    }[];
    image?: {
        url: string;
    };
    timestamp?: string;
    footer?: {
        text?: string;
        icon_url?: string;
    };
}

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
    simpleEmbed(
        displayText: string,
        otherOptions: DiscordEmbed = {}
    ): DiscordEmbed {
        otherOptions.description = displayText;
        return otherOptions;
    },
};
