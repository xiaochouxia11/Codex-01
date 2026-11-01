import type { MetricLoopActionResponse } from '../metricloop/metricLoopContracts';
import type { MetricLoopInvestigationBoard } from '../metricloop/metricLoopEngine';

export function createMetricLoopReportArtifact(
  sessionId: string,
  board: MetricLoopInvestigationBoard,
): NonNullable<MetricLoopActionResponse['artifact']> {
  const stableInput = sessionId + ':' + board.scopedReport.title + ':' + board.dropOffStep.step;
  let hash = 0;
  for (let index = 0; index < stableInput.length; index += 1) {
    hash = (hash * 31 + stableInput.charCodeAt(index)) >>> 0;
  }

  return {
    id: 'ml-report-' + hash.toString(16).padStart(8, '0'),
    status: 'ready',
    title: board.scopedReport.title,
    summary: board.scopedReport.summary,
    confidence: board.confidence,
  };
}
