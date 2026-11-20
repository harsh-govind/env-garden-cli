import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { KEY_PINS_FILENAME } from "../constants/crypto.js";
import { getConfigDirectory } from "./credentials.js";
import type { KeyPinStore } from "../types/keys.js";

function getPinsPath(): string {
  return join(getConfigDirectory(), KEY_PINS_FILENAME);
}

async function readStore(): Promise<KeyPinStore> {
  try {
    const parsed: unknown = JSON.parse(await readFile(getPinsPath(), "utf8"));
    return typeof parsed === "object" && parsed !== null ? (parsed as KeyPinStore) : {};
  } catch {
    return {};
  }
}

async function writeStore(store: KeyPinStore): Promise<void> {
  const directory = getConfigDirectory();
  const temporaryPath = join(directory, `.key-pins-${process.pid}-${Date.now()}.tmp`);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await writeFile(temporaryPath, `${JSON.stringify(store, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  await rename(temporaryPath, getPinsPath());
  await chmod(getPinsPath(), 0o600);
}

export async function trustSignerOnFirstUse(input: {
  accountKey: string;
  subjectUserId: string;
  email: string | null;
  signPublicKey: string;
}): Promise<"pinned" | "changed"> {
  const store = await readStore();
  const accountPins = store[input.accountKey] ?? {};
  const pins = accountPins[input.subjectUserId] ?? [];

  if (pins.some((pin) => pin.signPublicKey === input.signPublicKey)) {
    return "pinned";
  }

  if (pins.length > 0) {
    return "changed";
  }

  accountPins[input.subjectUserId] = [
    { signPublicKey: input.signPublicKey, email: input.email, pinnedAt: new Date().toISOString() },
  ];
  store[input.accountKey] = accountPins;
  await writeStore(store);
  return "pinned";
}

export async function forgetSigner(accountKey: string, query: string): Promise<number> {
  const store = await readStore();
  const accountPins = store[accountKey] ?? {};
  const normalized = query.trim().toLowerCase();
  const matches = Object.entries(accountPins).filter(
    ([userId, pins]) =>
      userId === query || pins.some((pin) => pin.email?.toLowerCase() === normalized)
  );

  for (const [userId] of matches) {
    delete accountPins[userId];
  }

  store[accountKey] = accountPins;
  await writeStore(store);
  return matches.length;
}
