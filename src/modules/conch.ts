/**
 * @file
 * This file contains the 'conch' module definition.
 */

const RESPONSES: string[] = [
  'As I see it, yes.',
  'Ask again later.',
  'Better not tell you now.',
  'Cannot predict now.',
  'Concentrate and ask again.',
  'Don’t count on it.',
  'It is certain.',
  'It is decidedly so.',
  'Most likely.',
  'My reply is no.',
  'My sources say no.',
  'Outlook not so good.',
  'Outlook good.',
  'Reply hazy, try again.',
  'Signs point to yes.',
  'Very doubtful.',
  'Without a doubt.',
  'Yes.',
  'Yes – definitely.',
  'You may rely on it.',
];

const THUMBNAIL_URL = 'https://i.imgur.com/vdvGrsR.png';

import {Colors, EmbedBuilder} from 'discord.js';
import * as util from '../core/util.js';

function getRandomReply(): string {
  return RESPONSES[Math.floor(Math.random() * RESPONSES.length)];
}

/** Formats a question for the embed, trims it if needed
 * @param question The question to format
 * @reutrns The formatted question string
 */
function formatQuestion(question: string): string {
  question = question.substring(0, 255);
  if (!question.endsWith('?')) {
    question += '?';
  }
  return question;
}

/** The root conch command definition */
const conch = new util.RootModule(
  'conch',
  'Asks a question to the magic conch (8ball)',
  [],
  [
    {
      type: util.ModuleOptionType.String,
      name: 'question',
      description: 'The question to ask',
      required: true,
    },
  ],
  async (args, interaction) => {
    const question: string = args
      .find(arg => arg.name === 'question')!
      .value!.toString();

    const embed: EmbedBuilder = new EmbedBuilder();

    embed.setTitle(formatQuestion(question));
    embed.setDescription(getRandomReply());
    embed.setColor(Colors.Blurple);
    embed.setThumbnail(THUMBNAIL_URL);

    await util.replyToInteraction(interaction, {embeds: [embed]});
  }
);

export default conch;
