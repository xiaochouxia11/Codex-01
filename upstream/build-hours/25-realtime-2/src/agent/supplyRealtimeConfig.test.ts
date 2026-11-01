import { describe, expect, it } from 'vitest';
import { createRealtimeSessionConfig } from '../realtimeSessionConfig';
import { SUPPLY_REALTIME_INSTRUCTIONS, SUPPLY_REALTIME_TOOLS } from './supplyPrompt';
import { SUPPLY_REALTIME_MODEL, SUPPLY_REALTIME_REASONING } from './supplyRealtimeConfig';

describe('Supply realtime model config', () => {
  it('targets GPT Realtime 2 with low reasoning effort', () => {
    const session = createRealtimeSessionConfig({
      model: SUPPLY_REALTIME_MODEL,
      reasoning: SUPPLY_REALTIME_REASONING,
      instructions: SUPPLY_REALTIME_INSTRUCTIONS,
      tools: SUPPLY_REALTIME_TOOLS,
    });

    expect(SUPPLY_REALTIME_MODEL).toBe('gpt-realtime-2');
    expect(SUPPLY_REALTIME_REASONING).toEqual({ effort: 'low' });
    expect(session.model).toBe('gpt-realtime-2');
    expect(session.reasoning).toEqual({ effort: 'low' });
  });
});
