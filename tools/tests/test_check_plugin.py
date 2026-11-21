"""Tests for tools/check_plugin.py. Plain python3; imports nothing from 42de."""
import importlib.util
from pathlib import Path

_SPEC = importlib.util.spec_from_file_location(
    "check_plugin", Path(__file__).resolve().parents[1] / "check_plugin.py"
)
check_plugin = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(check_plugin)

MCP_OK = '{"mcpServers": {"42de-demo": {"type": "http", "url": "${FORTYTWODE_DEMO_MCP_URL:-http://localhost:8080/mcp}"}}}'


def _plugin(tmp_path, files):
    root = tmp_path / "plugin"
    for rel, content in files.items():
        p = root / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        if isinstance(content, bytes):
            p.write_bytes(content)
        else:
            p.write_text(content, encoding="utf-8")
    return root


def test_clean_plugin_passes(tmp_path):
    root = _plugin(tmp_path, {".mcp.json": MCP_OK, "README.md": "See https://example.org."})
    assert check_plugin.check(root) == []
    assert check_plugin.main(["x", str(root)]) == 0


def test_missing_dir_fails(tmp_path):
    assert check_plugin.check(tmp_path / "nope")
    assert check_plugin.main(["x", str(tmp_path / "nope")]) == 1


def test_large_file_fails(tmp_path):
    root = _plugin(tmp_path, {"big.md": "a" * (256 * 1024 + 1), "ok.md": "a" * (256 * 1024)})
    problems = check_plugin.check(root)
    assert len(problems) == 1 and problems[0].startswith("big.md")


def test_too_many_files_fails(tmp_path):
    root = _plugin(tmp_path, {f"f{i}.md": "x" for i in range(513)})
    assert any("513 files" in p for p in check_plugin.check(root))


def test_binary_and_non_utf8_fail(tmp_path):
    root = _plugin(tmp_path, {"a.png": b"\x89PNG\x00\x01", "b.md": b"caf\xe9"})
    problems = check_plugin.check(root)
    assert any(p.startswith("a.png") and "binary" in p for p in problems)
    assert any(p.startswith("b.md") and "UTF-8" in p for p in problems)


PNG_MAGIC = b"\x89PNG\r\n\x1a\n"


def test_plugin_icon_png_is_the_one_allowed_binary(tmp_path):
    root = _plugin(tmp_path, {".claude-plugin/icon.png": PNG_MAGIC + b"\x00\x00rest"})
    assert check_plugin.check(root, publish=True) == []


def test_icon_must_really_be_a_png(tmp_path):
    root = _plugin(tmp_path, {".claude-plugin/icon.png": b"GIF89a\x00\x00"})
    assert any("icon.png" in p and "PNG" in p for p in check_plugin.check(root))


def test_png_elsewhere_is_still_binary(tmp_path):
    root = _plugin(tmp_path, {"skills/x/icon.png": PNG_MAGIC + b"\x00"})
    assert any("binary" in p for p in check_plugin.check(root))


def test_http_url_fails_anywhere_but_mcp_default(tmp_path):
    root = _plugin(
        tmp_path,
        {
            ".mcp.json": MCP_OK,
            "README.md": "Run it at http://localhost:8080/mcp locally.",
        },
    )
    problems = check_plugin.check(root)
    assert len(problems) == 1 and problems[0].startswith("README.md:1")


def test_http_in_mcp_json_outside_default_fails(tmp_path):
    bad = '{"mcpServers": {"x": {"type": "http", "url": "http://localhost:8080/mcp"}}}'
    other = MCP_OK.replace("8080", "9090")
    assert check_plugin.check(_plugin(tmp_path / "a", {".mcp.json": bad}))
    assert check_plugin.check(_plugin(tmp_path / "b", {".mcp.json": other}))


APACHE_LINE = "                        http://www.apache.org/licenses/\n"


def test_license_skips_only_the_http_scan(tmp_path):
    root = _plugin(tmp_path, {"LICENSE": APACHE_LINE, "NOTICE.md": APACHE_LINE})
    problems = check_plugin.check(root)
    assert len(problems) == 1 and problems[0].startswith("NOTICE.md:1")


def test_license_still_gets_size_and_encoding_checks(tmp_path):
    big = _plugin(tmp_path / "a", {"LICENSE": "a" * (256 * 1024 + 1)})
    latin = _plugin(tmp_path / "b", {"LICENSE": b"caf\xe9"})
    assert any(p.startswith("LICENSE") for p in check_plugin.check(big))
    assert any("UTF-8" in p for p in check_plugin.check(latin))


MCP_HOSTED = '{"mcpServers": {"42de-demo": {"type": "http", "url": "https://demo.example.org/mcp"}}}'


def test_publish_mode_rejects_local_default(tmp_path):
    root = _plugin(tmp_path, {".mcp.json": MCP_OK})
    assert check_plugin.check(root) == []                    # dev mode: exemption holds
    problems = check_plugin.check(root, publish=True)
    assert problems and all(p.startswith(".mcp.json") for p in problems)
    assert any("localhost" in p for p in problems) and any("http://" in p for p in problems)
    assert check_plugin.main(["x", "--publish", str(root)]) == 1
    assert check_plugin.main(["x", str(root)]) == 0


def test_publish_mode_rejects_bare_localhost(tmp_path):
    root = _plugin(tmp_path, {".mcp.json": MCP_OK.replace("http://localhost", "https://localhost")})
    problems = check_plugin.check(root, publish=True)
    assert any("localhost" in p for p in problems)


def test_publish_mode_accepts_hosted_https(tmp_path):
    root = _plugin(tmp_path, {".mcp.json": MCP_HOSTED})
    assert check_plugin.check(root, publish=True) == []
    assert check_plugin.main(["x", "--publish", str(root)]) == 0


def test_publish_mode_rejects_env_expansion(tmp_path):
    # claude.ai shows ${VAR:-default} literally and refuses it ("Replace the placeholder in braces").
    expanded = MCP_HOSTED.replace('"https://demo.example.org/mcp"', '"${X:-https://demo.example.org/mcp}"')
    root = _plugin(tmp_path, {".mcp.json": expanded})
    problems = check_plugin.check(root, publish=True)
    assert problems and any("expansion" in p for p in problems)
