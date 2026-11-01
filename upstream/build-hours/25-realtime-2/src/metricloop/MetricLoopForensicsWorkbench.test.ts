import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { MetricLoopForensicsWorkbench, hasMetricLoopWorkbenchActivities } from './MetricLoopForensicsWorkbench';
import type { MetricLoopToolActivity } from './metricLoopContracts';

function activity(name: string): MetricLoopToolActivity {
  return {
    id: name,
    name,
    label: name,
    status: 'done',
    startedAtMs: 0,
  };
}

describe('hasMetricLoopWorkbenchActivities', () => {
  it('ignores ordinary dashboard filter turns', () => {
    expect(
      hasMetricLoopWorkbenchActivities([
        activity('get_dashboard_state'),
        activity('apply_filter'),
      ]),
    ).toBe(false);
  });

  it('recognizes investigation artifact generation', () => {
    expect(
      hasMetricLoopWorkbenchActivities([
        activity('get_dashboard_state'),
        activity('start_root_cause_investigation'),
      ]),
    ).toBe(true);
  });

  it('recognizes cohort forensics work', () => {
    expect(
      hasMetricLoopWorkbenchActivities([
        activity('get_dashboard_state'),
        activity('run_cohort_query'),
      ]),
    ).toBe(true);
  });

  it('renders generated code validation and repair details in the trace', () => {
    const html = renderToStaticMarkup(
      createElement(MetricLoopForensicsWorkbench, {
        activities: [
          {
            ...activity('run_analysis_code'),
            status: 'needs_rewrite',
            label: 'Running generated analysis code',
            details: ['Validation issue: reducers must return a value.'],
            forensics: {
              kind: 'code_validation',
              title: 'Generated code validation',
              validationError: 'Generated analysis code is blocked: reducers must return a value.',
              rewriteInstructions: 'Rewrite using rows.map/filter/reduce/sort/slice.',
              allowedContract: ['Return an array of plain row objects with primitive values.'],
              code: 'const out = rows.map((row) => row);',
              sampleRows: [{ browser: 'mobile_safari', lost_activations: 42 }],
            },
          },
          {
            ...activity('run_analysis_code'),
            status: 'repaired',
            label: 'Running generated analysis code',
            forensics: {
              kind: 'code',
              title: 'Repaired generated analysis code',
              repairSource: 'external_model',
              validationError: 'Only bounded for-of loops are allowed.',
              originalCode: 'for (let i = 0; i < rows.length; i++) {} return [];',
              code: 'return rows.map((row) => ({ cohort: row.browser, lost_activations: row.lost_activations }));',
              previewRows: [{ cohort: 'mobile_safari', lost_activations: 42 }],
            },
          },
        ],
      }),
    );

    expect(html).toContain('Generated code validation');
    expect(html).toContain('Validation issue');
    expect(html).toContain('Allowed reducer contract');
    expect(html).toContain('Original failed code');
    expect(html).toContain('Repair path');
    expect(html).toContain('external model');
    expect(html).toContain('mobile_safari');
  });
});
