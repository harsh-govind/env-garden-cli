import {
  ACCOUNT_BOX_SUBKEY_ID,
  ACCOUNT_KDF_CONTEXT,
  ACCOUNT_SEED_BYTE_LENGTH,
  ACCOUNT_SIGN_SUBKEY_ID,
  CRYPTO_DOMAIN,
  CRYPTO_KEY_BYTE_LENGTH,
  FINGERPRINT_BYTE_LENGTH,
} from "../../constants/crypto.js";
import { encodeFields, fromBase64, toBase64, wipe } from "./encoding.js";
import { loadSodium } from "./sodium.js";
import type { AccountKeys, PublicAccountKeys } from "../../types/crypto.js";

export async function deriveAccountKeys(seed: Uint8Array): Promise<AccountKeys> {
  const sodium = await loadSodium();

  if (seed.length !== ACCOUNT_SEED_BYTE_LENGTH) {
    throw new Error("Account seed must be 32 bytes.");
  }

  const signSeed = sodium.crypto_kdf_derive_from_key(
    CRYPTO_KEY_BYTE_LENGTH,
    ACCOUNT_SIGN_SUBKEY_ID,
    ACCOUNT_KDF_CONTEXT,
    seed
  );
  const boxSeed = sodium.crypto_kdf_derive_from_key(
    CRYPTO_KEY_BYTE_LENGTH,
    ACCOUNT_BOX_SUBKEY_ID,
    ACCOUNT_KDF_CONTEXT,
    seed
  );

  try {
    const signKeyPair = sodium.crypto_sign_seed_keypair(signSeed);
    const boxKeyPair = sodium.crypto_box_seed_keypair(boxSeed);

    return {
      seed: new Uint8Array(seed),
      signPublicKey: signKeyPair.publicKey,
      signSecretKey: signKeyPair.privateKey,
      boxPublicKey: boxKeyPair.publicKey,
      boxSecretKey: boxKeyPair.privateKey,
    };
  } finally {
    wipe(sodium, signSeed, boxSeed);
  }
}

export async function getPublicAccountKeys(keys: AccountKeys): Promise<PublicAccountKeys> {
  const sodium = await loadSodium();

  return {
    signPublicKey: toBase64(sodium, keys.signPublicKey),
    boxPublicKey: toBase64(sodium, keys.boxPublicKey),
  };
}

export async function wipeAccountKeys(keys: AccountKeys | null | undefined): Promise<void> {
  if (!keys) {
    return;
  }

  const sodium = await loadSodium();
  wipe(sodium, keys.seed, keys.signSecretKey, keys.boxSecretKey);
}

export async function computeFingerprint(keys: PublicAccountKeys): Promise<string> {
  const sodium = await loadSodium();
  const digest = sodium.crypto_generichash(
    FINGERPRINT_BYTE_LENGTH,
    encodeFields(CRYPTO_DOMAIN.fingerprint, [
      fromBase64(sodium, keys.signPublicKey, sodium.crypto_sign_PUBLICKEYBYTES),
      fromBase64(sodium, keys.boxPublicKey, sodium.crypto_box_PUBLICKEYBYTES),
    ]),
    null
  );
  const hex = sodium.to_hex(digest).toUpperCase();

  return hex.match(/.{4}/g)?.join(" ") ?? hex;
}
