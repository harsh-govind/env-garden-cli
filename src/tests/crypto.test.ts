import assert from "node:assert/strict";
import test from "node:test";
import { computeVerificationCode, generateTransportKeyPair } from "../lib/crypto/cli.js";
import {
  computeKeyDigest,
  decryptVariable,
  deriveEnvironmentKey,
  encryptVariable,
  generateEnvironmentKey,
} from "../lib/crypto/environment.js";
import { computeFingerprint, deriveAccountKeys, getPublicAccountKeys } from "../lib/crypto/keyring.js";

test("account keys match the web app's published vector", async () => {
  const keys = await deriveAccountKeys(new Uint8Array(32).map((_, index) => index));
  const publicKeys = await getPublicAccountKeys(keys);

  assert.deepEqual(publicKeys, {
    signPublicKey: "KrZ51wSh/Gax3vAOl3qXRM1QBN4X1UML4JuCxgwIqIM=",
    boxPublicKey: "FpG/f+3zCLW4H7ueDEeB7mCK5TrO7dkyh3fTSNvJ7wk=",
  });
  assert.equal(await computeFingerprint(publicKeys), "C9F5 8B27 0EF6 C72F DCDA 1C13 1C06 5B17 609F 44F7");
});

test("variable name digests match the web app's published vector", async () => {
  const key = await deriveEnvironmentKey(new Uint8Array(32).map((_, index) => 255 - index));

  assert.equal(await computeKeyDigest("DATABASE_URL", key), "/I+GP0zet/sPd38f0FwYBfoW7wSHcTJgaHCWxqf2Ufg=");
});

test("variables are bound to their env file and flags", async () => {
  const key = await generateEnvironmentKey();
  const plain = { key: "API_KEY", value: "secret", note: "n", isCommented: false };
  const encrypted = await encryptVariable({ variable: plain, envFileId: "f", keyVersion: 1, key });

  assert.deepEqual(await decryptVariable({ variable: encrypted, envFileId: "f", key }), plain);
  await assert.rejects(decryptVariable({ variable: encrypted, envFileId: "g", key }), /Decryption failed/);
  await assert.rejects(decryptVariable({ variable: { ...encrypted, isCommented: true }, envFileId: "f", key }), /Decryption failed/);
});

test("verification codes are stable and readable", async () => {
  const transport = await generateTransportKeyPair();
  const code = await computeVerificationCode(transport.publicKey);

  assert.match(code, /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
  assert.equal(code, await computeVerificationCode(transport.publicKey));
});
