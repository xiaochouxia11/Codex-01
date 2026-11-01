import { describe, expect, it } from 'vitest';
import { createSupplyResponseGate } from './supplyResponseGate';

describe('Supply response gate', () => {
  it('defers tool continuations until the active response is done', () => {
    const gate = createSupplyResponseGate();

    gate.markResponseCreated();

    expect(gate.requestResponseForToolOutput()).toBe(false);
    expect(gate.markResponseDone()).toEqual({ shouldCreateResponse: true, reason: 'tool' });
  });

  it('allows a tool continuation immediately when the original response already finished', () => {
    const gate = createSupplyResponseGate();

    gate.markResponseCreated();
    gate.markToolCallStarted();

    expect(gate.markResponseDone()).toEqual({ shouldCreateResponse: false });
    expect(gate.requestResponseForToolOutput()).toBe(true);
  });

  it('queues typed turns while a response is active', () => {
    const gate = createSupplyResponseGate();

    expect(gate.requestResponseForUserTurn()).toBe(true);
    expect(gate.requestResponseForUserTurn()).toBe(false);
    expect(gate.markResponseDone()).toEqual({ shouldCreateResponse: true, reason: 'user' });
  });

  it('collapses repeated tool continuation requests into one deferred response', () => {
    const gate = createSupplyResponseGate();

    gate.markResponseCreated();

    expect(gate.requestResponseForToolOutput()).toBe(false);
    expect(gate.requestResponseForToolOutput()).toBe(false);
    expect(gate.markResponseDone()).toEqual({ shouldCreateResponse: true, reason: 'tool' });
    expect(gate.markResponseDone()).toEqual({ shouldCreateResponse: false });
  });

  it('waits for all pending tool outputs when response.done arrives first', () => {
    const gate = createSupplyResponseGate();

    gate.markResponseCreated();
    gate.markToolCallStarted('call_1');
    gate.markToolCallStarted('call_2');

    expect(gate.markResponseDone()).toEqual({ shouldCreateResponse: false });
    expect(gate.requestResponseForToolOutput('call_1')).toBe(false);
    expect(gate.requestResponseForToolOutput('call_2')).toBe(true);
  });
});
