/*
This module provides discord logging, and is intended to log messages to a collection of logging channels. Because this requires 
a comparatively very high level amount of processing compared to other tasks, this code should be *very* optimized
*/
import { APIEmbed, Events, Guild, Message, MessageActionRowComponent, TextChannel } from "discord.js";
import * as util from "../core/util.js";

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
    //TODO: annotate return types once I figure out if a message has a type
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
        // TODO: if write cursor has written an entire buffer's worth of data and hasn't been read yet, allocate more
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
let channelLogging = new util.Module("logging", "Manage discord channel and thread logging");

channelLogging.onInitialize(async () => {
    /**
     * `GuildMember` is the server specific object for a `User`, so that's fetched
     * to get info like nickname, and perform administrative tasks  on a user.
     *
     * `Guild` is the way to interact with server specific functionality.
     *
     * This makes the assumption that the bot is deployed to 1 guild.
     *
     * https://discord.js.org/#/docs/discord.js/main/class/Guild
     */
    // non-null assertion: if the bot isn't in a server, than throwing an error can be considered reasonable behavior
    const guild = util.client.guilds.cache.first()!;

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
                            value: `${(await guild.members.fetch(message.author.id)).displayName}`,
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

export default channelLogging;
