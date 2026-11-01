import { ChangeEvent, FormEvent, Fragment, useEffect, useMemo, useRef, useState } from "react";

import { useCreateDataset, useDatabaseTables, useDatabases, useDeleteDataset, useTablePreview } from "@/hooks/useDatabases";
import type { DatabaseInfo } from "@/api/types";

const DEFAULT_PAGE_SIZE = 50;

type DisplayDataset = DatabaseInfo & { pending?: boolean };

const DatasetsPage = () => {
  const { data, isLoading, isError, error } = useDatabases();
  const createDataset = useCreateDataset();
  const deleteDataset = useDeleteDataset();
  const datasets = data ?? [];
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newDatasetName, setNewDatasetName] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pendingDatasetName, setPendingDatasetName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (datasets.length === 0) {
      setSelectedName(null);
      return;
    }
    if (!selectedName || !datasets.some((db) => db.name === selectedName)) {
      setSelectedName(datasets[0].name);
    }
  }, [datasets, selectedName]);

  const selectedDataset: DatabaseInfo | undefined = useMemo(
    () => datasets.find((db) => db.name === selectedName),
    [datasets, selectedName]
  );

  const tablesQuery = useDatabaseTables(selectedName);
  const tables = tablesQuery.data ?? [];

  useEffect(() => {
    if (!tables || tables.length === 0) {
      setSelectedTable(null);
      return;
    }
    if (!selectedTable || !tables.some((table) => table.name === selectedTable)) {
      setSelectedTable(tables[0].name);
      setPage(0);
    }
  }, [tables, selectedTable]);

  useEffect(() => {
    setPage(0);
  }, [selectedName, selectedTable]);

  useEffect(() => {
    if (!showCreateForm) {
      setNewDatasetName("");
      setUploadFile(null);
      setCreateError(null);
      setDeleteError(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }, [showCreateForm]);

  useEffect(() => {
    if (pendingDatasetName && datasets.some((db) => db.name === pendingDatasetName)) {
      setPendingDatasetName(null);
    }
  }, [datasets, pendingDatasetName]);

  const previewQuery = useTablePreview({
    databaseName: selectedName,
    tableName: selectedTable,
    page,
    pageSize: DEFAULT_PAGE_SIZE
  });

  const isUploading = createDataset.isPending;

  const handleCreateDataset = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = newDatasetName.trim();
    if (!trimmedName) {
      setCreateError("Enter a dataset name.");
      return;
    }
    if (!uploadFile) {
      setCreateError("Upload a SQLite .db file.");
      return;
    }
    setCreateError(null);
    setPendingDatasetName(trimmedName);
    setShowCreateForm(false);
    setSelectedName(null);
    setSelectedTable(null);
    setPage(0);
    createDataset.mutate(
      { name: trimmedName, file: uploadFile },
      {
        onSuccess: (created) => {
          const resolvedName = created?.name ?? trimmedName;
          setPendingDatasetName(null);
          setSelectedName(resolvedName);
          setSelectedTable(null);
          setPage(0);
        },
        onError: (err) => {
          setPendingDatasetName(null);
          setCreateError(extractErrorMessage(err));
          setShowCreateForm(true);
        }
      }
    );
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files && event.target.files.length > 0 ? event.target.files[0] : null;
    setUploadFile(file);
    setCreateError(null);
  };

  const toggleCreateForm = () => {
    const next = !showCreateForm;
    setShowCreateForm(next);
    if (next) {
      setSelectedName(null);
      setSelectedTable(null);
      setPage(0);
    }
    setCreateError(null);
    setDeleteError(null);
    if (!next) {
      setPendingDatasetName(null);
    }
  };

  const handleDeleteDataset = () => {
    if (!selectedDataset) return;
    const confirmed = window.confirm(
      `Delete dataset "${selectedDataset.name}"? This action cannot be undone.`
    );
    if (!confirmed) {
      return;
    }
    setDeleteError(null);
    deleteDataset.mutate(selectedDataset.name, {
      onSuccess: () => {
        setSelectedName(null);
        setSelectedTable(null);
        setPage(0);
      },
      onError: (err) => {
        setDeleteError(extractErrorMessage(err));
      }
    });
  };

  const displayDatasets: DisplayDataset[] = useMemo(() => {
    if (pendingDatasetName && !datasets.some((db) => db.name === pendingDatasetName)) {
      return [
        ...datasets,
        {
          name: pendingDatasetName,
          size_bytes: 0,
          pending: true
        }
      ];
    }
    return datasets;
  }, [datasets, pendingDatasetName]);

  if (isLoading) {
    return <section className="card">Loading datasets…</section>;
  }

  if (isError) {
    return <section className="card">Failed to load datasets: {error instanceof Error ? error.message : "Unknown error"}</section>;
  }

  return (
    <section className="datasets-grid">
      <section className="panel datasets-panel">
        <header className="datasets-header">
          <div>
            <h2>{showCreateForm ? "Create dataset" : "Datasets"}</h2>
            {!showCreateForm && (
              <p>
                Select a database to inspect its tables. To add a dataset, click
                <em> Create dataset</em> and upload a <code>.db</code>, a single <code>.csv</code>,
                or a <code>.zip</code> (CSV bundle) to build a SQLite database.
              </p>
            )}
          </div>
          <button type="button" className="secondary" onClick={toggleCreateForm} disabled={isUploading}>
            {showCreateForm ? "Back" : "Create dataset"}
          </button>
        </header>
        {showCreateForm ? (
          <form className="dataset-create-form" onSubmit={handleCreateDataset}>
            <label className="form-group">
              <span>Dataset name</span>
              <input
                type="text"
                value={newDatasetName}
                onChange={(event) => {
                  setNewDatasetName(event.target.value);
                  setCreateError(null);
                }}
                placeholder="e.g., cohort-2024"
                disabled={isUploading}
              />
            </label>
            <div className="form-spacer" />
            <label className="form-group">
              <span>Upload .db, .csv, or .zip (CSV bundle)</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".db,.csv,.zip"
                onChange={handleFileChange}
                disabled={isUploading}
              />
            </label>
            <div className="form-spacer" />
            <span className="form-note">Upload a SQLite .db, a single .csv, or a .zip containing multiple CSVs to build tables.</span>
            {createError && <p className="error">{createError}</p>}
            <button className="primary" type="submit" disabled={isUploading}>
              {isUploading ? "Creating…" : "Create dataset"}
            </button>
          </form>
        ) : (
          <table className="data-table selectable">
            <thead>
              <tr>
                <th>Name</th>
                <th>Size</th>
              </tr>
            </thead>
            <tbody>
              {displayDatasets.map((db) => {
                const isActive = db.name === selectedName;
                const isPendingRow = Boolean(db.pending);
                return (
                  <tr
                    key={db.name}
                    className={`${isActive ? "active" : ""}${isPendingRow ? " pending" : ""}`.trim() || undefined}
                    onClick={() => {
                      if (isPendingRow) return;
                      setSelectedName(db.name);
                    }}
                    role="button"
                    aria-pressed={isActive}
                    aria-disabled={isPendingRow}
                    tabIndex={isPendingRow ? -1 : 0}
                    onKeyDown={(event) => {
                      if (isPendingRow) return;
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedName(db.name);
                      }
                    }}
                  >
                    <td>
                      <span className="dataset-name">
                        {db.name}
                        {isPendingRow && <span className="spinner" aria-label="Dataset creating" />}
                      </span>
                    </td>
                    <td>{isPendingRow ? "…" : formatBytes(db.size_bytes)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel dataset-detail">
        {!selectedDataset ? (
          <p>Select a dataset to explore its contents.</p>
        ) : (
          <Fragment>
            <header className="dataset-detail-header">
              <div>
                <h3>{selectedDataset.name}</h3>
                <p className="dataset-detail-meta">{formatBytes(selectedDataset.size_bytes)}</p>
              </div>
              <button
                type="button"
                className="danger"
                onClick={handleDeleteDataset}
                disabled={deleteDataset.isPending}
              >
                {deleteDataset.isPending ? "Deleting…" : "Delete dataset"}
              </button>
            </header>
            {deleteError && <p className="error">{deleteError}</p>}
            {tablesQuery.isLoading ? (
              <p>Loading tables…</p>
            ) : tables.length === 0 ? (
              <p>This SQLite database has no tables.</p>
            ) : (
              <div className="dataset-browser">
                <aside className="dataset-tables">
                  <h4>Tables</h4>
                  <ul>
                    {tables.map((table) => {
                      const isActive = table.name === selectedTable;
                      return (
                        <li key={table.name}>
                          <button
                            type="button"
                            className={isActive ? "active" : undefined}
                            onClick={() => {
                              setSelectedTable(table.name);
                              setPage(0);
                            }}
                          >
                            <span>{table.name}</span>
                            <span className="count">{table.row_count != null ? formatNumber(table.row_count) : "?"}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </aside>

                <section className="table-preview">
                  <header>
                    <div>
                      <h4>{selectedTable ?? "Preview"}</h4>
                      {previewQuery.data && (
                        <p>
                          Showing rows {previewQuery.data.offset + 1}–
                          {Math.min(previewQuery.data.offset + previewQuery.data.rows.length, previewQuery.data.total)} of{" "}
                          {previewQuery.data.total}
                        </p>
                      )}
                    </div>
                    <div className="preview-controls">
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => setPage((prev) => Math.max(prev - 1, 0))}
                        disabled={page === 0 || previewQuery.isLoading}
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => setPage((prev) => prev + 1)}
                        disabled={
                          previewQuery.isLoading ||
                          !previewQuery.data ||
                          previewQuery.data.offset + previewQuery.data.rows.length >= previewQuery.data.total
                        }
                      >
                        Next
                      </button>
                    </div>
                  </header>

                  {previewQuery.isLoading ? (
                    <p>Loading rows…</p>
                  ) : previewQuery.isError ? (
                    <p className="error">Failed to load table preview.</p>
                  ) : previewQuery.data && previewQuery.data.rows.length > 0 ? (
                    <div className="table-preview-scroll">
                      <table>
                        <thead>
                          <tr>
                            {previewQuery.data.columns.map((column) => (
                              <th key={column}>{column}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {previewQuery.data.rows.map((row, idx) => (
                            <tr key={idx}>
                              {previewQuery.data.columns.map((column) => (
                                <td key={column}>{formatCell(row[column])}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p>No rows to display.</p>
                  )}
                </section>
              </div>
            )}
          </Fragment>
        )}
      </section>
    </section>
  );
};

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, index);
  return `${value.toFixed(1)} ${units[index]}`;
}

function formatCell(value: unknown) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

const numberFormatter = new Intl.NumberFormat();

function formatNumber(value: number) {
  return numberFormatter.format(value);
}

export default DatasetsPage;

function extractErrorMessage(error: unknown) {
  if (error instanceof Error) {
    const trimmed = error.message.replace(/^API \d+:\s*/, "").trim();
    if (trimmed) return trimmed;
  }
  return "Failed to create dataset.";
}
