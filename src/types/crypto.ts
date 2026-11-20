export type AccountKeys = {
  seed: Uint8Array;
  signPublicKey: Uint8Array;
  signSecretKey: Uint8Array;
  boxPublicKey: Uint8Array;
  boxSecretKey: Uint8Array;
};

export type PublicAccountKeys = {
  signPublicKey: string;
  boxPublicKey: string;
};

export type EnvironmentKeyMaterial = {
  secret: Uint8Array;
  dataKey: Uint8Array;
  digestKey: Uint8Array;
};

export type EnvironmentShareContext = {
  environmentKeyId: string;
  version: number;
  recipientUserId: string;
  recipientBoxPublicKey: string;
};

export type SealedEnvironmentShare = {
  sealedSecret: string;
  signature: string;
};

export type VariableField = "key" | "value" | "note";

export type PlainVariable = {
  key: string;
  value: string;
  note: string | null;
  isCommented: boolean;
};

export type EncryptedVariable = {
  keyDigest: string;
  encryptedKey: string;
  encryptedValue: string;
  encryptedNote: string | null;
  isCommented: boolean;
  keyVersion: number;
};

export type CliKeyMaterial = {
  clientShare: Uint8Array;
  wrapKey: Uint8Array;
};

export type KeyPin = {
  signPublicKey: string;
  email: string | null;
  pinnedAt: string;
};
