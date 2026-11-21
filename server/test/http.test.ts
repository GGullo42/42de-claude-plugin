import { test, after } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { loadFixtures } from "../src/fixtures.js";
import { buildApp } from "../src/app.js";

const here = fileURLToPath(new URL(".", import.meta.url));
const REAL = join(here, "..", "fixtures");
const fx = loadFixtures(REAL);

// Remote mode: SMOKE_URL=https://host/mcp runs the HTTP tests against a deployed server.
const REMOTE = process.env.SMOKE_URL ? process.env.SMOKE_URL.replace(/\/+$/, "").replace(/\/mcp$/, "") : undefined;
const localOnly = REMOTE ? { skip: "needs a local server (SMOKE_URL is set)" } : {};

const servers: Server[] = [];
after(() => {
  for (const s of servers) s.close();
});

/** Start the app on a free port and return its base URL; in remote mode (SMOKE_URL set) return the remote base URL instead. */
async function startLocal(opts: { ratePerMinute?: number } = {}): Promise<string> {
  if (REMOTE) return REMOTE;
  const app = buildApp({ fixtures: fx, ...opts });
  const srv = await new Promise<Server>((res) => {
    const s = app.listen(0, "127.0.0.1", () => res(s));
  });
  servers.push(srv);
  return `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
}

async function mcpClient(base: string): Promise<Client> {
  const c = new Client({ name: "t", version: "0" });
  await c.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`)));
  return c;
}

const rpc = (base: string) =>
  fetch(`${base}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
  });

test("client lists 7 tools and calls each over HTTP", async () => {
  const base = await startLocal();
  const c = await mcpClient(base);
  const { tools } = await c.listTools();
  assert.equal(tools.length, 7);
  const sc = [...fx.scenarios.keys()][0];
  const args: Record<string, Record<string, unknown>> = {
    list_demo_scenarios: {},
    get_mission: { scenario: sc },
    get_robot_status: { scenario: sc },
    list_mission_alerts: { scenario: sc },
    get_replan_proposal: { scenario: sc },
    list_what_ifs: { scenario: sc },
  };
  const wi = fx.whatIfs.get(sc)!.find((o) => o.what_if)!.what_if!;
  args.simulate_replan = { scenario: sc, what_if: wi.id };
  for (const t of tools) {
    const r: any = await c.callTool({ name: t.name, arguments: args[t.name] });
    assert.ok(!r.isError, `${t.name}: ${r.content?.[0]?.text}`);
    assert.equal(JSON.parse(r.content[0].text).demo, true, t.name);
  }
  const info = c.getServerVersion();
  assert.equal(info?.name, "42de-demo");
  assert.match(info?.version ?? "", /^\d+\.\d+\.\d+/);
  assert.match(c.getInstructions() ?? "", /cannot operate, stop or dispatch robots/);
  await c.close();
});

test("GET /mcp is 405", async () => {
  const base = await startLocal();
  assert.equal((await fetch(`${base}/mcp`)).status, 405);
  assert.equal((await fetch(`${base}/mcp`, { method: "DELETE" })).status, 405);
});

test("61st request in a minute is 429 (with a 60/min limit)", localOnly, async () => {
  const base = await startLocal({ ratePerMinute: 60 });
  for (let i = 1; i <= 60; i++) {
    const r = await rpc(base);
    assert.equal(r.status, 200, `request ${i}`);
    await r.text();
  }
  const r = await rpc(base);
  assert.equal(r.status, 429);
  const ra = Number(r.headers.get("retry-after"));
  assert.ok(ra >= 1 && ra <= 60, `retry-after ${ra}`);
  // healthz is not rate limited
  assert.equal((await fetch(`${base}/healthz`)).status, 200);
});

test("default limit is 600/min: 61 requests in a minute all pass", localOnly, async () => {
  const base = await startLocal();
  for (let i = 1; i <= 61; i++) {
    const r = await rpc(base);
    assert.equal(r.status, 200, `request ${i}`);
    await r.text();
  }
});

test("healthz reports scenario count", async () => {
  const base = await startLocal();
  const j: any = await (await fetch(`${base}/healthz`)).json();
  assert.deepEqual(
    j,
    { ok: true, scenarios: fx.scenarios.size, fortytwode_commit: fx.manifest.fortytwode_commit },
    REMOTE ? "remote fixtures differ from local checkout — stale deploy or out-of-date checkout" : undefined,
  );
});

test("no Authorization header needed", async () => {
  const base = await startLocal();
  const r = await rpc(base);
  assert.equal(r.status, 200);
  await r.text();
});

test("oversized body is rejected and the body is never logged", localOnly, async () => {
  const base = await startLocal();
  const logged: string[] = [];
  const orig = console.error;
  console.error = (...a: unknown[]) => void logged.push(a.map(String).join(" "));
  let r: Response;
  try {
    r = await fetch(`${base}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pad: "SECRETPAD".repeat(8_000) }),
    });
    await r.text();
  } finally {
    console.error = orig;
  }
  assert.equal(r.status, 413);
  assert.ok(logged.length >= 1, "the error is logged");
  for (const l of logged) assert.doesNotMatch(l, /SECRETPAD/);
});

test("malformed JSON is rejected and its text is never logged", localOnly, async () => {
  const base = await startLocal();
  const logged: string[] = [];
  const orig = console.error;
  console.error = (...a: unknown[]) => void logged.push(a.map(String).join(" "));
  let r: Response;
  try {
    // JSON.parse error messages quote the input; the log must not.
    r = await fetch(`${base}/mcp`, { method: "POST", headers: { "content-type": "application/json" }, body: "SECRETWORD" });
    await r.text();
  } finally {
    console.error = orig;
  }
  assert.equal(r.status, 400);
  assert.ok(logged.length >= 1, "the error is logged");
  for (const l of logged) assert.doesNotMatch(l, /SECRET/);
});

test("main exits 1 naming the file when fixtures are invalid", localOnly, () => {
  const r = spawnSync("npx", ["tsx", "src/main.ts"], {
    cwd: join(here, ".."),
    env: { ...process.env, FIXTURES_DIR: join(here, "bad-fixtures"), PORT: "0" },
    encoding: "utf8",
    timeout: 30_000,
  });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /manifest\.json/);
});
