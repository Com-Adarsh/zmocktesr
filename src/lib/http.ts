export function jsonError(message: string, status: number, extra?: Record<string, unknown>) {
  return Response.json({ error: message, ...extra }, { status });
}

export async function readJson<T = unknown>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

export function str(value: unknown, max = 500): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function normalizeTestCode(value: unknown): string {
  return str(value, 64).toUpperCase();
}

export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  let e: unknown = error;
  // Drizzle wraps driver errors in `cause`.
  for (let i = 0; i < 3 && e && typeof e === "object"; i++) {
    const pg = e as { code?: string; constraint?: string; cause?: unknown };
    if (pg.code === "23505") return !constraint || pg.constraint === constraint;
    e = pg.cause;
  }
  return false;
}
