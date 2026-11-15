import {
  chmod,
  mkdir,
  readFile,
  rename,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import { homedir, platform } from "node:os";
import { join } from "node:path";
import {
  CONFIG_APPLICATION_NAME,
  CREDENTIALS_FILENAME,
} from "../constants/index.js";
import type {
  CliCredentials,
  ReadCredentialsResult,
  StoredCliCredentials,
} from "../types/credentials.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function getConfigDirectory(): string {
  if (process.env.EIT_CONFIG_DIR) {
    return process.env.EIT_CONFIG_DIR;
  }

  if (platform() === "win32" && process.env.APPDATA) {
    return join(process.env.APPDATA, CONFIG_APPLICATION_NAME);
  }

  if (process.env.XDG_CONFIG_HOME) {
    return join(process.env.XDG_CONFIG_HOME, CONFIG_APPLICATION_NAME);
  }

  return join(homedir(), ".config", CONFIG_APPLICATION_NAME);
}

export function getCredentialsPath(): string {
  return join(getConfigDirectory(), CREDENTIALS_FILENAME);
}

export async function saveCredentials(
  credentials: CliCredentials
): Promise<string> {
  const configDirectory = getConfigDirectory();
  const credentialsPath = getCredentialsPath();
  const temporaryPath = join(
    configDirectory,
    `.credentials-${process.pid}-${Date.now()}.tmp`
  );
  const contents = `${JSON.stringify(credentials, null, 2)}\n`;

  await mkdir(configDirectory, { recursive: true, mode: 0o700 });

  try {
    await writeFile(temporaryPath, contents, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    await rename(temporaryPath, credentialsPath);
    await chmod(credentialsPath, 0o600);
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  }

  return credentialsPath;
}

export async function readCredentials(): Promise<ReadCredentialsResult | null> {
  const credentialsPath = getCredentialsPath();

  try {
    const [contents, fileStat] = await Promise.all([
      readFile(credentialsPath, "utf8"),
      stat(credentialsPath),
    ]);
    const payload: unknown = JSON.parse(contents);

    if (
      !isRecord(payload)
      || typeof payload.apiUrl !== "string"
      || typeof payload.token !== "string"
    ) {
      throw new Error("Stored CLI credentials are invalid.");
    }

    const credentials: StoredCliCredentials = {
      apiUrl: payload.apiUrl,
      token: payload.token,
      ...(typeof payload.email === "string" ? { email: payload.email } : {}),
      ...(typeof payload.deviceName === "string"
        ? { deviceName: payload.deviceName }
        : {}),
      ...(typeof payload.loggedInAt === "string"
        ? { loggedInAt: payload.loggedInAt }
        : {}),
      ...(typeof payload.expiresAt === "string"
        ? { expiresAt: payload.expiresAt }
        : {}),
    };

    return {
      credentials,
      credentialsPath,
      modifiedAt: fileStat.mtime.toISOString(),
    };
  } catch (error) {
    if (
      error instanceof Error
      && "code" in error
      && error.code === "ENOENT"
    ) {
      return null;
    }

    if (error instanceof SyntaxError) {
      throw new Error("Stored CLI credentials are invalid.");
    }

    throw error;
  }
}

export async function deleteCredentials(): Promise<boolean> {
  try {
    await unlink(getCredentialsPath());
    return true;
  } catch (error) {
    if (
      error instanceof Error
      && "code" in error
      && error.code === "ENOENT"
    ) {
      return false;
    }

    throw error;
  }
}
