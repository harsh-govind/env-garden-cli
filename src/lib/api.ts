import {
  CLI_USER_AGENT,
  REQUEST_TIMEOUT_MS,
} from "../constants/index.js";
import type {
  CliUser,
  RevokeTokenInput,
  VerifyTokenInput,
} from "../types/api.js";

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

export async function verifyToken({
  apiUrl,
  token,
  fetchImplementation = fetch,
}: VerifyTokenInput): Promise<CliUser> {
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
    || !isRecord(payload.user)
    || typeof payload.user.id !== "string"
    || typeof payload.user.email !== "string"
  ) {
    throw new Error("Env Garden returned an invalid login response.");
  }

  return {
    id: payload.user.id,
    email: payload.user.email,
    ...(typeof payload.user.name === "string" || payload.user.name === null
      ? { name: payload.user.name }
      : {}),
  };
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
