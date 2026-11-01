import { useEffect, useRef, useState } from "react";

import type { EventEnvelope } from "@/api/types";
import { createEventSource } from "@/lib/eventSource";

interface EventStreamOptions {
  baseUrl?: string;
}

export function useEventStream<T = unknown>(endpoint: string | undefined, options: EventStreamOptions = {}) {
  const [events, setEvents] = useState<EventEnvelope<T>[]>([]);
  const [error, setError] = useState<string | null>(null);
  const sourceRef = useRef<EventSource | null>(null);
  const prevEndpointRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!endpoint) {
      setEvents([]);
      return undefined;
    }

    const base = options.baseUrl ?? (import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000");
    const shouldReset = prevEndpointRef.current !== endpoint;
    prevEndpointRef.current = endpoint;

    const source = createEventSource(`${base}${endpoint}`);
    sourceRef.current = source;
    if (shouldReset) {
      setEvents([]);
    }
    setError(null);

    source.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as EventEnvelope<T>;
        setEvents((prev) => [...prev, parsed]);
      } catch (err) {
        setError((err as Error).message);
      }
    };

    source.onerror = () => {
      setError("Event stream disconnected");
      source.close();
    };

    return () => {
      source.close();
      sourceRef.current = null;
    };
  }, [endpoint, options.baseUrl]);

  return { events, error };
}
