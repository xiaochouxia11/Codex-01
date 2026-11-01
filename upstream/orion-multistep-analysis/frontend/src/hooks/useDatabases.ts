import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/api/client";
import type { DatabaseInfo, DatabaseTableInfo, TablePreview } from "@/api/types";

export function useDatabases() {
  return useQuery<DatabaseInfo[]>({
    queryKey: ["databases"],
    queryFn: () => apiFetch<DatabaseInfo[]>("/api/databases/")
  });
}

export function useDatabaseTables(databaseName: string | null) {
  return useQuery<DatabaseTableInfo[]>({
    queryKey: ["databases", databaseName, "tables"],
    queryFn: () => apiFetch<DatabaseTableInfo[]>(`/api/databases/${databaseName}/tables`),
    enabled: Boolean(databaseName)
  });
}

interface TablePreviewOptions {
  databaseName: string | null;
  tableName: string | null;
  page: number;
  pageSize: number;
}

export function useTablePreview({ databaseName, tableName, page, pageSize }: TablePreviewOptions) {
  return useQuery<TablePreview>({
    queryKey: ["databases", databaseName, "tables", tableName, page, pageSize],
    queryFn: () => {
      const params = new URLSearchParams({ limit: String(pageSize), offset: String(page * pageSize) });
      return apiFetch<TablePreview>(`/api/databases/${databaseName}/tables/${tableName}?${params.toString()}`);
    },
    enabled: Boolean(databaseName) && Boolean(tableName)
  });
}

export function useCreateDataset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, file }: { name: string; file: File }) => {
      const form = new FormData();
      form.append("name", name);
      form.append("file", file);
      return apiFetch<DatabaseInfo>("/api/databases/", {
        method: "POST",
        body: form
      });
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["databases"] });
      if (created?.name) {
        queryClient.setQueryData<DatabaseInfo[] | undefined>(["databases"], (prev) => {
          if (!prev) return prev;
          const exists = prev.some((entry) => entry.name === created.name);
          return exists ? prev : [...prev, created];
        });
      }
    }
  });
}

export function useDeleteDataset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) =>
      apiFetch<void>(`/api/databases/${encodeURIComponent(name)}`, {
        method: "DELETE"
      }),
    onSuccess: (_, name) => {
      queryClient.invalidateQueries({ queryKey: ["databases"] });
      queryClient.setQueryData<DatabaseInfo[] | undefined>(["databases"], (prev) =>
        prev ? prev.filter((entry) => entry.name !== name) : prev
      );
    }
  });
}
