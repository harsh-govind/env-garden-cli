import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { hostname, platform } from "node:os";
import {
  CLI_USER_AGENT,
  DEFAULT_API_URL,
  LOGIN_EXPIRY_GRACE_MS,
  LOGIN_TIMEOUT_MS,
  MAX_POLLING_INTERVAL_SECONDS,
  REQUEST_TIMEOUT_MS,
  TOKEN_PATTERN,
} from "../constants/index.js";
import { isRecord, parseResponse, verifyToken } from "../lib/api.js";
import {
  getConfigDirectory,
  saveCredentials,
} from "../lib/credentials.js";
import type {
  CliLoginRequest,
  CliLoginStatus,
  LocalCliToken,
  LoginOptions,
  ReadAuthorizationStatusInput,
  RequestAuthorizationInput,
} from "../types/login.js";

function normalizeApiUrl(rawApiUrl: string): string {
  const url = new URL(rawApiUrl);
  const isLocalhost = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);

  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLocalhost)) {
    throw new Error("The API URL must use HTTPS unless it points to localhost.");
  }

  url.pathname = url.pathname.replace(/\/+$/, "");
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

function createLocalToken(): LocalCliToken {
  const token = `eit_${randomBytes(32).toString("base64url")}`;

  return {
    token,
    tokenHash: createHash("sha256").update(token, "utf8").digest("hex"),
    tokenPrefix: token.slice(0, 12),
  };
}

function getTokenName(): string {
  const configuredName = process.env.EIT_TOKEN_NAME?.trim();
  const name = configuredName || `${hostname()} (${platform()})`;
  return name.slice(0, 80);
}

async function requestAuthorization({
  apiUrl,
  tokenHash,
  tokenPrefix,
  tokenName,
  fetchImplementation = fetch,
}: RequestAuthorizationInput): Promise<CliLoginRequest> {
  let response;

  try {
    response = await fetchImplementation(`${apiUrl}/api/cli/v1/auth/requests`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": CLI_USER_AGENT,
      },
      body: JSON.stringify({ tokenHash, tokenPrefix, tokenName }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new Error(
        `Env Garden did not respond within ${REQUEST_TIMEOUT_MS / 1000} seconds.`
      );
    }

    throw new Error("Could not connect to Env Garden.");
  }

  const payload = await parseResponse(response);

  if (
    !isRecord(payload)
    || typeof payload.requestId !== "string"
    || typeof payload.pollSecret !== "string"
    || typeof payload.authorizationUrl !== "string"
    || typeof payload.expiresAt !== "string"
    || typeof payload.intervalSeconds !== "number"
  ) {
    throw new Error("Env Garden returned an invalid login request.");
  }

  const authorizationUrl = new URL(payload.authorizationUrl);
  const apiOrigin = new URL(apiUrl).origin;

  if (authorizationUrl.origin !== apiOrigin) {
    throw new Error("Env Garden returned an authorization URL for another origin.");
  }

  return {
    requestId: payload.requestId,
    pollSecret: payload.pollSecret,
    authorizationUrl: payload.authorizationUrl,
    expiresAt: payload.expiresAt,
    intervalSeconds: payload.intervalSeconds,
  };
}

async function readAuthorizationStatus({
  apiUrl,
  requestId,
  pollSecret,
  fetchImplementation = fetch,
}: ReadAuthorizationStatusInput): Promise<CliLoginStatus> {
  let response;

  try {
    response = await fetchImplementation(
      `${apiUrl}/api/cli/v1/auth/requests/${encodeURIComponent(requestId)}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${pollSecret}`,
          "User-Agent": CLI_USER_AGENT,
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      }
    );
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new Error(
        `Env Garden did not respond within ${REQUEST_TIMEOUT_MS / 1000} seconds.`
      );
    }

    throw new Error("Could not connect to Env Garden.");
  }

  const payload = await parseResponse(response);

  if (
    !isRecord(payload)
    || (
      payload.status !== "PENDING"
      && payload.status !== "APPROVED"
      && payload.status !== "EXPIRED"
    )
  ) {
    throw new Error("Env Garden returned an invalid login status.");
  }

  return payload.status;
}

async function openBrowser(url: string): Promise<boolean> {
  const currentPlatform = platform();
  const command = currentPlatform === "darwin"
    ? "open"
    : currentPlatform === "win32"
      ? "cmd"
      : "xdg-open";
  const args = currentPlatform === "win32"
    ? ["/c", "start", "", url]
    : [url];

  return new Promise<boolean>((resolve) => {
    const child = spawn(command, args, {
      detached: true,
      stdio: "ignore",
    });

    child.once("error", () => resolve(false));
    child.once("spawn", () => {
      child.unref();
      resolve(true);
    });
  });
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function login(options: LoginOptions = {}): Promise<void> {
  const apiUrl = normalizeApiUrl(
    options.apiUrl || process.env.EIT_API_URL || DEFAULT_API_URL
  );
  const tokenName = getTokenName();
  const localToken = createLocalToken();
  const fetchImplementation = options.fetchImplementation || fetch;
  const loginRequest = await requestAuthorization({
    apiUrl,
    tokenHash: localToken.tokenHash,
    tokenPrefix: localToken.tokenPrefix,
    tokenName,
    fetchImplementation,
  });
  const openBrowserImplementation = options.openBrowserImplementation || openBrowser;
  const sleepImplementation = options.sleepImplementation || sleep;

  console.log(`Open this URL to authorize eit:\n${loginRequest.authorizationUrl}\n`);

  if (options.openBrowser !== false) {
    const didOpenBrowser = await openBrowserImplementation(
      loginRequest.authorizationUrl
    );

    if (didOpenBrowser) {
      console.log("Browser opened. Waiting for authorization...");
    } else {
      console.log("Could not open a browser automatically. Open the URL above.");
    }
  } else {
    console.log("Waiting for authorization...");
  }

  const serverExpiresAt = Date.parse(loginRequest.expiresAt);

  if (!Number.isFinite(serverExpiresAt)) {
    throw new Error("Env Garden returned an invalid login expiration.");
  }

  const expiresAt = Math.min(
    serverExpiresAt + LOGIN_EXPIRY_GRACE_MS,
    Date.now() + LOGIN_TIMEOUT_MS + LOGIN_EXPIRY_GRACE_MS
  );
  const pollingInterval = Math.max(
    1,
    Math.min(loginRequest.intervalSeconds, MAX_POLLING_INTERVAL_SECONDS)
  ) * 1000;

  while (Date.now() < expiresAt) {
    const status = await readAuthorizationStatus({
      apiUrl,
      requestId: loginRequest.requestId,
      pollSecret: loginRequest.pollSecret,
      fetchImplementation,
    });

    if (status === "APPROVED") {
      if (!TOKEN_PATTERN.test(localToken.token)) {
        throw new Error("Failed to generate a valid CLI token.");
      }

      const user = await verifyToken({
        apiUrl,
        token: localToken.token,
        fetchImplementation,
      });
      await saveCredentials({
        apiUrl,
        token: localToken.token,
        email: user.email,
        deviceName: tokenName,
        loggedInAt: new Date().toISOString(),
      });
      console.log(`Logged in as ${user.email}.`);
      return;
    }

    if (status === "EXPIRED") {
      break;
    }

    await sleepImplementation(pollingInterval);
  }

  throw new Error("CLI login request expired. Run eit login again.");
}

export const testing = {
  createLocalToken,
  getConfigDirectory,
  normalizeApiUrl,
  readAuthorizationStatus,
  requestAuthorization,
  saveCredentials,
  verifyToken,
};
