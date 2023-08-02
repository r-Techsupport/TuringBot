/**
 * @file
 * This file contains the worker thread code for logging
 */

import {
  Message,
  Events,
  TextChannel,
  Client,
  GatewayIntentBits,
} from 'discord.js';
import {workerData, parentPort} from 'node:worker_threads';

// because this is a worker thread and we want to split imports and other behavior
// from the main codebase as much as possible to avoid some nasty side effects,
// a whole new client is defined
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

/** This is passed by the code starting the worker thread, it should be a mirror of the channel logging extension config */
//const config = workerData.config;
const config = workerData.config;
const authToken = workerData.authToken;

/** pass a message to the main thread that will then be passed to the event logger */
function logEvent(
  category: 'EE' | 'WW' | 'II',
  description: string,
  verbosity: 1 | 2 | 3
) {
  console.log('logging message');
  parentPort?.postMessage({
    type: 'log',
    content: {
      category: category,
      description: description,
      verbosity: verbosity,
    },
  });
}

// log the worker thread into discord
await client.login(authToken);

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
   * The maximum size that this buffer is allowed to grow to. Once the maximum amount is hit, {@link reallocationStepSize}
   * # of messages will be dropped from the buffer, and not logged
   */
  maxBufferSize: number;
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
  buf: Array<Message | null>;

  /**
   * Create a new ringbuffer
   * @param initialSize However many elements are to be initially allocated in the buffer. More elements may be allocated if necessary, but
   * this is the minimum amount to be allocated at all times
   */
  constructor(initialSize = 8, maxSize = 200) {
    this.initialBufferSize = initialSize;
    this.maxBufferSize = maxSize;
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
      logEvent(
        'II',
        `Shrunk message ringbuffer size (new size: ${this.buf.length})`,
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
    // if the buffer has hit the maximum stated size, than create
    // space in the buffer by moving the read cursor forwards, moving over
    // messages without reading them, effectively dropping them from the buffer
    if (this.numValues === this.maxBufferSize) {
      for (let i = 0; i < this.reallocationStepSize; i++) {
        logEvent(
          'WW',
          `Maximum message buffer of ${this.maxBufferSize} reached, ${this.reallocationStepSize} messages will not be logged`,
          1
        );
        this.incrementReadCursor();
      }
    }
    // if every spot in the buffer is filled, add more spots to the buffer
    if (this.numValues === this.buf.length - 1) {
      this.expandBuffer(this.reallocationStepSize);
    }
    // write the message into the buffer and increment the cursor and total size
    this.buf[this.writeCursorIndex] = message;
    this.numValues += 1;
    // move the write cursor forwards, wrapping back to the beginning if necessary
    // if we've hit the end of the array, go back to the beginning
    this.incrementWriteCursor();
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
    const shiftBlock = this.buf.splice(this.writeCursorIndex + 1);
    for (let i = 0; i < increaseBy; i++) {
      this.buf.push(null);
    }
    for (const item of shiftBlock) {
      this.buf.push(item);
    }
    // move the read cursor forwards
    if (this.readCursorIndex > this.writeCursorIndex) {
      for (let i = 0; i < increaseBy; i++) {
        this.incrementReadCursor();
      }
    }

    logEvent(
      'II',
      `Expanded ringbuffer size (current size: ${this.buf.length})`,
      3
    );
  }

  /**
   * Move the read cursor forwards, wrapping it back to the beginning of the buffer if needed. This does
   * not edit metadata like the amount of items in the buffer
   */
  private incrementReadCursor() {
    if (this.readCursorIndex === this.buf.length - 1) {
      this.readCursorIndex = 0;
    } else {
      this.readCursorIndex += 1;
    }
  }

  /**
   * Move the write cursor forwards, wrapping it back to the beginning of the buffer if needed. This does
   * not edit metadata like the amount of items in the buffer
   */
  private incrementWriteCursor() {
    if (this.writeCursorIndex === this.buf.length - 1) {
      this.writeCursorIndex = 0;
    } else {
      this.writeCursorIndex += 1;
    }
  }
}

/** Where messages that haven't been processed yet are stored. */
const mBuffer = new MessageRingBuffer(10);
// when a message is sent, add it to the buffer
client.on(Events.MessageCreate, message => {
  if (!message.author.bot) {
    mBuffer.write(message);
  }
});
const guild = client.guilds.cache.first()!;

// refer to the channel map
mBuffer.onWrite(async () => {
  // get the channel id, reference the channelmap to determine where the message needs to be logged
  // Non-null assertion: This code is only called when data is written to the buffer, thus ensuring we're handling non-null values
  const message: Message = (await mBuffer.read()) as Message;

  // Ignore all messages sent in channels not defined by the channel map
  if (!(message.channelId in config.channelMap)) return;

  const logChannelID = config.channelMap[message.channelId];
  // get the logging channel from cache send a log there containing relevant info
  // user roles are not logged, because it's unnecessary overhead
  const logChannel = client.channels.cache.get(logChannelID) as TextChannel;
  await logChannel.send({
    embeds: [
      {
        thumbnail: {
          url: message.author.avatarURL()!,
        },
        fields: [
          {
            name: 'Username',
            value: `${message.author.tag}`,
            inline: true,
          },
          {
            name: 'Nickname',
            value: `${
              (
                await guild.members.fetch(message.author.id)
              ).displayName
            }`,
            inline: true,
          },
          {
            name: 'Content',
            value: message.cleanContent,
          },
          {
            name: 'Channel',
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
