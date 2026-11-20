import {
  CLI_USER_AGENT,
  REQUEST_TIMEOUT_MS,
} from "../constants/index.js";
import type {
  ApiRequestInput,
  CliSessionInfo,
  CliUser,
  RevokeTokenInput,
  VerifyTokenInput,
} from "../types/api.js";

export class SessionExpiredError extends Error {
  constructor() {
    super("Your session has expired or was revoked. Run `eit login` to sign in again.");
    this.name = "SessionExpiredError";
  }
}

function toConnectionError(error: unknown): Error {
  if (error instanceof Error && error.name === "TimeoutError") {
    return new Error(
      `Env Garden did not respond within ${REQUEST_TIMEOUT_MS / 1000} seconds.`
    );
  }

  return new Error("Could not connect to Env Garden.");
}

export async function apiRequest<T = unknown>({
  apiUrl,
  token,
  path,
  method = "GET",
  body,
  fetchImplementation = fetch,
}: ApiRequestInput): Promise<T> {
  let response;

  try {
    response = await fetchImplementation(`${apiUrl}${path}`, {
      method,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "User-Agent": CLI_USER_AGENT,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw toConnectionError(error);
  }

  if (response.status === 401) {
    throw new SessionExpiredError();
  }

  return (await parseResponse(response)) as T;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function parseResponse(response: Response): Promise<unknown> {
  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMessage =
      isRecord(payload) && typeof payload.error === "string"
        ? payload.error
        : `Env Garden returned HTTP ${response.status}.`;
    throw new Error(errorMessage);
  }

  return payload;
}

export async function verifySession({
  apiUrl,
  token,
  fetchImplementation = fetch,
}: VerifyTokenInput): Promise<CliSessionInfo> {
  let response;

  try {
    response = await fetchImplementation(`${apiUrl}/api/cli/v1/auth/verify`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "User-Agent": CLI_USER_AGENT,
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw toConnectionError(error);
  }

  const payload = await parseResponse(response);

  if (
    !isRecord(payload)
    || !isRecord(payload.user)
    || typeof payload.user.id !== "string"
    || typeof payload.user.email !== "string"
  ) {
    throw new Error("Env Garden returned an invalid login response.");
  }

  const expiresAt =
    isRecord(payload.token) && typeof payload.token.expiresAt === "string"
      ? payload.token.expiresAt
      : null;

  return {
    user: {
      id: payload.user.id,
      email: payload.user.email,
      ...(typeof payload.user.name === "string" || payload.user.name === null
        ? { name: payload.user.name }
        : {}),
    },
    expiresAt,
  };
}

export async function verifyToken(input: VerifyTokenInput): Promise<CliUser> {
  return (await verifySession(input)).user;
}

export async function revokeToken({
  apiUrl,
  token,
  fetchImplementation = fetch,
}: RevokeTokenInput): Promise<void> {
  let response;

  try {
    response = await fetchImplementation(`${apiUrl}/api/cli/v1/auth/token`, {
      method: "DELETE",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "User-Agent": CLI_USER_AGENT,
      },
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

  if (response.status === 401) {
    return;
  }

  await parseResponse(response);
}
