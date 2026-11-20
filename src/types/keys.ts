import type { AccountKeys, EncryptedVariable, KeyPin, PublicAccountKeys } from "./crypto.js";

export type UnlockedAccount = {
  userId: string;
  keys: AccountKeys;
  publicKeys: PublicAccountKeys;
};

export type EnvironmentKeyShareInfo = {
  version: number;
  recipientBoxPublicKey: string;
  sealedSecret: string;
  signature: string;
  granter: {
    userId: string | null;
    email: string | null;
    signPublicKey: string;
  };
};

export type RemoteEnvironmentKey = {
  id: string;
  environment: string;
  version: number;
  rotationRequired: boolean;
  share: EnvironmentKeyShareInfo | null;
};

export type RemoteCipherVariable = EncryptedVariable & {
  id: string;
  position: number;
};

export type CipherVariablesResponse = {
  variables?: RemoteCipherVariable[];
  environmentKey?: RemoteEnvironmentKey;
};

export type NewEnvironmentKeyPayload = {
  id: string;
  environment: string;
  sealedSecret: string;
  signature: string;
};

export type KeyPinStore = Record<string, Record<string, KeyPin[]>>;
