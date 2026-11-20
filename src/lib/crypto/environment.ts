import {
  CRYPTO_DOMAIN,
  CRYPTO_KEY_BYTE_LENGTH,
  ENVIRONMENT_DATA_SUBKEY_ID,
  ENVIRONMENT_DIGEST_SUBKEY_ID,
  ENVIRONMENT_KDF_CONTEXT,
  ENVIRONMENT_KEY_ID_BYTE_LENGTH,
  ENVIRONMENT_SECRET_BYTE_LENGTH,
  KEY_DIGEST_BYTE_LENGTH,
} from "../../constants/crypto.js";
import { aeadDecrypt, aeadEncrypt } from "./aead.js";
import {
  encodeFields,
  fromBase64,
  toBase64,
  toBase64Url,
  utf8Decode,
  utf8Encode,
  wipe,
} from "./encoding.js";
import { loadSodium, type Sodium } from "./sodium.js";
import type {
  AccountKeys,
  EncryptedVariable,
  EnvironmentKeyMaterial,
  EnvironmentShareContext,
  PlainVariable,
  SealedEnvironmentShare,
  VariableField,
} from "../../types/crypto.js";

function deriveEnvironmentKeyWith(sodium: Sodium, secret: Uint8Array): EnvironmentKeyMaterial {
  if (secret.length !== ENVIRONMENT_SECRET_BYTE_LENGTH) {
    throw new Error("Environment secret must be 32 bytes.");
  }

  return {
    secret: new Uint8Array(secret),
    dataKey: sodium.crypto_kdf_derive_from_key(
      CRYPTO_KEY_BYTE_LENGTH,
      ENVIRONMENT_DATA_SUBKEY_ID,
      ENVIRONMENT_KDF_CONTEXT,
      secret
    ),
    digestKey: sodium.crypto_kdf_derive_from_key(
      CRYPTO_KEY_BYTE_LENGTH,
      ENVIRONMENT_DIGEST_SUBKEY_ID,
      ENVIRONMENT_KDF_CONTEXT,
      secret
    ),
  };
}

export async function deriveEnvironmentKey(secret: Uint8Array): Promise<EnvironmentKeyMaterial> {
  return deriveEnvironmentKeyWith(await loadSodium(), secret);
}

export async function generateEnvironmentKeyId(): Promise<string> {
  const sodium = await loadSodium();
  return toBase64Url(sodium, sodium.randombytes_buf(ENVIRONMENT_KEY_ID_BYTE_LENGTH));
}

export async function generateEnvironmentKey(): Promise<EnvironmentKeyMaterial> {
  const sodium = await loadSodium();
  const secret = sodium.randombytes_buf(ENVIRONMENT_SECRET_BYTE_LENGTH);

  try {
    return deriveEnvironmentKeyWith(sodium, secret);
  } finally {
    wipe(sodium, secret);
  }
}

export async function wipeEnvironmentKey(key: EnvironmentKeyMaterial | null | undefined): Promise<void> {
  if (!key) {
    return;
  }

  const sodium = await loadSodium();
  wipe(sodium, key.secret, key.dataKey, key.digestKey);
}

function shareSignatureMessage(
  sodium: Sodium,
  context: EnvironmentShareContext,
  sealedSecret: Uint8Array
): Uint8Array {
  return encodeFields(CRYPTO_DOMAIN.share, [
    context.environmentKeyId,
    context.version,
    context.recipientUserId,
    fromBase64(sodium, context.recipientBoxPublicKey, sodium.crypto_box_PUBLICKEYBYTES),
    sodium.crypto_generichash(32, sealedSecret, null),
  ]);
}

export async function sealEnvironmentKey(input: {
  key: EnvironmentKeyMaterial;
  context: EnvironmentShareContext;
  signer: AccountKeys;
}): Promise<SealedEnvironmentShare> {
  const sodium = await loadSodium();
  const sealedSecret = sodium.crypto_box_seal(
    input.key.secret,
    fromBase64(sodium, input.context.recipientBoxPublicKey, sodium.crypto_box_PUBLICKEYBYTES)
  );
  const signature = sodium.crypto_sign_detached(
    shareSignatureMessage(sodium, input.context, sealedSecret),
    input.signer.signSecretKey
  );

  return {
    sealedSecret: toBase64(sodium, sealedSecret),
    signature: toBase64(sodium, signature),
  };
}

export async function openEnvironmentKey(input: {
  share: SealedEnvironmentShare;
  context: EnvironmentShareContext;
  signerSignPublicKey: string;
  recipient: Pick<AccountKeys, "boxPublicKey" | "boxSecretKey">;
}): Promise<EnvironmentKeyMaterial> {
  const sodium = await loadSodium();
  const expectedRecipient = fromBase64(
    sodium,
    input.context.recipientBoxPublicKey,
    sodium.crypto_box_PUBLICKEYBYTES
  );

  if (!sodium.memcmp(expectedRecipient, input.recipient.boxPublicKey)) {
    throw new Error("This key was shared with a different device key.");
  }

  const sealedSecret = fromBase64(sodium, input.share.sealedSecret);
  const isAuthentic = sodium.crypto_sign_verify_detached(
    fromBase64(sodium, input.share.signature, sodium.crypto_sign_BYTES),
    shareSignatureMessage(sodium, input.context, sealedSecret),
    fromBase64(sodium, input.signerSignPublicKey, sodium.crypto_sign_PUBLICKEYBYTES)
  );

  if (!isAuthentic) {
    throw new Error("The environment key signature is invalid.");
  }

  let secret: Uint8Array;

  try {
    secret = sodium.crypto_box_seal_open(
      sealedSecret,
      input.recipient.boxPublicKey,
      input.recipient.boxSecretKey
    );
  } catch {
    throw new Error("Could not open the environment key.");
  }

  try {
    return deriveEnvironmentKeyWith(sodium, secret);
  } finally {
    wipe(sodium, secret);
  }
}

function computeKeyDigestWith(sodium: Sodium, keyName: string, digestKey: Uint8Array): string {
  return toBase64(
    sodium,
    sodium.crypto_generichash(KEY_DIGEST_BYTE_LENGTH, utf8Encode(keyName), digestKey)
  );
}

export async function computeKeyDigest(keyName: string, key: EnvironmentKeyMaterial): Promise<string> {
  return computeKeyDigestWith(await loadSodium(), keyName, key.digestKey);
}

function variableAssociatedData(
  context: { envFileId: string; keyVersion: number; keyDigest: string; isCommented: boolean },
  field: VariableField
): Uint8Array {
  return encodeFields(CRYPTO_DOMAIN.variable, [
    context.envFileId,
    context.keyVersion,
    context.keyDigest,
    context.isCommented,
    field,
  ]);
}

export async function encryptVariable(input: {
  variable: PlainVariable;
  envFileId: string;
  keyVersion: number;
  key: EnvironmentKeyMaterial;
}): Promise<EncryptedVariable> {
  const sodium = await loadSodium();
  const keyDigest = computeKeyDigestWith(sodium, input.variable.key, input.key.digestKey);
  const context = {
    envFileId: input.envFileId,
    keyVersion: input.keyVersion,
    keyDigest,
    isCommented: input.variable.isCommented,
  };
  const encryptField = (field: VariableField, value: string) =>
    aeadEncrypt(sodium, utf8Encode(value), input.key.dataKey, variableAssociatedData(context, field));

  return {
    keyDigest,
    encryptedKey: encryptField("key", input.variable.key),
    encryptedValue: encryptField("value", input.variable.value),
    encryptedNote: input.variable.note ? encryptField("note", input.variable.note) : null,
    isCommented: input.variable.isCommented,
    keyVersion: input.keyVersion,
  };
}

export async function decryptVariable(input: {
  variable: EncryptedVariable;
  envFileId: string;
  key: EnvironmentKeyMaterial;
}): Promise<PlainVariable> {
  const sodium = await loadSodium();
  const context = {
    envFileId: input.envFileId,
    keyVersion: input.variable.keyVersion,
    keyDigest: input.variable.keyDigest,
    isCommented: input.variable.isCommented,
  };
  const decryptField = (field: VariableField, payload: string) =>
    utf8Decode(aeadDecrypt(sodium, payload, input.key.dataKey, variableAssociatedData(context, field)));
  const key = decryptField("key", input.variable.encryptedKey);

  if (computeKeyDigestWith(sodium, key, input.key.digestKey) !== input.variable.keyDigest) {
    throw new Error("A variable name does not match its digest.");
  }

  return {
    key,
    value: decryptField("value", input.variable.encryptedValue),
    note: input.variable.encryptedNote ? decryptField("note", input.variable.encryptedNote) : null,
    isCommented: input.variable.isCommented,
  };
}
