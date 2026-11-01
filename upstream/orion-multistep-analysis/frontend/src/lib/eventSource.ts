export function createEventSource(url: string): EventSource {
  const source = new EventSource(url, { withCredentials: false });
  return source;
}
