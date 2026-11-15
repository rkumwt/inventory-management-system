/** The one error shape every service returns, for every failure. */
export interface ErrorResponse {
  statusCode: number;
  /** Stable machine-readable code, e.g. `NOT_FOUND`, `VALIDATION_FAILED`. */
  error: string;
  /** Human-readable summary, safe to show to the user. */
  message: string;
  /** Extra detail, e.g. the list of validation failures. */
  details?: unknown;
  correlationId?: string;
  timestamp: string;
  path: string;
}
