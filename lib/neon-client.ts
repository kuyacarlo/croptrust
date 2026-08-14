import { neon } from "@neondatabase/serverless";

/**
 * Returns a Neon SQL tagged template function.
 * Requires DATABASE_URL env var (Neon connection string).
 */
export function getNeonClient() {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  return neon(url);
}
