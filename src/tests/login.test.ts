import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { login, testing } from "../commands/login.js";
import type { CreateCliLoginRequestPayload } from "../types/login.js";

test("normalizeApiUrl accepts HTTPS and strips trailing slashes", () => {
  assert.equal(
    testing.normalizeApiUrl("https://example.com///"),
    "https://example.com"
  );
});

test("normalizeApiUrl rejects insecure remote URLs", () => {
  assert.throws(
    () => testing.normalizeApiUrl("http://example.com"),
    /must use HTTPS/
  );
});

test("verifyToken sends the bearer token and returns the user", async () => {
  const token = `eit_${"a".repeat(43)}`;
  const user = await testing.verifyToken({
    apiUrl: "https://example.com",
    token,
    fetchImplementation: async (url, options) => {
      assert.equal(url, "https://example.com/api/cli/v1/auth/verify");
      assert.equal(
        new Headers(options?.headers).get("Authorization"),
        `Bearer ${token}`
      );
      return new Response(
        JSON.stringify({ user: { id: "user-1", email: "dev@example.com" } }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    },
  });

  assert.deepEqual(user, { id: "user-1", email: "dev@example.com" });
});

test("login opens an authorization URL and stores the locally generated token", async () => {
  const directory = await mkdtemp(join(tmpdir(), "eit-login-test-"));
  const previousConfigDirectory = process.env.EIT_CONFIG_DIR;
  let createRequestBody: CreateCliLoginRequestPayload | undefined;
  let openedUrl: string | undefined;

  try {
    process.env.EIT_CONFIG_DIR = directory;

    await login({
      apiUrl: "https://example.com",
      openBrowserImplementation: async (url) => {
        openedUrl = url;
        return true;
      },
      sleepImplementation: async () => undefined,
      fetchImplementation: async (url, options) => {
        if (url === "https://example.com/api/cli/v1/auth/requests") {
          const body = options?.body;

          if (typeof body !== "string") {
            throw new Error("Expected a JSON request body.");
          }

          createRequestBody = JSON.parse(body) as CreateCliLoginRequestPayload;
          return new Response(
            JSON.stringify({
              requestId: "request-1",
              pollSecret: `eit_poll_${"p".repeat(43)}`,
              authorizationUrl: "https://example.com/cli/authorize/request-1",
              expiresAt: new Date(Date.now() + 60_000).toISOString(),
              intervalSeconds: 1,
            }),
            { status: 201, headers: { "Content-Type": "application/json" } }
          );
        }

        if (url === "https://example.com/api/cli/v1/auth/requests/request-1") {
          return new Response(JSON.stringify({ status: "APPROVED" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        if (url === "https://example.com/api/cli/v1/auth/verify") {
          const authorization = new Headers(options?.headers).get("Authorization");

          if (!authorization || !createRequestBody) {
            throw new Error("Missing authorization test state.");
          }

          const token = authorization.replace("Bearer ", "");
          const tokenHash = createHash("sha256")
            .update(token, "utf8")
            .digest("hex");

          assert.equal(tokenHash, createRequestBody.tokenHash);
          assert.equal(token.slice(0, 12), createRequestBody.tokenPrefix);

          return new Response(
            JSON.stringify({
              user: { id: "user-1", email: "dev@example.com" },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }

        throw new Error(`Unexpected request: ${url}`);
      },
    });

    const credentials = JSON.parse(
      await readFile(join(directory, "credentials.json"), "utf8")
    );

    assert.equal(openedUrl, "https://example.com/cli/authorize/request-1");
    assert.match(credentials.token, /^eit_[A-Za-z0-9_-]{43}$/);
  } finally {
    if (previousConfigDirectory === undefined) {
      delete process.env.EIT_CONFIG_DIR;
    } else {
      process.env.EIT_CONFIG_DIR = previousConfigDirectory;
    }

    await rm(directory, { recursive: true, force: true });
  }
});

test("saveCredentials writes a user-only credentials file", async () => {
  const directory = await mkdtemp(join(tmpdir(), "eit-test-"));
  const previousConfigDirectory = process.env.EIT_CONFIG_DIR;

  try {
    process.env.EIT_CONFIG_DIR = directory;
    const credentialsPath = await testing.saveCredentials({
      apiUrl: "https://example.com",
      token: `eit_${"b".repeat(43)}`,
    });
    const credentials = JSON.parse(await readFile(credentialsPath, "utf8"));
    const fileStat = await stat(credentialsPath);

    assert.equal(credentials.apiUrl, "https://example.com");
    assert.equal(credentials.token, `eit_${"b".repeat(43)}`);
    assert.equal(fileStat.mode & 0o777, 0o600);
  } finally {
    if (previousConfigDirectory === undefined) {
      delete process.env.EIT_CONFIG_DIR;
    } else {
      process.env.EIT_CONFIG_DIR = previousConfigDirectory;
    }

    await rm(directory, { recursive: true, force: true });
  }
});
