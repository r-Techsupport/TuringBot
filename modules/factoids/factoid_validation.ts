/**
 * @file
 * This file contains code for factoid validation. It's meant to provide a more user friendly way to notate issues
 * with factoids.
 */

import { APIEmbed, BaseMessageOptions, Embed } from 'discord.js'
import { title } from 'node:process'

// TODO: fill all this out
// most of these were picked from the limits list on the discord.js page,
// this is far from thorough

// these are split into enums so that you could check and see what kind of error it is or easily change the error message
// without copying the string everywhere
enum MessageIssue {
  InvalidJson = 'The file attached is not a valid json, try using a linter.',
  ContentType = '`.content` is defined, but is not a string',
  ContentLength = '`.content` is over the maximum length (2000 chars)',
  EmbedsType = '`.embeds is defined, but is not an array',
  FilesType = '`.files` is defined, but it is not an array',
}

/**
 * Possible issues with an {@link APIEmbed}, meant for embed validation
 *
 * Fill this out as issues pop up
 *
 * @see {@link https://discordjs.guide/popular-topics/embeds.html#embed-limits}
 */
export enum EmbedIssue {
  TitleLength = '`.title` length is over the maximum length (256 chars)',
  DescriptionLength = '`.description` length is over the maximum allowed (4096 chars)',
  FieldsLength = '.fields contains more than the maximum allowed amount (25 fields)',
  FieldNameLength = '`.name` length is over the maximum allowed length for a field name (256 chars)',
  FieldValueLength = '`.value` length is over the maximum allowed for a field value (1024 chars)',
  FooterLength = '`.footer` length is over the maximum allowed for a footer (2048 chars)'
}

/**
 * Determine whether or not the passed object represents a valid message, in this case, to validate factoids before storage
 * @argument messageToValidate A serialized string containing the json form of the message to validate
 * @returns A list of issues found
 */
// this is a Generator (https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/yield)
// so that if the function crashes before finishing, we can still know what embed issues were found
/*
 * A bit of a nerd rant on the efficiency of this choice. Because Javascript passes arrays by reference,
 * this is actually a fairly memory efficient way to do things. It requires a bit more work because
 * you need to iterate over all yielded things, but that can be done with a while loop nested in try/catch
 */
// TODO: look into supporting link buttons (https://discord.com/developers/docs/interactions/message-components)
export function * validateMessage (messageToValidate: string): Generator<string[]> {
  // it's primarily a list of message issues, but some issues won't necessarily conform to
  // an enum
  const issues: MessageIssue | string[] = []
  let message: BaseMessageOptions
  // it must be a valid json
  try {
    message = JSON.parse(messageToValidate)
  } catch {
    issues.push(MessageIssue.InvalidJson)
    return issues
  }

  // https://discord.js.org/#/docs/discord.js/main/typedef/BaseMessageOptions
  // content must be string or null/undefined
  if ('content' in message && typeof message.content !== 'string') {
    issues.push(MessageIssue.ContentType)
    yield issues
  }

  // if content is defined, it must be under 2000 chars
  // non-null assertion: check made to ensure the content key is defined
  if ('content' in message && message.content!.length > 2000) {
    issues.push(MessageIssue.ContentLength)
    yield issues
  }

  // if embeds is defined, it needs to be an array
  if ('embeds' in message && !Array.isArray(message.embeds)) {
    issues.push(MessageIssue.EmbedsType)
    yield issues
  }

  // embed validation
  if ('embeds' in message) {
    for (const i in message.embeds!) {
      let embedIssues: string[] = []
      try {
        for (const foundIssues of validateEmbed(message.embeds[i] as APIEmbed)) {
          embedIssues = foundIssues
        }
      } catch (err) {
        embedIssues.push(
          ' Validation did not complete, and errored early with: ' + err
        )
      }
      // go through and indicate which embed is bad
      embedIssues = embedIssues.map(embedIssue => `embedIssues[${i}]` + embedIssue)
    }
  }

  if ('files' in message && !Array.isArray(message.files)) {
    issues.push(MessageIssue.FilesType)
    yield issues
  }

  yield issues
}

/** Similar to {@link validateMessage()}, this does some basic checks and attempts to ensure that the object passed is a valid APIEmbed.
 * if it finds something that does not comply, it will add it to the generated list.
 *
 * This is implemented as a generator to prevent a severely malformed object from stopping any results from being returned
 *
 * @returns A list of issues found with the embed
*/
// for the record, this function was miserable to write, and it will never ever be done because
// you need to come up with every way someone could do this wrong
function * validateEmbed (embed: APIEmbed): Generator<string[]> {
  const issues: EmbedIssue | string[] = []

  // title is over length
  if ('title' in embed && embed.title!.length > 256) {
    issues.push(EmbedIssue.TitleLength)
    yield issues
  }

  // description is over max length
  if ('description' in embed && embed.description!.length > 4096) {
    issues.push(EmbedIssue.DescriptionLength)
    yield issues
  }

  // there can only be 25 fields
  if ('fields' in embed && embed.fields!.length > 25) {
    issues.push(EmbedIssue.FieldsLength)
  }

  // iterate over each field and make sure the name and value are within size limits
  if ('fields' in embed) {
    for (const i in embed.fields!) {
      // name must be under 256 chars
      if (embed.fields[i].name.length > 256) {
        issues.push(
                    `.fields[${i}]` + EmbedIssue.FieldNameLength
        )
        yield issues
      }

      // value must be under 1024
      if (embed.fields[i].value.length > 1024) {
        issues.push(
                    `.fields[${i}]` + EmbedIssue.FieldValueLength
        )
        yield issues
      }
    }
  }

  // footer must be under 2048 chars
  // should probably validate that the footer is properly formed
  if ('footer' in embed && embed.footer!.text.length > 2048) {
    issues.push(EmbedIssue.FooterLength)
    yield issues
  }

  yield issues
}
