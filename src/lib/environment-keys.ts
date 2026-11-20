import {
  decryptVariable,
  encryptVariable,
  generateEnvironmentKey,
  generateEnvironmentKeyId,
  openEnvironmentKey,
  sealEnvironmentKey,
  wipeEnvironmentKey,
} from "./crypto/environment.js";
import { trustSignerOnFirstUse } from "./key-pins.js";
import type { StoredCliCredentials } from "../types/credentials.js";
import type { EncryptedVariable, EnvironmentKeyMaterial, PlainVariable } from "../types/crypto.js";
import type {
  NewEnvironmentKeyPayload,
  RemoteCipherVariable,
  RemoteEnvironmentKey,
  UnlockedAccount,
} from "../types/keys.js";

export function pinAccountKey(credentials: StoredCliCredentials): string {
  return `${credentials.apiUrl}\n${credentials.email ?? ""}`;
}

export async function openRemoteEnvironmentKey(input: {
  credentials: StoredCliCredentials;
  account: UnlockedAccount;
  environmentKey: RemoteEnvironmentKey;
}): Promise<EnvironmentKeyMaterial> {
  const share = input.environmentKey.share;

  if (!share || share.version !== input.environmentKey.version) {
    throw new Error("Nobody has shared this environment's key with you yet. Ask a teammate who has access.");
  }

  const granter = share.granter;

  if (granter.userId === input.account.userId) {
    if (granter.signPublicKey !== input.account.publicKeys.signPublicKey) {
      throw new Error("This environment's key was signed by a key that isn't yours. Ask a teammate to share it again.");
    }
  } else if (granter.userId) {
    const trust = await trustSignerOnFirstUse({
      accountKey: pinAccountKey(input.credentials),
      subjectUserId: granter.userId,
      email: granter.email,
      signPublicKey: granter.signPublicKey,
    });

    if (trust === "changed") {
      throw new Error(
        `${granter.email ?? "A teammate"} shared this key with a signing key this machine hasn't seen before. `
        + `Confirm with them that they reset their keys, then run \`eit keys trust ${granter.email ?? granter.userId}\`.`
      );
    }
  }

  return openEnvironmentKey({
    share: { sealedSecret: share.sealedSecret, signature: share.signature },
    context: {
      environmentKeyId: input.environmentKey.id,
      version: share.version,
      recipientUserId: input.account.userId,
      recipientBoxPublicKey: share.recipientBoxPublicKey,
    },
    signerSignPublicKey: granter.signPublicKey,
    recipient: input.account.keys,
  });
}

export async function decryptRemoteVariables(input: {
  variables: RemoteCipherVariable[];
  envFileId: string;
  material: EnvironmentKeyMaterial;
}): Promise<PlainVariable[]> {
  return Promise.all(
    input.variables.map((variable) =>
      decryptVariable({ variable, envFileId: input.envFileId, key: input.material })
    )
  );
}

export async function encryptForPush(input: {
  local: PlainVariable[];
  remote: { plain: PlainVariable; cipher: RemoteCipherVariable }[];
  envFileId: string;
  keyVersion: number;
  material: EnvironmentKeyMaterial;
}): Promise<EncryptedVariable[]> {
  const remoteByKey = new Map(input.remote.map((entry) => [entry.plain.key, entry]));

  return Promise.all(
    input.local.map(async (variable) => {
      const existing = remoteByKey.get(variable.key);

      if (
        existing
        && existing.cipher.keyVersion === input.keyVersion
        && existing.plain.value === variable.value
        && (existing.plain.note ?? null) === (variable.note ?? null)
        && existing.plain.isCommented === variable.isCommented
      ) {
        const { keyDigest, encryptedKey, encryptedValue, encryptedNote, isCommented, keyVersion } = existing.cipher;
        return { keyDigest, encryptedKey, encryptedValue, encryptedNote, isCommented, keyVersion };
      }

      return encryptVariable({
        variable,
        envFileId: input.envFileId,
        keyVersion: input.keyVersion,
        key: input.material,
      });
    })
  );
}

export async function createEnvironmentKeysForSelf(
  account: UnlockedAccount,
  environments: string[]
): Promise<NewEnvironmentKeyPayload[]> {
  return Promise.all(
    environments.map(async (environment) => {
      const id = await generateEnvironmentKeyId();
      const material = await generateEnvironmentKey();

      try {
        const share = await sealEnvironmentKey({
          key: material,
          context: {
            environmentKeyId: id,
            version: 1,
            recipientUserId: account.userId,
            recipientBoxPublicKey: account.publicKeys.boxPublicKey,
          },
          signer: account.keys,
        });

        return { id, environment, ...share };
      } finally {
        await wipeEnvironmentKey(material);
      }
    })
  );
}
