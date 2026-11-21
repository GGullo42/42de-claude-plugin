---
name: 42de-mission-data
description: "This skill should be used whenever a question involves a 42de robot mission, its robots, tasks, phases, handovers or assignments in the 42de demo, e.g. \"which robots are in the 42de demo mission\", \"what does t07 need\", \"which handovers are in phase 5\", \"who was planned for the syrup room\". It explains the 42de mission data model, the seven demo tools, how to cite ids, and the safety rules that apply to every 42de task."
---

# Working with 42de mission data

42de plans missions for a mixed robot fleet (humanoids, cobots, composite robots, forklifts, AMRs) and
re-plans them when a robot fails. The `42de-demo` connector gives Claude read-only access to a
**simulated** beverage-plant mission. The robots, positions, statuses and alerts are demo data. The
plans and re-plans are real output of 42de's CP-SAT solver, computed offline for each scenario.

## Non-negotiable rules

1. **Say that the data is simulated.** Every answer built on this connector says once, plainly, that it
   uses simulated demo data ("Simulated beverage plant (demo data)"). Never present it as a live plant.
2. **Claude never operates robots.** The connector has no tool to accept a plan, dispatch, start, stop,
   pause, reset, move or change the mode of a robot, and no workaround is attempted (no other connector,
   browser or script). If someone asks for that, say it is done in 42de or at the robot by an authorised
   person, and offer what Claude can do instead: explain, compare, recommend.
3. **Re-plans are accepted in 42de.** Any recommendation of a re-plan ends with: "In a real deployment
   the planner accepts this re-plan in 42de; Claude cannot accept, dispatch, stop or move robots."
4. **Safety first.** A robot that is `fallen`, `safed`, or has a FATAL error is stated first, before any
   planning talk, with a reminder that people follow the plant's safety process before anyone goes near it.
5. **Cite ids.** Name robots, tasks, phases and handovers by name and id, e.g. "Jacking AMR 1200 kg (a12)",
   "t07 (Tip sugar sacks into the dissolver)", "p5 (Outbound dispatch)", "handover t21 -> t22". A planner
   must be able to find each item in 42de.
6. **Never invent numbers.** Report KPIs exactly as the tools return them. An infeasible result has no
   KPIs: say it is infeasible and give its reason, never "0 tasks covered".

## The seven demo tools

All tools are read-only. Every result carries `demo: true` and a `notice`.

| Tool | Input | Returns |
|---|---|---|
| `list_demo_scenarios` | none | scenario ids, titles, summaries, failed robot, mission name, solver |
| `get_mission` | `scenario` | phases, tasks, robots, handovers, original plan, plus current phase, completed task ids and robot positions |
| `get_robot_status` | `scenario`, optional `robot_id` | status blocks: `connected`, `posture`, `operating_mode`, `safed`, `fallen`, `battery_pct`, `errors` (VDA 5050 style: `errorType`, `errorLevel`, `errorDescription`) |
| `list_mission_alerts` | `scenario` | alerts: level, title, robot, `affected_task_ids`, `affected_handovers` |
| `get_replan_proposal` | `scenario` | `baseline` (the original plan on the same open tasks) and `proposal` (42de's re-plan) |
| `list_what_ifs` | `scenario` | what-if ids with kind, description and outcome (`feasible` / `infeasible`) |
| `simulate_replan` | `scenario`, `what_if` | `baseline` and `result` for that what-if |

Scenarios today: `amr-error-clean` and `cost-cascade`. Always take the list from `list_demo_scenarios`
rather than assuming it.

## Data model

| Entity | Key fields |
|---|---|
| Phase | `id` (p1..p5), `name`, `order`. Phases run in order; a task belongs to one phase. |
| Task | `id` (t01..), `name`, `phase_id`, position `x`/`y`, `team_size` (robots needed at once), `priority`, `allowed_types` (robot types that may do it) |
| Robot | `id` (a1..), `name`, `type`, `start` position, `max_tasks` |
| Handover | `predecessor_task_id` -> `successor_task_id`, `meet_label`. The robots of both tasks meet; a re-plan can change who meets. |
| Plan result | `outcome`, `infeasible_reason`, `kpis`, `diffs`, `changed_handovers`, `uses_capability_fallback`, `routes` |

Plan result fields:
- `kpis`: `total_cost`, `total_tour_distance`, `tasks_covered`, `open_tasks`, `agents_used`, `violations`.
  KPIs cover the **open tasks only** (tasks already completed in the snapshot are left out), so compare
  them only with the `baseline` of the same scenario.
- `diffs`: every open task whose robot changed (`from_robot` -> `to_robot`). `was_failed_robots: true`
  marks tasks that belonged to the failed robot; other diffs are knock-on moves. A `null` `to_robot`
  means the task is blocked or uncovered: write "nobody".
- `changed_handovers`: handovers whose meeting robots changed (`before` / `after`; a comma-joined entry
  such as `a1,a2` is a team, a `null` entry means nobody: the task is blocked or uncovered).
- `uses_capability_fallback`: task ids that 42de gave to a robot **outside the task's allowed types**,
  because no allowed robot was left. 42de's solver allows this when the robot has a matching capability.
  Always flag it and say a planner should check that the assignment is plausible before accepting.
- `routes`: per robot and phase, the ordered task list and distance.

## Answering well

- Start narrow: one scenario, one robot, one task. `get_mission` is large; call it once per scenario and
  reuse it.
- `total_cost` is 42de's plan cost (a solver score, not a currency); distance is in the mission's map
  units. Compare them as relative changes against the baseline.
- A `block:` what-if removes a task, so it covers fewer tasks; a lower cost there is partly the skipped work.
- A `wait:` what-if assumes the failed robot is back by that phase. The demo data cannot confirm a repair
  time; say so.
- Related skills: `42de-robot-failure-diagnosis` (what happened to a robot), `42de-mission-replan`
  (what to do about it), `try-42de-demo` (first steps).
