import type { MetricLoopForensicsPreviewRow, MetricLoopForensicsValue } from '../metricloop/metricLoopContracts';

const blockedPattern = /\b(import|require|process|globalThis|global|window|document|fetch|XMLHttpRequest|WebSocket|Worker|Function|eval|localStorage|sessionStorage|indexedDB|navigator|setTimeout|setInterval|constructor|prototype|__proto__|while)\b/;

export const METRIC_LOOP_SAFE_CODE_CONTRACT = [
  'Read rows from rows or input.rows.',
  'Use const or let and local helper functions that only operate on row data.',
  'Use array methods map, filter, reduce, sort, and slice.',
  'Use bounded for-of loops when iteration is needed.',
  'Use Math, Number, String, and Boolean only for primitive conversion and scoring.',
  'Return an array of plain row objects with primitive values.',
  'Do not use network, DOM, server globals, imports, eval, constructors, prototypes, timers, workers, or indexed for loops.',
];

export function runSafeMetricLoopAnalysisCode(
  code: string,
  rows: MetricLoopForensicsPreviewRow[],
): MetricLoopForensicsPreviewRow[] {
  const trimmedCode = String(code ?? '').trim();
  if (!/\breturn\b/.test(trimmedCode)) {
    throw new Error('Generated analysis code is blocked: reducers must return a value.');
  }
  if (trimmedCode.length > 3000) {
    throw new Error('Generated analysis code is blocked: code is too long.');
  }
  if (blockedPattern.test(trimmedCode)) {
    throw new Error('Generated analysis code is blocked because it references unsafe runtime capabilities.');
  }
  assertSafeForLoops(trimmedCode);

  const inputRows = cloneRows(rows);
  const prelude = /\b(?:const|let|var)\s+rows\b/.test(trimmedCode)
    ? ''
    : 'const rows = sourceRows;\n';
  const fn = new Function('sourceRows', 'input', '"use strict";\n' + prelude + trimmedCode) as (
    sourceRows: MetricLoopForensicsPreviewRow[],
    input: {
      rows: MetricLoopForensicsPreviewRow[];
      previewRows: MetricLoopForensicsPreviewRow[];
    },
  ) => unknown;
  const result = fn(inputRows, { rows: inputRows, previewRows: inputRows });

  if (!Array.isArray(result)) {
    throw new Error('Generated analysis code must return an array of rows.');
  }

  return result.slice(0, 20).map((row) => normalizeRow(row));
}

function assertSafeForLoops(code: string) {
  const matches = code.matchAll(/\bfor\s*\(([^)]*)\)/g);
  for (const match of matches) {
    const header = match[1] ?? '';
    if (!/\bof\b/.test(header) || /;/.test(header)) {
      throw new Error('Generated analysis code is blocked: only bounded for-of loops are allowed.');
    }
  }
}

function cloneRows(rows: MetricLoopForensicsPreviewRow[]) {
  return rows.map((row) => ({ ...row }));
}

function normalizeRow(value: unknown): MetricLoopForensicsPreviewRow {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { value: normalizeValue(value) };
  }

  const row: MetricLoopForensicsPreviewRow = {};
  for (const [key, nestedValue] of Object.entries(value).slice(0, 20)) {
    row[key] = normalizeValue(nestedValue);
  }
  return row;
}

function normalizeValue(value: unknown): MetricLoopForensicsValue {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null) {
    return value;
  }
  if (value === undefined) return null;
  return JSON.stringify(value).slice(0, 160);
}
