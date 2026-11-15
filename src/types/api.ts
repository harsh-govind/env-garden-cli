export type CliFetch = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Response>;

export type CliUser = {
  id: string;
  email: string;
  name?: string | null;
};

export type VerifyTokenInput = {
  apiUrl: string;
  token: string;
  fetchImplementation?: CliFetch;
};

export type RevokeTokenInput = VerifyTokenInput;

export type CliSessionInfo = {
  user: CliUser;
  expiresAt: string | null;
};

export type ApiRequestInput = {
  apiUrl: string;
  token: string;
  path: string;
  method?: "GET" | "PUT" | "DELETE";
  body?: unknown;
  fetchImplementation?: CliFetch;
};

export type RemoteEnvFile = {
  id: string;
  name: string;
  environment: string;
  variableCount: number;
};

export type RemoteProject = {
  id: string;
  name: string;
  envFiles: RemoteEnvFile[];
};

export type RemoteWorkspace = {
  id: string;
  name: string;
  projects: RemoteProject[];
};

export type RemoteVariable = {
  key: string;
  value: string;
  note: string | null;
  isCommented: boolean;
};
