/**
 * @file
 * Modules:
 *  - {@link channelLogging}
 *  - Submodules: Populate
 */
import {
  TextChannel,
  CategoryChannel,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  GuildBasedChannel,
  ChannelType,
  StringSelectMenuInteraction,
  ButtonInteraction,
  BaseChannel,
} from 'discord.js';
import {Worker} from 'worker_threads';
import * as util from '../../core/util.js';
import {fileURLToPath} from 'url';
import path from 'path';

// control is not implemented yet
interface WorkerMessage {
  type: 'log' | 'control';
  content: {
    category: util.EventCategory;
    description: string;
    verbosity: util.VerbosityLevel;
  } | null;
}

const channelLogging = new util.RootModule(
  'logging',
  'Manage discord channel and thread logging',
  [],
  []
);
channelLogging.onInitialize(async () => {
  // spin up a new logging worker thread
  // this is needed to calculate the worker path relative to the current file
  const workerPath = fileURLToPath(
    path.dirname(import.meta.url) + '/logging_worker.js'
  );
  const worker = new Worker(workerPath, {
    workerData: {
      config: channelLogging.config,
      authToken: util.botConfig.authToken,
    },
  });
  worker.on('message', (message: WorkerMessage) => {
    if (message.type === 'log') {
      util.logEvent(
        message.content!.category,
        'logging_worker',
        message.content!.description,
        message.content!.verbosity
      );
    }
  });
  worker.on('error', err => {
    util.logEvent(
      util.EventCategory.Error,
      'channel_logging',
      'Logging worker thread encountered a fatal error: ' + err,
      1
    );
  });
  worker.on('exit', code => {
    util.logEvent(
      util.EventCategory.Warning,
      'channel_logging',
      `logging worker thread exited with exit code ${code},` +
        'this may be normal behavior, or an issue',
      1
    );
  });
  util.logEvent(
    util.EventCategory.Info,
    'channel_logging',
    'Logging worker thread started.',
    3
  );
});

const populate = new util.SubModule(
  'populate',
  'Generate needed logging channels and populate the config',
  [
    {
      type: util.ModuleOptionType.String,
      name: 'blacklist',
      description:
        'A list of channels, separated by spaces that you want to add to the blacklist.',
      required: false,
    },
  ],
  async (args, interaction) => {
    const guild = util.client.guilds.cache.first()!;
    const loggingCategory = guild.channels.cache.get(
      populate.config.loggingCategory
    ) as CategoryChannel;
    // check to see if loggingCategory exists and references a valid category.
    if (!loggingCategory) {
      return util.embed.errorEmbed(
        '`loggingCategory` in the config does not appear to point ' +
          'to a valid category'
      );
    }
    // while the type coercion is not strictly needed, I think it makes the code easier to understand
    let loggingChannels: TextChannel[] = Array.from(
      loggingCategory.children.cache.values()
    ) as TextChannel[];
    // iterate over every text channel not in the logging category.
    // text channels have a type of 0
    /** A list of all channels not in the configured logging category */
    const channels = guild.channels.cache.filter(
      (ch: BaseChannel) => ch.type === 0
    );
    // remove all channels in the logging category
    for (const loggingChannel of loggingChannels) {
      // delete silently returns false if the element doesn't exist,
      // so this is error resilient
      channels.delete(loggingChannel.id);
    }

    /** This is sent to discord as a checklist, where the user can go through and select or deselect channels they want logged */
    const channelSelector = new StringSelectMenuBuilder().setCustomId(
      'populate'
    );

    // generate a list of all blacklisted channels
    // blacklisted channels are disabled by default
    let channelBlacklist: string[] = populate.config.channelBlacklist;
    // blacklisted channels should be passed as channel ids, separated by a space
    const inputBlacklist = args.find(arg => arg.name === 'blacklist');
    if (inputBlacklist !== undefined) {
      // possibly undefined: verified that args were passed first
      for (const channel of inputBlacklist.value as string) {
        channelBlacklist.push(channel);
      }
    }

    for (const channel of channels) {
      // if a blacklisted channel is already in the config, or passed as an argument
      // have them toggled on by default
      let selectedByDefault = false;
      if (channelBlacklist.includes(channel[0])) {
        selectedByDefault = true;
      }

      channelSelector.addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel(`${channel[1].name} (${channel[1].id})`)
          .setValue(`${channel[1].id}`)
          // this is apparently required
          // (https://stackoverflow.com/questions/73302171/validationerror-s-string-expected-a-string-primitive-received-undefined)
          // TODO: indicate whether or not a logging channel exists here
          .setDescription(`${channel[1].name}-logging`)
          .setDefault(selectedByDefault)
      );
    }

    channelSelector.setMaxValues(channels.size);
    const confirmButton = new ButtonBuilder()
      .setCustomId('popconfirm')
      .setLabel("Don't change blacklist")
      .setStyle(ButtonStyle.Primary);

    // send the menu
    // The action menu is a 5x5 grid, a select menu takes up all 5 spots in a row, so a
    // button needs to be moved to the next row
    const channelSelectorActionRow =
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        channelSelector
      );
    const buttonActionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      confirmButton
    );
    /** this message contains the selection menu */
    const botResponse = await interaction.reply({
      embeds: [
        util.embed.infoEmbed('Select channels to exclude from logging:'),
      ],
      components: [channelSelectorActionRow, buttonActionRow],
    });

    /**
     * This rather inelegant and badly function does basically everything, and is only in a function because it needs to be
     * done for a button interaction or a text select menu, with only minor deviations in between
     * @param menuInteraction Pass this from the interaction listener (https://discordjs.guide/message-components/interactions.html#component-collectors)
     */
    async function generateChannelsAndPopulateConfig(
      menuInteraction: StringSelectMenuInteraction | ButtonInteraction
    ): Promise<void> {
      // blacklisted channels are dropped from the channels collection entirely,
      // and we pretend they don't exist from a logging perspective
      for (const blacklistedChannel of channelBlacklist) {
        // this safely continues if it can't find the key to delete
        channels.delete(blacklistedChannel);
      }
      // generate a list of the name of each logging channel,
      // so then we can see later on if a normal channel starts with any of the logging channels
      const loggingChannelNames: string[] = [];
      for (const loggingChannel of loggingChannels) {
        loggingChannelNames.push(loggingChannel.name);
      }

      // iterate over logging channels, if loggingchannel.startswith(iterate over normal channel names, normal being "non-logging channels")
      // if logging channel starts with a normal channel name, stop looking
      // if none found, add to unloggedChannels, then send one final confirmation with a list of new channels that'll be made
      /** A list of channels that presumably need to be logged, but aren't yet */
      const unloggedChannels: Array<[string, GuildBasedChannel]> = [];
      for (const channel of channels) {
        let didFindChannel = false;
        for (const loggingChannel of loggingChannelNames) {
          if (loggingChannel.startsWith(channel[1].name)) {
            didFindChannel = true;
            break;
          }
        }
        if (!didFindChannel) {
          unloggedChannels.push(channel);
        }
      }
      // only attempt to generate new channels if there's new channels to generate
      if (unloggedChannels.length > 0) {
        await util.embed
          .confirmEmbed(
            'New logging channels for these channels will be made:\n' +
              unloggedChannels.join('\n'),
            interaction
          )
          .then(async choice => {
            switch (choice) {
              case util.ConfirmEmbedResponse.Confirmed:
                menuInteraction.followUp({
                  embeds: [util.embed.infoEmbed('Generating new channels...')],
                  components: [],
                });
                // By submitting all of the promises at once, and then awaiting after submission,
                // you can save a lot of time over submitting channel creation one at a time
                // and awaiting in between each channel
                // eslint-disable-next-line no-case-declarations
                const jobs = [];
                for (const channel of unloggedChannels) {
                  const newChannel = guild.channels.create({
                    name: channel[1].name + '-logging',
                    type: ChannelType.GuildText,
                    parent: loggingCategory.id,
                  });

                  jobs.push(newChannel);
                }
                // awaited because config population needs the IDs of these channels
                // also add all of the new channels to the collection of logging channels
                // concat is immutable
                loggingChannels = loggingChannels.concat(
                  await Promise.all(jobs)
                );
                break;

              case util.ConfirmEmbedResponse.Denied:
                menuInteraction.followUp({
                  embeds: [
                    util.embed.infoEmbed(
                      'New channels will not be generated, moving on to config population.'
                    ),
                  ],
                  components: [],
                });
                break;
            }
          });
      } else {
        await menuInteraction.followUp({
          embeds: [
            util.embed.infoEmbed(
              'No new channels need generation, moving onto config updates...'
            ),
          ],
        });
      }

      await menuInteraction.followUp({
        embeds: [
          util.embed.infoEmbed(
            'Generating and applying the correct config options...'
          ),
        ],
      });
      // now that channels have been created, the config can be populated.
      // blacklistedChannels is simply dumped into the config setting.
      // if channel creation was cancelled, any channels that "needed" creation
      // end up in this weird empty space where they're not in the blacklist, and
      // they are not logged.
      await util.botConfig.editConfigOption(
        ['modules', 'logging', 'channelBlacklist'],
        channelBlacklist
      );
      const channelMap: {[key: string]: string} = {};
      // if a channel has a logging channel that starts with that channel's name, add the IDs to the channel map
      // This will silently not add channels that it doesn't find the appropriate channel for, because checks have already been made
      // to ensure that blacklisted channels can't be logged, and any channel that didn't exist could be created
      for (const channel of channels) {
        for (const loggingChannel of loggingChannels) {
          if (loggingChannel.name.startsWith(channel[1].name)) {
            channelMap[channel[1].id] = loggingChannel.id;
          }
        }
      }
      await util.botConfig.editConfigOption(
        ['modules', 'logging', 'channelMap'],
        channelMap
      );
      menuInteraction.followUp({
        embeds: [
          util.embed.successEmbed('Config updated and logging deployed.'),
        ],
      });
    }

    const continueButtonListener = botResponse.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: i => interaction.user.id === i.user.id,
      time: 60_000,
    });

    continueButtonListener.on(
      'collect',
      async (interaction: ButtonInteraction) => {
        await interaction.update({
          embeds: [
            util.embed.successEmbed(
              'Continuing without modifying blacklist...'
            ),
          ],
          components: [],
        });
        await generateChannelsAndPopulateConfig(interaction);
      }
    );

    // enable doing things when someone interacts with the channel selection menu
    // https://discordjs.guide/message-components/interactions.html#component-collectors
    // time is in MS
    const channelSelectListener = botResponse.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      filter: i => interaction.user.id === i.user.id,
      time: 60_000,
    });

    channelSelectListener.on('collect', async interaction => {
      await interaction.update({
        embeds: [
          util.embed.successEmbed(
            'Choice confirmed, looking for any logging channels that need to be made...'
          ),
        ],
        components: [],
      });
      // whatever was selected is the whole blacklist, so set it
      // later on, blacklisted channels are dropped from the channels collection entirely,
      // and we pretend they don't exist from a logging perspective
      channelBlacklist = interaction.values;
      await generateChannelsAndPopulateConfig(interaction);
    });

    // delete the stuff after the time is up
    channelSelectListener.on('end', () => {
      // the listener doesn't know whether or not the interaction was ever completed,
      // it just knows when the listener has stopped listening
      if (channelSelectListener.collected.size === 0) {
        botResponse.edit({
          embeds: [util.embed.errorEmbed('Interaction timeout, try again.')],
          components: [],
        });
      }
    });
  }
);

channelLogging.registerSubModule(populate);

export default channelLogging;
