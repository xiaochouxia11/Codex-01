export interface DatabaseInfo {
  name: string;
  size_bytes: number;
}

export interface AnalysisSummaryTable {
  name: string;
  row_count?: number | null;
}

export interface AnalysisSummary {
  tables?: AnalysisSummaryTable[];
  schema?: Record<string, Record<string, string>>;
  small_table_summary?: {
    table?: string;
    row_count?: number;
    summary?: Record<string, unknown>;
  } | null;
  goal?: string;
}

export interface LiteraturePlanStep {
  objective?: string;
  query?: string;
  rationale?: string;
  expected_insight?: string;
  suggested_sources?: string[];
  filters?: string[];
}

export interface LiteratureEvidence {
  title?: string;
  summary?: string;
  url?: string;
  source?: string;
  published?: string;
  relevance?: string;
}

export interface LiteraturePlan {
  plan?: LiteraturePlanStep[];
  sources?: LiteratureEvidence[];
  insights?: string[];
  notes?: string;
}

export interface SupervisorVerdictFile {
  aligned?: boolean;
  issues?: string[];
  next_steps?: string[];
  notes?: string;
  llm_summary?: string;
  review_iterations?: number;
  feedback_history?: string[];
}

export interface DatabaseTableInfo {
  name: string;
  row_count: number | null;
}

export interface TablePreview {
  table: string;
  columns: string[];
  rows: Record<string, unknown>[];
  total: number;
  limit: number;
  offset: number;
}

export interface RunRecord {
  id: string;
  database: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  created_at: string;
  updated_at: string;
  name?: string | null;
  notes?: string | null;
  goal?: string | null;
  error?: string | null;
  session_id?: string | null;
  archived: boolean;
  prompts: {
    agent: string;
    literature: string;
    supervisor: string;
  };
}

export interface RunCreateRequest {
  database: string;
  notes?: string;
  name?: string;
  prompts?: PromptSelection;
  goal?: string;
}

export interface RunUpdateRequest {
  name?: string | null;
  notes?: string | null;
}

export interface EventEnvelope<T = unknown> {
  type: string;
  timestamp: string;
  data: T;
}

export interface RunEventLog {
  step?: number;
  text?: string;
  [key: string]: unknown;
}

export interface ArtifactListing {
  path: string;
  size: number;
  updated_at: string;
}

export type PromptRole = "agent" | "literature" | "supervisor" | (string & {});

export interface PromptTemplate {
  id: string;
  name: string;
  role: PromptRole;
  content: string;
  source: "default" | "custom";
  locked: boolean;
  archived: boolean;
}

export interface PromptSelection {
  agent?: string;
  literature?: string;
  supervisor?: string;
}

export interface PromptDuplicateRequest {
  name?: string;
  content?: string;
}

export interface PromptUpdateRequest {
  name: string;
  content: string;
}
