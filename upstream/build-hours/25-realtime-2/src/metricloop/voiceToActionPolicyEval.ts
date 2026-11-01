import type { MetricLoopTurnPolicy } from './metricLoopContracts';

export interface MetricLoopWakeWordEvalCase {
  id: string;
  transcript: string;
  expectedShouldSpeak: boolean;
  category: 'wake_word' | 'split_wake_word' | 'action' | 'product_name';
}

export interface MetricLoopWakeWordEvalResult extends MetricLoopWakeWordEvalCase {
  actualShouldSpeak: boolean;
  actualMode: MetricLoopTurnPolicy['mode'];
  passed: boolean;
}

export interface MetricLoopWakeWordEvalScore {
  total: number;
  correct: number;
  falseAudio: MetricLoopWakeWordEvalResult[];
  falseSilent: MetricLoopWakeWordEvalResult[];
  results: MetricLoopWakeWordEvalResult[];
}

export const METRIC_LOOP_WAKE_WORD_EVAL_CASES: MetricLoopWakeWordEvalCase[] = [
  {
    id: 'plain-action-root-cause',
    transcript: 'Why did activation drop for first-time shoppers in Europe last week?',
    expectedShouldSpeak: false,
    category: 'action',
  },
  {
    id: 'plain-action-filter',
    transcript: 'Filter to the last seven days and compare Mobile Safari to Chrome.',
    expectedShouldSpeak: false,
    category: 'action',
  },
  {
    id: 'plain-action-report',
    transcript: 'Create an engineering ticket brief for this cohort.',
    expectedShouldSpeak: false,
    category: 'action',
  },
  {
    id: 'product-name-is-not-wake-word',
    transcript: 'MetricLoop explain what happened on the activation funnel.',
    expectedShouldSpeak: false,
    category: 'product_name',
  },
  {
    id: 'dashboard-name-is-not-wake-word',
    transcript: 'Ask MetricLoop to investigate the activation drop.',
    expectedShouldSpeak: false,
    category: 'product_name',
  },
  {
    id: 'leading-wake-word',
    transcript: 'Lighthouse explain the likely cause out loud.',
    expectedShouldSpeak: true,
    category: 'wake_word',
  },
  {
    id: 'mid-sentence-wake-word',
    transcript: 'Can you, Lighthouse, walk me through what changed?',
    expectedShouldSpeak: true,
    category: 'wake_word',
  },
  {
    id: 'lowercase-wake-word',
    transcript: 'lighthouse summarize the report for the room.',
    expectedShouldSpeak: true,
    category: 'wake_word',
  },
  {
    id: 'split-wake-word',
    transcript: 'Before we move on light house summarize the likely cause.',
    expectedShouldSpeak: true,
    category: 'split_wake_word',
  },
  {
    id: 'hyphenated-wake-word',
    transcript: 'Light-house explain why paid ads were ruled out.',
    expectedShouldSpeak: true,
    category: 'split_wake_word',
  },
];

export function scoreMetricLoopWakeWordPolicy(
  cases: MetricLoopWakeWordEvalCase[],
  policy: (transcript: string) => MetricLoopTurnPolicy,
): MetricLoopWakeWordEvalScore {
  const results = cases.map((evalCase) => {
    const actual = policy(evalCase.transcript);
    return {
      ...evalCase,
      actualShouldSpeak: actual.shouldSpeak,
      actualMode: actual.mode,
      passed: actual.shouldSpeak === evalCase.expectedShouldSpeak,
    };
  });

  return {
    total: results.length,
    correct: results.filter((result) => result.passed).length,
    falseAudio: results.filter(
      (result) => result.actualShouldSpeak && !result.expectedShouldSpeak,
    ),
    falseSilent: results.filter(
      (result) => !result.actualShouldSpeak && result.expectedShouldSpeak,
    ),
    results,
  };
}
