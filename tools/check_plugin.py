#!/usr/bin/env python3
"""Pre-submission checks for the 42de plugin folder.

Usage: python3 tools/check_plugin.py [--publish] [plugin_dir]   (default: plugin)

Fails (exit 1, one message per violation) when:
- the folder does not exist or holds no files,
- it holds more than 512 files,
- a file is larger than 256 KiB,
- a file is binary or not valid UTF-8, except the plugin icon `.claude-plugin/icon.png`, which must
  start with the PNG signature (size check still applies),
- a file contains an http:// URL, except the exact local default
  `http://localhost:8080/mcp` inside a `${VAR:-...}` expansion in `.mcp.json`.
  Files named `LICENSE` skip only this http:// scan (the canonical Apache-2.0 text has
  http:// URLs and is kept byte-identical); size, binary and UTF-8 checks still apply.

With --publish (run before pushing the plugin for others to install), the local-default exemption is
dropped: any `http://` or `localhost` in `.mcp.json` fails, so the hosted demo URL must be the default.

Plain python3 only; it imports nothing from 42de.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

MAX_FILES = 512
MAX_BYTES = 256 * 1024
ALLOWED_HTTP = "http://localhost:8080/mcp"
HTTP_RE = re.compile(r"http://[^\s\"'<>)\]}]*", re.IGNORECASE)
# `${NAME:-http://localhost:8080/mcp}` -- the only http:// URL we accept, and only in .mcp.json.
ALLOWED_EXPANSION_RE = re.compile(r"\$\{[A-Za-z_][A-Za-z0-9_]*:-" + re.escape(ALLOWED_HTTP) + r"\}")


LOCALHOST_RE = re.compile(r"localhost", re.IGNORECASE)
ICON = ".claude-plugin/icon.png"
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


def check(plugin_dir: Path, publish: bool = False) -> list[str]:
    problems: list[str] = []
    if not plugin_dir.is_dir():
        return [f"{plugin_dir}: not a directory"]
    files = sorted(p for p in plugin_dir.rglob("*") if p.is_file())
    if not files:
        return [f"{plugin_dir}: no files"]
    if len(files) > MAX_FILES:
        problems.append(f"{plugin_dir}: {len(files)} files, the limit is {MAX_FILES}")
    for path in files:
        rel = path.relative_to(plugin_dir)
        size = path.stat().st_size
        if size > MAX_BYTES:
            problems.append(f"{rel}: {size} bytes, the limit is {MAX_BYTES} (256 KiB)")
        data = path.read_bytes()
        if rel.as_posix() == ICON:
            if not data.startswith(PNG_SIGNATURE):
                problems.append(f"{rel}: not a PNG file (the plugin icon must be a PNG)")
            continue
        if b"\x00" in data:
            problems.append(f"{rel}: binary file (contains NUL bytes)")
            continue
        try:
            text = data.decode("utf-8")
        except UnicodeDecodeError as exc:
            problems.append(f"{rel}: not valid UTF-8 ({exc.reason} at byte {exc.start})")
            continue
        if path.name == "LICENSE":
            continue  # canonical license text keeps its http:// URLs; only the URL scan is skipped
        scan = text
        if rel.as_posix() == ".mcp.json":
            if publish:
                for m in LOCALHOST_RE.finditer(text):
                    line = text.count("\n", 0, m.start()) + 1
                    problems.append(f"{rel}:{line}: localhost not allowed when publishing "
                                    f"(set the hosted demo URL as the default)")
                for m in re.finditer(r"\$\{", text):
                    line = text.count("\n", 0, m.start()) + 1
                    problems.append(f"{rel}:{line}: ${{...}} expansion not allowed when publishing "
                                    f"(claude.ai does not expand it; use the plain hosted URL)")
            else:
                scan = ALLOWED_EXPANSION_RE.sub("", scan)
        for m in HTTP_RE.finditer(scan):
            line = scan.count("\n", 0, m.start()) + 1
            problems.append(f"{rel}:{line}: plain http:// URL not allowed: {m.group(0)}")
    return problems


def main(argv: list[str]) -> int:
    args = argv[1:]
    publish = "--publish" in args
    args = [a for a in args if a != "--publish"]
    plugin_dir = Path(args[0]) if args else Path("plugin")
    problems = check(plugin_dir, publish=publish)
    for p in problems:
        print(f"FAIL {p}")
    if problems:
        print(f"check_plugin: {len(problems)} problem(s) in {plugin_dir}")
        return 1
    print(f"check_plugin: OK ({plugin_dir}{', publish mode' if publish else ''})")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
