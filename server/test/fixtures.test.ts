import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { FixtureError, loadFixtures } from "../src/fixtures.js";

const here = fileURLToPath(new URL(".", import.meta.url));
const MINI = join(here, "mini-fixtures");
const REAL = join(here, "..", "fixtures");

function copyMini(): string {
  const d = mkdtempSync(join(tmpdir(), "mini-"));
  cpSync(MINI, d, { recursive: true });
  return d;
}
function editJson(file: string, fn: (v: any) => void): void {
  const v = JSON.parse(readFileSync(file, "utf8"));
  fn(v);
  writeFileSync(file, JSON.stringify(v));
}

test("loads mini fixtures", () => {
  const f = loadFixtures(MINI);
  assert.equal(f.manifest.schema_version, 1);
  assert.equal(f.mission.robots.length, 2);
  assert.equal(f.mission.tasks.length, 3);
  assert.equal(f.scenarios.get("mini")?.failed_robot_id, "a2");
  const w = f.whatIfs.get("mini")!;
  assert.deepEqual(w.map((o) => o.outcome), ["feasible", "infeasible"]);
  assert.equal(w[1].kpis, null);
});

test("rejects schema_version != 1", () => {
  const d = copyMini();
  try {
    editJson(join(d, "manifest.json"), (m) => { m.schema_version = 2; });
    assert.throws(() => loadFixtures(d), (e: any) => e instanceof FixtureError && /manifest\.json/.test(e.message) && /schema_version/.test(e.message));
  } finally { rmSync(d, { recursive: true }); }
});

test("rejects infeasible outcome with kpis", () => {
  const d = copyMini();
  try {
    editJson(join(d, "scenarios/mini.what-ifs.json"), (w) => { w[1].kpis = w[0].kpis; });
    assert.throws(() => loadFixtures(d), (e: any) => e instanceof FixtureError && /mini\.what-ifs\.json/.test(e.message) && /\[1\]/.test(e.message));
  } finally { rmSync(d, { recursive: true }); }
});

test("rejects feasible outcome without kpis", () => {
  const d = copyMini();
  try {
    editJson(join(d, "scenarios/mini.what-ifs.json"), (w) => { w[0].kpis = null; });
    assert.throws(() => loadFixtures(d), FixtureError);
  } finally { rmSync(d, { recursive: true }); }
});

test("rejects unknown keys", () => {
  const d = copyMini();
  try {
    editJson(join(d, "scenarios/mini.json"), (s) => { s.surprise = 1; });
    assert.throws(() => loadFixtures(d), (e: any) => e instanceof FixtureError && /mini\.json/.test(e.message));
  } finally { rmSync(d, { recursive: true }); }
});

test("rejects missing scenario file listed in manifest", () => {
  const d = copyMini();
  try {
    rmSync(join(d, "scenarios/mini.json"));
    assert.throws(() => loadFixtures(d), (e: any) => e instanceof FixtureError && /mini\.json/.test(e.message));
  } finally { rmSync(d, { recursive: true }); }
});

test("loads real fixtures", { skip: !existsSync(join(REAL, "manifest.json")) }, () => {
  const f = loadFixtures(REAL);
  assert.equal(f.scenarios.size, f.manifest.scenario_ids.length);
  assert.ok(f.scenarios.size >= 1);
});
