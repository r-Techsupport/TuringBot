/*
This module provides discord logging, and is intended to log messages to a collection of logging channels. Because this requires 
a comparatively very high level amount of processing compared to other tasks, this code should be *very* optimized
*/
import { Events } from "discord.js";
import * as util from "../core/util.js";

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

    constructor(initialSize: number = 32) {
        this.buf = Array(initialSize);
    }

    /**
     * Read and return a message, move the read cursor forwards. If there's no more unread data in the buffer, returns `null`
     */
    //TODO: annotate return types once I figure out if a message has a type
    read() {
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
    private calledOnWrite = () => {};

    /**
     * Write a message into the buffer and advance the write cursor forwards, allocating more space if necessary
     */
    write(message) {
        // TODO: if write cursor has written an entire buffer's worth of data and hasn't been read yet, allocate more
        if (this.numValues > this.buf.length - 1) {
            throw new Error("attempting to overwrite values that haven't been written yet");
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
}
let channelLogging = new util.Module("logging", "Manage discord channel and thread logging");

channelLogging.onInitialize(async () => {
    let mBuffer = new MessageRingBuffer(3);
    // when a message is sent, add it to the buffer
    util.client.on(Events.MessageCreate, (message) => {
        mBuffer.write(message);
    });

    // refer to the channel map
    mBuffer.onWrite(async () => {
        while (mBuffer.numValues > 0) {
            console.log(mBuffer.buf);
            // get the channel id, reference the channelmap to determine where the message needs to be logged
            const message = mBuffer.read();
            const logChannelId = channelLogging.fetchConfig().channelMap[message.channelId];
            // get the logging chanel from cache send a log there
            let logChannel = util.client.channels.cache.get(logChannelId);
            logChannel.send({ embeds: [{}] });
        }
    });
});

export default channelLogging;
