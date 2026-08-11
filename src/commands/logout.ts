import { revokeToken } from "../lib/api.js";
import {
  deleteCredentials,
  readCredentials,
} from "../lib/credentials.js";
import type { LogoutOptions } from "../types/commands.js";

export async function logout(options: LogoutOptions = {}): Promise<void> {
  const storedCredentials = await readCredentials();

  if (!storedCredentials) {
    console.log("Not logged in.");
    return;
  }

  const { credentials } = storedCredentials;

  if (!options.localOnly) {
    await revokeToken({
      apiUrl: credentials.apiUrl,
      token: credentials.token,
      ...(options.fetchImplementation
        ? { fetchImplementation: options.fetchImplementation }
        : {}),
    });
  }

  await deleteCredentials();

  if (options.localOnly) {
    console.log("Local credentials removed. The server token was not revoked.");
    return;
  }

  console.log(
    credentials.email
      ? `Logged out ${credentials.email}.`
      : "Logged out."
  );
}
