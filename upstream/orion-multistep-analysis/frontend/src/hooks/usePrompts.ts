import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/api/client";
import type {
  PromptDuplicateRequest,
  PromptTemplate,
  PromptUpdateRequest
} from "@/api/types";

export function usePrompts() {
  return useQuery<PromptTemplate[]>({
    queryKey: ["prompts"],
    queryFn: () => apiFetch<PromptTemplate[]>("/api/prompts/")
  });
}

export function useDuplicatePrompt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      promptId,
      payload
    }: {
      promptId: string;
      payload: PromptDuplicateRequest;
    }) =>
      apiFetch<PromptTemplate>(`/api/prompts/${promptId}/duplicate`, {
        method: "POST",
        body: JSON.stringify(payload ?? {})
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prompts"] });
    }
  });
}

export function useUpdatePrompt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      promptId,
      payload
    }: {
      promptId: string;
      payload: PromptUpdateRequest;
    }) =>
      apiFetch<PromptTemplate>(`/api/prompts/${promptId}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      }),
    onSuccess: (template) => {
      queryClient.invalidateQueries({ queryKey: ["prompts"] });
      queryClient.invalidateQueries({
        queryKey: ["prompts", template.role]
      });
    }
  });
}

export function useArchivePrompt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (promptId: string) =>
      apiFetch<PromptTemplate>(`/api/prompts/${promptId}/archive`, {
        method: "POST"
      }),
    onSuccess: (template) => {
      queryClient.invalidateQueries({ queryKey: ["prompts"] });
      queryClient.invalidateQueries({
        queryKey: ["prompts", template.role]
      });
    }
  });
}

export function useUnarchivePrompt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (promptId: string) =>
      apiFetch<PromptTemplate>(`/api/prompts/${promptId}/unarchive`, {
        method: "POST"
      }),
    onSuccess: (template) => {
      queryClient.invalidateQueries({ queryKey: ["prompts"] });
      queryClient.invalidateQueries({
        queryKey: ["prompts", template.role]
      });
    }
  });
}

export function useDeletePrompt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (promptId: string) =>
      apiFetch<void>(`/api/prompts/${promptId}`, {
        method: "DELETE"
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prompts"] });
    }
  });
}
