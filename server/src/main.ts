import { loadFixtures } from "./fixtures.js";
import { buildApp } from "./app.js";

// Log the error name only (messages can quote request data) and keep serving: one failed request must not take the
// instance down.
process.on("unhandledRejection", (reason) => {
  console.error(`unhandledRejection: ${reason instanceof Error ? reason.name : "non-Error rejection"}`);
});

const port = Number(process.env.PORT ?? 8080);
const dir = process.env.FIXTURES_DIR ?? "./fixtures";

let fixtures;
try {
  fixtures = loadFixtures(dir);
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}

buildApp({ fixtures }).listen(port, () => {
  console.log(`42de-demo MCP listening on :${port} (${fixtures.scenarios.size} scenarios, fixtures ${dir})`);
});
