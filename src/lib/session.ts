import { DEFAULT_API_URL, ENVIRONMENT_TOKEN_PATTERN } from "../constants/index.js";
import { normalizeApiUrl } from "./api-url.js";
import { readCredentials } from "./credentials.js";
import type { StoredCliCredentials } from "../types/credentials.js";

function fromBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("base64");
}

export function readEnvironmentToken(): StoredCliCredentials | null {
  const raw = process.env.EIT_TOKEN?.trim();

  if (!raw) {
    return null;
  }

  const match = ENVIRONMENT_TOKEN_PATTERN.exec(raw);

  if (!match || !match[1] || !match[2] || !match[3]) {
    throw new Error("EIT_TOKEN is not a valid service account token. Create a new one in Env Garden.");
  }

  return {
    apiUrl: normalizeApiUrl(process.env.EIT_API_URL || DEFAULT_API_URL),
    token: match[1],
    clientShare: fromBase64Url(match[2]),
    wrapKey: fromBase64Url(match[3]),
    deviceName: "EIT_TOKEN",
  };
}

export async function requireCredentials(): Promise<StoredCliCredentials> {
  const environmentToken = readEnvironmentToken();

  if (environmentToken) {
    return environmentToken;
  }

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
