import {describe, it} from 'node:test';
import chalk from 'chalk';

import {EventCategory, logEvent} from '../core/logger';
import {botConfig} from '../core/config';

// This should probably be removed later, I'd like to make tests run when
// the bot is connected to discord and started so that tests don't need
// to emulate a whole api
botConfig.readConfigFromFileSystem();

describe('testing logging', () => {
  it('should support color', () => {
    if (!chalk.supportsColor) throw 'This terminal does not support color';
  });

  it('should log an information event', () => {
    logEvent(EventCategory.Info, 'testing', 'logging an information event', 3);
  });

  it('should log a warning event', () => {
    logEvent(EventCategory.Warning, 'testing', 'logging a warning event', 3);
  });

  it('should log an error event', () => {
    logEvent(EventCategory.Error, 'testing', 'logging an error event', 3);
  });
});
