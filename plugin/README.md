# 42de plugin for Claude (demo)

42de plans missions for mixed robot fleets and re-plans them when a robot fails. This plugin lets Claude
explain such a re-plan to a factory planner: it reads the alert and the robot's status, shows which
tasks and handovers are hit, explains 42de's re-plan proposal, and compares what-ifs in one table with a
recommendation.

This version is a **demo with simulated data**: a simulated beverage plant with 13 robots, 24 tasks and
5 phases. The plans and re-plans are real output of 42de's CP-SAT solver, computed offline. The connector
is read-only. Claude never operates robots: in a real deployment the planner accepts a re-plan in 42de,
and Claude cannot accept, dispatch, stop or move robots.

## Skills

| Skill | What it does |
|---|---|
| `try-42de-demo` | Checks the connector, lists the scenarios, suggests a first prompt for each |
| `42de-robot-failure-diagnosis` | Explains a robot failure, safety states first, then cause and mission impact |
| `42de-mission-replan` | 42de's proposal, 2-4 what-ifs, a comparison table and a recommendation |
| `42de-mission-data` | The mission data model, the tools and the safety rules |

## Connector tools

The `42de-demo` MCP server has seven read-only tools: `list_demo_scenarios`, `get_mission`,
`get_robot_status`, `list_mission_alerts`, `get_replan_proposal`, `list_what_ifs` and `simulate_replan`.

## Install

In Claude Code:

```
/plugin marketplace add GGullo42/42de-claude-plugin
/plugin install 42de@42de
```

## Try it

1. Install the plugin (above). Its connector points at the hosted 42de demo server, so there is nothing
   to start or configure.
2. Ask: "try the 42de demo", "the jacking AMR failed, what now?" or "compare re-plans for the cost cascade".

The cost cascade happens in phase 5, the mission's last phase, so it offers no `wait:<phase>` what-ifs:
there is no later phase to wait for the robot.

Developers who want to run their own demo server: see the repository README.

## License

Apache-2.0. See `LICENSE`.

## Support

Help, troubleshooting and contact: https://42de.tech/support

## Privacy

The demo connector stores no request records and receives no prompt text. Details: https://42de.tech/privacy/claude-demo
