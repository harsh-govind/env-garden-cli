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
import type { EncryptedVariable } from "../types/crypto.js";
import type { RemoteCipherVariable } from "../types/keys.js";
import { createFakeAccount, createFakeEnvironment, decryptAll, encryptAll } from "./fake-account.js";

const token = `eit_${"s".repeat(43)}`;
const variablesUrl =
  "https://example.com/api/cli/v1/workspaces/ws-1/projects/p-1/env-files/e-1/variables";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const account = await createFakeAccount(token);

async function createFakeServer(initial: RemoteVariable[]) {
  const environment = await createFakeEnvironment(account, "PRODUCTION");
  const state = {
    variables: await encryptAll(initial, "e-1", environment.material),
    puts: 0,
    lastPut: [] as EncryptedVariable[],
  };
  const fetchImplementation: CliFetch = async (input, init) => {
    const url = String(input);
    assert.equal(new Headers(init?.headers).get("Authorization"), `Bearer ${token}`);

    if (url === "https://example.com/api/cli/v1/auth/keys") {
      return json(account.keysResponse);
    }

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
      return json({ variables: state.variables, environmentKey: environment.environmentKey });
    }

    if (url === variablesUrl && init?.method === "PUT") {
      state.puts += 1;
      state.lastPut = (JSON.parse(String(init.body)) as { variables: EncryptedVariable[] }).variables;
      state.variables = state.lastPut.map((variable, position): RemoteCipherVariable => ({
        id: `v-put-${state.puts}-${position}`,
        position,
        ...variable,
      }));
      return json({ count: state.variables.length });
    }

    return json({ error: "not found" }, 404);
  };

  return {
    state,
    fetchImplementation,
    plainVariables: () => decryptAll(state.variables, "e-1", environment.material),
  };
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
    ...account.credentialShares,
    email: "dev@example.com",
    deviceName: "Test device",
    loggedInAt: new Date().toISOString(),
    expiresAt,
  });
}

test("link, pull, push and run work end to end against the API", async () => {
  await withTempWorkspace(async (directory) => {
    await login();
    const server = await createFakeServer([
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
    const before = server.state.variables.map((variable) => variable.encryptedValue);
    await push({ yes: true, fetchImplementation });
    assert.equal(server.state.puts, 1);
    assert.deepEqual(
      (await server.plainVariables()).map((variable) => [variable.key, variable.isCommented]),
      [["DATABASE_URL", false], ["OLD_FLAG", true], ["NEW_KEY", false]]
    );
    assert.equal(JSON.stringify(server.state.lastPut).includes("postgres://db"), false, "push sends ciphertext only");
    assert.deepEqual(
      server.state.lastPut.slice(0, 2).map((variable) => variable.encryptedValue),
      before,
      "unchanged variables keep their ciphertext"
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

test("EIT_TOKEN works without a credentials file", async () => {
  await withTempWorkspace(async (directory) => {
    const server = await createFakeServer([
      { key: "DEPLOY_KEY", value: "k1", note: null, isCommented: false },
    ]);
    const previousToken = process.env.EIT_TOKEN;
    const previousApiUrl = process.env.EIT_API_URL;

    try {
      process.env.EIT_TOKEN = [
        token,
        Buffer.from(account.clientShare).toString("base64url"),
        Buffer.from(account.wrapKey).toString("base64url"),
      ].join(".");
      process.env.EIT_API_URL = "https://example.com";

      await link({ workspace: "Acme", project: "api", env: "production", fetchImplementation: server.fetchImplementation });
      await pull({ fetchImplementation: server.fetchImplementation });
      assert.equal(await readFile(join(directory, ".env"), "utf8"), "DEPLOY_KEY=k1\n");

      process.env.EIT_TOKEN = `${token}.bad`;
      await assert.rejects(pull({ force: true, fetchImplementation: server.fetchImplementation }), /not a valid service account token/);
    } finally {
      if (previousToken === undefined) delete process.env.EIT_TOKEN;
      else process.env.EIT_TOKEN = previousToken;
      if (previousApiUrl === undefined) delete process.env.EIT_API_URL;
      else process.env.EIT_API_URL = previousApiUrl;
    }
  });
});
