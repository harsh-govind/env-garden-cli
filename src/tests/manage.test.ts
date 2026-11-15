import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { historyCommand } from "../commands/history.js";
import { memberCommand } from "../commands/member.js";
import { projectCommand } from "../commands/project.js";
import { workspaceCommand } from "../commands/workspace.js";
import { CLI_VALUE_FLAGS } from "../constants/index.js";
import { parseArgs } from "../lib/args.js";
import { saveCredentials } from "../lib/credentials.js";
import type { CliFetch } from "../types/api.js";

const token = `eit_${"m".repeat(43)}`;
const workspace = {
  id: "ws-1",
  name: "Acme",
  role: "OWNER",
  projectAccessScope: "ALL_PROJECTS",
  projectCount: 1,
  memberCount: 1,
  historyCount: 3,
  projects: [{ id: "p-1", name: "api" }],
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function createFakeApi() {
  const requests: { method: string; path: string; body: unknown }[] = [];
  const fetchImplementation: CliFetch = async (input, init) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    requests.push({ method, path: url.pathname + url.search, body });
    assert.equal(new Headers(init?.headers).get("Authorization"), `Bearer ${token}`);

    if (url.pathname === "/api/workspaces" && method === "GET") return json({ workspaces: [{ id: "ws-1", name: "Acme" }] });
    if (url.pathname === "/api/workspaces" && method === "POST") return json({ workspaceId: "ws-new" }, 201);
    if (url.pathname === "/api/workspaces/ws-1") return json({ workspace });
    if (url.pathname === "/api/workspaces/ws-1/projects" && method === "POST") return json({ project: { id: "p-2", name: body.name } }, 201);
    if (url.pathname === "/api/workspaces/ws-1/projects/p-2") {
      return json({ project: { id: "p-2", name: "web", role: "OWNER", envFiles: [{ id: "e-1", name: ".env.production", environment: "PRODUCTION", variableCount: 0 }] } });
    }
    if (url.pathname === "/api/workspaces/ws-1/members" && method === "POST") return json({ invite: {} }, 201);
    if (url.pathname === "/api/workspaces/ws-1/history") {
      const cursor = url.searchParams.get("cursor");
      const page = cursor ? 2 : 1;
      return json({
        history: [1, 2].map((n) => ({ id: `h${page}${n}`, operation: "X", message: `entry ${page}.${n}`, createdAt: "2026-11-15T10:00:00.000Z" })),
        hasMore: page === 1,
        nextCursor: page === 1 ? "c2" : null,
      });
    }

    return json({ error: `unexpected ${method} ${url.pathname}` }, 404);
  };

  return { requests, fetchImplementation };
}

async function withLogin(fn: () => Promise<void>) {
  const directory = await mkdtemp(join(tmpdir(), "eit-manage-test-"));
  const previous = process.env.EIT_CONFIG_DIR;
  const previousCwd = process.cwd();

  try {
    process.env.EIT_CONFIG_DIR = join(directory, "config");
    process.chdir(directory);
    await saveCredentials({
      apiUrl: "https://example.com",
      token,
      email: "dev@example.com",
      deviceName: "test",
      loggedInAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    });
    await fn();
  } finally {
    process.chdir(previousCwd);
    if (previous === undefined) delete process.env.EIT_CONFIG_DIR;
    else process.env.EIT_CONFIG_DIR = previous;
    await rm(directory, { recursive: true, force: true });
  }
}

const parse = (args: string[]) => parseArgs(args, CLI_VALUE_FLAGS);

test("workspace create posts the name and reads workspaceId", async () => {
  await withLogin(async () => {
    const api = createFakeApi();
    await workspaceCommand({ parsed: parse(["workspace", "create", "New WS"]), fetchImplementation: api.fetchImplementation });
    assert.deepEqual(api.requests.at(-1), { method: "POST", path: "/api/workspaces", body: { name: "New WS" } });
  });
});

test("project create sends uppercase environments", async () => {
  await withLogin(async () => {
    const api = createFakeApi();
    await projectCommand({
      parsed: parse(["project", "create", "web", "--environments", "production"]),
      fetchImplementation: api.fetchImplementation,
    });
    const create = api.requests.find((request) => request.method === "POST");
    assert.deepEqual(create?.body, { name: "web", environments: ["PRODUCTION"] });
  });
});

test("member invite sends the same access payload as the web form", async () => {
  await withLogin(async () => {
    const api = createFakeApi();
    await memberCommand({
      parsed: parse(["member", "invite", "a@b.dev", "--projects", "api", "--project-role", "contributor"]),
      fetchImplementation: api.fetchImplementation,
    });
    const invite = api.requests.find((request) => request.method === "POST");
    assert.deepEqual(invite?.body, {
      email: "a@b.dev",
      role: "MEMBER",
      projectAccessScope: "SELECTED_PROJECTS",
      defaultProjectRole: "CONTRIBUTOR",
      projects: [{ projectId: "p-1", role: "CONTRIBUTOR", environmentAccessScope: "ALL_ENVIRONMENTS", environments: [] }],
    });
  });
});

test("history follows cursors up to --limit", async () => {
  await withLogin(async () => {
    const api = createFakeApi();
    await historyCommand({ parsed: parse(["history", "--limit", "3"]), fetchImplementation: api.fetchImplementation });
    const historyCalls = api.requests.filter((request) => request.path.includes("/history"));
    assert.equal(historyCalls.length, 2);
    assert.match(historyCalls[1]?.path ?? "", /cursor=c2/);
  });
});
