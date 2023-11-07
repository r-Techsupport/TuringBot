/**
 * @file
 * Modules:
 *  - {@link bot}
 *  - Submodules: Info
 */

import {Colors, EmbedBuilder, EmbedField} from 'discord.js';
import process from 'node:process';
import osutils from 'node-os-utils';
import * as util from '../../core/util.js';
import {spawn} from 'node:child_process';

/**
 * Function that returns an array of the latest 5 event loop tick latencies.
 *
 * @see https://nodejs.dev/en/learn/understanding-processnexttick/
 */
async function getTickLatency(): Promise<number[]> {
  return new Promise<number[]>(resolve => {
    let iteration = 0;
    const tickDelay: number[] = [];

    /** Function to push the tick latency to tickDelay, resolve on the fifth tick */
    function measureIteration() {
      // Unix timestamp of start in ms
      const startRaw = process.hrtime();
      const start = startRaw[0] * 1_000 + startRaw[1] / 1_000_000;

      process.nextTick(() => {
        // Unix timestamp of iteration in ms
        const lagTime = process.hrtime();
        const lag = lagTime[0] * 1_000 + lagTime[1] / 1_000_000;

        tickDelay.push(lag - start);
        iteration++;

        if (iteration < 5) {
          measureIteration();
        } else {
          resolve(tickDelay);
        }
      });
    }

    measureIteration();
  });
}

/** The root bot command definition */
const bot = new util.RootModule(
  'bot',
  'Bot info and management command group',
  [],
  []
);

bot.registerSubModule(
  new util.SubModule(
    'info',
    'Prints information about the bot',
    [],
    async (_, interaction) => {
      const embed: EmbedBuilder = new EmbedBuilder()
        .setColor(Colors.Blurple)
        .setTitle(util.client.user!.username)
        .setThumbnail(util.client.user!.displayAvatarURL());

      // Gets the Average tick delay
      const tickDelay = await getTickLatency();

      // Averages the delays out and rounds it to 4 decimal points
      const sum: number = tickDelay.reduce((a, b) => a + b, 0);
      const averageDelay: string = (sum / tickDelay.length).toFixed(4);

      // Gets the CPU usage
      let cpuUsage = 'Unable to get the cpu usage';

      await osutils.cpu.usage().then(cpuPercentage => {
        cpuUsage = cpuPercentage.toString();
      });

      const memoryUsage: number = process.memoryUsage.rss() / 1_000_000; // MB

      const fields: EmbedField[] = [
        {
          name: 'Started',
          value: util.client.readyAt!.toString(),
          inline: true,
        },
        {
          name: 'IRC',
          value: 'IRC is not implemented yet you dingus',
          inline: true,
        },
        // Line break
        {
          name: '\u200B',
          value: '\u200B',
          inline: false,
        },
        {
          name: 'Bot latency',
          value: `${Date.now() - interaction.createdTimestamp} ms`,
          inline: true,
        },
        {
          name: 'API latency',
          value: `${util.client.ws.ping} ms`,
          inline: true,
        },
        // Line break
        {
          name: '\u200B',
          value: '\u200B',
          inline: false,
        },
        {
          name: 'Average tick delay',
          value: `${averageDelay} ms`,
          inline: true,
        },
        {
          name: 'CPU Usage',
          value: `${cpuUsage}%`,
          inline: true,
        },
        {
          name: 'Memory usage',
          value: `${memoryUsage.toFixed(2)} MB`,
          inline: true,
        },
      ];

      embed.setFields(fields);

      await util.replyToInteraction(interaction, {embeds: [embed]});
    }
  )
);

// restart the currently running process
bot.registerSubModule(
  new util.SubModule(
    'restart',
    "Fully restart the bot's operating system process",
    [],
    async (_, interaction) => {
      await util.replyToInteraction(interaction, {
        embeds: [util.embed.infoEmbed('Restarting.')],
      });
      util.logEvent(util.EventCategory.Info, 'bot', 'Restarting.', 2);
      // adapted from https://thekenyandev.com/blog/how-to-restart-a-node-js-app-programmatically/
      // when the process closes, start a new one
      process.on('exit', () => {
        // start a new process
        // the first argument to a process is the binary called, the next are the arguments to the binary
        // share the current working directory and stdio
        spawn(process.argv.shift()!, process.argv, {
          cwd: process.cwd(),
          detached: true,
          stdio: 'inherit',
        });
      });
      // kill the process
      // eslint seems to think that this is happening to throw an error, but we're just rebooting
      // eslint-disable-next-line
      process.exit();
    }
  )
);

export default bot;
