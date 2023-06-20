/**
 * @file
 * This file contains the `factoid` module definition.
 */
import { Db } from 'mongodb'
import { request } from 'undici'

import * as util from '../../core/util.js'
import { Attachment, BaseMessageOptions } from 'discord.js'
import { validateMessage } from './factoid_validation.js'

interface Factoid {
  /** The primary term used to refer to the factoid */
  name: string
  /** Any alternative terms used to refer to the factoid */
  aliases: string[]
  /** Whether or not the factoid will show up in lists */
  hidden: boolean
  /** The message you'd like to be sent when the factoid is triggered. While preferably an embed, this could be any valid form of message */
  message: BaseMessageOptions
}

const factoid = new util.RootModule(
  'factoid',
  'Simple way to dynamically create and manage factoids (a static message that can be summoned on demand)',
  [util.mongo]
)

factoid.onInitialize(async () => {
  // TODO: add a listener that looks for a factoid if prefix is found
})


factoid.registerSubModule(new util.SubModule('remember', 'Register a new factoid', async (args, msg) => {
  const db: Db = util.mongo.fetchValue()
  const factoids = db.collection<Factoid>('factoids')
  // first see if they uploaded a factoid
  // the json upload
  const uploadedFactoid: Attachment | undefined = msg.attachments.first()
  if (uploadedFactoid === undefined) {
    return util.embed.errorEmbed('No attachments provided')
  }
  // fetch the first attachment, ignore the rest
  // non-null assertion: we've verified that there's at least one attachment

  const { body } = await request(uploadedFactoid.url)
  // the factoid as a string
  const serializedFactoid = await body.text()
  // then validate it
  let messageIssues: string[] = []
  try {
    for (const issues of validateMessage(serializedFactoid)) {
      messageIssues = issues
    }
  } catch (err) {
    messageIssues.push(`Factoid validation failed with error: ${(err as Error).name}`)
  }
  // if any errors were found, return early
  if (messageIssues.length > 0) {
    return util.embed.errorEmbed(`The following issues were found with the attached json (remember cancelled):\n - ${messageIssues.join('\n- ')}`)
  }

  // if no name was specified, return early
  if (args === undefined) {
    return util.embed.errorEmbed('Factoid name missing from command invocation, please specify a name.')
  }

  const factoid: Factoid = {
    name: args.split(' ')[0],
    aliases: [],
    hidden: false,
    message: JSON.parse(serializedFactoid)
  }

  // TODO: allow plain text factoids by taking everything after the argument

  // TODO: see if a factoid is stored with the same name
  await factoids.insertOne(factoid).catch((err) => {
    return util.embed.errorEmbed(`Database call failed with error ${(err as Error).name}`)
  })

  return util.embed.successEmbed('Factoid successfully registered: ' + factoid.name)
}))
factoid.registerSubModule(new util.SubModule('forget', 'Remove a factoid'))
factoid.registerSubModule(new util.SubModule('get', 'Display a factoid'))
factoid.registerSubModule(new util.SubModule('preview', 'Preview a factoid'))
factoid.registerSubModule(new util.SubModule('all', 'Generate a list of all factoids as a webpage'))

export default factoid
