import { afterEach, describe, expect, it, vi } from "vitest";

import { apiFetch } from "@/api/client";
import type { DatabaseInfo, RunRecord } from "@/api/types";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

type MockResponseOptions = {
  ok: boolean;
  status: number;
  json?: unknown;
  text?: string;
};

function mockResponse({ ok, status, json, text }: MockResponseOptions): Response {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(json),
    text: vi.fn().mockResolvedValue(text ?? "")
  } as unknown as Response;
}

describe("apiFetch dataset and run helpers", () => {
  const baseUrl = "http://example.test";

  it("returns datasets on success", async () => {
    const datasets: DatabaseInfo[] = [{ name: "rare-db", size_bytes: 2048 }];
    const fetchMock = vi.fn().mockResolvedValue(mockResponse({ ok: true, status: 200, json: datasets }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiFetch<DatabaseInfo[]>("/api/databases/", {}, baseUrl);

    expect(result).toEqual(datasets);
    expect(fetchMock).toHaveBeenCalledWith(`${baseUrl}/api/databases/`, expect.any(Object));
  });

  it("surface dataset errors with API status and message", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(mockResponse({ ok: false, status: 500, text: "Dataset failed" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiFetch<DatabaseInfo[]>("/api/databases/", {}, baseUrl)).rejects.toThrow(
      "API 500: Dataset failed"
    );
  });

  it("returns runs on success", async () => {
    const runs: RunRecord[] = [
      {
        id: "run-1",
        database: "rare-db",
        status: "running",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
        archived: false,
        prompts: {
          agent: "agent prompt",
          literature: "literature prompt",
          supervisor: "supervisor prompt"
        }
      }
    ];
    const fetchMock = vi.fn().mockResolvedValue(mockResponse({ ok: true, status: 200, json: runs }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiFetch<RunRecord[]>("/api/runs/", {}, baseUrl);

    expect(result).toEqual(runs);
    expect(fetchMock).toHaveBeenCalledWith(`${baseUrl}/api/runs/`, expect.any(Object));
  });

  it("surface run errors with API status and message", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse({ ok: false, status: 404, text: "Run missing" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiFetch<RunRecord[]>("/api/runs/", {}, baseUrl)).rejects.toThrow(
      "API 404: Run missing"
    );
  });
});
