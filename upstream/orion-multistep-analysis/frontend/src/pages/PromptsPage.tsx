import { FormEvent, useEffect, useMemo, useState } from "react";

import type { PromptRole, PromptTemplate } from "@/api/types";
import {
  useArchivePrompt,
  useDeletePrompt,
  useDuplicatePrompt,
  usePrompts,
  useUnarchivePrompt,
  useUpdatePrompt
} from "@/hooks/usePrompts";

type PromptGroups = Record<PromptRole, PromptTemplate[]>;

const ROLE_PRIORITY: PromptRole[] = ["agent", "literature", "supervisor"];

const ROLE_LABELS: Record<string, string> = {
  agent: "Analysis Agent",
  literature: "Literature Agent",
  supervisor: "Supervisor"
};

const PromptsPage = () => {
  const promptsQuery = usePrompts();
  const duplicatePrompt = useDuplicatePrompt();
  const updatePrompt = useUpdatePrompt();
  const archivePrompt = useArchivePrompt();
  const unarchivePrompt = useUnarchivePrompt();
  const deletePrompt = useDeletePrompt();
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  const prompts = promptsQuery.data ?? [];

  const promptsByRole = useMemo(() => {
    const groups: PromptGroups = {} as PromptGroups;
    for (const template of prompts) {
      const role = template.role as PromptRole;
      if (!groups[role]) {
        groups[role] = [];
      }
      groups[role].push(template);
    }
    for (const role of Object.keys(groups) as PromptRole[]) {
      groups[role].sort((a, b) => {
        if (a.locked !== b.locked) {
          return a.locked ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
    }
    return groups;
  }, [prompts]);

  const orderedRoles = useMemo(() => {
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

  const editingPrompt = useMemo(() => {
    if (!editingPromptId) {
      return null;
    }
    return prompts.find((template) => template.id === editingPromptId) ?? null;
  }, [editingPromptId, prompts]);

  useEffect(() => {
    if (!editingPrompt) {
      setDraftName("");
      setDraftContent("");
      return;
    }
    setDraftName(editingPrompt.name);
    setDraftContent(editingPrompt.content);
  }, [editingPrompt]);

  const handleDuplicatePrompt = (template: PromptTemplate) => {
    const suggested = `${template.name} Copy`;
    const entered = window.prompt("Name for duplicated prompt", suggested);
    if (entered === null) {
      return;
    }
    const name = entered.trim();
    duplicatePrompt.mutate(
      {
        promptId: template.id,
        payload: name ? { name } : {}
      },
      {
        onSuccess: (created) => {
          setCopyMessage(null);
          setEditingPromptId(created.id);
          setDraftName(created.name);
          setDraftContent(created.content);
        }
      }
    );
  };

  const handleCopyPrompt = (template: PromptTemplate) => {
    const text = template.content ?? "";
    if (!navigator?.clipboard) {
      try {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "absolute";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        setCopyMessage(`Copied "${template.name}" to clipboard`);
        setTimeout(() => setCopyMessage(null), 2500);
      } catch (error) {
        console.error("Failed to copy prompt", error);
        setCopyMessage("Failed to copy prompt");
        setTimeout(() => setCopyMessage(null), 2500);
      }
      return;
    }
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopyMessage(`Copied "${template.name}" to clipboard`);
        setTimeout(() => setCopyMessage(null), 2500);
      })
      .catch((error) => {
        console.error("Failed to copy prompt", error);
        setCopyMessage("Failed to copy prompt");
        setTimeout(() => setCopyMessage(null), 2500);
      });
  };

  const handleArchivePrompt = (template: PromptTemplate) => {
    if (template.source !== "custom") {
      return;
    }
    if (editingPromptId === template.id) {
      setEditingPromptId(null);
    }
    archivePrompt.mutate(template.id, {
      onSuccess: (updated) => {
        if (editingPromptId === updated.id) {
          setEditingPromptId(null);
        }
      }
    });
  };

  const handleUnarchivePrompt = (template: PromptTemplate) => {
    if (template.source !== "custom") {
      return;
    }
    unarchivePrompt.mutate(template.id);
  };

  const archivedByRole = useMemo(() => {
    const entries: Array<{ role: PromptRole; templates: PromptTemplate[] }> = [];
    for (const role of orderedRoles) {
      const archived = (promptsByRole[role] ?? []).filter((template) => template.archived);
      if (archived.length > 0) {
        entries.push({ role, templates: archived });
      }
    }
    return entries;
  }, [orderedRoles, promptsByRole]);

  const totalArchived = archivedByRole.reduce((acc, entry) => acc + entry.templates.length, 0);

  const handleInlineSave = (event: FormEvent<HTMLFormElement>, template: PromptTemplate) => {
    event.preventDefault();
    const trimmedName = draftName.trim();
    if (!trimmedName) {
      window.alert("Prompt name is required.");
      return;
    }
    updatePrompt.mutate(
      {
        promptId: template.id,
        payload: { name: trimmedName, content: draftContent }
      },
      {
        onSuccess: () => {
          setEditingPromptId(null);
        }
      }
    );
  };

  const handleCancelEdit = () => {
    setEditingPromptId(null);
  };

  const handleDeletePrompt = (template: PromptTemplate) => {
    if (!window.confirm("Delete this prompt permanently?")) {
      return;
    }
    deletePrompt.mutate(template.id, {
      onSuccess: () => {
        if (editingPromptId === template.id) {
          setEditingPromptId(null);
        }
      }
    });
  };

  const ready = promptsQuery.isSuccess && prompts.length > 0;

  return (
    <section className="panel prompt-library-panel">
      <h2>Prompt Library</h2>
      <p className="prompt-library-description">
        Review the locked defaults and create customised copies for each agent role. Custom prompts stay available for future runs.
      </p>
      {copyMessage && <div className="prompt-copy-toast">{copyMessage}</div>}
      {promptsQuery.isLoading ? (
        <p>Loading prompt templates…</p>
      ) : promptsQuery.isError ? (
        <p className="error">Failed to load prompts.</p>
      ) : !ready ? (
        <p>No prompt templates found.</p>
      ) : (
        <>
          <div className="prompt-role-grid">
            {orderedRoles.map((role) => {
              const templates = promptsByRole[role] ?? [];
              const activeTemplates = templates.filter((template) => !template.archived);
              return (
                <div key={role} className="prompt-role-card">
                  <header className="prompt-role-header">
                    <h4>{formatPromptRole(role)}</h4>
                    <small>{templates.length} templates</small>
                  </header>
                  <ul className="prompt-list">
                    {activeTemplates.map((template) => {
                      const isEditing = editingPromptId === template.id;
                      return (
                        <li key={template.id} className={`prompt-list-item${isEditing ? " editing" : ""}`}>
                          <div className="prompt-list-meta">
                            <strong>{template.name}</strong>
                            <span className={`badge ${template.locked ? "neutral" : "info"}`}>
                              {template.locked ? "locked" : "custom"}
                            </span>
                          </div>
                          <div className="prompt-list-actions">
                            <button
                              type="button"
                              className="secondary"
                              onClick={() => handleDuplicatePrompt(template)}
                              disabled={duplicatePrompt.isPending}
                            >
                              Duplicate
                            </button>
                            <button
                              type="button"
                              className="secondary"
                              onClick={() => handleCopyPrompt(template)}
                            >
                              Copy
                            </button>
                            {template.source === "custom" && (
                              <button
                                type="button"
                                className="secondary"
                                onClick={() => {
                                  setEditingPromptId(template.id);
                                  setDraftName(template.name);
                                  setDraftContent(template.content);
                                  setCopyMessage(null);
                                }}
                                disabled={updatePrompt.isPending && isEditing}
                              >
                                {isEditing ? "Editing…" : "Edit"}
                              </button>
                            )}
                            {template.source === "custom" && (
                              <button
                                type="button"
                                className="secondary"
                                onClick={() => handleArchivePrompt(template)}
                                disabled={archivePrompt.isPending}
                              >
                                Archive
                              </button>
                            )}
                          </div>
                          {isEditing ? (
                            <form
                              className="prompt-inline-editor"
                              onSubmit={(event) => handleInlineSave(event, template)}
                            >
                              <label className="form-group">
                                <span>Name</span>
                                <input
                                  type="text"
                                  value={draftName}
                                  onChange={(event) => setDraftName(event.target.value)}
                                  disabled={updatePrompt.isPending}
                                />
                              </label>
                              <label className="form-group">
                                <span>Content</span>
                                <textarea
                                  value={draftContent}
                                  onChange={(event) => setDraftContent(event.target.value)}
                                  rows={12}
                                  disabled={updatePrompt.isPending}
                                />
                              </label>
                              <div className="prompt-inline-actions">
                                <button className="primary" type="submit" disabled={updatePrompt.isPending}>
                                  {updatePrompt.isPending ? "Saving…" : "Save"}
                                </button>
                                <button
                                  type="button"
                                  className="secondary"
                                  onClick={handleCancelEdit}
                                  disabled={updatePrompt.isPending}
                                >
                                  Cancel
                                </button>
                              </div>
                              {updatePrompt.isError && isEditing && (
                                <p className="error">Failed to save prompt. Please try again.</p>
                              )}
                            </form>
                          ) : (
                            <details className="prompt-content">
                              <summary>View prompt</summary>
                              <pre>{template.content}</pre>
                            </details>
                          )}
                        </li>
                      );
                    })}
                    {activeTemplates.length === 0 && (
                      <li className="prompt-list-placeholder">No active prompts.</li>
                    )}
                  </ul>
                </div>
              );
            })}
          </div>
        </>
      )}
      {duplicatePrompt.isError && (
        <p className="error">Failed to duplicate prompt. Please try again.</p>
      )}
      {(archivePrompt.isError || unarchivePrompt.isError) && (
        <p className="error">Failed to update archive state. Please try again.</p>
      )}
      {deletePrompt.isError && <p className="error">Failed to delete prompt. Please try again.</p>}
      {totalArchived > 0 && (
        <details className="prompt-archived-container">
          <summary>
            Archived Prompts ({totalArchived})
          </summary>
          <div className="prompt-archived-content">
            {archivedByRole.map(({ role, templates }) => (
              <section key={role} className="prompt-archived-group">
                <header className="prompt-archived-header">
                  <h4>{formatPromptRole(role)}</h4>
                  <small>{templates.length} archived</small>
                </header>
                <ul className="prompt-list">
                  {templates.map((template) => (
                    <li key={template.id} className="prompt-list-item archived">
                      <div className="prompt-list-meta">
                        <strong>{template.name}</strong>
                        <span className="badge warning">archived</span>
                      </div>
                      <div className="prompt-list-actions">
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => handleDuplicatePrompt(template)}
                          disabled={duplicatePrompt.isPending}
                        >
                          Duplicate
                        </button>
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => handleCopyPrompt(template)}
                        >
                          Copy
                        </button>
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => handleUnarchivePrompt(template)}
                          disabled={unarchivePrompt.isPending}
                        >
                          Unarchive
                        </button>
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => handleDeletePrompt(template)}
                          disabled={deletePrompt.isPending}
                        >
                          Delete
                        </button>
                      </div>
                      <details className="prompt-content">
                        <summary>View prompt</summary>
                        <pre>{template.content}</pre>
                      </details>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </details>
      )}
    </section>
  );
};

function formatPromptRole(role: PromptRole | string) {
  const label = ROLE_LABELS[role];
  if (label) return label;
  const text = typeof role === "string" && role.length > 0 ? role : "Prompt";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export default PromptsPage;
