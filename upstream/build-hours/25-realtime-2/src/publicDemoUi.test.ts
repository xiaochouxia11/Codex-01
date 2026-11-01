import { describe, expect, it } from 'vitest';
import appSource from './App.tsx?raw';
import metricLoopActionConsoleSource from './metricloop/MetricLoopActionConsole.tsx?raw';
import metricLoopDashboardSource from './metricloop/MetricLoopDashboard.tsx?raw';
import metricLoopForensicsWorkbenchSource from './metricloop/MetricLoopForensicsWorkbench.tsx?raw';
import metricLoopNotebookSource from './metricloop/MetricLoopNotebook.tsx?raw';
import metricLoopRealtimeSource from './metricloop/useMetricLoopRealtime.ts?raw';

const { readFileSync } = await import('node:fs');
const stylesSource = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');

describe('public demo UI polish', () => {
  it('distinguishes the saved shoe size recommendation from the selected PDP size', () => {
    expect(appSource).toContain('saved-size-recommendation');
    expect(appSource).toContain('Recommended saved size');
    expect(appSource).toContain('shouldPulse');
  });

  it('uses product-facing MetricLoop investigation copy instead of tutorial copy', () => {
    expect(metricLoopDashboardSource).toContain('Investigate activation drop');
    expect(metricLoopDashboardSource).toContain('Ask MetricLoop to investigate the activation drop');
    expect(metricLoopDashboardSource).not.toContain('Broad dashboard loaded');
    expect(metricLoopDashboardSource).not.toContain('Suggested investigation path');
    expect(metricLoopDashboardSource).not.toContain('Ask the hero investigation question');
  });

  it('uses a neutral empty state before MetricLoop generates the notebook', () => {
    expect(metricLoopDashboardSource).toContain('Investigation Notebook');
    expect(metricLoopDashboardSource).toContain('{hasInvestigation && (');
    expect(metricLoopDashboardSource).not.toContain('function RootCauseSummary');
    expect(metricLoopDashboardSource).not.toContain('<span>Artifact</span>');
    expect(metricLoopDashboardSource).not.toContain('Root-Cause Investigation Notebook');
    expect(metricLoopDashboardSource).toContain(
      "request.insightId === 'investigation_notebook' && !hasInvestigation",
    );
    expect(metricLoopDashboardSource).toContain(
      'Investigation Notebook is not available yet.',
    );
    expect(metricLoopNotebookSource).not.toContain('Ready for investigation');
    expect(metricLoopNotebookSource).not.toContain('Ask what looks suspicious in activation');
    expect(metricLoopNotebookSource).not.toContain('Notebook artifact');
    expect(metricLoopNotebookSource).not.toContain('voice shopping data loaded');
  });

  it('uses a minimal root-cause panel header after investigation generation', () => {
    expect(metricLoopNotebookSource).toContain('Collapse root-cause investigation');
    expect(metricLoopNotebookSource).toContain('Expand root-cause investigation');
    expect(metricLoopNotebookSource).toContain("{isExpanded ? 'Collapse' : 'Expand'}");
    expect(metricLoopNotebookSource).toContain('Summary');
    expect(metricLoopNotebookSource).toContain('Reasoning trace');
    expect(metricLoopNotebookSource).not.toContain('{board.confidence} confidence');
  });

  it('keeps the floating Lighthouse console available while the expanded notebook is open', () => {
    expect(metricLoopDashboardSource).toContain("notebookExpanded ? 'notebook-expanded' : ''");
    expect(metricLoopDashboardSource).toContain('onToolActivities=');
    expect(metricLoopDashboardSource).toContain('hasInvestigation={hasInvestigation}');
    expect(metricLoopDashboardSource).toContain('notebookExpanded={notebookExpanded}');
    expect(metricLoopActionConsoleSource).toContain('previousInvestigationState');
    expect(metricLoopActionConsoleSource).toContain('investigationOpened');
    expect(metricLoopActionConsoleSource).toContain('panelExpanded');
    expect(stylesSource).not.toContain('.metricloop-app.notebook-expanded .metricloop-action-console {\n  display: none;\n}');
    expect(stylesSource).not.toContain('.metricloop-app.notebook-expanded .metricloop-action-console');
    expect(stylesSource).toContain('right: 18px;');
    expect(stylesSource).toContain('left: auto;');
    expect(stylesSource).toContain('z-index: 60;');
    expect(stylesSource).toContain('width: min(1196px, calc(100vw - 36px));');
  });

  it('keeps the expanded MetricLoop notebook highlight from clipping at the viewport edge', () => {
    expect(stylesSource).toContain('.metricloop-notebook.expanded.highlighted::before');
    expect(stylesSource).toContain('content: none;');
  });

  it('names the MetricLoop action console assistant Lighthouse', () => {
    expect(metricLoopActionConsoleSource).toContain('METRIC_LOOP_WAKE_WORD');
    expect(metricLoopActionConsoleSource).toContain('Lighthouse assistant');
    expect(metricLoopActionConsoleSource).toContain('Lighthouse voice replies');
    expect(metricLoopActionConsoleSource).toContain("? 'Start' : 'Stop'");
    expect(metricLoopActionConsoleSource).not.toContain("? 'Mic' : 'Stop'");
    expect(metricLoopActionConsoleSource).toContain('Say "');
    expect(metricLoopActionConsoleSource).toContain("'Enabled' : 'Disabled'");
    expect(metricLoopActionConsoleSource).toContain('to hear a spoken answer');
    expect(metricLoopActionConsoleSource).toContain('without audio');
    expect(metricLoopActionConsoleSource).not.toContain('Spoken replies on');
    expect(metricLoopActionConsoleSource).not.toContain('Spoken replies off');
    expect(metricLoopRealtimeSource).toContain('Ask Lighthouse');
    expect(metricLoopRealtimeSource).not.toContain('Ready for typed analysis');
  });

  it('gives long MetricLoop tool details enough vertical spacing to wrap cleanly', () => {
    expect(stylesSource).toContain('.metricloop-tool-details small {');
    expect(stylesSource).toContain('line-height: 1.22;');
    expect(stylesSource).toContain('padding: 7px 12px;');
  });

  it('renders MetricLoop forensics query, code, and chart traces in the notebook workbench, not the Lighthouse transcript', () => {
    expect(metricLoopActionConsoleSource).not.toContain('ForensicsTraceCard');
    expect(metricLoopActionConsoleSource).not.toContain('ToolTraceItem');
    expect(metricLoopActionConsoleSource).not.toContain('metricloop-forensics-query');
    expect(metricLoopActionConsoleSource).not.toContain('metricloop-forensics-code');
    expect(metricLoopActionConsoleSource).not.toContain('metricloop-preamble');
    expect(metricLoopNotebookSource).toContain('MetricLoopForensicsWorkbench');
    expect(metricLoopNotebookSource).toContain('Reasoning trace');
    expect(metricLoopNotebookSource).toContain('Targeted follow-up');
    expect(metricLoopNotebookSource).toContain('Rank impacted cohorts');
    expect(metricLoopNotebookSource).toContain('Show me the top contributing cohorts as a chart.');
    expect(metricLoopForensicsWorkbenchSource).toContain('ForensicsTraceCard');
    expect(metricLoopForensicsWorkbenchSource).toContain('ForensicsArtifactHighlights');
    expect(metricLoopForensicsWorkbenchSource).toContain('Latest query');
    expect(metricLoopForensicsWorkbenchSource).toContain('Generated code');
    expect(metricLoopForensicsWorkbenchSource).toContain('Rendered chart');
    expect(metricLoopForensicsWorkbenchSource).toContain('activity.forensics');
    expect(metricLoopForensicsWorkbenchSource).toContain('metricloop-forensics-query');
    expect(metricLoopForensicsWorkbenchSource).toContain('metricloop-forensics-code');
    expect(metricLoopForensicsWorkbenchSource).toContain('metricloop-forensics-table');
    expect(stylesSource).toContain('.metricloop-forensics-trace');
    expect(stylesSource).toContain('.metricloop-forensics-highlights');
    expect(stylesSource).toContain('.metricloop-work-suggestions');
  });

  it('routes deeper-question suggestion chips into the Lighthouse send path', () => {
    expect(metricLoopNotebookSource).toContain('onSuggestedPrompt?: (prompt: string) => void');
    expect(metricLoopNotebookSource).toContain('onClick={() => onSuggestedPrompt?.(item.prompt)}');
    expect(metricLoopNotebookSource).toContain('Run deeper analysis');
    expect(metricLoopNotebookSource).toContain('Prove whether this activation drop is a Mobile Safari product bug');
    expect(metricLoopNotebookSource).toContain('Rank impacted cohorts');
    expect(metricLoopNotebookSource).toContain('Test acquisition mix');
    expect(metricLoopNotebookSource).toContain('Check instrumentation');
    expect(metricLoopDashboardSource).toContain('const [suggestedPromptRequest, setSuggestedPromptRequest]');
    expect(metricLoopDashboardSource).toContain('onSuggestedPrompt={handleSuggestedPrompt}');
    expect(metricLoopDashboardSource).toContain('submit: true');
    expect(metricLoopActionConsoleSource).toContain('promptRequest?: MetricLoopConsolePromptRequest | null');
    expect(metricLoopActionConsoleSource).toContain('if (promptRequest.submit)');
    expect(metricLoopActionConsoleSource).toContain('void send(promptRequest.text);');
  });

  it('positions the notebook summary as a hypothesis memo before the reasoning trace', () => {
    expect(metricLoopNotebookSource).toContain('Working hypothesis');
    expect(metricLoopNotebookSource).toContain('What could still be wrong');
    expect(metricLoopNotebookSource).toContain('Create Linear issue');
    expect(metricLoopNotebookSource).toContain('Reasoning trace');
    expect(metricLoopNotebookSource).not.toContain('Show work');
    expect(stylesSource).toContain('.metricloop-hypothesis-memo');
    expect(stylesSource).toContain('.metricloop-proof-card');
    expect(stylesSource).toContain('.metricloop-notebook:not(.expanded) .metricloop-hypothesis-memo');
    expect(stylesSource).toContain('.metricloop-notebook-section h3');
    expect(stylesSource).toContain('padding: 18px');
  });

  it('surfaces live analysis progress in Lighthouse and the reasoning trace', () => {
    expect(metricLoopActionConsoleSource).toContain('onAnalysisRunChange');
    expect(metricLoopActionConsoleSource).toContain('Running deeper analysis');
    expect(metricLoopActionConsoleSource).toContain('metricloop-analysis-status');
    expect(metricLoopNotebookSource).toContain('MetricLoopAnalysisProgress');
    expect(metricLoopNotebookSource).toContain('Analysis run');
    expect(metricLoopNotebookSource).toContain("setActiveTab('work')");
    expect(stylesSource).toContain('.metricloop-analysis-progress');
    expect(stylesSource).toContain('.metricloop-analysis-status');
  });

  it('makes MetricLoop forensics work visible as plan, progress, validation, execution, and evidence', () => {
    expect(metricLoopForensicsWorkbenchSource).toContain('ForensicsWorkSummaryPanel');
    expect(metricLoopForensicsWorkbenchSource).toContain('metricloop-forensics-plan');
    expect(metricLoopForensicsWorkbenchSource).toContain('metricloop-evidence-ledger');
    expect(metricLoopForensicsWorkbenchSource).toContain('metricloop-tool-progress');
    expect(metricLoopForensicsWorkbenchSource).toContain('Server validation');
    expect(metricLoopForensicsWorkbenchSource).toContain('Execution scope');
    expect(metricLoopForensicsWorkbenchSource).toContain('Evidence ledger');
    expect(stylesSource).toContain('.metricloop-forensics-work-summary');
    expect(stylesSource).toContain('.metricloop-tool-progress');
    expect(stylesSource).toContain('.metricloop-evidence-ledger');
  });
});
