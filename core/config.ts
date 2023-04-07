/*
 * This file provides a simple interface to read from `config.jsonc` and TODO select module specific configs
 */
import { readFileSync } from "node:fs";
import { parse as parseJSONC } from "jsonc-parser";

import { logUtil } from "./logger";

/**
 * This is an object mirror of `config.jsonc`. You can load the config from the filesystem with `readConfigFromFileSystem()`.
 */
// The any type is needed because the json is written to this object at runtime
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
};
