/**
 * @file
 * Modules:
 *  - {@link autopaste}
 */

import {Colors, EmbedBuilder, Events, Message, Role} from 'discord.js';
import * as util from '../core/util.js';
import {request} from 'undici';

const autopaste = new util.RootModule(
  'autopaste',
  'Autopaste messages over a certain length',
  []
);

autopaste.onInitialize(async () => {
  // Only defines and checks everything once so it isn't redefined on every message
  const maxLength: number = autopaste.config.maxLength;

  if (!maxLength) {
    util.logEvent(
      util.EventCategory.Warning,
      'autopaste',
      "Config error: The max length isn't set or is invalid, the autopaste module will be disabled.",
      1
    );
    return;
  }

  const API_URL: string = autopaste.config.pasteApi;

  if (!API_URL || !API_URL.startsWith('http')) {
    util.logEvent(
      util.EventCategory.Warning,
      'autopaste',
      "Config error: The API URL isn't set or is invalid, the autopaste module will be disabled.",
      1
    );
    return;
  }

  const immuneRoles: string[] = autopaste.config.immuneRoleIds;

  const headers = {
    'Linx-Expiry': '1800',
    'Linx-Randomize': 'yes',
    Accept: 'application/json',
  };

  // The main message listener
  util.client.on(Events.MessageCreate, async (message: Message<boolean>) => {
    if (message.content.length <= maxLength) {
      return;
    }

    // Makes sure the author doesn't have any immune roles
    for (const roleIds of immuneRoles) {
      // The role is found from the cache and only THEN is ITs id checked, done to make sure you
      // can't just put a role name in the list and then create a new role with the same name
      const role: Role | undefined = message.guild!.roles.cache.find(
        role => role.id === roleIds
      );

      if (role !== undefined && message.member!.roles.cache.has(role.id)) {
        return;
      }
    }
    const content: string = message.content;

    // Pastes the message contents
    const response = await request(API_URL, {
      method: 'PUT',
      headers: headers,
      body: JSON.stringify(content),
    });

    // Parses the response data
    let responseData = '';

    for await (const data of response.body) {
      responseData += data;
    }

    const parsedResponse = JSON.parse(responseData);
    const url = parsedResponse.url;

    if (!url) {
      util.logEvent(
        util.EventCategory.Warning,
        'autopaste',
        `call to ${API_URL} failed! Response code ${response.statusCode}`,
        1
      );
      return;
    }

    const embed: EmbedBuilder = new EmbedBuilder()
      .setColor(Colors.Blue)
      .setAuthor({
        name: `Paste by ${message.author.tag}`,
        iconURL: message.author.displayAvatarURL(),
      })
      .setDescription(message.content.substring(0, 100).replace('\n', ''))
      .addFields({
        name: 'Paste link',
        value: url,
      })
      .setFooter({
        text: autopaste.config.pasteFooterContent,
      });

    await message.delete();
    await message.channel.send({embeds: [embed]});
  });
});

export default autopaste;
