// Added by f00700f for the community-maintained LazyCat distribution, 2026.
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("[entrypoint] DATABASE_URL is required");
  process.exit(1);
}

const timeoutMs = Number(process.env.DATABASE_WAIT_TIMEOUT_MS ?? 90_000);
const retryMs = Number(process.env.DATABASE_WAIT_RETRY_MS ?? 2_000);
const deadline = Date.now() + timeoutMs;
let attempt = 0;

while (true) {
  attempt += 1;
  const sql = postgres(databaseUrl, {
    max: 1,
    connect_timeout: 3,
    idle_timeout: 1,
  });

  try {
    await sql.unsafe("select 1");
    await sql.end({ timeout: 1 });
    console.log(`[entrypoint] PostgreSQL is ready (attempt ${attempt})`);
    break;
  } catch (error) {
    await sql.end({ timeout: 0 }).catch(() => {});
    if (Date.now() >= deadline) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[entrypoint] PostgreSQL did not become ready within ${timeoutMs}ms: ${message}`);
      process.exit(1);
    }
    console.log(`[entrypoint] waiting for PostgreSQL (attempt ${attempt})...`);
    await new Promise((resolve) => setTimeout(resolve, retryMs));
  }
}
