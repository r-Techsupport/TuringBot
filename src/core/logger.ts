/**
 * @file
 * This file contains the code for the EventLogger class. It will be used to log system events, with configuration support for various levels of verbosity.
 */

// Used to color stdout console colors
import chalk from 'chalk';

import {botConfig} from './config.js';
import {client} from './api.js';
import {APIEmbed, TextChannel} from 'discord.js';

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
 * `EE` - Error; The logger will not throw an error, you should either handle the error gracefully or throw an error when logging an event of this type
 */
export enum EventCategory {
  Info = 'II',
  Warning = 'WW',
  Error = 'EE',
}

export function logEvent(
  category: EventCategory,
  location: string,
  description: string,
  verbosity: VerbosityLevel
) {
  // Logging to stdout
  {
    /** Verbosity level specified in the config for logging to stdout */
    const loggingLevel: number = botConfig.logging.stdout.verboseLevel;
    /**
     * Convert stdout to a particular color.
     * ```
     * console.log(colorEventType("This color will change depending on the event type: " + event.category))
     * ```
     */
    let colorEventType;
    switch (category) {
      case 'II':
        colorEventType = chalk.bold.blue;
        break;
      case 'WW':
        colorEventType = chalk.bold.yellowBright;
        break;
      case 'EE':
        colorEventType = chalk.bold.redBright;
        break;
      default:
        colorEventType = chalk.bold.whiteBright;
    }

    if (loggingLevel >= verbosity) {
      console.log(
        `|${new Date().toLocaleString()}| ${colorEventType(
          '[' + category + ']'
        )} ${chalk.bold(location)}: ${description}`
      );
    }
  }

  // Check to see if we have a discord connection before logging to discord
  if (!client.isReady()) {
    return;
  }
  // this is used for the event channel and DMs
  const eventEmbed = generateEventEmbed(category, location, description);

  // Logging to the event channel
  {
    /**
     * Channel ID specified in `config.jsonc` where events are logged
     */
    const loggingChannelId: string =
      botConfig.logging.loggingChannel.loggingChannelId;
    /**
     * Verbosity specified in the config for logging events to the event channel on discord
     */
    const loggingLevel: number = botConfig.logging.loggingChannel.verboseLevel;

    // silence all logging channel event messages if an ID has not been set,
    // yet an attempt is still being made to log something
    if (loggingChannelId === '' && loggingLevel !== 0) {
      botConfig.logging.loggingChannel.verboseLevel = 0;
      logEvent(
        EventCategory.Warning,
        'core',
        'No logging channel ID has been set, to prevent this warning, set `logging.loggingChannel.verboseLevel` to 0 in the config. Logging through discord will be disabled until restart.',
        1
      );
    }
    // Sending the event to the logging channel
    if (loggingLevel >= verbosity) {
      /**
       * The actual {@link TextChannel} discord.js reference to the
       * event channel
       */
      const loggingChannel: TextChannel = client.channels.cache.get(
        loggingChannelId
      ) as TextChannel;

      void loggingChannel.send({embeds: [eventEmbed]});
    }
  }

  // Logging to DMs
  {
    /**
     * List of user IDs that receive event DMs
     */
    const subscribedUsers: string[] =
      botConfig.logging.directMessageLogging.userIds;
    // config specified logging level for DMs
    const loggingLevel = botConfig.logging.directMessageLogging.verboseLevel;
    // Ensure that at least one user is specified
    if (subscribedUsers.length === 0) {
      // silence all user event DMs
      botConfig.logging.directMessageLogging.verboseLevel = 0;
      logEvent(
        EventCategory.Warning,
        'core',
        'No users are configured to receive events in DMs, however an attempt was made to log an event in DMs. To prevent this warning, set `logging.directMessageLogging.verboseLevel` to 0. All further DM events will be silenced.',
        1
      );
    }

    if (loggingLevel >= verbosity) {
      // DM everyone specified in the config
      for (const user of subscribedUsers) {
        void client.users.send(user, {embeds: [eventEmbed]});
      }
    }
  }
}

/**
 * Take in the given params and spit out a discord embed with the requisite event info
 * @param category {@link EventCategory} Event type
 * @param location Where the event occurred
 * @param description What happened
 */
export function generateEventEmbed(
  category: EventCategory,
  location: string,
  description: string
): APIEmbed {
  // Determine the embed color and long name
  let embedColor: number;
  let longName: string;
  switch (category) {
    // Blue
    case 'II':
      embedColor = 0x2e8eea;
      longName = 'Information';
      break;
    // Yellow
    case 'WW':
      embedColor = 0xf5f543;
      longName = 'Warning';
      break;
    // Red
    case 'EE':
      embedColor = 0xd74e2e;
      longName = 'Error';
      break;
    default:
      // He screams, for this should not be possible. (gray)
      embedColor = 0xaaaaaa;
      longName = 'Unknown';
  }

  return {
    title: 'Event Type: ' + longName,
    description: 'Location: ' + location,
    color: embedColor,
    fields: [
      {
        name: 'Description',
        value: description,
      },
    ],
    timestamp: new Date().toISOString(),
  };
}
