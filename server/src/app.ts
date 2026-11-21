import express from "express";
import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Fixtures } from "./fixtures.js";
import { registerDemoTools } from "./tools.js";

const INSTRUCTIONS =
  "42de demo: a simulated beverage-plant robot mission with two robot-failure scenarios. Read-only. " +
  "Re-plans are real 42de CP-SAT results computed offline. This server cannot operate, stop or dispatch robots.";

// ../package.json resolves from both src/ (tsx) and dist/ (built).
const VERSION: string = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
).version;

/**
 * Default per-IP limit. Deliberately high: claude.ai connectors reach the server from shared Anthropic
 * egress IPs, so one "IP" can be many users. The hosting cap (Web Function max environments + rate limit) is the global cost cap.
 */
export const DEFAULT_RATE_PER_MINUTE = 600;

/** Per-IP fixed-window limiter, in memory (per instance). */
function rateLimit(limit: number, windowMs = 60_000): express.RequestHandler {
  const hits = new Map<string, { count: number; resetAt: number }>();
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
  }, windowMs);
  sweep.unref();
  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip ?? "unknown";
    let e = hits.get(key);
    if (!e || e.resetAt <= now) {
      e = { count: 0, resetAt: now + windowMs };
      hits.set(key, e);
    }
    e.count++;
    if (e.count > limit) {
      res.set("Retry-After", String(Math.max(1, Math.ceil((e.resetAt - now) / 1000))));
      res.status(429).json({ jsonrpc: "2.0", error: { code: -32029, message: "Rate limit exceeded" }, id: null });
      return;
    }
    next();
  };
}

export function buildApp(opts: { fixtures: Fixtures; ratePerMinute?: number }): express.Express {
  const { fixtures } = opts;
  const app = express();
  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  // Outside the limiter: health checks and uptime probes.
  app.get("/healthz", (_req, res) => {
    res.json({
      ok: true,
      scenarios: fixtures.scenarios.size,
      fortytwode_commit: fixtures.manifest.fortytwode_commit,
    });
  });

  app.use("/mcp", rateLimit(opts.ratePerMinute ?? DEFAULT_RATE_PER_MINUTE));
  app.use("/mcp", express.json({ limit: "64kb" }));

  // Stateless Streamable HTTP: a fresh server + transport per request.
  app.post("/mcp", async (req, res) => {
    const server = new McpServer({ name: "42de-demo", version: VERSION }, { instructions: INSTRUCTIONS });
    registerDemoTools(server, fixtures);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => {
      transport.close().catch(() => {});
      server.close().catch(() => {});
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch {
      if (!res.headersSent) {
        res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Internal error" }, id: null });
      }
    }
  });
  app.all("/mcp", (_req, res) => {
    res
      .status(405)
      .set("Allow", "POST")
      .json({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed (stateless server: use POST)" }, id: null });
  });

  // Body-parser failures (too large, bad JSON): JSON-RPC error. Logs the error type and status only:
  // error messages can quote the request (JSON.parse does), and the privacy policy promises they don't.
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const kind = typeof err?.type === "string" ? err.type : typeof err?.name === "string" ? err.name : "unknown";
    console.error(`request error: ${kind} (${typeof err?.status === "number" ? err.status : 500})`);
    const status = typeof err?.status === "number" && err.status >= 400 && err.status < 500 ? err.status : 500;
    res.status(status).json({
      jsonrpc: "2.0",
      error: { code: status === 500 ? -32603 : -32700, message: status === 500 ? "Internal error" : "Bad request" },
      id: null,
    });
  });

  return app;
}
