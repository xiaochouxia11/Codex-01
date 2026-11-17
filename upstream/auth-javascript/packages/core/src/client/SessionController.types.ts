export interface SessionObservation {
  cleanup?: () => void;
}

export interface SessionRequest {
  controller: AbortController;
  promise: Promise<void>;
  finish: () => void;
}
