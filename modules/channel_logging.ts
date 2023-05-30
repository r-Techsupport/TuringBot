/*
This module provides discord logging, and is intended to log messages to a collection of logging channels. Because this requires 
a comparatively very high level amount of processing compared to other tasks, this code should be *very* optimized
*/
import {
    APIEmbed,
    Events,
    Guild,
    Message,
    MessageActionRowComponent,
    TextChannel,
    Channel,
    CategoryChannel,
    StringSelectMenuBuilder,
    StringSelectMenuComponent,
    StringSelectMenuOptionBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    Collector,
    ComponentType,
    CategoryChildChannel,
    GuildBasedChannel,
    ChannelType,
    StringSelectMenuInteraction,
    ButtonInteraction,
} from "discord.js";
import * as util from "../core/util.js";
import { getCombinedModifierFlags } from "typescript";
import { promises } from "node:dns";

/**
 * An efficient data structure for the buffered handling of messages, make use of the `read()`, `write()`, and `onWrite()` methods
 */
class MessageRingBuffer {
    /**
     * The initial number of elements to be held in the buffer. The number of elements in the buffer may increase
     * and decrease by whatever `reallocationStepSize` is set to, but it will not ever be less than `initialBufferSize`
     */
    initialBufferSize: number;
    // TODO: add a max buffer size, this behavior can be implemented by over-writing data and shoving the read cursor forwards.
    // it's a lossy method of keeping memory under control, but we could maybe add an event
    /**
     * When the write cursor is behind the read cursor but has data to write into the buffer, the read cursor and all data
     * in front of it is shifted forwards by `reallocationStepSize` to avoid overwriting messages that haven't been handled
     */
    reallocationStepSize = 4;
    /**
     * Messages are read one at a time from the buffer, at this index. This should *never* overtake the write cursor,
     * because then it's reading a "stale" message that's already been read, but hasn't been overwritten with a new one
     */
    readCursorIndex = 0;
    /**
     * Messages are written into the buffer at this position. The read cursor trails behind, addressing unprocessed messages.
     * If it makes it all the way around the ringbuffer and catches up to the read cursor,
     * `reallocationStepSize` more positions are allocated, and the readcursor with all data after shifted forward to make space
     */
    writeCursorIndex = 0;
    /**
     * This value measures how many items have been written to the buffer that haven't been read yet
     */
    numValues = 0;
    /**
     * All messages are stored here. This should not be directly accessed, instead use the `read()` and `write()` methods
     */
    buf: (Message | null)[];

    /**
     * Create a new ringbuffer
     * @param initialSize However many elements are to be initially allocated in the buffer. More elements may be allocated if necessary, but
     * this is the minimum amount to be allocated at all times
     */
    constructor(initialSize: number = 8) {
        this.initialBufferSize = initialSize;
        this.buf = Array(initialSize);
    }

    /**
     * Read and return a message, move the read cursor forwards. If there's no more unread data in the buffer, returns `null`
     *
     * This will also shrink the buffer under the following conditions:
     * - The last item is read from the buffer
     * - The buffer is larger than the initial set size (`initialBufferSize`)
     */
    async read(): Promise<Message | null> {
        if (this.numValues === 0) {
            return null;
        }
        const returnVal = this.buf[this.readCursorIndex];
        if (this.readCursorIndex === this.buf.length - 1) {
            this.readCursorIndex = 0;
        } else {
            this.readCursorIndex += 1;
        }
        this.numValues -= 1;

        // check to see if the buffer is now empty and larger than the initial allocation size, then decrease buffer size
        if (this.numValues === 0 && this.buf.length > this.initialBufferSize) {
            // because all data at this point is read and considered "stale", the
            // position of r/w cursors doesn't matter in regards to data integrity
            // reset the cursors back to the beginning of the buffer, and shrink by 4 elements
            this.readCursorIndex = 0;
            this.writeCursorIndex = 0;
            this.buf.length -= this.reallocationStepSize;
            util.eventLogger.logEvent(
                {
                    category: util.EventCategory.Info,
                    description: `Shrunk message ringbuffer size (new size: ${this.buf.length})`,
                    location: "channel-logging",
                },
                3
            );
        }

        return returnVal;
    }

    /**
     * Called whenever a message is written into a buffer
     */
    calledOnWrite = () => {};

    /**
     * Write a message into the buffer and advance the write cursor forwards, allocating more space if necessary
     */
    write(message: Message) {
        if (this.numValues == this.buf.length - 1) {
            this.expandBuffer(this.reallocationStepSize);
        }

        this.buf[this.writeCursorIndex] = message;
        this.numValues += 1;

        // move the write cursor forwards, wrapping back to the beginning if necessary
        // if we've hit the end of the array, go back to the beginning
        if (this.writeCursorIndex === this.buf.length - 1) {
            this.writeCursorIndex = 0;
        } else {
            this.writeCursorIndex += 1;
        }
        this.calledOnWrite();
    }

    /**
     * Define a function to call directly after a message is written to the buffer
     */
    onWrite(funcToCallOnWrite: () => {}) {
        this.calledOnWrite = funcToCallOnWrite;
    }

    /**
     * Expand the buffer size by inserting space after the write cursor and shifting everything
     */
    expandBuffer(increaseBy: number) {
        // select everything after the write cursor and shift it forwards
        let shiftBlock = this.buf.splice(this.writeCursorIndex + 1);
        for (let i = 0; i < increaseBy; i++) {
            this.buf.push(null);
        }
        for (let item of shiftBlock) {
            this.buf.push(item);
        }
        // move the read cursor forwards
        if (this.readCursorIndex > this.writeCursorIndex) {
            for (let i = 0; i < increaseBy; i++) {
                if (this.readCursorIndex == this.buf.length - 1) {
                    this.readCursorIndex = 0;
                } else {
                    this.readCursorIndex += 1;
                }
            }
        }

        util.eventLogger.logEvent(
            {
                category: util.EventCategory.Info,
                location: "channel-logging",
                description: `Expanded ringbuffer size (current size: ${this.buf.length})`,
            },
            3
        );
    }
}
let channelLogging = new util.RootModule("logging", "Manage discord channel and thread logging");

channelLogging.onInitialize(async () => {
    /** Where messages that haven't been processed yet are stored. */
    let mBuffer = new MessageRingBuffer(10);
    // when a message is sent, add it to the buffer
    util.client.on(Events.MessageCreate, (message) => {
        if (!message.author.bot) {
            mBuffer.write(message);
        }
    });

    // refer to the channel map
    mBuffer.onWrite(async () => {
        // get the channel id, reference the channelmap to determine where the message needs to be logged
        // Non-null assertion: This code is only called when data is written to the buffer, thus ensuring we're handling non-null values
        const message: Message = (await mBuffer.read()) as Message;

        // Ignore all messages sent in channels not defined by the channel map
        if (!(message.channelId in channelLogging.config.channelMap)) return;

        const logChannelID = channelLogging.config.channelMap[message.channelId];
        // get the logging channel from cache send a log there containing relevant info
        // user roles are not logged, because it's unnecessary overhead
        let logChannel = util.client.channels.cache.get(logChannelID) as TextChannel;
        await logChannel.send({
            embeds: [
                {
                    thumbnail: {
                        url: message.author.avatarURL()!,
                    },
                    fields: [
                        {
                            name: "Username",
                            value: `${message.author.tag}`,
                            inline: true,
                        },
                        {
                            name: "Nickname",
                            value: `${(await util.guild.members.fetch(message.author.id)).displayName}`,
                            inline: true,
                        },
                        {
                            name: "Content",
                            value: message.cleanContent,
                        },
                        {
                            name: "Channel",
                            value: `${message.channel}`,
                        },
                    ],
                    timestamp: new Date().toISOString(),
                    footer: {
                        text: `User ID: ${message.author.id}`,
                    },
                },
            ],
        });
    });
});

let populate = new util.SubModule(
    "populate",
    "Fill the channel map in the config, and automatically start logging. " +
        "\nThis requires `loggingCategory` to be set. Takes a list of channel IDs that you don't want",
    async (args, msg) => {
        const loggingCategory = util.guild.channels.cache.get(populate.config.loggingCategory) as CategoryChannel;
        // check to see if loggingCategory exists and references a valid category.
        if (!loggingCategory) {
            return util.quickEmbed.errorEmbed(
                "`loggingCategory` in the config does not appear to point " + "to a valid category"
            );
        }
        // while the type coercion is not strictly needed, I think it makes the code easier to understand
        let loggingChannels: TextChannel[] = Array.from(loggingCategory.children.cache.values()) as TextChannel[];
        // iterate over every text channel not in the logging category.
        // text channels have a type of 0
        /** A list of all channels not in the configured logging category */
        let channels = util.guild.channels.cache.filter((ch: any) => ch.type === 0);
        // remove all channels in the logging category
        for (const loggingChannel of loggingChannels) {
            // delete silently returns false if the element doesn't exist,
            // so this is error resilient
            channels.delete(loggingChannel.id);
        }

        /** This is sent to discord as a checklist, where the user can go through and select or deselect channels they want logged */
        const channelSelector = new StringSelectMenuBuilder().setCustomId("populate");

        // generate a list of all blacklisted channels
        // blacklisted channels are disabled by default
        let channelBlacklist: string[] = populate.config.channelBlacklist;
        // blacklisted channels should be passed as channel ids, separated by a space
        if (args) {
            // possibly undefined: verified that args were passed first
            for (let channel of args?.split(" ")) {
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
            .setCustomId("popconfirm")
            .setLabel("Don't change blacklist")
            .setStyle(ButtonStyle.Primary);

        // send the menu
        // The action menu is a 5x5 grid, a select menu takes up all 5 spots in a row, so a
        // button needs to be moved to the next row
        const channelSelectorActionRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(channelSelector);
        const buttonActionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(confirmButton);
        /** this message contains the selection menu */
        const botResponse = await msg.reply({
            embeds: [util.quickEmbed.infoEmbed("Select channels to exclude from logging:")],
            components: [channelSelectorActionRow, buttonActionRow],
        });

        /**
         * This rather inelegant and badly function does basically everything, and is only in a function because it needs to be
         * done for a button interaction or a text select menu, with only minor deviations in between
         * @param interaction Pass this from the interaction listener (https://discordjs.guide/message-components/interactions.html#component-collectors)
         */
        async function generateChannelsAndPopulateConfig(interaction: StringSelectMenuInteraction | ButtonInteraction) {
            // blacklisted channels are dropped from the channels collection entirely,
            // and we pretend they don't exist from a logging perspective
            for (const blacklistedChannel of channelBlacklist) {
                // this safely continues if it can't find the key to delete
                channels.delete(blacklistedChannel);
            }
            // generate a list of the name of each logging channel,
            // so then we can see later on if a normal channel starts with any of the logging channels
            let loggingChannelNames: string[] = [];
            for (const loggingChannel of loggingChannels) {
                loggingChannelNames.push(loggingChannel.name);
            }

            // iterate over logging channels, if loggingchannel.startswith(iterate over normal channel names, normal being "non-logging channels")
            // if logging channel starts with a normal channel name, stop looking
            // if none found, add to unloggedChannels, then send one final confirmation with a list of new channels that'll be made
            /** A list of channels that presumably need to be logged, but aren't yet */
            let unloggedChannels: [string, GuildBasedChannel][] = [];
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
                await util.quickEmbed
                    .confirmEmbed(
                        "New logging channels for these channels will be made:\n" + unloggedChannels.join("\n"),
                        msg
                    )
                    .then(async (choice) => {
                        switch (choice) {
                            case util.ConfirmEmbedResponse.Confirmed:
                                interaction.followUp({
                                    embeds: [util.quickEmbed.infoEmbed("Generating new channels...")],
                                    components: [],
                                });
                                // By submitting all of the promises at once, and then awaiting after submission,
                                // you can save a lot of time over submitting channel creation one at a time
                                // and awaiting in between each channel
                                let jobs = [];
                                for (const channel of unloggedChannels) {
                                    const newChannel = util.guild.channels.create({
                                        name: channel[1].name + "-logging",
                                        type: ChannelType.GuildText,
                                        parent: loggingCategory.id,
                                    });

                                    jobs.push(newChannel);
                                }
                                // awaited because config population needs the IDs of these channels
                                // also add all of the new channels to the collection of logging channels
                                // concat is immutable
                                loggingChannels = loggingChannels.concat(await Promise.all(jobs));
                                break;

                            case util.ConfirmEmbedResponse.Denied:
                                interaction.followUp({
                                    embeds: [
                                        util.quickEmbed.infoEmbed(
                                            "New channels will not be generated, moving on to config population."
                                        ),
                                    ],
                                    components: [],
                                });
                                break;
                        }
                    });
            } else {
                await interaction.followUp({
                    embeds: [
                        util.quickEmbed.infoEmbed("No new channels need generation, moving onto config updates..."),
                    ],
                });
            }

            await interaction.followUp({
                embeds: [util.quickEmbed.infoEmbed("Generating and applying the correct config options...")],
            });
            // now that channels have been created, the config can be populated.
            // blacklistedChannels is simply dumped into the config setting.
            // if channel creation was cancelled, any channels that "needed" creation
            // end up in this weird empty space where they're not in the blacklist, and
            // they are not logged.
            await util.botConfig.editConfigOption(["modules", "logging", "channelBlacklist"], channelBlacklist);
            let channelMap: { [key: string]: string } = {};
            // if a channel has a logging channel that starts with that channel's name, add the IDs to the channel map
            // This will silently not add channels that it doesn't find the appropriate channel for, because checks have already been made
            // to ensure that blacklisted channels can't be logged, and any channel that didn't exist could be created
            console.log("generating channel map");
            for (const channel of channels) {
                for (const loggingChannel of loggingChannels) {
                    if (loggingChannel.name.startsWith(channel[1].name)) {
                        channelMap[channel[1].id] = loggingChannel.id;
                    }
                }
            }
            await util.botConfig.editConfigOption(["modules", "logging", "channelMap"], channelMap);
            interaction.followUp({ embeds: [util.quickEmbed.successEmbed("Config updated and logging deployed.")] });
        }

        let continueButtonListener = botResponse.createMessageComponentCollector({
            componentType: ComponentType.Button,
            filter: (i) => msg.author.id === i.user.id,
            time: 60_000,
        });

        continueButtonListener.on("collect", async (interaction: ButtonInteraction) => {
            await interaction.update({
                embeds: [util.quickEmbed.successEmbed("Continuing without modifying blacklist...")],
                components: [],
            });
            await generateChannelsAndPopulateConfig(interaction);
        });

        // enable doing things when someone interacts with the channel selection menu
        // https://discordjs.guide/message-components/interactions.html#component-collectors
        // time is in MS
        let channelSelectListener = botResponse.createMessageComponentCollector({
            componentType: ComponentType.StringSelect,
            filter: (i) => msg.author.id === i.user.id,
            time: 60_000,
        });

        channelSelectListener.on("collect", async (interaction) => {
            await interaction.update({
                embeds: [
                    util.quickEmbed.successEmbed(
                        "Choice confirmed, looking for any logging channels that need to be made..."
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
        channelSelectListener.on("end", () => {
            // the listener doesn't know whether or not the interaction was ever completed,
            // it just knows when the listener has stopped listening
            if (channelSelectListener.collected.size === 0) {
                botResponse.edit({
                    embeds: [util.quickEmbed.errorEmbed("Interaction timeout, try again.")],
                    components: [],
                });
            }
        });
    }
);

channelLogging.registerSubModule(populate);

export default channelLogging;
