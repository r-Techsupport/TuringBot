/*
 * This file provides a simple interface to read from `config.jsonc` and TODO select module specific configs
 */
import { readFileSync } from "node:fs";
import { parse as parseJSONC } from "jsonc-parser";

import { EventLogger } from "./logger";


console.log(typeof EventLogger);
let eventLogger = new EventLogger();
/**
 * This mirrors `config.jsonc`
 */
export class Config {
    // Loading the config
    constructor() {
        // read the config from the filesystem
        // TODO: only do this if the config hasn't been set already
        try {
            Object.assign(
                Config.prototype,
                parseJSONC(readFileSync("./config.jsonc", "utf-8")));
        } catch (err) {
            eventLogger.logEvent(
                {
                    location: "config",
                    description:
                        "Unable to parse config.jsonc, make sure it exists and is valid.",
                    category: "EE",
                },
                1
            );
            throw err;
        }
    }
}

/**
 * This mirrors `config.jsonc`.
 */
export let config = new Config();
