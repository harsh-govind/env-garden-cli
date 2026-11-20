import type { CliFetch } from "./api.js";
import type { EncryptedVariable } from "./crypto.js";

export type LogoutOptions = {
  localOnly?: boolean;
  fetchImplementation?: CliFetch;
};

export type StatusOptions = {
  fetchImplementation?: CliFetch;
};

export type ListOptions = {
  fetchImplementation?: CliFetch;
};

export type LinkOptions = {
  workspace?: string;
  project?: string;
  env?: string;
  fetchImplementation?: CliFetch;
};

export type PullOptions = {
  env?: string;
  output?: string;
  force?: boolean;
  fetchImplementation?: CliFetch;
};

export type PushOptions = {
  env?: string;
  file?: string;
  yes?: boolean;
  fetchImplementation?: CliFetch;
};

export type RunOptions = {
  env?: string;
  command: string[];
  fetchImplementation?: CliFetch;
};

export type VariableDiff = {
  added: string[];
  removed: string[];
  changed: string[];
};

export type PushPayload = {
  variables: EncryptedVariable[];
};

export type KeysCommandOptions = {
  action: string | undefined;
  subject?: string;
  fetchImplementation?: CliFetch;
};
