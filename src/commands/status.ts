import { verifySession } from "../lib/api.js";
import { readCredentials } from "../lib/credentials.js";
import { formatDateTime } from "../lib/format.js";
import { findProjectLink } from "../lib/project-config.js";
import type { StatusOptions } from "../types/commands.js";

export async function status(options: StatusOptions = {}): Promise<void> {
  const storedCredentials = await readCredentials();
  const found = await findProjectLink();

  if (!storedCredentials) {
    console.log("Status: Not logged in");
    console.log("Run eit login to connect your Env Garden account.");
    return;
  }

  const { credentials, credentialsPath, modifiedAt } = storedCredentials;
  let sessionState = "Active";
  let expiresAt = credentials.expiresAt ?? null;

  try {
    const session = await verifySession({
      apiUrl: credentials.apiUrl,
      token: credentials.token,
      ...(options.fetchImplementation
        ? { fetchImplementation: options.fetchImplementation }
        : {}),
    });
    expiresAt = session.expiresAt ?? expiresAt;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    sessionState = /expired|revoked|invalid/i.test(message)
      ? "Expired or revoked — run eit login"
      : `Unknown (${message || "could not reach Env Garden"})`;
  }

  console.log(`Status: Logged in`);
  console.log(`Email: ${credentials.email || "Unknown (log in again to refresh)"}`);
  console.log(`Session: ${sessionState}`);
  console.log(`Expires: ${expiresAt ? formatDateTime(expiresAt) : "Unknown"}`);
  console.log(`API URL: ${credentials.apiUrl}`);
  console.log(`Device: ${credentials.deviceName || "Unknown"}`);
  console.log(`Logged in at: ${formatDateTime(credentials.loggedInAt || modifiedAt)}`);
  console.log(`Credentials: ${credentialsPath}`);
  console.log(
    found
      ? `Linked: ${found.link.workspaceName} / ${found.link.projectName} / ${found.link.envFileName}`
      : "Linked: no (run eit link)"
  );
}
