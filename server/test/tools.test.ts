import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { loadFixtures } from "../src/fixtures.js";
import { registerDemoTools } from "../src/tools.js";

const here = fileURLToPath(new URL(".", import.meta.url));
const MINI = join(here, "mini-fixtures");
const REAL = join(here, "..", "fixtures");

const NAMES = [
  "get_mission",
  "get_replan_proposal",
  "get_robot_status",
  "list_demo_scenarios",
  "list_mission_alerts",
  "list_what_ifs",
  "simulate_replan",
];

async function connect(dir: string) {
  const server = new McpServer({ name: "t", version: "0" });
  registerDemoTools(server, loadFixtures(dir));
  const client = new Client({ name: "c", version: "0" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), client.connect(b)]);
  return client;
}
async function call(c: Client, name: string, args: Record<string, unknown> = {}) {
  const r: any = await c.callTool({ name, arguments: args });
  const text: string = r.content[0].text;
  return { isError: !!r.isError, text, json: r.isError ? null : JSON.parse(text) };
}

test("exactly seven tools, all annotated", async () => {
  const c = await connect(MINI);
  const { tools } = await c.listTools();
  assert.deepEqual(tools.map((t) => t.name).sort(), NAMES);
  for (const t of tools) {
    assert.ok(t.annotations?.title, `${t.name} title`);
    assert.equal(t.annotations?.readOnlyHint, true);
    assert.equal(t.annotations?.destructiveHint, false);
    assert.equal(t.annotations?.idempotentHint, true);
    assert.equal(t.annotations?.openWorldHint, false);
    for (const k of Object.keys(t.inputSchema.properties ?? {})) {
      assert.doesNotMatch(k, /token|confirm|accept|dispatch/i);
    }
  }
});

test("every result carries demo + notice", async () => {
  const c = await connect(MINI);
  const calls: [string, Record<string, unknown>][] = [
    ["list_demo_scenarios", {}],
    ["get_mission", { scenario: "mini" }],
    ["get_robot_status", { scenario: "mini" }],
    ["list_mission_alerts", { scenario: "mini" }],
    ["get_replan_proposal", { scenario: "mini" }],
    ["list_what_ifs", { scenario: "mini" }],
    ["simulate_replan", { scenario: "mini", what_if: "wait:a2" }],
  ];
  for (const [n, a] of calls) {
    const r = await call(c, n, a);
    assert.equal(r.isError, false, n);
    assert.equal(r.json.demo, true, n);
    assert.match(r.json.notice, /Simulated beverage plant/, n);
  }
});

test("payload shapes", async () => {
  const c = await connect(MINI);
  const m = (await call(c, "get_mission", { scenario: "mini" })).json;
  assert.ok(m.mission.phases && m.current_phase_id && m.completed_task_ids && m.positions);
  assert.ok(m.mission.original_plan.assignments);
  const w = (await call(c, "list_what_ifs", { scenario: "mini" })).json;
  assert.deepEqual(Object.keys(w.what_ifs[0]).sort(), ["description", "id", "kind", "outcome"]);
  const p = (await call(c, "get_replan_proposal", { scenario: "mini" })).json;
  assert.ok(p.baseline && p.proposal);
});

test("unknown scenario lists valid ids", async () => {
  const c = await connect(MINI);
  const r = await call(c, "get_mission", { scenario: "nope" });
  assert.equal(r.isError, true);
  assert.match(r.text, /mini/);
});

test("unknown what_if lists valid ids", async () => {
  const c = await connect(MINI);
  const r = await call(c, "simulate_replan", { scenario: "mini", what_if: "zzz" });
  assert.equal(r.isError, true);
  assert.match(r.text, /wait:a2/);
  assert.match(r.text, /drop:a1/);
  const ci = await call(c, "simulate_replan", { scenario: "mini", what_if: "WAIT:A2" });
  assert.equal(ci.isError, false);
});

test("robot_id is case-insensitive", async () => {
  const c = await connect(MINI);
  const r = await call(c, "get_robot_status", { scenario: "mini", robot_id: "A1" });
  assert.equal(r.isError, false);
  assert.equal(r.json.robot_status.length, 1);
  assert.equal(r.json.robot_status[0].robot_id, "a1");
  const all = await call(c, "get_robot_status", { scenario: "mini" });
  assert.equal(all.json.robot_status.length, 2);
});

test("unknown robot_id lists valid ids", async () => {
  const c = await connect(MINI);
  const r = await call(c, "get_robot_status", { scenario: "mini", robot_id: "x9" });
  assert.equal(r.isError, true);
  assert.match(r.text, /a1/);
  assert.match(r.text, /a2/);
});

test("infeasible what-if renders as infeasible", async () => {
  const c = await connect(MINI);
  const r = await call(c, "simulate_replan", { scenario: "mini", what_if: "drop:a1" });
  assert.equal(r.json.result.outcome, "infeasible");
  assert.equal(r.json.result.kpis, null);
  assert.match(r.json.result.infeasible_reason, /t3/);
  assert.ok(r.json.baseline);
});

test("results stay under 60,000 chars on real fixtures", { skip: !existsSync(join(REAL, "manifest.json")) }, async () => {
  const fx = loadFixtures(REAL);
  const c = await connect(REAL);
  const check = async (n: string, a: Record<string, unknown>) => {
    const r = await call(c, n, a);
    assert.equal(r.isError, false, `${n} ${JSON.stringify(a)}`);
    assert.ok(r.text.length < 60000, `${n} ${JSON.stringify(a)}: ${r.text.length}`);
  };
  await check("list_demo_scenarios", {});
  for (const id of fx.scenarios.keys()) {
    for (const n of ["get_mission", "get_robot_status", "list_mission_alerts", "get_replan_proposal", "list_what_ifs"]) {
      await check(n, { scenario: id });
    }
    for (const o of fx.whatIfs.get(id)!) await check("simulate_replan", { scenario: id, what_if: o.what_if!.id });
  }
});

test("error texts carry the 42de demo prefix", async () => {
  const c = await connect(MINI);
  for (const [n, a] of [
    ["get_mission", { scenario: "nope" }],
    ["get_robot_status", { scenario: "mini", robot_id: "x9" }],
    ["simulate_replan", { scenario: "mini", what_if: "zzz" }],
  ] as [string, Record<string, unknown>][]) {
    const r = await call(c, n, a);
    assert.equal(r.isError, true, n);
    assert.match(r.text, /^42de demo: /, n);
  }
});

test("echoed user input is capped at 64 chars", async () => {
  const c = await connect(MINI);
  const long = "Q".repeat(5000);
  for (const [n, a] of [
    ["get_mission", { scenario: long }],
    ["get_robot_status", { scenario: "mini", robot_id: long }],
    ["simulate_replan", { scenario: "mini", what_if: long }],
  ] as [string, Record<string, unknown>][]) {
    const r = await call(c, n, a);
    assert.equal(r.isError, true, n);
    const run = Math.max(...(r.text.match(/Q+/g) ?? [""]).map((s) => s.length));
    assert.ok(run <= 64, `${n}: echoed ${run} chars`);
    assert.ok(r.text.length < 500, `${n}: ${r.text.length} chars`);
  }
});
