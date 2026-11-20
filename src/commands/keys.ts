import { unlockAccount } from "../lib/account-keys.js";
import { computeFingerprint } from "../lib/crypto/keyring.js";
import { pinAccountKey } from "../lib/environment-keys.js";
import { forgetSigner } from "../lib/key-pins.js";
import { requireCredentials } from "../lib/session.js";
import type { KeysCommandOptions } from "../types/commands.js";

export async function keysCommand(options: KeysCommandOptions): Promise<void> {
  const credentials = await requireCredentials();

  switch (options.action) {
    case "fingerprint":
    case undefined: {
      const account = await unlockAccount(
        credentials,
        options.fetchImplementation ? { fetchImplementation: options.fetchImplementation } : {}
      );
      console.log(`Key fingerprint: ${await computeFingerprint(account.publicKeys)}`);
      console.log("It matches the one in Settings > Encryption in your browser.");
      return;
    }

    case "trust": {
      if (!options.subject) {
        throw new Error("Usage: eit keys trust <email>");
      }

      const removed = await forgetSigner(pinAccountKey(credentials), options.subject);

      if (removed === 0) {
        console.log(`No saved key for ${options.subject}. Nothing to change.`);
        return;
      }

      console.log(`Forgot the saved key for ${options.subject}. Their current key is trusted on next use.`);
      return;
    }

    default:
      throw new Error("Usage: eit keys [fingerprint | trust <email>]");
  }
}
