const DEFAULT_BASE_URL = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000";

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {},
  baseUrl: string = DEFAULT_BASE_URL
): Promise<T> {
  const init: RequestInit = { ...options };
  const headers = new Headers(options.headers ?? {});
  if (!headers.has("Content-Type") && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  init.headers = headers;
  const response = await fetch(`${baseUrl}${endpoint}`, {
    ...init
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API ${response.status}: ${text}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
