import { drizzle } from "drizzle-orm/netlify-db";
import * as schema from "./schema";

// Module-level singleton: warm serverless instances and dev hot-reloads reuse one client.
// Netlify Database handles pooling and TLS, so no connection string is needed.
const globalForDb = globalThis as unknown as { sfiDb?: ReturnType<typeof createDb> };

function createDb() {
  return drizzle({ schema });
}

export const db = globalForDb.sfiDb ?? createDb();
if (process.env.NODE_ENV !== "production") globalForDb.sfiDb = db;

export * from "./schema";
