import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { link } from "../commands/link.js";
import { pull } from "../commands/pull.js";
import { push } from "../commands/push.js";
import { run } from "../commands/run.js";
import { saveCredentials } from "../lib/credentials.js";
import type { CliFetch, RemoteVariable } from "../types/api.js";

const token = `eit_${"s".repeat(43)}`;
const variablesUrl =
  "https://example.com/api/cli/v1/workspaces/ws-1/projects/p-1/env-files/e-1/variables";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** In-memory fake of the Env Garden CLI API. */
function createFakeServer(initial: RemoteVariable[]) {
  const state = { variables: initial, puts: 0 };
  const fetchImplementation: CliFetch = async (input, init) => {
    const url = String(input);
    assert.equal(new Headers(init?.headers).get("Authorization"), `Bearer ${token}`);

    if (url === "https://example.com/api/cli/v1/projects") {
      return json({
        workspaces: [
          {
            id: "ws-1",
            name: "Acme",
            projects: [
              {
                id: "p-1",
                name: "api",
                envFiles: [
                  { id: "e-1", name: ".env.production", environment: "production", variableCount: 2 },
                  { id: "e-2", name: ".env.development", environment: "development", variableCount: 0 },
                ],
              },
            ],
          },
        ],
      });
    }

    if (url === variablesUrl && (init?.method ?? "GET") === "GET") {
      return json({ variables: state.variables });
    }

    if (url === variablesUrl && init?.method === "PUT") {
      state.puts += 1;
      state.variables = (JSON.parse(String(init.body)) as { variables: RemoteVariable[] }).variables;
      return json({ count: state.variables.length });
    }

    return json({ error: "not found" }, 404);
  };

  return { state, fetchImplementation };
}

async function withTempWorkspace(fn: (directory: string) => Promise<void>) {
  const directory = await mkdtemp(join(tmpdir(), "eit-sync-test-"));
  const previousCwd = process.cwd();
  const previousConfigDirectory = process.env.EIT_CONFIG_DIR;

  try {
    process.env.EIT_CONFIG_DIR = join(directory, "config");
    process.chdir(directory);
    await fn(directory);
  } finally {
    process.chdir(previousCwd);

    if (previousConfigDirectory === undefined) {
      delete process.env.EIT_CONFIG_DIR;
    } else {
      process.env.EIT_CONFIG_DIR = previousConfigDirectory;
    }

    await rm(directory, { recursive: true, force: true });
  }
}

async function login(expiresAt = new Date(Date.now() + 86_400_000).toISOString()) {
  await saveCredentials({
    apiUrl: "https://example.com",
    token,
    email: "dev@example.com",
    deviceName: "Test device",
    loggedInAt: new Date().toISOString(),
    expiresAt,
  });
}

test("link, pull, push and run work end to end against the API", async () => {
  await withTempWorkspace(async (directory) => {
    await login();
    const server = createFakeServer([
      { key: "DATABASE_URL", value: "postgres://db", note: "Primary database", isCommented: false },
      { key: "OLD_FLAG", value: "on", note: null, isCommented: true },
    ]);
    const { fetchImplementation } = server;

    await link({ workspace: "Acme", project: "api", env: "production", fetchImplementation });
    const linkFile = JSON.parse(await readFile(join(directory, ".eit.json"), "utf8"));
    assert.equal(linkFile.envFileId, "e-1");
    assert.equal(JSON.stringify(linkFile).includes(token), false);

    await pull({ fetchImplementation });
    const pulled = await readFile(join(directory, ".env"), "utf8");
    assert.equal(pulled, "# Primary database\nDATABASE_URL=postgres://db\n# OLD_FLAG=on\n");
    assert.equal((await stat(join(directory, ".env"))).mode & 0o777, 0o600);

    await writeFile(join(directory, ".env"), `${pulled}NEW_KEY=hello\n`);
    await push({ yes: true, fetchImplementation });
    assert.equal(server.state.puts, 1);
    assert.deepEqual(
      server.state.variables.map((variable) => [variable.key, variable.isCommented]),
      [["DATABASE_URL", false], ["OLD_FLAG", true], ["NEW_KEY", false]]
    );

    await push({ yes: true, fetchImplementation });
    assert.equal(server.state.puts, 1, "unchanged file should not be pushed again");

    const exitCode = await run({
      command: [
        process.execPath,
        "-e",
        "process.exit(process.env.NEW_KEY === 'hello' && process.env.OLD_FLAG === undefined ? 0 : 3)",
      ],
      fetchImplementation,
    });
    assert.equal(exitCode, 0, "run injects active variables and skips commented ones");
  });
});

test("commands fail clearly when the session expired", async () => {
  await withTempWorkspace(async () => {
    await login(new Date(Date.now() - 1000).toISOString());
    await assert.rejects(pull(), /session has expired/);
  });
});

test("a revoked token surfaces a re-login message", async () => {
  await withTempWorkspace(async () => {
    await login();
    await assert.rejects(
      link({
        workspace: "Acme",
        fetchImplementation: async () => json({ error: "revoked" }, 401),
      }),
      /eit login/
    );
  });
});
