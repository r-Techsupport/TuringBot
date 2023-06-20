import { describe, it } from 'node:test'
import chalk from 'chalk'

import { EventCategory, eventLogger } from '../core/logger'
import { botConfig } from '../core/config'

// This should probably be removed later, I'd like to make tests run when
// the bot is connected to discord and started so that tests don't need
// to emulate a whole api
botConfig.readConfigFromFileSystem()

describe('testing logging', () => {
  it('should support color', () => {
    if (!chalk.supportsColor) throw 'This terminal does not support color'
  })

  it('should log an information event', () => {
    eventLogger.logEvent(
      {
        location: 'testing',
        description: 'logging an information event',
        category: EventCategory.Info
      },
      3
    )
  })

  it('should log a warning event', () => {
    eventLogger.logEvent(
      {
        location: 'testing',
        description: 'logging a warning event',
        category: EventCategory.Warning
      },
      3
    )
  })

  it('should log an error event', () => {
    eventLogger.logEvent(
      {
        location: 'testing',
        description: 'logging an error event',
        category: EventCategory.Error
      },
      3
    )
  })
})
