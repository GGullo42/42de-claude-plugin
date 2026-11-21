---
name: 42de-robot-failure-diagnosis
description: This skill should be used when a robot in the 42de demo mission has failed, stopped, raised an error or alert, or is behaving abnormally and someone wants to know what happened and what it means for the mission, e.g. "what is wrong with robot a12", "why did a13 stop", "why did the forklift leave the mission", "which tasks are hit by the forklift alert".
---

# Robot failure diagnosis (42de demo)

Explain what happened to a robot from 42de's status and alert data, separate the cause from the
mission impact, and hand over to re-planning. Follow the `42de-mission-data` rules. The data is
simulated; diagnosis informs people, it never commands the robot.

## If asked to accept, dispatch or move anything

If the person asks Claude to accept, apply, dispatch, send, stop or move anything (a re-plan, a task,
a robot), say that this is done in 42de, or at the robot by an authorised person, and that Claude has
no tool for it in this demo. Do not pretend it happened. Offer to explain or compare instead.

## 1. Find the scenario and the robot

- If the scenario is unclear, call `list_demo_scenarios` and match the person's words to a scenario
  title or failed robot (e.g. "jacking AMR" -> `amr-error-clean`, robot a12; "forklift battery" ->
  `cost-cascade`, robot a13). If two scenarios fit, ask which one.
- Call `list_mission_alerts` for the scenario and `get_robot_status` for the robot concerned.
- Call `get_mission` once for task names, phases, handovers and the original assignments.

## 2. Lead with safety-relevant states

Before anything else, check the robot's status block:
- `fallen: true` -> the robot has fallen (humanoids). State it first.
- `safed: true` -> the robot is in a safe state and out of automatic operation. State it first.
- any error with `errorLevel: "FATAL"` -> a fatal error stopped the robot. State it first.
- `connected: false`, or `operating_mode` other than `AUTOMATIC` -> say so next.

Then say plainly: people follow the plant's safety and lockout process before anyone approaches or
restarts the robot, and the restart is decided in 42de or at the robot by an authorised person. Claude
cannot reset, restart, stop or move it.

## 3. Cause (what the data shows)

From the status block and alert: the error type, level and description (VDA 5050 style
`errorType` / `errorLevel` / `errorDescription`), battery level, operating mode and connection. Quote
them exactly. Then:
- give the likely meaning in plain words (e.g. `driveFault` with "Drive motor overcurrent" points at
  the drive train: motor, gearbox, wheel or a blocked wheel; `batteryLow` at 7 % means the robot left to
  charge and will be back only after charging),
- list 1-3 checks a technician could do, in order, and
- say what the demo data cannot tell: there is no telemetry history, maintenance record or repair
  estimate in the demo, so the cause stays a hypothesis.

## 4. Mission impact (separate from the cause)

From the alert's `affected_task_ids` and `affected_handovers`, plus `get_mission`:
- the current phase and the tasks already completed,
- each affected task by id and name, with its phase and allowed robot types,
- each affected handover (`predecessor -> successor`, `meet_label`) and which robots meet there,
- whether other robots of the same type exist (from the mission's robot list).

## 5. Present

1. Safety line (if any of section 2 applies).
2. What happened: robot (name and id), error, level, when in the mission (phase).
3. Likely cause and checks, with what the data cannot tell.
4. Mission impact: tasks and handovers hit.
5. Data notice: "Simulated beverage plant (demo data)."
6. Next step. If the person only asked what happened, offer to compare re-plans. If they asked what
   to do ("what now?", "what should we do?"), load the `42de-mission-replan` skill and follow it in
   full, sections 2-5: 42de's proposal, the chosen what-ifs (including an infeasible one when any
   exists), the comparison table with exactly its columns, and the recommendation with its closing
   line. Do not build a different table of your own.

Never claim Claude can accept a re-plan, dispatch, stop or move robots. Any answer that recommends a
re-plan ends with exactly this line:

In a real deployment the planner accepts this re-plan in 42de; Claude cannot accept, dispatch, stop or move robots.
