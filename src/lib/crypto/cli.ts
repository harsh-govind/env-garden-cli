import {
  CRYPTO_DOMAIN,
  CRYPTO_KEY_BYTE_LENGTH,
  VERIFICATION_CODE_ALPHABET,
  VERIFICATION_CODE_BYTE_LENGTH,
} from "../../constants/crypto.js";
import { aeadDecrypt } from "./aead.js";
import { encodeFields, fromBase64, toBase64, wipe, xorBytes } from "./encoding.js";
import { deriveAccountKeys, getPublicAccountKeys, wipeAccountKeys } from "./keyring.js";
import { loadSodium } from "./sodium.js";
import type { AccountKeys, CliKeyMaterial, PublicAccountKeys } from "../../types/crypto.js";

export async function generateTransportKeyPair(): Promise<{ publicKey: string; secretKey: Uint8Array }> {
  const sodium = await loadSodium();
  const keyPair = sodium.crypto_box_keypair();

  return {
    publicKey: toBase64(sodium, keyPair.publicKey),
    secretKey: keyPair.privateKey,
  };
}

export async function openCliPackage(input: {
  sealedPackage: string;
  transportPublicKey: string;
  transportSecretKey: Uint8Array;
}): Promise<CliKeyMaterial> {
  const sodium = await loadSodium();
  let plaintext: Uint8Array;

  try {
    plaintext = sodium.crypto_box_seal_open(
      fromBase64(sodium, input.sealedPackage),
      fromBase64(sodium, input.transportPublicKey, sodium.crypto_box_PUBLICKEYBYTES),
      input.transportSecretKey
    );
  } catch {
    throw new Error("Could not open the key package from the browser.");
  }

  if (plaintext.length !== CRYPTO_KEY_BYTE_LENGTH * 2) {
    wipe(sodium, plaintext);
    throw new Error("The key package from the browser is malformed.");
  }

  const material = {
    clientShare: plaintext.slice(0, CRYPTO_KEY_BYTE_LENGTH),
    wrapKey: plaintext.slice(CRYPTO_KEY_BYTE_LENGTH),
  };
  wipe(sodium, plaintext);
  return material;
}

export async function combineCliAccountKey(input: CliKeyMaterial & {
  encryptedServerShare: string;
  tokenHash: string;
  expected: PublicAccountKeys;
}): Promise<AccountKeys> {
  const sodium = await loadSodium();
  const serverShare = aeadDecrypt(
    sodium,
    input.encryptedServerShare,
    input.wrapKey,
    encodeFields(CRYPTO_DOMAIN.cliShare, [input.tokenHash])
  );
  const seed = xorBytes(serverShare, input.clientShare);
  wipe(sodium, serverShare);

  try {
    const keys = await deriveAccountKeys(seed);
    const publicKeys = await getPublicAccountKeys(keys);

    if (
      publicKeys.signPublicKey !== input.expected.signPublicKey
      || publicKeys.boxPublicKey !== input.expected.boxPublicKey
    ) {
      await wipeAccountKeys(keys);
      throw new Error("Your encryption keys changed. Run `eit login` again.");
    }

    return keys;
  } finally {
    wipe(sodium, seed);
  }
}

export async function computeVerificationCode(transportPublicKey: string): Promise<string> {
  const sodium = await loadSodium();
  const digest = sodium.crypto_generichash(
    VERIFICATION_CODE_BYTE_LENGTH,
    encodeFields(CRYPTO_DOMAIN.verificationCode, [
      fromBase64(sodium, transportPublicKey, sodium.crypto_box_PUBLICKEYBYTES),
    ]),
    null
  );
  let bits = 0;
  let bitCount = 0;
  let code = "";

  for (const byte of digest) {
    bits = (bits << 8) | byte;
    bitCount += 8;

    while (bitCount >= 5) {
      bitCount -= 5;
      code += VERIFICATION_CODE_ALPHABET[(bits >> bitCount) & 31];
    }

    bits &= (1 << bitCount) - 1;
  }

  return `${code.slice(0, 4)}-${code.slice(4, 8)}`;
}
