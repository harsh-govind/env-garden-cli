import { readCredentials } from "./credentials.js";
import type { StoredCliCredentials } from "../types/credentials.js";

/** Returns stored credentials, or throws a helpful error when logged out/expired. */
export async function requireCredentials(): Promise<StoredCliCredentials> {
  const stored = await readCredentials();

  if (!stored) {
    throw new Error("Not logged in. Run `eit login` first.");
  }

  const { expiresAt } = stored.credentials;

  if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
    throw new Error("Your session has expired. Run `eit login` to sign in again.");
  }

  return stored.credentials;
}
