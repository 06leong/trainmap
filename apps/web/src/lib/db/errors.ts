export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super("DATABASE_URL is not configured.");
    this.name = "DatabaseNotConfiguredError";
  }
}

export function isDatabaseNotConfigured(error: unknown): error is DatabaseNotConfiguredError {
  return error instanceof DatabaseNotConfiguredError;
}
