/**
 * Domain errors that represent a run-fatal validation problem (as opposed to a
 * transient provider failure). The orchestrator maps these to a FAILED run with
 * a sanitized message; they are never retried and never silently swallowed.
 */
export class ReferenceIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReferenceIntegrityError';
  }
}

/** Raised when a per-run resource ceiling (e.g. token budget) is exceeded. */
export class BudgetExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BudgetExceededError';
  }
}
