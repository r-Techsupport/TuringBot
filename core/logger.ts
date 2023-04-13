/*
 * This file contains the code for the EventLogger class. It will be used to log system events, with configuration support for various levels of verbosity.
 */

// Used to color stdout console colors
import chalk from "chalk";

import { botConfig } from "./config";
import { DiscordEmbed } from "./embed";
import { client } from "./main";

/**
 * Different levels of verbose logging.
 *
 * `0`: No logging, no events will be logged
 *
 * `1`: Very minimalist logging, including core and module starting, as well as module failure.
 *
 * `2`: Slightly more verbose logging, may log some important info events
 *
 * `3`: Will log commands used and all info passed through eventLogger
 *
 */
export type VerbosityLevel = 0 | 1 | 2 | 3;
/**
 * `II` - Information
 *
 * `WW` - Warning
 *
 * `EE` - Error; The logger will not throw an error, you should either handle the error or throw an error when logging an event of this type
 */
export type EventCategory = "II" | "WW" | "EE";

/**
 * Collection of information about a bot event.
 *
 */
export interface EventInfo {
    /** Where the event originated from, this could be a module name, part of the core, or whatever you see fit */
    location: string;
    /** A description of what happened */
    description: string;
    /** A categorization of the event */
    category: EventCategory;
}

/**
 * Internal event logger
 * 
 * This should be used to log bot events. Depending on the config, events will be propagated through stdout, the configured channel, and configured DMs. One might use this to log a module starting or stopping, or something changing
 */
export let eventLogger = {
    discordInitialized: false,
    /**
     * Use to log an bot event. Depending on the config, this will be propagated to stdout, a configured Discord channel, or the PMs of a configured user.
     * @param location Where the event originates from, this could be a module name, a part of the core, or wherever you see fit
     * @param event The actual event, this explains what happened and categorizes it
     * @param verbosity At what level you want the event to be logged. This number should *never* be 0 outside of configuration.
     */
    logEvent(event: EventInfo, verbosity: VerbosityLevel) {
        /**
         * Channel ID specified in `config.jsonc` where events are logged
         */
        const loggingChannelId: string = botConfig.logging.loggingChannel.loggingChannelId;

        /**
         * List of user IDs that receive event DMs
         */
        const subscribedUsers: string[] = botConfig.logging.directMessageLogging.userIds;

        /**
         * Convert stdout to a particular color.
         * ```
         * colorEventType("[" + event.category + "]")
         * ```
         */
        let colorEventType;
        switch (event.category) {
            case "II":
                colorEventType = chalk.bold.blue;
                break;
            case "WW":
                colorEventType = chalk.bold.yellowBright;
                break;
            case "EE":
                colorEventType = chalk.bold.redBright;
                break;
            default:
                colorEventType = chalk.bold.whiteBright;
        }

        // Make sure the config is populated and the logging section exists, if no, throw error
        // This allows the rest of the file to assume the config exists
        if (botConfig.logging === undefined) {
            console.log(
                ` ${chalk.bold.redBright("[EE]")} |${new Date().toLocaleString()}| ${chalk.bold.gray(
                    "logging"
                )}: unable to get log settings from botConfig`
            );
            process.exit(1);
        }

        if (botConfig.logging.stdout.verboseLevel >= verbosity) {
            console.log(
                `|${new Date().toLocaleString()}| ${colorEventType("[" + event.category + "]")} ${chalk.bold(
                    event.location
                )}: ${event.description}`
            );
        }

        // Logging the event to discord

        // Determine the embed color
        let embedColor: number;
        switch (event.category) {
            // Blue
            case "II":
                embedColor = 0x2e8eea;
                break;
            // Yellow
            case "WW":
                embedColor = 0xf5f543;
                break;
            // Red
            case "EE":
                embedColor = 0xd74e2e;
                break;
            default:
                // He screams, for this should not be possible. (gray)
                0xaaaaaa;
        }
        const eventEmbed: DiscordEmbed = {
            title: "Event Type: " + categoryToPrettyString(event.category),
            description: "Location: " + event.location,
            color: embedColor,
            fields: [
                {
                    name: "Description",
                    value: event.description,
                },
            ],
            timestamp: new Date().toISOString(),
        };

        // Sending the event to the logging channel
        if (this.discordInitialized && botConfig.logging.loggingChannel.verboseLevel >= verbosity) {
            // Make sure a logging channel has been specified, disable it if one hasn't been set
            if (botConfig.logging.loggingChannel.loggingChannelId === "") {
                // silence all logging channel event messages
                botConfig.logging.loggingChannel.verboseLevel = 0;
                eventLogger.logEvent(
                    {
                        category: "WW",
                        location: "core",
                        description:
                            "No logging channel ID has been set, to prevent this warning, set `logging.loggingChannel.verboseLevel` to 0 in the config. Logging through discord will be disabled.",
                    },
                    1
                );
            } else {
                // send the event
                const loggingChannel = client.channels.cache.get(loggingChannelId);
                loggingChannel.send({ embeds: [eventEmbed] });
            }

        }

        if (this.discordInitialized && botConfig.logging.directMessageLogging.verboseLevel >= verbosity) {
            // Ensure that at least one user is specified
            if (subscribedUsers.length === 0) {
                // silence all user event DMs
                botConfig.logging.directMessageLogging.verboseLevel = 0;
                eventLogger.logEvent(
                    {
                        category: "WW",
                        location: "core",
                        description:
                            "No users are configured to receive events in DMs, however an attempt was made to log an event in DMs. To prevent this warning, set `logging.directMessageLogging.verboseLevel` to 0. All further DM events will be silenced.",
                    },
                    1
                );
            } else {
                // DM everyone specified in the config
                for (let user in subscribedUsers) {
                    client.users.send(user, { embeds: [eventEmbed] });
                }
            }

        }
    },
};

/**
 * convert an event type to the extended 'human' type, EG:
 *
 * `II` -> `Information`
 * `WW` -> `Warning`
 * `EE` -> `Error`
 */
function categoryToPrettyString(shortenedCategory: EventCategory): string {
    switch (shortenedCategory) {
        case "II":
            return "Information";
        case "WW":
            return "Warning";
        case "EE":
            return "Error";
    }
}

export * as logUtil from "./logger";
