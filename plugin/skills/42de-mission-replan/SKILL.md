---
name: 42de-mission-replan
description: "This skill should be used when someone wants to know what to do about a robot failure in a 42de mission, how the mission should be re-planned, or wants to compare re-plan options and what-ifs, e.g. \"the jacking AMR failed, what now?\", \"compare re-plans for the cost cascade\", \"should we wait for a12 or re-plan now\", \"what if a10 fails too\"."
---

# Mission re-plan (42de demo)

Take a failure alert to a recommended re-plan: what is hit, what 42de proposes, which alternatives
exist, and the trade-off. Follow the `42de-mission-data` rules. The data is simulated; the re-plans
are real 42de CP-SAT output computed offline. Claude recommends; a planner decides in 42de.

## If asked to accept, dispatch or move anything

If the person asks Claude to accept, apply, dispatch, send, stop or move anything (a re-plan, a task,
a robot), say that this is done in 42de, or at the robot by an authorised person, and that Claude has
no tool for it in this demo. Do not pretend it happened. Offer to explain or compare instead.

## 1. Alert and impact

1. If the scenario is unclear, call `list_demo_scenarios` and match the person's words to a title or
   failed robot. If two fit, ask.
2. Call `list_mission_alerts` and `get_robot_status` for the failed robot. If it is `fallen`, `safed`
   or has a FATAL error, open the answer with that, and add that people follow the plant's safety and
   lockout process before anyone approaches or restarts the robot (see `42de-robot-failure-diagnosis`,
   section 2).
3. Call `get_mission` once. Name the current phase, the completed tasks, and each affected task and
   handover by id and name.

## 2. 42de's proposal

Call `get_replan_proposal`. Report:
- `tasks_covered` / `open_tasks` in the proposal,
- cost and distance against the `baseline` (the original plan on the same open tasks), as absolute
  values and percent change,
- every diff (`task: from -> to`); mark the failed robot's tasks apart from knock-on moves
  (`was_failed_robots: false`),
- every changed handover (`predecessor -> successor`, `before` -> `after`),
- any `uses_capability_fallback` tasks (see section 4).

## 3. Pick 2-4 relevant what-ifs

Call `list_what_ifs`. Choose what a planner would ask next, and say why each was picked:
- `none` is 42de's own proposal; it is always the first row.
- a `wait:<phase>` for the earliest phase offered, if any ("is it worth waiting for the robot?"). Say the
  demo cannot confirm the robot is repaired or recharged by then. `cost-cascade` has none: its failure is
  in phase 5, the last phase, so there is no later phase to wait for; say so instead.
- a `drop:<robot>` of a robot that takes over work in the proposal or sits on a changed handover ("what
  if the backup fails too?").
- a `block:<task>` of an affected task, if skipping it is a realistic option.
- If `list_what_ifs` marks any what-if `infeasible`, include at least one, preferring one that involves
  the affected tasks, the takeover robots or a changed handover. Infeasible results show where the plan
  has no slack left.

Call `simulate_replan` for each chosen what-if (including the infeasible one, to get its reason).

## 4. Comparison table

One row per chosen what-if, `none` first. Use exactly these columns, in this order, and no other
comparison table:

| what-if | outcome | tasks covered | Δ cost | Δ distance | changed handovers | fallback flags |
|---|---|---|---|---|---|---|

- Δ cost and Δ distance are against the `baseline`: give the new value, the absolute change and the
  percent change, e.g. `156.7 (+48.5, +45 %)`.
- tasks covered is `tasks_covered / open_tasks`. A `block:` row has fewer open tasks than the
  baseline: compare its `open_tasks` with the baseline's, name the skipped task in the cell
  (e.g. `3 / 3 (t22 skipped)`), and say that its lower cost is partly the skipped task.
- changed handovers: count and the handovers, e.g. `1 (t21 -> t22: a13 -> a12)`. A `null` robot in
  `before` / `after` (or a `null` `to_robot` in `diffs`) means the task is blocked or uncovered:
  write "nobody", e.g. `t21 -> t22: a13 -> nobody`.
- fallback flags: the `uses_capability_fallback` task ids, or `none`.
- **Infeasible rows:** outcome `infeasible`, the `infeasible_reason` in words in the tasks covered
  cell, and `n/a` in every other cell (Δ cost, Δ distance, changed handovers, fallback flags). Never
  write numbers, zeros or "0 tasks covered" for an infeasible what-if.

Under the table, for every row with fallback flags: "42de assigned <task ids> to a robot outside the
task's allowed robot types; a planner should check that this is plausible before accepting."

## 5. Recommendation

- Recommend one option and state the trade-off in one or two sentences (e.g. full coverage at +45 %
  cost versus waiting for a robot whose return the data cannot confirm).
- Call out risks: no slack (infeasible what-ifs), fallback assignments, handovers with new partners
  that the floor team should know about.
- Note: "Simulated beverage plant (demo data). Re-plans are real 42de CP-SAT output, computed offline."
- End with exactly this line:

  In a real deployment the planner accepts this re-plan in 42de; Claude cannot accept, dispatch, stop or move robots.

Never claim Claude has accepted, applied or dispatched anything.
