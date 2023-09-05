/**
 * @file
 * This file provides a simple interface to interact with config.jsonc, whether that be reading to or writing from it
 */
import {writeFile, readFile} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {parse as parseJSONC, modify, applyEdits, JSONPath} from 'jsonc-parser';
import {EventCategory, logEvent} from './logger.js';

// TODO: write out a large interface for the config
/**
 * Path of the config on the filesystem relative to where node is being run from
 */
const CONFIG_LOCATION = './config.jsonc';
const SECRETS_LOCATION = './secrets.jsonc';

/**
 * This is an object mirror of `config.jsonc`. You can load the config from the filesystem with `readConfigFromFileSystem()`.
 * @namespace
 */
// The any type is needed because the json is written to this object at runtime
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const botConfig: any = {
  /**
   * This function populates `botConfig` with a mirror of `config.jsonc`
   */
  readConfigFromFileSystem() {
    // read the config from the filesystem
    // TODO: only do this if the config hasn't been set already
    try {
      Object.assign(
        botConfig,
        parseJSONC(readFileSync(CONFIG_LOCATION, 'utf-8'))
      );
      // read `secrets.jsonc` into the config, under `.secrets`
      botConfig.secrets = parseJSONC(readFileSync(SECRETS_LOCATION, 'utf-8'));
    } catch (err) {
      throw new Error(
        'Unable to locate or process config.jsonc, are you sure it exists?'
      );
    }
  },

  // https://stackoverflow.com/questions/18936915/dynamically-set-property-of-nested-object
  // used to modify a part of the config in memory
  // eslint disable: We want the config value to be set to *anything*
  // this is not just lazy typing
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _set(path: JSONPath, value: any) {
    // eslint disable: this is set to abuse javascript references
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let schema = this; // a moving reference to internal objects within obj
    for (let i = 0; i < path.length - 1; i++) {
      const elem = path[i];
      schema = schema[elem];
    }
    schema[path[path.length - 1]] = value;
  },

  /**
   * Selectively modify a part of the config. This reads the config from the filesystem and then modifies it, writing it back.
   *
   * It then applies the changes to the config in memory. This segmentation allows modification of the config on the fly, without
   * writing those changes to the filesystem.
   *
   * Do not use this to fill out config options that you're too lazy to manually add to `config.default.jsonc`
   *
   * @param location The path to what you'd like to edit as an array, so `foo.bar.baz` becomes `["foo", "bar", "baz"]`
   *
   * @param newValue Whatever you want the new value of `location` to be
   *
   * @example
   * // editing `botconfig.authToken` to "?win"
   * // if you check CONFIG_LOCATION, that file will have changed
   * botConfig.editConfigOption(["authToken"], "?win");
   *
   * @throws Will throw an error if `CONFIG_LOCATION` does not point to a valid file,
   * or filesystem operations fail in any way (bad perms, whatever). Will return silently and
   * log an error if `location` does not point to a valid location in the config.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async editConfigOption(location: JSONPath, newValue: any): Promise<void> {
    // iteratively determine whether or not the key that's being edited exists
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let currentPosition = this;
    for (const i in location) {
      // see if the key exists
      if (location[i] in currentPosition) {
        currentPosition = currentPosition[location[i]];
      } else {
        logEvent(
          EventCategory.Error,
          'core',
          "An attempt was made to edit a config value that doesn't exist( " +
            location.join('.') +
            '), cancelling edit',

          1
        );
        return;
      }
    }

    this._set(location, newValue);

    // write changes to filesystem
    const file = await readFile(CONFIG_LOCATION, 'utf8');

    const newConfig = applyEdits(
      file,
      modify(file, location, newValue, {
        formattingOptions: {insertSpaces: true, tabSize: 4},
      })
    );

    await writeFile(CONFIG_LOCATION, newConfig);
    logEvent(
      EventCategory.Info,
      'core',
      location.join('.') +
        ' in `config.jsonc` changed and diff applied in memory',
      2
    );
  },
};
