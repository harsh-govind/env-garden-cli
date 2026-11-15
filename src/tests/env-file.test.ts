import assert from "node:assert/strict";
import test from "node:test";
import { buildEnvText, parseEnvText } from "../lib/env-file.js";
import { parseArgs } from "../lib/args.js";
import { diffVariables } from "../commands/push.js";

test("parseEnvText keeps comments as notes and commented-out variables", () => {
  const parsed = parseEnvText(`# Database
# primary
DATABASE_URL="postgres://u:p@h/db"
#TYPE="blabla"
export PORT=3000 # web port
URL=https://x.dev/#frag`);

  assert.deepEqual(parsed, [
    { key: "DATABASE_URL", value: "postgres://u:p@h/db", note: "Database\nprimary", isCommented: false },
    { key: "TYPE", value: "blabla", note: "", isCommented: true },
    { key: "PORT", value: "3000", note: "web port", isCommented: false },
    { key: "URL", value: "https://x.dev/#frag", note: "", isCommented: false },
  ]);
});

test("buildEnvText round-trips through parseEnvText", () => {
  const entries = [
    { key: "A", value: "has spaces # and hash", note: "multi\nline", isCommented: false },
    { key: "B", value: "line1\nline2", note: "", isCommented: true },
    { key: "C", value: "", note: "", isCommented: false },
  ];

  assert.deepEqual(parseEnvText(buildEnvText(entries)), entries);
});

test("parseArgs separates flags, values and passthrough", () => {
  const parsed = parseArgs(
    ["run", "--env", "production", "--", "node", "server.js", "--port", "3000"],
    new Set(["--env"])
  );

  assert.equal(parsed.command, "run");
  assert.equal(parsed.flags.get("--env"), "production");
  assert.deepEqual(parsed.passthrough, ["node", "server.js", "--port", "3000"]);
  assert.throws(() => parseArgs(["pull", "--env"], new Set(["--env"])), /requires a value/);
});

test("diffVariables reports added, changed and removed keys", () => {
  const remote = [
    { key: "KEEP", value: "1", note: null, isCommented: false },
    { key: "CHANGE", value: "old", note: null, isCommented: false },
    { key: "GONE", value: "x", note: null, isCommented: false },
  ];
  const local = [
    { key: "KEEP", value: "1", note: null, isCommented: false },
    { key: "CHANGE", value: "old", note: null, isCommented: true },
    { key: "NEW", value: "y", note: null, isCommented: false },
  ];

  assert.deepEqual(diffVariables(local, remote), {
    added: ["NEW"],
    removed: ["GONE"],
    changed: ["CHANGE"],
  });
});
