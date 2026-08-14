import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "..", "supabase", "migrations");

async function main() {
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
  const projectRef = process.env.SUPABASE_PROJECT_REF;
  if (!accessToken) throw new Error("SUPABASE_ACCESS_TOKEN env var required");
  if (!projectRef) throw new Error("SUPABASE_PROJECT_REF env var required");

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf-8");
    console.log(`Applying ${file}...`);
    const res = await fetch(
      `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: sql }),
      },
    );
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Migration ${file} failed (${res.status}): ${err.slice(0, 300)}`);
    }
    console.log(`  OK`);
  }
  console.log("All migrations applied.");
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
