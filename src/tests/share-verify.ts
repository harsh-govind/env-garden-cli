import { openEnvironmentKey } from "../lib/crypto/environment.js";
import type { createFakeAccount } from "./fake-account.js";

export async function verifyEnvironmentShareForTest(
  key: { id: string; sealedSecret: string; signature: string },
  account: Awaited<ReturnType<typeof createFakeAccount>>
): Promise<boolean> {
  const material = await openEnvironmentKey({
    share: { sealedSecret: key.sealedSecret, signature: key.signature },
    context: {
      environmentKeyId: key.id,
      version: 1,
      recipientUserId: account.userId,
      recipientBoxPublicKey: account.publicKeys.boxPublicKey,
    },
    signerSignPublicKey: account.publicKeys.signPublicKey,
    recipient: account.keys,
  });

  return material.secret.length === 32;
}
