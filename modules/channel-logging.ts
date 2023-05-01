/*
This module provides discord logging, and is intended to log messages to a collection of logging channels. Because this requires 
a comparatively very high level amount of processing compared to other tasks, this code should be *very* optimized
*/
import { Events } from "discord.js";
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
    buf: any[];

    /**
     *
     * @param initialSize However many elements are to be initially allocated in the buffer. More elements may be allocated if necessary, but
     * this is the minimum amount to be allocated at all times
     */
    constructor(initialSize: number = 8) {
        this.buf = Array(initialSize);
    }

    /**
     * Read and return a message, move the read cursor forwards. If there's no more unread data in the buffer, returns `null`
     */
    //TODO: annotate return types once I figure out if a message has a type
    async read() {
        //artificially slow down read calls to test ringbuffer reallocation
        await new Promise((r) => setTimeout(r, 2000));
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
        return returnVal;
    }

    /**
     * Called whenever a message is written into a buffer
     */
    calledOnWrite = () => {};

    /**
     * Write a message into the buffer and advance the write cursor forwards, allocating more space if necessary
     */
    write(message) {
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
    onWrite(funcToCallOnWrite) {
        this.calledOnWrite = funcToCallOnWrite;
    }

    /**
     * Expand the buffer size by inserting space after the write cursor and shifting everything
     */
    expandBuffer(increaseBy) {
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
                category: "II",
                location: "channel logging",
                description: `Expanded ringbuffer size (current size: ${this.buf.length}`,
            },
            3
        );
    }
}
let channelLogging = new util.Module("logging", "Manage discord channel and thread logging");

channelLogging.onInitialize(async () => {
    let mBuffer = new MessageRingBuffer(3);
    // when a message is sent, add it to the buffer
    util.client.on(Events.MessageCreate, (message) => {
        if (!message.author.bot) {
            mBuffer.write(message);
        }
    });

    // refer to the channel map
    mBuffer.onWrite(async () => {
        // get the channel id, reference the channelmap to determine where the message needs to be logged
        const message = await mBuffer.read();
        const logChannelId = channelLogging.fetchConfig().channelMap[message.channelId];
        // get the logging channel from cache send a log there
        let logChannel = util.client.channels.cache.get(logChannelId);
        logChannel.send({
            embeds: [
                {
                    fields: [
                        {
                            name: "Content",
                            value: message.cleanContent,
                        },
                        {
                            name: "Channel",
                            value: `${message.channel}`,
                        },
                        {
                            name: "Nickname",
                            value: message.author.tag,
                            inline: true,
                        },
                        {
                            name: "Username",
                            value: `${message.username}`,
                            inline: true,
                        },
                        {
                            name: "Roles",
                            value: `${message.member.roles.roles}`,
                        },
                    ],
                },
            ],
            timestamp: new Date().toISOString(),
            footer: {
                text: `User ID: ${message.author.id}`,
            },
        });
    });
});

export default channelLogging;
