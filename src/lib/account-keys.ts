import { createHash } from "node:crypto";
import { apiRequest, isRecord } from "./api.js";
import { combineCliAccountKey } from "./crypto/cli.js";
import { fromBase64, wipe } from "./crypto/encoding.js";
import { loadSodium } from "./crypto/sodium.js";
import type { RemoteOptions } from "../types/api.js";
import type { AccountKeys } from "../types/crypto.js";
import type { StoredCliCredentials } from "../types/credentials.js";
import type { UnlockedAccount } from "../types/keys.js";

const unlockedAccounts = new Map<string, Promise<UnlockedAccount>>();

async function unlock(
  credentials: StoredCliCredentials,
  options: RemoteOptions
): Promise<UnlockedAccount> {
  if (!credentials.clientShare || !credentials.wrapKey) {
    throw new Error("This CLI session predates end-to-end encryption. Run `eit login` again.");
  }

  const payload = await apiRequest<unknown>({
    apiUrl: credentials.apiUrl,
    token: credentials.token,
    path: "/api/cli/v1/auth/keys",
    ...(options.fetchImplementation ? { fetchImplementation: options.fetchImplementation } : {}),
  });

  if (
    !isRecord(payload)
    || typeof payload.userId !== "string"
    || typeof payload.encryptedServerShare !== "string"
    || typeof payload.signPublicKey !== "string"
    || typeof payload.boxPublicKey !== "string"
  ) {
    throw new Error("Env Garden returned invalid account keys.");
  }

  const sodium = await loadSodium();
  const clientShare = fromBase64(sodium, credentials.clientShare, 32);
  const wrapKey = fromBase64(sodium, credentials.wrapKey, 32);

  try {
    const keys: AccountKeys = await combineCliAccountKey({
      clientShare,
      wrapKey,
      encryptedServerShare: payload.encryptedServerShare,
      tokenHash: createHash("sha256").update(credentials.token, "utf8").digest("hex"),
      expected: {
        signPublicKey: payload.signPublicKey,
        boxPublicKey: payload.boxPublicKey,
      },
    });

    return {
      userId: payload.userId,
      keys,
      publicKeys: {
        signPublicKey: payload.signPublicKey,
        boxPublicKey: payload.boxPublicKey,
      },
    };
  } finally {
    wipe(sodium, clientShare, wrapKey);
  }
}

export function unlockAccount(
  credentials: StoredCliCredentials,
  options: RemoteOptions = {}
): Promise<UnlockedAccount> {
  const cacheKey = `${credentials.apiUrl}\n${credentials.token}`;
  let unlocked = unlockedAccounts.get(cacheKey);

  if (!unlocked) {
    unlocked = unlock(credentials, options);
    unlocked.catch(() => unlockedAccounts.delete(cacheKey));
    unlockedAccounts.set(cacheKey, unlocked);
  }

  return unlocked;
}
