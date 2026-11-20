import type { EnvironmentKeyMaterial, PlainVariable } from "./crypto.js";
import type { RemoteCipherVariable } from "./keys.js";

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
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
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

export type RemoteVariable = PlainVariable;

export type RemoteState = {
  variables: RemoteVariable[];
  entries: { plain: RemoteVariable; cipher: RemoteCipherVariable }[];
  keyVersion: number;
  material: EnvironmentKeyMaterial;
};

export type RemoteOptions = {
  fetchImplementation?: CliFetch;
};

export type WorkspacesResponse = {
  workspaces?: RemoteWorkspace[];
};

export type PushVariablesResponse = {
  count?: number;
};
