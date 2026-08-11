import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { logout } from "../commands/logout.js";
import { status } from "../commands/status.js";
import {
  readCredentials,
  saveCredentials,
} from "../lib/credentials.js";

test("status reports stored credentials and logout revokes the token", async () => {
  const directory = await mkdtemp(join(tmpdir(), "eit-account-test-"));
  const previousConfigDirectory = process.env.EIT_CONFIG_DIR;
  const token = `eit_${"c".repeat(43)}`;
  let revokeRequestReceived = false;

  try {
    process.env.EIT_CONFIG_DIR = directory;
    await saveCredentials({
      apiUrl: "https://example.com",
      token,
      email: "dev@example.com",
      deviceName: "Test device",
      loggedInAt: "2026-08-12T00:00:00.000Z",
    });

    await status();
    await logout({
      fetchImplementation: async (url, options) => {
        assert.equal(url, "https://example.com/api/cli/v1/auth/token");
        assert.equal(options?.method, "DELETE");
        assert.equal(
          new Headers(options?.headers).get("Authorization"),
          `Bearer ${token}`
        );
        revokeRequestReceived = true;
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    });

    assert.equal(revokeRequestReceived, true);
    assert.equal(await readCredentials(), null);
  } finally {
    if (previousConfigDirectory === undefined) {
      delete process.env.EIT_CONFIG_DIR;
    } else {
      process.env.EIT_CONFIG_DIR = previousConfigDirectory;
    }

    await rm(directory, { recursive: true, force: true });
  }
});
