/*
 * This file contains the code for the EventLogger class. It will be used to log system events, with configuration support for various levels of verbosity.
 */

// Used to color stdout console colors
import chalk from "chalk";

import { Config } from "./config";

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

let config: any = new Config();
/**
 * Use to log bot events. This should be very robust, when developing in this class, never make assumptions about config options existing or the ability to log to discord.
 */
export class EventLogger {
    constructor() {}

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

        if (
            config.logging !== null &&
            config.logging.stdout.verboseLevel >= verbosity
        ) {
            console.log(
                ` ${colorEventType(
                    "[" + event.category + "]"
                )} |${new Date().toLocaleString()}| ${chalk.bold.gray(
                    event.location
                )}: ${event.description}`
            );
        }
    }
}

//export let eventLogger: EventLogger = new EventLogger();

export * as logging from "./logger";
