import {describe, it} from 'node:test';
import chalk from 'chalk';

import {EventCategory, generateEventEmbed} from '../core/logger.js';
import assert from 'node:assert';

describe('testing logging', () => {
  it('should generate an info event embed', () => {
    const generationResult = generateEventEmbed(EventCategory.Info, 'a', 'a');
    // the timestamp can't be compared, because it can change between the function call
    // and the assertion, so we just verify that it's a valid date
    Date.parse(generationResult.timestamp!);
    generationResult.timestamp = undefined;

    assert.deepStrictEqual(generationResult, {
      title: 'Event Type: Information',
      description: 'Location: a',
      color: 0x2e8eea,
      fields: [{name: 'Description', value: 'a'}],
      timestamp: undefined,
    });
  });

  it('should generate a warning event embed', () => {
    const generationResult = generateEventEmbed(
      EventCategory.Warning,
      'a',
      'a'
    );
    // the timestamp can't be compared, because it can change between the function call
    // and the assertion, so we just verify that it's a valid date
    Date.parse(generationResult.timestamp!);
    generationResult.timestamp = undefined;

    assert.deepStrictEqual(generationResult, {
      title: 'Event Type: Warning',
      description: 'Location: a',
      color: 0xf5f543,
      fields: [{name: 'Description', value: 'a'}],
      timestamp: undefined,
    });
  });

  it('should generate an error event embed', () => {
    const generationResult = generateEventEmbed(EventCategory.Error, 'a', 'a');
    // the timestamp can't be compared, because it can change between the function call
    // and the assertion, so we just verify that it's a valid date
    Date.parse(generationResult.timestamp!);
    generationResult.timestamp = undefined;

    assert.deepStrictEqual(generationResult, {
      title: 'Event Type: Error',
      description: 'Location: a',
      color: 0xd74e2e,
      fields: [{name: 'Description', value: 'a'}],
      timestamp: undefined,
    });
  });
});
