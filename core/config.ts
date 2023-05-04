/*
 * This file provides a simple interface to read from `config.jsonc` and TODO select module specific configs
 */
import { readFileSync, readFile, writeFile } from "node:fs";
import { parse as parseJSONC, modify, applyEdits, JSONPath } from "jsonc-parser";

/**
 * Path of the config on the filesystem relative to where node is being run from
 */
const CONFIG_LOCATION = "./config.jsonc"

/**
 * This is an object mirror of `config.jsonc`. You can load the config from the filesystem with `readConfigFromFileSystem()`.
 */
// The any type is needed because the json is written to this object at runtime
export let botConfig: any = {

    /**
     * This function populates `botConfig` with a mirror of `config.jsonc`
     */
    readConfigFromFileSystem() {
        // read the config from the filesystem
        // TODO: only do this if the config hasn't been set already
        try {
            Object.assign(botConfig, parseJSONC(readFileSync(CONFIG_LOCATION, "utf-8")));
        } catch (err) {
            throw new Error("Unable to locate or process config.jsonc");
        }
    },

    /**
     * Selectively modify a part of the config. This reads the config from the filesystem and then modifies it, writing it back. 
     * 
     * It then applies the changes to the config in memory. This segmentation allows modification of the config on the fly, without
     * writing those changes to the filesystem
     */
    async editConfigOption(location: JSONPath, newValue) {
        // write changes to filesystem
        readFile("./config.jsonc", "utf8", (err, file) => {
            if (err) {
                throw err;
            }
            console.log("new json: " + applyEdits(file, modify(file, location, newValue, {formattingOptions: {insertSpaces: true, tabSize: 4}})))
        });
    }
};
