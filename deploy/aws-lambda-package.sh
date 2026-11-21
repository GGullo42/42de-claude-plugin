#!/usr/bin/env bash
# Build the zip for the 42de demo MCP server on AWS Lambda. Run by the owner; uploads nothing.
# One zip serves both Lambda styles:
#   - Web Function (the console's "Create Web Function"): the runtime loads index.js, which maps
#     AWS_LAMBDA_HTTP_ENDPOINT (host:port) to PORT and starts the server.
#   - Classic function + Lambda Web Adapter layer: handler run.sh, server on 8080.
#   ./deploy/aws-lambda-package.sh
# Output: deploy/out/42de-demo-mcp-lambda.zip (upload it as the code of an AWS Lambda Web Function).
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$PWD"
OUT_DIR="$ROOT/deploy/out"
ZIP="$OUT_DIR/42de-demo-mcp-lambda.zip"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# Copy only what the build needs; never the local node_modules or dist.
cp server/package.json server/package-lock.json server/tsconfig.json "$WORK/"
cp -R server/src server/fixtures "$WORK/"

(
  cd "$WORK"
  npm ci --no-audit --no-fund
  npm run build
  npm prune --omit=dev --no-audit --no-fund
  rm -rf src tsconfig.json
  # The Lambda Web Adapter starts this script; the server listens on 8080 (AWS_LWA_PORT).
  printf '#!/bin/bash\nexport NODE_ENV=production\nexec node dist/main.js\n' > run.sh
  chmod 755 run.sh
  # Web Function entry point: listen where Lambda says (AWS_LAMBDA_HTTP_ENDPOINT = host:port).
  cat > index.js <<'JS'
import { fileURLToPath } from "node:url";
const ep = process.env.AWS_LAMBDA_HTTP_ENDPOINT;
if (ep) process.env.PORT = ep.slice(ep.lastIndexOf(":") + 1);
process.env.FIXTURES_DIR ??= fileURLToPath(new URL("./fixtures", import.meta.url));
process.env.NODE_ENV ??= "production";
await import("./dist/main.js");
JS
)

mkdir -p "$OUT_DIR"
rm -f "$ZIP"
(cd "$WORK" && zip -qrX "$ZIP" index.js run.sh package.json dist node_modules fixtures)

echo "Wrote $ZIP ($(du -h "$ZIP" | cut -f1))"
echo "Next: upload it in the Lambda console."
