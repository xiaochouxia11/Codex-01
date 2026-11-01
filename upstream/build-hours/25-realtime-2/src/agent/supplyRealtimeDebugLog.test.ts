import { describe, expect, it } from 'vitest';
import { createSupplyRealtimeDebugEntry } from './supplyRealtimeDebugLog';

describe('Supply realtime debug log', () => {
  it('keeps lifecycle metadata without storing raw transcript or tool output', () => {
    const entry = createSupplyRealtimeDebugEntry('server', {
      type: 'response.done',
      response: {
        id: 'resp_123',
        output: [
          {
            id: 'item_1',
            type: 'function_call',
            call_id: 'call_1',
            name: 'search_products',
            arguments: '{"query":"private words"}',
          },
        ],
      },
      transcript: 'private transcript',
      delta: 'private delta',
    });

    expect(entry).toMatchObject({
      direction: 'server',
      type: 'response.done',
      responseId: 'resp_123',
      responseOutputCount: 1,
      responseFunctionCalls: [{ itemId: 'item_1', callId: 'call_1', toolName: 'search_products' }],
    });
    expect(JSON.stringify(entry)).not.toContain('private transcript');
    expect(JSON.stringify(entry)).not.toContain('private delta');
    expect(JSON.stringify(entry)).not.toContain('private words');
  });

  it('records function_call_output metadata without persisting output payloads', () => {
    const entry = createSupplyRealtimeDebugEntry('client', {
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id: 'call_2',
        output: '{"products":[{"title":"private product"}]}',
      },
    });

    expect(entry).toMatchObject({
      direction: 'client',
      type: 'conversation.item.create',
      itemType: 'function_call_output',
      callId: 'call_2',
      outputLength: 42,
    });
    expect(JSON.stringify(entry)).not.toContain('private product');
  });
});
