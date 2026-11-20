import type { CliFetch } from "./api.js";

export type LoginOptions = {
  apiUrl?: string;
  openBrowser?: boolean;
  fetchImplementation?: CliFetch;
  openBrowserImplementation?: (url: string) => Promise<boolean>;
  sleepImplementation?: (milliseconds: number) => Promise<void>;
};

export type RequestAuthorizationInput = {
  apiUrl: string;
  tokenHash: string;
  tokenPrefix: string;
  tokenName: string;
  transportPublicKey: string;
  fetchImplementation?: CliFetch;
};

export type CreateCliLoginRequestPayload = Pick<
  RequestAuthorizationInput,
  "tokenHash" | "tokenPrefix" | "tokenName" | "transportPublicKey"
>;

export type ReadAuthorizationStatusInput = {
  apiUrl: string;
  requestId: string;
  pollSecret: string;
  fetchImplementation?: CliFetch;
};

export type LocalCliToken = {
  token: string;
  tokenHash: string;
  tokenPrefix: string;
};

export type CliLoginRequest = {
  requestId: string;
  pollSecret: string;
  authorizationUrl: string;
  expiresAt: string;
  intervalSeconds: number;
};

export type CliLoginStatus =
  | { status: "PENDING" | "EXPIRED" }
  | { status: "APPROVED"; sealedPackage: string };
