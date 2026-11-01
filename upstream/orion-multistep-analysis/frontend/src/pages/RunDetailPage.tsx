import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";

import type {
  EventEnvelope,
  ArtifactListing,
  PromptTemplate,
  PromptRole,
  AnalysisSummary,
  LiteraturePlan,
  SupervisorVerdictFile
} from "@/api/types";
import { useRun, useCancelRun, useRenameRun } from "@/hooks/useRuns";
import { useEventStream } from "@/hooks/useEventStream";
import { apiFetch } from "@/api/client";
import { useQuery } from "@tanstack/react-query";
import { usePrompts } from "@/hooks/usePrompts";

const RunDetailPage = () => {
  const { runId } = useParams<{ runId: string }>();
  const runQuery = useRun(runId);
  const cancelRun = useCancelRun();
  const renameRun = useRenameRun();
  const promptsQuery = usePrompts();
  const promptTemplates = promptsQuery.data ?? [];
  const promptMap = useMemo(() => {
    const map = new Map<string, PromptTemplate>();
    for (const template of promptTemplates) {
      map.set(template.id, template);
    }
    return map;
  }, [promptTemplates]);

  const artifactsQuery = useQuery<ArtifactListing[]>({
    queryKey: ["runs", runId, "artifacts"],
    queryFn: () => apiFetch<ArtifactListing[]>(`/api/runs/${runId}/artifacts`),
    enabled: Boolean(runId)
  });

  const eventEndpoint = runId ? `/api/runs/${runId}/events` : undefined;
  const { events, error: streamError } = useEventStream<RunEventPayload>(eventEndpoint);

  const parsedEvents = useMemo(() => events.slice(-200), [events]);
  const flowState = useMemo(() => deriveFlowState(parsedEvents), [parsedEvents]);

  const analysisSummaryQuery = useQuery<AnalysisSummary | undefined>({
    queryKey: ["runs", runId, "analysis-summary"],
    queryFn: async () => safelyFetchJson<AnalysisSummary>(runId, "analysis/analysis_summary.json"),
    enabled: Boolean(runId)
  });

  const literaturePlanQuery = useQuery<LiteraturePlan | undefined>({
    queryKey: ["runs", runId, "literature-plan"],
    queryFn: async () => safelyFetchJson<LiteraturePlan>(runId, "analysis/literature_plan.json"),
    enabled: Boolean(runId)
  });

  const supervisorVerdictQuery = useQuery<SupervisorVerdictFile | undefined>({
    queryKey: ["runs", runId, "supervisor-verdict"],
    queryFn: async () => safelyFetchJson<SupervisorVerdictFile>(runId, "analysis/supervisor_verdict.json"),
    enabled: Boolean(runId)
  });

  if (runQuery.isLoading) {
    return <section className="card">Loading run…</section>;
  }

  if (runQuery.isError || !runQuery.data) {
    return (
      <section className="card">
        <p>Run not found.</p>
        <Link to="/runs">Back to runs</Link>
      </section>
    );
  }

  const run = runQuery.data;
  const runInProgress = run.status === "pending" || run.status === "running";
  const promptRoles = ["agent", "literature", "supervisor"] as const;
  const promptAssignments = promptRoles.map((role) => {
    const id = run.prompts?.[role] ?? "";
    const template = id ? promptMap.get(id) : undefined;
    return { role, id, template };
  });

  const toRelativeArtifact = (fullPath?: string) => {
    if (!fullPath) return "";
    const marker = `${run.id}/`;
    const markerIdx = fullPath.lastIndexOf(marker);
    if (markerIdx !== -1) {
      return fullPath.slice(markerIdx + marker.length);
    }
    const analysisIdx = fullPath.indexOf("analysis/");
    if (analysisIdx !== -1) {
      return fullPath.slice(analysisIdx);
    }
    return fullPath;
  };

  const handleRename = () => {
    if (!runId) return;
    const currentName = run.name?.trim() ?? "";
    const entered = window.prompt("Rename run", currentName);
    if (entered === null) {
      return;
    }
    const trimmed = entered.trim();
    renameRun.mutate({ runId, payload: { name: trimmed || null } });
  };

  const artifactsPanel = (
    <section className="panel">
      <h3>Artifacts</h3>
      {artifactsQuery.isLoading ? (
        <p>Loading artifacts…</p>
      ) : (artifactsQuery.data ?? []).length === 0 ? (
        <p>No artifacts generated yet.</p>
      ) : (
        <div className="artifact-list">
          {(artifactsQuery.data ?? []).map((artifact) => (
            <div key={artifact.path} className="artifact-item">
              <div>
                <div>{artifact.path}</div>
                <small>{new Date(artifact.updated_at).toLocaleString()}</small>
              </div>
              <a
                className="secondary"
                href={`/api/runs/${run.id}/artifacts/${artifact.path}`}
                target="_blank"
                rel="noreferrer"
              >
                Download
              </a>
            </div>
          ))}
        </div>
      )}
    </section>
  );

  return (
    <section className="grid">
      <section className="panel">
        <header className="run-detail-top">
          <div className="run-detail-header">
            <h2>{run.name?.trim() ? run.name : `Run ${run.id}`}</h2>
            {run.name?.trim() && <p className="run-detail-subtitle">Run ID {run.id}</p>}
          </div>
          <div className="run-detail-actions">
            <button className="secondary" type="button" onClick={handleRename} disabled={renameRun.isPending}>
              Rename
            </button>
          </div>
        </header>
        <p>
          Database <strong>{run.database}</strong>
        </p>
        <dl className="run-detail">
          {run.goal && (
            <div>
              <dt>Goal</dt>
              <dd>{run.goal}</dd>
            </div>
          )}
          <div>
            <dt>Status</dt>
            <dd>{run.status}</dd>
          </div>
          <div>
            <dt>Created</dt>
            <dd>{new Date(run.created_at).toLocaleString()}</dd>
          </div>
          <div>
            <dt>Updated</dt>
            <dd>{new Date(run.updated_at).toLocaleString()}</dd>
          </div>
          {run.notes && (
            <div>
              <dt>Notes</dt>
              <dd>{run.notes}</dd>
            </div>
          )}
          {run.error && (
            <div>
              <dt>Error</dt>
              <dd className="error">{run.error}</dd>
            </div>
          )}
        </dl>
        <button
          className="secondary"
          type="button"
          onClick={() => runId && cancelRun.mutate(runId)}
          disabled={!runId || cancelRun.isPending || (run.status !== "running" && run.status !== "pending")}
        >
          Cancel Run
        </button>
      </section>

      <section className="panel">
        <h3>Prompts</h3>
        {promptsQuery.isError && (
          <p className="error">Unable to refresh prompt templates. Showing stored identifiers.</p>
        )}
        {promptsQuery.isLoading && <p>Loading prompt templates…</p>}
        <ul className="prompt-overview-list">
          {promptAssignments.map(({ role, id, template }) => (
            <li key={role}>
              <div className="prompt-overview-header">
                <span className="prompt-overview-role">{formatPromptRole(role)}</span>
                <span className="prompt-overview-name">
                  {template ? template.name : id || "Not set"}
                </span>
              </div>
              <details className="prompt-overview-content">
                <summary>View prompt</summary>
                <pre>
                  {template
                    ? template.content
                    : id
                    ? "Prompt template not found. The run stored only the identifier."
                    : "No prompt recorded for this role."}
                </pre>
              </details>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <h3>Analysis Flow</h3>
        <AnalysisFlow lanes={flowState} />
      </section>

      <section className="panel">
        <h3>Analysis Summary</h3>
        {analysisSummaryQuery.isLoading ? (
          <p>Loading summary…</p>
        ) : analysisSummaryQuery.data ? (
          <AnalysisSummarySection summary={analysisSummaryQuery.data} />
        ) : runInProgress ? (
          <p>Run in progress. Summary will appear once the agent publishes results.</p>
        ) : analysisSummaryQuery.isError ? (
          <p className="error">Failed to load analysis summary.</p>
        ) : (
          <p>No summary was produced for this run.</p>
        )}
      </section>

      <section className="panel">
        <h3>Literature Plan</h3>
        {literaturePlanQuery.isLoading ? (
          <p>Loading literature plan…</p>
        ) : literaturePlanQuery.data ? (
          <LiteraturePlanSection plan={literaturePlanQuery.data} />
        ) : runInProgress ? (
          <p>Run in progress. Literature plan will appear if the supervisor requests it.</p>
        ) : literaturePlanQuery.isError ? (
          <p className="error">Failed to load literature plan.</p>
        ) : (
          <p>No literature plan recorded.</p>
        )}
      </section>

      <section className="panel">
        <h3>Supervisor Verdict</h3>
        {supervisorVerdictQuery.isLoading ? (
          <p>Loading supervisor verdict…</p>
        ) : supervisorVerdictQuery.data ? (
          <SupervisorVerdictSection verdict={supervisorVerdictQuery.data} />
        ) : runInProgress ? (
          <p>Supervisor review pending. Verdict will appear once the workflow completes.</p>
        ) : supervisorVerdictQuery.isError ? (
          <p className="error">Failed to load supervisor verdict.</p>
        ) : (
          <p>No supervisor verdict recorded.</p>
        )}
      </section>

      <section className="panel log-panel">
        <h3>Live Log</h3>
        {streamError && <p className="error">{streamError}</p>}
        <LogList events={parsedEvents} />
      </section>

      {artifactsPanel}
    </section>
  );
};

interface RunEventPayload {
  step?: number;
  text?: string;
  [key: string]: unknown;
}

type UnknownRecord = Record<string, unknown>;

const META_KEYS = new Set(["step", "call_id", "id", "function"]);

function formatEventLabel(type: string) {
  return type.replace(/_/g, " ").toUpperCase();
}

function normalizeEscapedWhitespace(value: string) {
  // Tool outputs and LLM responses sometimes include literal "\n" sequences; render them as real newlines.
  return value.replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\r/g, "\r");
}

function tryParseJson(value: string): unknown | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const startsLikeJson = trimmed.startsWith("{") || trimmed.startsWith("[");
  if (!startsLikeJson) return undefined;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return undefined;
  }
}

function pythonLiteralToJson(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) return undefined;

  let out = "";
  let inSingle = false;
  let inDouble = false;

  for (let idx = 0; idx < trimmed.length; idx += 1) {
    const char = trimmed[idx];

    if (inSingle) {
      if (char === "\\") {
        const next = trimmed[idx + 1];
        if (next == null) {
          out += "\\\\";
          continue;
        }
        // Preserve common escapes in a JSON-safe way.
        if (next === "n" || next === "t" || next === "r") {
          out += `\\${next}`;
          idx += 1;
          continue;
        }
        if (next === "\\") {
          out += "\\\\";
          idx += 1;
          continue;
        }
        if (next === "'") {
          out += "'";
          idx += 1;
          continue;
        }
        if (next === "\"") {
          out += "\\\"";
          idx += 1;
          continue;
        }
        out += `\\\\${next}`;
        idx += 1;
        continue;
      }

      if (char === "'") {
        inSingle = false;
        out += "\"";
        continue;
      }

      if (char === "\"") {
        out += "\\\"";
        continue;
      }

      if (char === "\n") {
        out += "\\n";
        continue;
      }
      if (char === "\r") {
        out += "\\r";
        continue;
      }
      if (char === "\t") {
        out += "\\t";
        continue;
      }

      out += char;
      continue;
    }

    if (inDouble) {
      // If the string already uses JSON-style quoting, just copy it through.
      if (char === "\\") {
        const next = trimmed[idx + 1];
        if (next == null) {
          out += "\\\\";
          continue;
        }
        out += `\\${next}`;
        idx += 1;
        continue;
      }

      if (char === "\"") {
        inDouble = false;
        out += "\"";
        continue;
      }

      out += char;
      continue;
    }

    if (char === "'") {
      inSingle = true;
      out += "\"";
      continue;
    }

    if (char === "\"") {
      inDouble = true;
      out += "\"";
      continue;
    }

    if (/[A-Za-z_]/.test(char)) {
      let end = idx + 1;
      while (end < trimmed.length && /[A-Za-z_]/.test(trimmed[end])) {
        end += 1;
      }
      const word = trimmed.slice(idx, end);
      if (word === "None") {
        out += "null";
      } else if (word === "True") {
        out += "true";
      } else if (word === "False") {
        out += "false";
      } else if (word === "nan" || word === "NaN") {
        out += "null";
      } else {
        out += word;
      }
      idx = end - 1;
      continue;
    }

    out += char;
  }

  if (inSingle || inDouble) {
    return undefined;
  }

  return out;
}

function tryParsePythonLiteral(value: string): unknown | undefined {
  const jsonText = pythonLiteralToJson(value);
  if (!jsonText) return undefined;
  try {
    return JSON.parse(jsonText) as unknown;
  } catch {
    return undefined;
  }
}

function tryParseStructured(value: string): unknown | undefined {
  return tryParseJson(value) ?? tryParsePythonLiteral(value);
}

type DelimitedTable = {
  title?: string;
  header: string[];
  rows: string[][];
};

function parseDelimitedLine(line: string, delimiter: string): string[] {
  const values: string[] = [];
  let buffer = "";
  let inQuotes = false;
  for (let idx = 0; idx < line.length; idx += 1) {
    const char = line[idx];
    if (inQuotes) {
      if (char === "\"") {
        const next = line[idx + 1];
        if (next === "\"") {
          buffer += "\"";
          idx += 1;
        } else {
          inQuotes = false;
        }
      } else {
        buffer += char;
      }
      continue;
    }

    if (char === "\"") {
      inQuotes = true;
      continue;
    }

    if (char === delimiter) {
      values.push(buffer.trim());
      buffer = "";
      continue;
    }

    buffer += char;
  }
  values.push(buffer.trim());
  return values;
}

function detectDelimitedTable(raw: string): DelimitedTable | undefined {
  const normalized = normalizeEscapedWhitespace(raw).replace(/\r\n/g, "\n").trim();
  if (!normalized) return undefined;

  const lines = normalized
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);

  if (lines.length < 2) return undefined;

  const delimiters = [",", "\t", ";", "|"];

  const candidateMaxIdx = Math.min(lines.length - 2, 2);
  for (let headerIdx = 0; headerIdx <= candidateMaxIdx; headerIdx += 1) {
    const headerLine = lines[headerIdx];
    for (const delimiter of delimiters) {
      if (!headerLine.includes(delimiter)) continue;
      const header = parseDelimitedLine(headerLine, delimiter);
      if (header.length < 3) continue;

      const firstRow = parseDelimitedLine(lines[headerIdx + 1], delimiter);
      if (firstRow.length !== header.length) continue;

      const rows: string[][] = [];
      for (let rowIdx = headerIdx + 1; rowIdx < lines.length; rowIdx += 1) {
        const row = parseDelimitedLine(lines[rowIdx], delimiter);
        if (row.length !== header.length) break;
        rows.push(row);
      }

      if (rows.length === 0) continue;

      const title = headerIdx > 0 ? lines.slice(0, headerIdx).join("\n") : undefined;
      return { title, header, rows };
    }
  }

  return undefined;
}

function stripMetaKeys(value: UnknownRecord): UnknownRecord {
  const cleaned: UnknownRecord = {};
  for (const [key, entry] of Object.entries(value)) {
    if (META_KEYS.has(key)) continue;
    cleaned[key] = entry;
  }
  return cleaned;
}

function renderDelimitedTable(table: DelimitedTable) {
  const maxRows = 24;
  const renderTable = (rows: string[][]) => (
    <div className="log-table-wrapper">
      <table className="log-table">
        <thead>
          <tr>
            {table.header.map((cell, idx) => (
              <th key={`${cell}-${idx}`}>{cell}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIdx) => (
            <tr key={rowIdx}>
              {row.map((cell, cellIdx) => (
                <td key={`${rowIdx}-${cellIdx}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  if (table.rows.length <= maxRows) {
    return renderTable(table.rows);
  }

  const preview = table.rows.slice(0, maxRows);
  return (
    <div className="log-table-block">
      {renderTable(preview)}
      <details className="log-table-details">
        <summary>Show all {table.rows.length} rows</summary>
        {renderTable(table.rows)}
      </details>
    </div>
  );
}

function renderRichString(value: string): JSX.Element {
  const normalized = normalizeEscapedWhitespace(value);
  const table = detectDelimitedTable(normalized);
  if (table) {
    return (
      <div className="log-rich">
        {table.title && <div className="log-table-title">{table.title}</div>}
        {renderDelimitedTable(table)}
      </div>
    );
  }

  const parsedStructured = tryParseStructured(normalized);
  if (parsedStructured !== undefined) {
    return renderPayload(parsedStructured);
  }

  return <pre className="log-text">{normalized}</pre>;
}

function formatFieldLabel(key: string) {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function isPrimitive(value: unknown) {
  return value == null || typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

function isPlainObject(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRecordArray(value: unknown): value is UnknownRecord[] {
  if (!Array.isArray(value) || value.length === 0) return false;
  return value.every((entry) => isPlainObject(entry));
}

function collectRecordColumns(rows: UnknownRecord[]) {
  const columns: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (seen.has(key)) continue;
      seen.add(key);
      columns.push(key);
    }
  }
  return columns;
}

function renderCellValue(value: unknown) {
  if (value == null) return <span className="log-kv-empty">—</span>;
  if (typeof value === "string") return <span>{value}</span>;
  if (typeof value === "number" || typeof value === "boolean") return <span>{String(value)}</span>;
  if (Array.isArray(value)) {
    const allStrings = value.every((entry) => typeof entry === "string");
    if (allStrings) {
      return <span>{(value as string[]).join(", ")}</span>;
    }
    const allPrimitives = value.every((entry) => isPrimitive(entry));
    if (allPrimitives) {
      return <span>{value.map((entry) => String(entry)).join(", ")}</span>;
    }
    return <pre className="log-text">{JSON.stringify(value, null, 2)}</pre>;
  }
  if (typeof value === "object") {
    return <pre className="log-text">{JSON.stringify(value, null, 2)}</pre>;
  }
  return <span>{String(value)}</span>;
}

function renderRecordTable(rows: UnknownRecord[], opts: { title?: string } = {}): JSX.Element {
  const maxRows = 24;
  const columns = collectRecordColumns(rows);
  const safeColumns = columns.length > 0 ? columns : ["value"];

  const renderTable = (data: UnknownRecord[]) => (
    <div className="log-table-wrapper">
      <table className="log-table log-record-table">
        <thead>
          <tr>
            {safeColumns.map((col) => (
              <th key={col}>{formatFieldLabel(col)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIdx) => (
            <tr key={rowIdx}>
              {safeColumns.map((col) => (
                <td key={`${rowIdx}-${col}`}>{renderCellValue(row[col])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  if (rows.length <= maxRows) {
    return (
      <div className="log-table-block">
        {opts.title && <div className="log-table-title">{opts.title}</div>}
        {renderTable(rows)}
      </div>
    );
  }

  const preview = rows.slice(0, maxRows);
  return (
    <div className="log-table-block">
      {opts.title && <div className="log-table-title">{opts.title}</div>}
      {renderTable(preview)}
      <details className="log-table-details">
        <summary>Show all {rows.length} rows</summary>
        {renderTable(rows)}
      </details>
    </div>
  );
}

function renderCollapsedText(text: string, className: string, summaryLabel: string) {
  const normalized = normalizeEscapedWhitespace(text);
  const lines = normalized.split("\n");
  const maxPreviewLines = 14;
  const maxPreviewChars = 1000;

  if (lines.length <= maxPreviewLines && normalized.length <= maxPreviewChars) {
    return <pre className={className}>{normalized}</pre>;
  }

  const preview = lines.slice(0, maxPreviewLines).join("\n");
  return (
    <div className="log-collapsible">
      <pre className={className}>{preview}{lines.length > maxPreviewLines ? "\n…" : ""}</pre>
      <details className="log-collapsible-details">
        <summary>{summaryLabel} ({lines.length} lines)</summary>
        <pre className={className}>{normalized}</pre>
      </details>
    </div>
  );
}

function renderObjectTable(record: UnknownRecord): JSX.Element {
  const cleaned = stripMetaKeys(record);
  const recordArrayEntries = Object.entries(cleaned).filter(([, value]) => isRecordArray(value));
  if (recordArrayEntries.length > 0) {
    const nonTableEntries = Object.entries(cleaned).filter(([, value]) => !isRecordArray(value));
    return (
      <div className="log-structured">
        {nonTableEntries.length > 0 && renderObjectTable(Object.fromEntries(nonTableEntries) as UnknownRecord)}
        {recordArrayEntries.map(([key, value], idx) => {
          const rows = value as UnknownRecord[];
          return (
            <details key={key} className="log-section" open>
              <summary>{formatFieldLabel(key)} ({rows.length} rows)</summary>
              {renderRecordTable(rows)}
            </details>
          );
        })}
      </div>
    );
  }

  const entries = Object.entries(cleaned);
  if (entries.length === 0) {
    return <pre className="log-text">—</pre>;
  }

  if (entries.length === 1) {
    const [key, value] = entries[0];
    if (key === "reason" && typeof value === "string") {
      return renderRichString(value);
    }
    if (key === "code" && typeof value === "string") {
      return renderCollapsedText(value, "log-code", "Show full code");
    }
  }

  return (
    <table className="log-kv-table">
      <tbody>
        {entries.map(([key, value]) => {
          const label = formatFieldLabel(key);
          const isCode = key === "code" && typeof value === "string";
          const valueNode =
            value == null ? (
              <span className="log-kv-empty">—</span>
            ) : typeof value === "string" ? (
              isCode ? renderCollapsedText(value, "log-code", "Show full code") : renderCollapsedText(value, "log-text", "Show full text")
            ) : isRecordArray(value) ? (
              renderRecordTable(value)
            ) : isPrimitive(value) ? (
              <span>{String(value)}</span>
            ) : (
              <pre className="log-text">{JSON.stringify(value, null, 2)}</pre>
            );

          return (
            <tr key={key}>
              <th scope="row">{label}</th>
              <td>{valueNode}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

type LiteraturePlanStepLike = {
  objective?: unknown;
  query?: unknown;
  rationale?: unknown;
  expected_insight?: unknown;
  suggested_sources?: unknown;
  filters?: unknown;
};

function renderLiteraturePlan(steps: LiteraturePlanStepLike[]): JSX.Element {
  return (
    <details className="log-plan" open>
      <summary>Plan ({steps.length} steps)</summary>
      <ol className="log-plan-list">
        {steps.map((step, idx) => {
          const objective = typeof step.objective === "string" ? step.objective : undefined;
          const query = typeof step.query === "string" ? step.query : undefined;
          const rationale = typeof step.rationale === "string" ? step.rationale : undefined;
          const expected = typeof step.expected_insight === "string" ? step.expected_insight : undefined;
          const sources = Array.isArray(step.suggested_sources) ? step.suggested_sources.filter((s) => typeof s === "string") as string[] : [];
          const filters = Array.isArray(step.filters) ? step.filters.filter((f) => typeof f === "string") as string[] : [];

          return (
            <li key={idx} className="log-plan-step">
              {objective && <div className="log-plan-objective">{objective}</div>}
              {query && (
                <div className="log-plan-field">
                  <span className="log-plan-label">Query</span>
                  <div className="log-plan-value">{query}</div>
                </div>
              )}
              {rationale && (
                <div className="log-plan-field">
                  <span className="log-plan-label">Why</span>
                  <div className="log-plan-value">{rationale}</div>
                </div>
              )}
              {expected && (
                <div className="log-plan-field">
                  <span className="log-plan-label">Expected</span>
                  <div className="log-plan-value">{expected}</div>
                </div>
              )}
              {sources.length > 0 && (
                <div className="log-plan-field">
                  <span className="log-plan-label">Sources</span>
                  <div className="log-plan-value">{sources.join(", ")}</div>
                </div>
              )}
              {filters.length > 0 && (
                <div className="log-plan-field">
                  <span className="log-plan-label">Filters</span>
                  <div className="log-plan-value">{filters.join(", ")}</div>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </details>
  );
}

function renderPayload(value: unknown): JSX.Element {
  if (value == null) {
    return <pre className="log-text">—</pre>;
  }
  if (typeof value === "string") {
    return renderRichString(value);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return <pre className="log-text">{String(value)}</pre>;
  }
  if (Array.isArray(value)) {
    if (isRecordArray(value)) {
      return renderRecordTable(value);
    }
    return <pre className="log-text">{JSON.stringify(value, null, 2)}</pre>;
  }
  if (typeof value === "object") {
    const record = stripMetaKeys(value as UnknownRecord);
    const plan = record.plan;
    if (Array.isArray(plan)) {
      const steps = plan.filter((item) => item && typeof item === "object") as LiteraturePlanStepLike[];
      if (steps.length > 0) {
        return renderLiteraturePlan(steps);
      }
    }
    return renderObjectTable(record);
  }
  return <pre className="log-text">{String(value)}</pre>;
}

function renderEventBody(event: EventEnvelope<RunEventPayload>) {
  const { type, data } = event;
  const payload = (data ?? {}) as UnknownRecord;

  if (type === "tool_result") {
    return renderPayload(payload.result);
  }

  if (type === "tool_calls") {
    const calls = Array.isArray(payload.calls) ? (payload.calls as unknown[]) : [];
    if (calls.length === 0) {
      return <pre className="log-text">No tool calls.</pre>;
    }
    return (
      <div className="log-calls">
        {calls.map((entry, index) => {
          const call = (entry ?? {}) as UnknownRecord;
          const args = call.arguments;
          const parsedArgs = typeof args === "string" ? tryParseStructured(args) : undefined;
          const shownArgs = parsedArgs !== undefined ? parsedArgs : args;
          const meta: UnknownRecord = {};
          if (call.id != null) meta.id = call.id;
          return (
            <div key={index} className="log-call">
              {typeof call.function === "string" && call.function.trim().length > 0 && (
                <div className="log-call-tool">{call.function}</div>
              )}
              {renderPayload(shownArgs)}
              {Object.keys(meta).length > 0 && (
                <details className="log-meta-details">
                  <summary>Metadata</summary>
                  <pre className="log-text">{JSON.stringify(meta, null, 2)}</pre>
                </details>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // Most event payloads have a "text" field; show it directly instead of JSON-stringifying the entire payload.
  const text = typeof payload.text === "string" ? payload.text : undefined;
  if (text) {
    return renderRichString(text);
  }

  // Some progress events use "message"/"stage" fields.
  const message = typeof payload.message === "string" ? payload.message : undefined;
  if (message) {
    return renderRichString(message);
  }

  return renderPayload(stripMetaKeys(payload));
}

const LogEntry = ({ event }: { event: EventEnvelope<RunEventPayload> }) => {
  const { type, timestamp } = event;
  return (
    <div className={`log-entry ${variantForType(type)}`}>
      <div className="meta">
        {new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
      </div>
      <div className="label">{formatEventLabel(type)}</div>
      <div className="log-body">{renderEventBody(event)}</div>
    </div>
  );
};

const variantForType = (type: string) => {
  switch (type) {
    case "main_agent":
      return "variant-main";
    case "main_agent_progress":
      return "variant-main";
    case "workflow_progress":
      return "variant-analysis";
    case "workflow_complete":
      return "variant-analysis";
    case "literature_agent":
      return "variant-analysis";
    case "supervisor":
      return "variant-supervisor";
    case "literature_plan":
      return "variant-analysis";
    case "tool_calls":
    case "tool_result":
      return "variant-tool";
    case "log":
      return "variant-log";
    case "analysis_result_appended":
      return "variant-analysis";
    default:
      return "variant-default";
  }
};

interface LogSectionsProps {
  events: EventEnvelope<RunEventPayload>[];
}

const LogList = ({ events }: LogSectionsProps) => {
  if (events.length === 0) {
    return <p>No events yet.</p>;
  }

  return (
    <div className="log-list">
      {events.map((event, index) => (
        <LogEntry key={`${event.timestamp}-${index}`} event={event} />)
      )}
    </div>
  );
};

export default RunDetailPage;

type FlowLaneKey = "main" | "literature" | "supervisor";
type FlowStatus = "pending" | "running" | "complete" | "error";

interface FlowLaneState {
  status: FlowStatus;
  detail?: string;
}

const laneLabels: Record<FlowLaneKey, string> = {
  main: "Main Agent",
  literature: "Literature Plan",
  supervisor: "Supervisor",
};

const statusLabels: Record<FlowStatus, string> = {
  pending: "Pending",
  running: "Running",
  complete: "Complete",
  error: "Error",
};

const statusBadgeClass: Record<FlowStatus, string> = {
  pending: "info",
  running: "warning",
  complete: "success",
  error: "error",
};

const AnalysisFlow = ({ lanes }: { lanes: Record<FlowLaneKey, FlowLaneState> }) => {
  const order: FlowLaneKey[] = ["main", "literature", "supervisor"];
  return (
    <div className="flow-diagram">
      <div className="flow-lanes">
        {order.map((key) => {
          const lane = lanes[key];
          return (
            <div key={key} className={`flow-lane status-${lane.status}`}>
              <div className="flow-lane-header">
                <span className="flow-lane-title">{laneLabels[key]}</span>
                <span className={`badge ${statusBadgeClass[lane.status]}`}>{statusLabels[lane.status]}</span>
              </div>
              <p className="flow-lane-detail">{lane.detail ?? "Awaiting updates"}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

function deriveFlowState(events: EventEnvelope<RunEventPayload>[]): Record<FlowLaneKey, FlowLaneState> {
  const base: Record<FlowLaneKey, FlowLaneState> = {
    main: { status: "pending", detail: "Waiting for first turn" },
    literature: { status: "pending", detail: "Planning" },
    supervisor: { status: "pending", detail: "Awaiting agent summary" },
  };

  const normalizeDetail = (value: unknown): string | undefined => {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
    return undefined;
  };

  events.forEach((event) => {
    const { type, data } = event;
    const payload = (data ?? {}) as Record<string, unknown>;

    switch (type) {
      case "main_agent":
        if (base.main.status === "pending") {
          base.main.status = "running";
        }
        base.main.detail = `Turn ${typeof payload.step === "number" ? payload.step : "active"}`;
        break;
      case "supervisor":
        if (base.supervisor.status === "pending") {
          base.supervisor.status = "running";
        }
        base.supervisor.detail = "Reviewing latest findings";
        break;
      case "terminated":
        if (base.main.status === "running") {
          base.main.status = "complete";
          base.main.detail = "Dialogue ended";
        }
        if (base.supervisor.status === "running") {
          base.supervisor.status = "complete";
          base.supervisor.detail = "Run terminated";
        }
        if (base.literature.status === "pending") {
          base.literature.status = "complete";
          base.literature.detail = "Finalized";
        }
        break;
      case "main_agent_progress": {
        if (base.main.status === "pending") {
          base.main.status = "running";
        }
        const detail = normalizeDetail(payload.message) ?? normalizeDetail(payload.stage) ?? "Planning";
        base.main.detail = detail;
        break;
      }
      case "workflow_progress": {
        if (base.main.status === "pending") {
          base.main.status = "running";
        }
        const detail =
          normalizeDetail(payload.message) ??
          normalizeDetail(payload.stage) ??
          (typeof payload.status === "string" ? payload.status : undefined) ??
          "Processing";
        base.main.detail = detail;
        break;
      }
      case "literature_agent": {
        const stage = typeof payload.stage === "string" ? payload.stage : "";
        if (stage === "planning") {
          base.literature.status = "running";
          base.literature.detail = normalizeDetail(payload.message) ?? "Planning literature search";
        } else if (stage === "completed") {
          base.literature.status = "complete";
          const sources = typeof payload.source_count === "number" ? payload.source_count : undefined;
          base.literature.detail =
            sources != null ? `${sources} sources gathered` : normalizeDetail(payload.message) ?? "Literature summary ready";
        } else {
          if (base.literature.status === "pending") {
            base.literature.status = "running";
          }
          base.literature.detail = normalizeDetail(payload.message) ?? "Reviewing literature";
        }
        break;
      }
      case "literature_plan": {
        base.literature.status = "complete";
        const count = typeof payload.sources === "number" ? payload.sources : undefined;
        base.literature.detail = count != null ? `${count} sources planned` : normalizeDetail(payload.message) ?? "Plan ready";
        break;
      }
      case "workflow_complete": {
        if (base.main.status === "running") {
          base.main.status = "complete";
          base.main.detail = normalizeDetail(payload.message) ?? "Workflow complete";
        }
        if (base.literature.status === "pending") {
          base.literature.status = "complete";
          base.literature.detail = "Finalized";
        }
        if (base.supervisor.status === "running") {
          base.supervisor.status = "complete";
          base.supervisor.detail = "Summary recorded";
        }
        break;
      }
      case "analysis_result_appended": {
        const source = typeof payload.source === "string" ? payload.source : "";
        const statusValue = typeof payload.status === "string" ? payload.status : undefined;
        if (source === "literature_plan" && statusValue === "ok") {
          base.literature.status = "complete";
          base.literature.detail = "Result shared";
        }
        break;
      }
      default:
        break;
    }
  });

  return base;
}

const PROMPT_ROLE_LABELS: Record<string, string> = {
  agent: "Analysis Agent",
  literature: "Literature Agent",
  supervisor: "Supervisor"
};

function formatPromptRole(role: PromptRole | string) {
  const label = PROMPT_ROLE_LABELS[role];
  if (label) return label;
  const text = typeof role === "string" && role.length > 0 ? role : "Prompt";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const integerFormatter = new Intl.NumberFormat();

function formatCount(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "–";
  }
  return integerFormatter.format(value);
}

function formatDecimal(value?: number, digits = 2) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "–";
  }
  return value.toFixed(digits);
}

async function safelyFetchJson<T>(runId: string | undefined, artifactPath: string): Promise<T | undefined> {
  if (!runId) return undefined;
  try {
    return await apiFetch<T>(`/api/runs/${runId}/artifacts/${artifactPath}`);
  } catch (error) {
    if (error instanceof Error && /404/.test(error.message)) {
      return undefined;
    }
    throw error;
  }
}

interface AnalysisSummarySectionProps {
  summary: AnalysisSummary;
}

const AnalysisSummarySection = ({ summary }: AnalysisSummarySectionProps) => {
  const tables = summary.tables ?? [];
  const schemaEntries = Object.entries(summary.schema ?? {});
  const smallTable = summary.small_table_summary;

  return (
    <div className="analysis-summary">
      <h4>Tables</h4>
      {tables.length === 0 ? (
        <p>No tables discovered.</p>
      ) : (
        <table className="data-table compact">
          <thead>
            <tr>
              <th>Name</th>
              <th>Rows</th>
              <th>Columns (schema)</th>
            </tr>
          </thead>
          <tbody>
            {tables.map((table) => {
              const columnCount = schemaEntries.find(([name]) => name === table.name)?.[1];
              const colSize = columnCount ? Object.keys(columnCount).length : undefined;
              return (
                <tr key={table.name}>
                  <td>{table.name}</td>
                  <td>{table.row_count != null ? formatCount(table.row_count) : "?"}</td>
                  <td>{colSize != null ? formatCount(colSize) : "–"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {smallTable ? (
        <details className="analysis-small-table">
          <summary>Small Table Summary ({smallTable.table ?? "unknown"})</summary>
          <pre>{JSON.stringify(smallTable, null, 2)}</pre>
        </details>
      ) : (
        <p>No small-table profile captured.</p>
      )}
    </div>
  );
};

const LiteraturePlanSection = ({ plan }: { plan: LiteraturePlan }) => {
  const steps = plan.plan ?? [];
  const sources = plan.sources ?? [];
  const insights = plan.insights ?? [];

  if (steps.length === 0 && sources.length === 0 && insights.length === 0 && !plan.notes) {
    return <p>No literature plan recorded.</p>;
  }

  return (
    <div className="literature-plan">
      {steps.length > 0 && (
        <div className="literature-plan-steps">
          <h4>Search Plan</h4>
          <ol>
            {steps.map((step, index) => (
              <li key={index}>
                <div className="literature-plan-step">
                  {step.objective && <strong>{step.objective}</strong>}
                  {step.query && <div className="literature-plan-query">Query: {step.query}</div>}
                  {step.rationale && <div className="literature-plan-rationale">Why: {step.rationale}</div>}
                  {step.expected_insight && (
                    <div className="literature-plan-expected">Expected insight: {step.expected_insight}</div>
                  )}
                  {Array.isArray(step.suggested_sources) && step.suggested_sources.length > 0 && (
                    <div className="literature-plan-sources">
                      Sources: {step.suggested_sources.join(", ")}
                    </div>
                  )}
                  {Array.isArray(step.filters) && step.filters.length > 0 && (
                    <div className="literature-plan-filters">Filters: {step.filters.join(", ")}</div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {insights.length > 0 && (
        <div className="literature-plan-insights">
          <h4>Key Insights</h4>
          <ul>
            {insights.map((insight, index) => (
              <li key={index}>{insight}</li>
            ))}
          </ul>
        </div>
      )}

      {sources.length > 0 && (
        <div className="literature-plan-evidence">
          <h4>Evidence</h4>
          <ul>
            {sources.map((source, index) => (
              <li key={`${source.title ?? "source"}-${index}`}>
                <div className="literature-plan-entry">
                  {source.title ? (
                    source.url ? (
                      <a href={source.url} target="_blank" rel="noreferrer">
                        {source.title}
                      </a>
                    ) : (
                      <strong>{source.title}</strong>
                    )
                  ) : null}
                  {source.summary && <div className="literature-plan-summary">{source.summary}</div>}
                  <div className="literature-plan-meta">
                    {source.source && <span>{source.source}</span>}
                    {source.published && <span> • {source.published}</span>}
                    {source.relevance && <span> • {source.relevance}</span>}
                  </div>
                  {source.url && source.title === undefined && (
                    <div>
                      <a href={source.url} target="_blank" rel="noreferrer">
                        {source.url}
                      </a>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {plan.notes && <p className="literature-plan-note">{plan.notes}</p>}
    </div>
  );
};

const SupervisorVerdictSection = ({ verdict }: { verdict: SupervisorVerdictFile }) => {
  const aligned = verdict.aligned ?? false;
  const issues = verdict.issues ?? [];
  const nextSteps = verdict.next_steps ?? [];
  const feedbackHistory = verdict.feedback_history ?? [];
  const iterations = verdict.review_iterations;

  return (
    <div className="supervisor-verdict">
      <p>
        Alignment: <strong>{aligned ? "Aligned" : "Not aligned"}</strong>
      </p>
      <div className="supervisor-section">
        <h4>Key Findings</h4>
        <p>{verdict.llm_summary || verdict.notes || "Supervisor summary not provided."}</p>
      </div>
      <div className="supervisor-section">
        <h4>Issues</h4>
        {issues.length === 0 ? <p>None recorded.</p> : (
          <ul>{issues.map((issue, index) => (<li key={index}>{issue}</li>))}</ul>
        )}
      </div>
      <div className="supervisor-section">
        <h4>Next Steps</h4>
        {nextSteps.length === 0 ? <p>None recorded.</p> : (
          <ul>{nextSteps.map((step, index) => (<li key={index}>{step}</li>))}</ul>
        )}
      </div>
      <div className="supervisor-meta">
        {iterations != null && <p>Review iterations: {iterations}</p>}
        {feedbackHistory.length > 0 && (
          <details>
            <summary>Supervisor feedback history</summary>
            <ul>
              {feedbackHistory.map((entry, index) => (
                <li key={index}>{entry || "(empty)"}</li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
};
