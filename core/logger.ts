/*
 * This file contains the code for the EventLogger class. It will be used to log system events, with configuration support for various levels of verbosity.
 */

// Used to color stdout console colors
import chalk from "chalk";

import { botConfig } from "./config";

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
 * Use to log bot events. This should be very robust, when developing in this class, never make assumptions about config options existing or the ability to log to discord.
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
        //Writing to stdout, yellow for warnings, red for errors, blue for info
        let colorEventType;
        switch (event.category) {
            case "EE":
                colorEventType = chalk.bold.redBright;
                break;
            case "WW":
                colorEventType = chalk.bold.yellowBright;
                break;
            case "II":
                colorEventType = chalk.bold.blue;
                break;
            default:
                colorEventType = chalk.bold.whiteBright;
        }

        // Make sure the config is populated and the logging section exists, if no, throw error
        // This allows the rest of the file to assume the config exists
        if (botConfig.logging === undefined) {
            console.log(
                ` ${chalk.bold.redBright(
                    "[EE]"
                )} |${new Date().toLocaleString()}| ${chalk.bold.gray(
                    "logging"
                )}: unable to get log settings from botConfig`
            );
            process.exit(1);
        }

        if (botConfig.logging.stdout.verboseLevel >= verbosity) {
            console.log(
                `|${new Date().toLocaleString()}| ${colorEventType(
                    "[" + event.category + "]"
                )} ${chalk.bold(event.location)}: ${event.description}`
            );
        }

        // Sending the event to the logging channel and dms
        if (
            this.discordInitialized &&
            botConfig.logging.loggingChannel.verboseLevel >= verbosity
        ) {
            // Make sure a logging channel has been specified, then send a message to the channel
            if (botConfig.logging.loggingChannel.loggingChannelId === "") {
                // prevent it from infinitely failing to log this in discord
                botConfig.logging.loggingChannel.verboseLevel = 0;
                eventLogger.logEvent(
                    {
                        category: "EE",
                        location: "core",
                        description:
                            "No logging channel ID has been set, to prevent this error, set `logging.loggingChannel.verboseLevel` to 0 in the config",
                    },
                    1
                );
                process.exit(1);
            }
        }
    },
};

export * as logUtil from "./logger";
