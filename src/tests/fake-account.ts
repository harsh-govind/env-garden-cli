import { createHash } from "node:crypto";
import { CRYPTO_DOMAIN } from "../constants/crypto.js";
import { aeadEncrypt } from "../lib/crypto/aead.js";
import { concatBytes, encodeFields, toBase64, xorBytes } from "../lib/crypto/encoding.js";
import {
  decryptVariable,
  encryptVariable,
  generateEnvironmentKey,
  generateEnvironmentKeyId,
  sealEnvironmentKey,
} from "../lib/crypto/environment.js";
import { deriveAccountKeys, getPublicAccountKeys } from "../lib/crypto/keyring.js";
import { loadSodium } from "../lib/crypto/sodium.js";
import type { EncryptedVariable, EnvironmentKeyMaterial, PlainVariable } from "../types/crypto.js";
import type { RemoteCipherVariable, RemoteEnvironmentKey } from "../types/keys.js";

export async function createFakeAccount(token: string, userId = "user-1") {
  const sodium = await loadSodium();
  const seed = sodium.randombytes_buf(32);
  const keys = await deriveAccountKeys(seed);
  const publicKeys = await getPublicAccountKeys(keys);
  const clientShare = sodium.randombytes_buf(32);
  const wrapKey = sodium.randombytes_buf(32);
  const tokenHash = createHash("sha256").update(token, "utf8").digest("hex");
  const encryptedServerShare = aeadEncrypt(
    sodium,
    xorBytes(seed, clientShare),
    wrapKey,
    encodeFields(CRYPTO_DOMAIN.cliShare, [tokenHash])
  );

  return {
    userId,
    keys,
    publicKeys,
    clientShare,
    wrapKey,
    credentialShares: {
      clientShare: toBase64(sodium, clientShare),
      wrapKey: toBase64(sodium, wrapKey),
    },
    keysResponse: { userId, encryptedServerShare, ...publicKeys },
    sealedPackageFor: (transportPublicKey: string) =>
      toBase64(
        sodium,
        sodium.crypto_box_seal(
          concatBytes(clientShare, wrapKey),
          sodium.from_base64(transportPublicKey, sodium.base64_variants.ORIGINAL)
        )
      ),
  };
}

export async function createFakeEnvironment(
  account: Awaited<ReturnType<typeof createFakeAccount>>,
  environment: string
) {
  const id = await generateEnvironmentKeyId();
  const material = await generateEnvironmentKey();
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
  const environmentKey: RemoteEnvironmentKey = {
    id,
    environment,
    version: 1,
    rotationRequired: false,
    share: {
      version: 1,
      recipientBoxPublicKey: account.publicKeys.boxPublicKey,
      ...share,
      granter: { userId: account.userId, email: "dev@example.com", signPublicKey: account.publicKeys.signPublicKey },
    },
  };

  return { environmentKey, material };
}

export async function encryptAll(
  variables: PlainVariable[],
  envFileId: string,
  material: EnvironmentKeyMaterial
): Promise<RemoteCipherVariable[]> {
  return Promise.all(
    variables.map(async (variable, position) => ({
      id: `v-${position}-${Math.random().toString(36).slice(2)}`,
      position,
      ...(await encryptVariable({ variable, envFileId, keyVersion: 1, key: material })),
    }))
  );
}

export async function decryptAll(
  variables: EncryptedVariable[],
  envFileId: string,
  material: EnvironmentKeyMaterial
): Promise<PlainVariable[]> {
  return Promise.all(variables.map((variable) => decryptVariable({ variable, envFileId, key: material })));
}
