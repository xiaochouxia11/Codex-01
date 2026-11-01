import { describe, expect, it } from 'vitest';
import { createRealtimeResponseController } from './realtimeResponseController';

describe('createRealtimeResponseController', () => {
  it('does not create a response from speech stopped alone', () => {
    const controller = createRealtimeResponseController();

    controller.beginAudioTurn();

    expect(controller.markSpeechStopped()).toEqual({ shouldCreateResponse: false });
  });

  it('creates one response after a completed transcript', () => {
    const controller = createRealtimeResponseController();

    controller.beginAudioTurn();
    controller.markSpeechStopped();

    expect(controller.completeTranscript('Lighthouse explain the drop')).toEqual({
      shouldCreateResponse: true,
      reason: 'transcript',
      text: 'Lighthouse explain the drop',
    });
    expect(controller.completeTranscript('Lighthouse explain the drop')).toEqual({
      shouldCreateResponse: false,
    });
  });

  it('drops an empty transcript without creating a response', () => {
    const controller = createRealtimeResponseController();

    controller.beginAudioTurn();

    expect(controller.completeTranscript('   ')).toEqual({ shouldCreateResponse: false });
  });

  it('defers tool continuations until the active response is done', () => {
    const controller = createRealtimeResponseController();

    expect(controller.requestTextTurn('Create a report')).toEqual({
      shouldCreateResponse: true,
      reason: 'typed',
      text: 'Create a report',
    });
    controller.markResponseCreated('resp_1');

    expect(controller.requestToolContinuation()).toEqual({ shouldCreateResponse: false });
    expect(controller.markResponseDone('resp_1')).toEqual({
      shouldCreateResponse: true,
      reason: 'tool',
    });
  });

  it('keeps a tool continuation pending when the tool finishes before response.done', () => {
    const controller = createRealtimeResponseController();

    expect(controller.requestTextTurn('Create a report')).toMatchObject({ shouldCreateResponse: true });
    controller.markResponseCreated('resp_1');
    controller.beginToolCall('call_1');

    expect(controller.requestToolContinuation()).toEqual({ shouldCreateResponse: false });
    expect(controller.completeToolCall('call_1')).toEqual({ shouldCreateResponse: false });
    expect(controller.markResponseDone('resp_1')).toEqual({
      shouldCreateResponse: true,
      reason: 'tool',
    });
  });

  it('waits for every pending tool output before continuing after response.done', () => {
    const controller = createRealtimeResponseController();

    expect(controller.requestTextTurn('Find tents')).toMatchObject({ shouldCreateResponse: true });
    controller.markResponseCreated('resp_1');
    controller.beginToolCall('call_1');
    controller.beginToolCall('call_2');

    expect(controller.markResponseDone('resp_1')).toEqual({ shouldCreateResponse: false });
    expect(controller.requestToolContinuation()).toEqual({ shouldCreateResponse: false });
    expect(controller.completeToolCall('call_1')).toEqual({ shouldCreateResponse: false });
    expect(controller.completeToolCall('call_2')).toEqual({
      shouldCreateResponse: true,
      reason: 'tool',
    });
  });

  it('queues typed turns while a response is active', () => {
    const controller = createRealtimeResponseController();

    expect(controller.requestTextTurn('first turn')).toMatchObject({ shouldCreateResponse: true });
    controller.markResponseCreated('resp_1');

    expect(controller.requestTextTurn('second turn')).toEqual({ shouldCreateResponse: false });
    expect(controller.markResponseDone('resp_1')).toEqual({
      shouldCreateResponse: true,
      reason: 'queued',
      text: 'second turn',
    });
  });

  it('clears active response and queued work on reset', () => {
    const controller = createRealtimeResponseController();

    controller.requestTextTurn('first turn');
    controller.markResponseCreated('resp_1');
    controller.requestTextTurn('queued turn');
    controller.requestToolContinuation();
    controller.reset();

    expect(controller.markResponseDone('resp_1')).toEqual({ shouldCreateResponse: false });
    expect(controller.requestTextTurn('fresh turn')).toEqual({
      shouldCreateResponse: true,
      reason: 'typed',
      text: 'fresh turn',
    });
  });
});
