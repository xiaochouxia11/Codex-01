import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
  useArchiveRun,
  useCancelRun,
  useCreateRun,
  useRenameRun,
  useRuns,
  useUnarchiveRun
} from "@/hooks/useRuns";
import { useDatabases } from "@/hooks/useDatabases";
import { usePrompts } from "@/hooks/usePrompts";
import type {
  PromptRole,
  PromptTemplate,
  PromptSelection,
  RunRecord
} from "@/api/types";

type PromptSelectionState = Partial<Record<PromptRole, string>>;

const ROLE_PRIORITY: PromptRole[] = ["agent", "literature", "supervisor"];
const ROLE_LABELS: Record<string, string> = {
  agent: "Analysis Agent",
  literature: "Literature Agent",
  supervisor: "Supervisor"
};

const formatPromptRole = (role: PromptRole) => {
  const label = ROLE_LABELS[role];
  if (label) return label;
  return role.charAt(0).toUpperCase() + role.slice(1);
};

const RunsPage = () => {
  const [showArchived, setShowArchived] = useState(false);
  const runsQuery = useRuns(showArchived);
  const databasesQuery = useDatabases();
  const promptsQuery = usePrompts();
  const createRun = useCreateRun();
  const cancelRun = useCancelRun();
  const archiveRun = useArchiveRun();
  const unarchiveRun = useUnarchiveRun();
  const renameRun = useRenameRun();
  const navigate = useNavigate();
  const [selectedDatabase, setSelectedDatabase] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [goal, setGoal] = useState<string>("");
  const [selectedPrompts, setSelectedPrompts] = useState<PromptSelectionState>({});

  const goalRef = useRef<HTMLTextAreaElement | null>(null);
  const notesRef = useRef<HTMLTextAreaElement | null>(null);

  const autoGrow = (element: HTMLTextAreaElement | null) => {
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  };

  useEffect(() => {
    autoGrow(goalRef.current);
  }, [goal]);

  useEffect(() => {
    autoGrow(notesRef.current);
  }, [notes]);

  const prompts = useMemo(
    () => (promptsQuery.data ?? []).filter((template) => !template.archived),
    [promptsQuery.data]
  );
  const promptsByRole = useMemo(() => {
    const groups: Record<PromptRole, PromptTemplate[]> = {} as Record<PromptRole, PromptTemplate[]>;
    for (const template of prompts) {
      const role = template.role as PromptRole;
      if (!groups[role]) {
        groups[role] = [];
      }
      groups[role].push(template);
    }
    Object.values(groups).forEach((list) => {
      list.sort((a, b) => {
        if (a.locked !== b.locked) {
          return a.locked ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
    });
    return groups;
  }, [prompts]);

  const availableRoles = useMemo<PromptRole[]>(() => {
    const existing = Object.keys(promptsByRole) as PromptRole[];
    const ordered: PromptRole[] = [];
    for (const role of ROLE_PRIORITY) {
      if (existing.includes(role)) {
        ordered.push(role);
      }
    }
    for (const role of existing) {
      if (!ordered.includes(role)) {
        ordered.push(role);
      }
    }
    return ordered;
  }, [promptsByRole]);

  const defaultPromptSelection = useMemo<PromptSelectionState>(() => {
    const defaults: PromptSelectionState = {};
    for (const role of availableRoles) {
      const options = promptsByRole[role] ?? [];
      const locked = options.find((entry) => entry.locked);
      if (locked) {
        defaults[role] = locked.id;
      } else if (options.length > 0) {
        defaults[role] = options[0].id;
      }
    }
    return defaults;
  }, [availableRoles, promptsByRole]);

  useEffect(() => {
    if (availableRoles.length === 0) {
      return;
    }
    setSelectedPrompts((previous) => {
      const next = { ...previous };
      let changed = false;
      for (const role of availableRoles) {
        if (!next[role] && defaultPromptSelection[role]) {
          next[role] = defaultPromptSelection[role];
          changed = true;
        }
      }
      return changed ? next : previous;
    });
  }, [availableRoles, defaultPromptSelection]);

  const handlePromptChange = (role: PromptRole, promptId: string) => {
    setSelectedPrompts((previous) => ({
      ...previous,
      [role]: promptId || undefined
    }));
  };

  const handleCreateRun = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedDatabase) {
      event.currentTarget.reportValidity();
      return;
    }

    const promptEntries = Object.entries(selectedPrompts).filter(
      (entry): entry is [string, string] => Boolean(entry[1])
    );
    const promptPayload = promptEntries.reduce<Record<string, string>>((acc, [role, value]) => {
      acc[role] = value;
      return acc;
    }, {});
    const trimmedNotes = notes.trim();
    const trimmedGoal = goal.trim();
    if (!trimmedGoal) {
      event.currentTarget.reportValidity();
      return;
    }

    createRun.mutate(
      {
        database: selectedDatabase,
        notes: trimmedNotes ? trimmedNotes : undefined,
        prompts: promptEntries.length ? (promptPayload as PromptSelection) : undefined,
        goal: trimmedGoal,
      },
      {
        onSuccess: (run) => {
          setSelectedDatabase("");
          setNotes("");
          setGoal("");
          navigate(`/runs/${run.id}`);
        }
      }
    );
  };

  const isRunFormLoading = databasesQuery.isLoading || promptsQuery.isLoading;
  const runs = runsQuery.data ?? [];
  const databases = databasesQuery.data ?? [];

  return (
    <section className="grid two-col">
      <section className="panel">
        <h3>Launch New Run</h3>
        <form onSubmit={handleCreateRun} className="run-form">
          <label className="form-group">
            <span>Dataset</span>
            <select
              value={selectedDatabase}
              onChange={(event) => setSelectedDatabase(event.target.value)}
              disabled={databasesQuery.isLoading || createRun.isPending}
            >
              <option value="" disabled>
                Select database…
              </option>
              {databases.map((database) => (
                <option key={database.name} value={database.name}>
                  {database.name}
                </option>
              ))}
            </select>
          </label>
          <label className="form-group">
            <span>Goal</span>
            <textarea
              ref={goalRef}
              value={goal}
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
                setGoal(event.target.value);
                autoGrow(event.target);
              }}
              onFocus={(event) => autoGrow(event.target)}
              placeholder="State the research goal for this run"
              required
              rows={3}
            />
          </label>
          <label className="form-group">
            <span>Notes (optional)</span>
            <textarea
              ref={notesRef}
              value={notes}
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
                setNotes(event.target.value);
                autoGrow(event.target);
              }}
              onFocus={(event) => autoGrow(event.target)}
              rows={3}
            />
          </label>
          <fieldset className="prompt-fieldset">
            <legend>Agent Prompts</legend>
            {promptsQuery.isLoading ? (
              <p>Loading prompt templates…</p>
            ) : promptsQuery.isError ? (
              <p className="error">Failed to load prompts.</p>
            ) : availableRoles.length === 0 ? (
              <p>No prompts available.</p>
            ) : (
              availableRoles.map((role) => (
                <label key={role} className="form-group prompt-select">
                  <span>{formatPromptRole(role)}</span>
                  <select
                    value={selectedPrompts[role] ?? ""}
                    onChange={(event) => handlePromptChange(role, event.target.value)}
                    disabled={createRun.isPending || promptsQuery.isLoading}
                  >
                    {(promptsByRole[role] ?? []).map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                        {template.locked ? " (default)" : " (custom)"}
                      </option>
                    ))}
                  </select>
                </label>
              ))
            )}
            <small className="prompt-fieldset-help">
              To leverage a customized prompt, create one in the Prompts tab.
            </small>
          </fieldset>
          <button
            className="primary"
            type="submit"
            disabled={!selectedDatabase || !goal.trim() || createRun.isPending || isRunFormLoading}
          >
            {createRun.isPending ? "Launching…" : "Launch Run"}
          </button>
          {createRun.isError && (
            <p className="error">
              Failed to launch run:{" "}
              {createRun.error instanceof Error ? createRun.error.message : "Unknown error"}
            </p>
          )}
        </form>
      </section>

      <section className="panel">
        <div className="runs-header">
          <h3>Runs</h3>
          <label className="runs-archive-toggle">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(event) => setShowArchived(event.target.checked)}
            />
            <span>Show archived runs</span>
          </label>
        </div>
        {runsQuery.isLoading ? (
          <p>Loading runs…</p>
        ) : runs.length === 0 ? (
          <p>No runs yet. Launch one using the form.</p>
        ) : (
          <div className="runs-list">
            {runs.map((run) => (
              <article key={run.id} className={`run-item${run.archived ? " archived" : ""}`}>
                <header>
                  <div className="run-title">
                    <Link to={`/runs/${run.id}`}>{run.name?.trim() ? run.name : run.id}</Link>
                    {run.name?.trim() && <div className="run-subtitle">{run.id}</div>}
                  </div>
                  <div className="status-badges">
                    <StatusBadge status={run.status} />
                    {run.archived && <span className="badge neutral">archived</span>}
                  </div>
                </header>
                <dl>
                  <div>
                    <dt>Database</dt>
                    <dd>{run.database}</dd>
                  </div>
                  <div>
                    <dt>Started</dt>
                    <dd>{new Date(run.created_at).toLocaleString()}</dd>
                  </div>
                  <div>
                    <dt>Updated</dt>
                    <dd>{new Date(run.updated_at).toLocaleString()}</dd>
                  </div>
                </dl>
                <footer className="run-actions">
                  <button
                    className="secondary"
                    type="button"
                    onClick={() => cancelRun.mutate(run.id)}
                    disabled={cancelRun.isPending || !isCancelable(run) || run.archived}
                  >
                    Cancel
                  </button>
                  <button
                    className="secondary"
                    type="button"
                    onClick={() => {
                      const currentName = run.name?.trim() ?? "";
                      const entered = window.prompt("Rename run", currentName) ?? undefined;
                      if (entered === undefined) return;
                      const trimmed = entered.trim();
                      renameRun.mutate({ runId: run.id, payload: { name: trimmed || null } });
                    }}
                    disabled={renameRun.isPending}
                  >
                    Rename
                  </button>
                  {run.archived ? (
                    <button
                      className="secondary"
                      type="button"
                      onClick={() => unarchiveRun.mutate(run.id)}
                      disabled={unarchiveRun.isPending}
                    >
                      Unarchive
                    </button>
                  ) : (
                    <button
                      className="secondary"
                      type="button"
                      onClick={() => archiveRun.mutate(run.id)}
                      disabled={archiveRun.isPending || !isArchivable(run)}
                    >
                      Archive
                    </button>
                  )}
                </footer>
              </article>
            ))}
          </div>
        )}
      </section>

    </section>
  );
};

function isCancelable(run: RunRecord) {
  return run.status === "pending" || run.status === "running";
}

function isArchivable(run: RunRecord) {
  return !run.archived && !(run.status === "pending" || run.status === "running");
}

const StatusBadge = ({ status }: { status: RunRecord["status"] }) => {
  const style =
    status === "completed"
      ? "success"
      : status === "failed"
      ? "error"
      : status === "running"
      ? "info"
      : status === "cancelled"
      ? "warning"
      : "warning";
  return <span className={`badge ${style}`}>{status}</span>;
};

export default RunsPage;
