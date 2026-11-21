# 42de plugin for Claude

A Claude plugin and a demo MCP server for [42de](https://42de.tech), the robot-mission platform.
Claude reads a **simulated** beverage-plant mission: when a robot fails mid-mission, it reads the alert
and robot status, explains 42de's re-plan proposal and compares what-ifs. The re-plans are real 42de
results computed in advance. The demo is read-only: Claude never operates robots.

- `plugin/` - the Claude plugin (skills, connector config, icon).
- `server/` - the demo MCP server, hosted at `https://demo.42de.tech/mcp`.
- `deploy/` - builds the server zip for AWS Lambda.
- `tools/check_plugin.py` - pre-publish checks for the plugin folder.

## Install

In Claude Code:

```
/plugin marketplace add GGullo42/42de-claude-plugin
/plugin install 42de@42de
```

In Claude (web or desktop), add a custom connector with the URL `https://demo.42de.tech/mcp` and no
sign-in. Help: https://42de.tech/support. Privacy: https://42de.tech/privacy/claude-demo.

## Developing against a local server

```sh
cd server && npm ci && npm run dev          # serves http://localhost:8080/mcp
claude --plugin-dir plugin                   # after pointing plugin/.mcp.json at the local URL
```

`plugin/.mcp.json` holds the plain hosted URL, because claude.ai does not expand `${VAR:-default}`.
For local work, change its `url` to `http://localhost:8080/mcp` and change it back before pushing:
`python3 tools/check_plugin.py --publish plugin` fails on any localhost, `http://` or `${...}` there.

Tests: `cd server && npm test`, and `python3 -m pytest tools/tests`.

Licensed under Apache-2.0 (see `LICENSE`).
