// Usage: npm run smoke -- --url https://host/mcp
// Runs the HTTP tests against a deployed server. Without --url, runs them against a local one.
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const i = args.indexOf("--url");
const env = { ...process.env };
if (i >= 0) {
  const url = args[i + 1];
  if (!url) {
    console.error("--url needs a value, e.g. --url https://host/mcp");
    process.exit(2);
  }
  env.SMOKE_URL = url;
}
const r = spawnSync("npx", ["tsx", "--test", "test/http.test.ts"], { stdio: "inherit", env });
process.exit(r.status ?? 1);
