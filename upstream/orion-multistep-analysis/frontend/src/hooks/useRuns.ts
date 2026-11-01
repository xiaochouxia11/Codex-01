import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/api/client";
import type { RunCreateRequest, RunRecord, RunUpdateRequest } from "@/api/types";

export function useRuns(includeArchived = false) {
  return useQuery<RunRecord[]>({
    queryKey: ["runs", includeArchived ? "with-archived" : "active"],
    queryFn: () => {
      const params = new URLSearchParams();
      if (includeArchived) {
        params.set("include_archived", "true");
      }
      const query = params.toString();
      const suffix = query ? `?${query}` : "";
      return apiFetch<RunRecord[]>(`/api/runs/${suffix}`);
    }
  });
}

export function useRun(runId: string | undefined) {
  return useQuery<RunRecord>({
    queryKey: ["runs", runId],
    queryFn: () => apiFetch<RunRecord>(`/api/runs/${runId}`),
    enabled: Boolean(runId)
  });
}

export function useCreateRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: RunCreateRequest) =>
      apiFetch<RunRecord>("/api/runs/", {
        method: "POST",
        body: JSON.stringify(payload)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["runs"] });
    }
  });
}

export function useCancelRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (runId: string) =>
      apiFetch<RunRecord>(`/api/runs/${runId}/cancel`, { method: "POST" }),
    onSuccess: (_, runId) => {
      queryClient.invalidateQueries({ queryKey: ["runs"] });
      queryClient.invalidateQueries({ queryKey: ["runs", runId] });
    }
  });
}

export function useRenameRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ runId, payload }: { runId: string; payload: RunUpdateRequest }) =>
      apiFetch<RunRecord>(`/api/runs/${runId}`, {
        method: "PATCH",
        body: JSON.stringify(payload)
      }),
    onSuccess: (run) => {
      queryClient.invalidateQueries({ queryKey: ["runs"] });
      queryClient.invalidateQueries({ queryKey: ["runs", run.id] });
    }
  });
}

export function useArchiveRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (runId: string) =>
      apiFetch<RunRecord>(`/api/runs/${runId}/archive`, { method: "POST" }),
    onSuccess: (_, runId) => {
      queryClient.invalidateQueries({ queryKey: ["runs"] });
      queryClient.invalidateQueries({ queryKey: ["runs", runId] });
    }
  });
}

export function useUnarchiveRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (runId: string) =>
      apiFetch<RunRecord>(`/api/runs/${runId}/unarchive`, { method: "POST" }),
    onSuccess: (_, runId) => {
      queryClient.invalidateQueries({ queryKey: ["runs"] });
      queryClient.invalidateQueries({ queryKey: ["runs", runId] });
    }
  });
}
