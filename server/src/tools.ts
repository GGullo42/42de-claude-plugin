import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Fixtures, Scenario } from "./fixtures.js";

const NOTICE = "Simulated beverage plant (demo data). Re-plans are real 42de CP-SAT output, computed offline.";

type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };

function ok(payload: Record<string, unknown>): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify({ demo: true, notice: NOTICE, ...payload }) }] };
}
function fail(message: string): ToolResult {
  return { isError: true, content: [{ type: "text", text: `42de demo: ${message}` }] };
}

/** Caps user input echoed back in an error message. */
const MAX_ECHO = 64;
function clip(s: string): string {
  return s.length > MAX_ECHO ? `${s.slice(0, MAX_ECHO)}...` : s;
}

const scenarioArg = z.string().describe("Scenario id, as returned by list_demo_scenarios.");

export function registerDemoTools(server: McpServer, fx: Fixtures): void {
  const ids = [...fx.scenarios.keys()];

  const withScenario =
    <A extends { scenario: string }>(fn: (s: Scenario, args: A) => ToolResult) =>
    async (args: A): Promise<ToolResult> => {
      const key = ids.find((i) => i.toLowerCase() === args.scenario.trim().toLowerCase());
      const s = key === undefined ? undefined : fx.scenarios.get(key);
      if (!s) return fail(`Unknown scenario "${clip(args.scenario)}". Valid scenario ids: ${ids.join(", ")}.`);
      return fn(s, args);
    };

  const annotations = (title: string) => ({
    title,
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  });

  server.registerTool(
    "list_demo_scenarios",
    {
      title: "List demo scenarios",
      description:
        "Returns the pre-computed failure scenarios of the simulated beverage-plant demo mission: id, title, summary and the failed robot of each, plus the mission name and solver.",
      inputSchema: {},
      annotations: annotations("List demo scenarios"),
    },
    async () =>
      ok({
        mission_name: fx.manifest.mission_name,
        solver: fx.manifest.solver,
        scenarios: ids.map((i) => {
          const s = fx.scenarios.get(i)!;
          return { id: s.id, title: s.title, summary: s.summary, failed_robot_id: s.failed_robot_id };
        }),
      }),
  );

  server.registerTool(
    "get_mission",
    {
      title: "Get mission",
      description:
        "Returns the simulated mission (phases, tasks, robots, handovers, original assignments, KPIs and routes) together with the scenario's current phase, completed task ids and robot positions.",
      inputSchema: { scenario: scenarioArg },
      annotations: annotations("Get mission"),
    },
    withScenario((s) =>
      ok({
        scenario: s.id,
        mission: fx.mission,
        current_phase_id: s.current_phase_id,
        completed_task_ids: s.completed_task_ids,
        positions: s.positions,
      }),
    ),
  );

  server.registerTool(
    "get_robot_status",
    {
      title: "Get robot status",
      description:
        "Returns simulated live status blocks (connection, posture, operating mode, safed/fallen flags, battery, errors) for every robot in a scenario, or for one robot when robot_id is given.",
      inputSchema: {
        scenario: scenarioArg,
        robot_id: z.string().optional().describe("Optional robot id (case-insensitive). Omit for all robots."),
      },
      annotations: annotations("Get robot status"),
    },
    withScenario((s, a: { scenario: string; robot_id?: string }) => {
      if (a.robot_id === undefined) return ok({ scenario: s.id, robot_status: s.robot_status });
      const want = a.robot_id.trim().toLowerCase();
      const hit = s.robot_status.filter((r) => r.robot_id.toLowerCase() === want);
      if (hit.length === 0) {
        return fail(
          `Unknown robot_id "${clip(a.robot_id)}" in scenario "${s.id}". Valid robot ids: ${s.robot_status.map((r) => r.robot_id).join(", ")}.`,
        );
      }
      return ok({ scenario: s.id, robot_status: hit });
    }),
  );

  server.registerTool(
    "list_mission_alerts",
    {
      title: "List mission alerts",
      description:
        "Returns the simulated alerts raised in a scenario, each with level, title, the robot concerned, and the affected tasks and handovers.",
      inputSchema: { scenario: scenarioArg },
      annotations: annotations("List mission alerts"),
    },
    withScenario((s) => ok({ scenario: s.id, alerts: s.alerts })),
  );

  server.registerTool(
    "get_replan_proposal",
    {
      title: "Get re-plan proposal",
      description:
        "Returns 42de's proposed re-plan for a scenario next to the no-failure baseline: KPIs, task reassignments, changed handovers and routes.",
      inputSchema: { scenario: scenarioArg },
      annotations: annotations("Get re-plan proposal"),
    },
    withScenario((s) => ok({ scenario: s.id, baseline: s.baseline, proposal: s.proposal })),
  );

  server.registerTool(
    "list_what_ifs",
    {
      title: "List what-ifs",
      description:
        "Returns the pre-computed what-if options of a scenario: id, kind, description and whether each is feasible or infeasible.",
      inputSchema: { scenario: scenarioArg },
      annotations: annotations("List what-ifs"),
    },
    withScenario((s) =>
      ok({
        scenario: s.id,
        what_ifs: (fx.whatIfs.get(s.id) ?? []).map((o) => ({
          id: o.what_if?.id,
          kind: o.what_if?.kind,
          description: o.what_if?.description,
          outcome: o.outcome,
        })),
      }),
    ),
  );

  server.registerTool(
    "simulate_replan",
    {
      title: "Simulate re-plan",
      description:
        "Returns 42de's re-plan for one pre-computed what-if in a demo scenario, with KPIs against the no-failure baseline, task reassignments, changed handovers and any capability-fallback assignments.",
      inputSchema: {
        scenario: scenarioArg,
        what_if: z.string().describe("What-if id from list_what_ifs, e.g. drop:a3, block:t07, wait:p3 or none."),
      },
      annotations: annotations("Simulate re-plan"),
    },
    withScenario((s, a: { scenario: string; what_if: string }) => {
      const all = fx.whatIfs.get(s.id) ?? [];
      const want = a.what_if.trim().toLowerCase();
      const hit =
        all.find((o) => o.what_if?.id === a.what_if) ?? all.find((o) => o.what_if?.id.toLowerCase() === want);
      if (!hit) {
        return fail(
          `Unknown what_if "${clip(a.what_if)}" in scenario "${s.id}". Valid what_if ids: ${all.map((o) => o.what_if?.id).join(", ")}.`,
        );
      }
      return ok({ scenario: s.id, baseline: s.baseline, result: hit });
    }),
  );
}
