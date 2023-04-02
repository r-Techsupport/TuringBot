/*
 * This file provides a simple interface to read from `config.jsonc` and TODO select module specific configs
 */
import { readFileSync } from "node:fs";
import { parse as parseJSONC } from "jsonc-parser";

import { logEvent } from "./logger";
//export class Config {
// Loading the config
//    constructor() {
export let botConfig: any = {
    readConfigFromFileSystem() {
        // read the config from the filesystem
        // TODO: only do this if the config hasn't been set already
        try {
            Object.assign(
                botConfig,
                parseJSONC(readFileSync("./config.jsonc", "utf-8"))
            );
        } catch (err) {
            throw new Error("Unable to locate or process config.jsonc");
        }
    },

    // console.log("\n\nConfig.prototype" + JSON.stringify(Config.prototype))
};
