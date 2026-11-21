---
name: try-42de-demo
description: "This skill should be used when someone wants to try, start, set up, test or troubleshoot the 42de demo or its connector, e.g. \"try the 42de demo\", \"what can the 42de plugin do\", \"is the 42de connector working\", \"show me the 42de scenarios\"."
---

# Try the 42de demo

Check that the demo connector responds, show the scenarios, and suggest a first prompt for each.
Follow the `42de-mission-data` rules.

## 1. Check the connector

Call `list_demo_scenarios`.
- The tool is missing -> the `42de-demo` connector is not enabled or not reachable. Say so, and suggest
  checking that the 42de plugin is installed and enabled (`/plugin`) and then restarting Claude Code. The
  connector talks to a hosted demo server; nothing needs to be started locally.
- The call fails -> report the error as returned; the hosted demo server may be briefly unavailable or
  rate limited, so suggest trying again in a minute.
- The call works -> continue.

## 2. Introduce the demo

In a few sentences:
- The mission is the one `list_demo_scenarios` names ("Simulated beverage plant (demo data)"): a mixed
  fleet of humanoids, cobots, composite robots, forklifts and AMRs working through five phases, from
  inbound receiving to outbound dispatch.
- The data is simulated. Each scenario is a fixed snapshot of a robot failure; 42de's re-plans and
  what-ifs are real CP-SAT solver output, computed offline.
- Everything is read-only. Claude explains and compares re-plans; in a real deployment the planner
  accepts a re-plan in 42de, and Claude cannot accept, dispatch, stop or move robots.

## 3. List the scenarios

A short table: scenario id, title, failed robot, one-line summary, taken from the tool result. Do not
add scenarios that the tool did not return.

## 4. Suggest a first prompt for each

One suggestion per scenario, matched to what it shows, for example:
- `amr-error-clean` (a robot fault early in the mission, clean re-plan): "The jacking AMR failed, what now?"
- `cost-cascade` (every task still covered, but cost rises and a handover gets a new partner):
  "Compare re-plans for the cost cascade."

Add one general prompt: "What does the 42de mission look like?" Then offer to start with either scenario.
