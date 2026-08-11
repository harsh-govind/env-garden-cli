export type CliFetch = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Response>;

export type CliUser = {
  id: string;
  email: string;
  name?: string | null;
};

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
  fetchImplementation?: CliFetch;
};

export type CreateCliLoginRequestPayload = Pick<
  RequestAuthorizationInput,
  "tokenHash" | "tokenPrefix" | "tokenName"
>;

export type ReadAuthorizationStatusInput = {
  apiUrl: string;
  requestId: string;
  pollSecret: string;
  fetchImplementation?: CliFetch;
};

export type VerifyTokenInput = {
  apiUrl: string;
  token: string;
  fetchImplementation?: CliFetch;
};

export type SaveCredentialsInput = {
  apiUrl: string;
  token: string;
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

export type CliLoginStatus = "PENDING" | "APPROVED" | "EXPIRED";
