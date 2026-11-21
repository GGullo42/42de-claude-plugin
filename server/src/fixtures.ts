import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

/** Thrown for any missing, unparsable or schema-violating fixture file. */
export class FixtureError extends Error {
  constructor(public file: string, public path: string, detail: string) {
    super(`fixture ${file}${path ? ` at ${path}` : ""}: ${detail}`);
    this.name = "FixtureError";
  }
}

const Point = z.object({ x: z.number(), y: z.number() }).strict();

export const Kpis = z
  .object({
    total_cost: z.number(),
    total_tour_distance: z.number(),
    tasks_covered: z.number().int(),
    open_tasks: z.number().int(),
    agents_used: z.number().int(),
    violations: z.array(z.string()),
  })
  .strict();

export const Route = z
  .object({
    robot_id: z.string(),
    phase_id: z.string(),
    task_ids: z.array(z.string()),
    distance: z.number(),
  })
  .strict();

export const Handover = z
  .object({
    predecessor_task_id: z.string(),
    successor_task_id: z.string(),
    meet_label: z.string(),
  })
  .strict();

export const Diff = z
  .object({
    task_id: z.string(),
    from_robot: z.string(), // may be a comma-joined team, e.g. "a1,a2"
    to_robot: z.string().nullable(),
    was_failed_robots: z.boolean(),
  })
  .strict();

export const ChangedHandover = Handover.extend({
  before: z.array(z.string().nullable()),
  after: z.array(z.string().nullable()),
}).strict();

export const WhatIf = z
  .object({
    id: z.string(),
    kind: z.enum(["none", "drop_robot", "block_task", "wait_for_robot"]),
    description: z.string(),
  })
  .strict();

/** outcome === "infeasible"  <=>  kpis === null && infeasible_reason !== null */
export const Outcome = z
  .object({
    what_if: WhatIf.nullable(), // null for the scenario baseline / proposal
    outcome: z.enum(["feasible", "infeasible"]),
    infeasible_reason: z.string().nullable(),
    kpis: Kpis.nullable(),
    diffs: z.array(Diff),
    changed_handovers: z.array(ChangedHandover),
    uses_capability_fallback: z.array(z.string()),
    routes: z.array(Route),
  })
  .strict()
  .superRefine((o, ctx) => {
    const infeasible = o.outcome === "infeasible";
    const ok = infeasible
      ? o.kpis === null && o.infeasible_reason !== null
      : o.kpis !== null && o.infeasible_reason === null;
    if (!ok) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: infeasible ? ["kpis"] : ["outcome"],
        message: 'outcome "infeasible" requires kpis null and infeasible_reason set; "feasible" requires kpis set and infeasible_reason null',
      });
    }
  });
export type Outcome = z.infer<typeof Outcome>;

export const Manifest = z
  .object({
    schema_version: z.literal(1),
    generated_at: z.string(),
    fortytwode_commit: z.string(),
    solver: z.string(),
    mission_name: z.string(),
    scenario_ids: z.array(z.string()).min(1),
  })
  .strict();
export type Manifest = z.infer<typeof Manifest>;

export const Mission = z
  .object({
    phases: z.array(z.object({ id: z.string(), name: z.string(), order: z.number().int() }).strict()),
    robots: z.array(
      z
        .object({ id: z.string(), name: z.string(), type: z.string(), start: Point, max_tasks: z.number().int() })
        .strict(),
    ),
    tasks: z.array(
      z
        .object({
          id: z.string(),
          name: z.string(),
          phase_id: z.string(),
          x: z.number(),
          y: z.number(),
          team_size: z.number().int(),
          priority: z.number(),
          allowed_types: z.array(z.string()),
        })
        .strict(),
    ),
    handovers: z.array(Handover),
    original_plan: z
      .object({
        assignments: z.array(z.object({ task_id: z.string(), robot_ids: z.array(z.string()) }).strict()),
        kpis: Kpis,
        routes: z.array(Route),
      })
      .strict(),
  })
  .strict();
export type Mission = z.infer<typeof Mission>;

export const Scenario = z
  .object({
    id: z.string(),
    title: z.string(),
    summary: z.string(),
    failed_robot_id: z.string(),
    current_phase_id: z.string(),
    completed_task_ids: z.array(z.string()),
    positions: z.array(z.object({ robot_id: z.string(), x: z.number(), y: z.number() }).strict()),
    robot_status: z.array(
      z
        .object({
          robot_id: z.string(),
          connected: z.boolean(),
          posture: z.string().nullable(),
          operating_mode: z.string(),
          safed: z.boolean(),
          fallen: z.boolean(),
          battery_pct: z.number(),
          errors: z.array(
            z.object({ errorType: z.string(), errorLevel: z.string(), errorDescription: z.string() }).strict(),
          ),
        })
        .strict(),
    ),
    alerts: z.array(
      z
        .object({
          id: z.string(),
          robot_id: z.string(),
          level: z.string(),
          title: z.string(),
          affected_task_ids: z.array(z.string()),
          affected_handovers: z.array(Handover),
        })
        .strict(),
    ),
    baseline: Outcome,
    proposal: Outcome,
  })
  .strict();
export type Scenario = z.infer<typeof Scenario>;

export type Fixtures = {
  manifest: Manifest;
  mission: Mission;
  scenarios: Map<string, Scenario>;
  whatIfs: Map<string, Outcome[]>;
};

function readParsed<T>(dir: string, rel: string, schema: z.ZodType<T, z.ZodTypeDef, unknown>): T {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(join(dir, rel), "utf8"));
  } catch (e) {
    throw new FixtureError(rel, "", `cannot read or parse: ${(e as Error).message}`);
  }
  const r = schema.safeParse(raw);
  if (!r.success) {
    const i = r.error.issues[0];
    const path = i.path.map((p) => (typeof p === "number" ? `[${p}]` : `.${p}`)).join("").replace(/^\./, "");
    throw new FixtureError(rel, path, i.message);
  }
  return r.data;
}

export function loadFixtures(dir: string): Fixtures {
  const manifest = readParsed(dir, "manifest.json", Manifest);
  const mission = readParsed(dir, "mission.json", Mission);
  const scenarios = new Map<string, Scenario>();
  const whatIfs = new Map<string, Outcome[]>();
  for (const id of manifest.scenario_ids) {
    const s = readParsed(dir, `scenarios/${id}.json`, Scenario);
    if (s.id !== id) throw new FixtureError(`scenarios/${id}.json`, "id", `expected "${id}", found "${s.id}"`);
    scenarios.set(id, s);
    whatIfs.set(id, readParsed(dir, `scenarios/${id}.what-ifs.json`, z.array(Outcome)));
  }
  return { manifest, mission, scenarios, whatIfs };
}
