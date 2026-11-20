import { apiRequest } from "./api.js";
import { unlockAccount } from "./account-keys.js";
import { wipeEnvironmentKey } from "./crypto/environment.js";
import {
  decryptRemoteVariables,
  encryptForPush,
  openRemoteEnvironmentKey,
} from "./environment-keys.js";
import type {
  PushVariablesResponse,
  RemoteEnvFile,
  RemoteOptions,
  RemoteState,
  RemoteVariable,
  RemoteWorkspace,
  WorkspacesResponse,
} from "../types/api.js";
import type { StoredCliCredentials } from "../types/credentials.js";
import type { PushPayload } from "../types/commands.js";
import type { CipherVariablesResponse } from "../types/keys.js";
import type { NamedEntity, ProjectLink } from "../types/project.js";

function withFetch(options: RemoteOptions) {
  return options.fetchImplementation
    ? { fetchImplementation: options.fetchImplementation }
    : {};
}

function variablesPath(link: Pick<ProjectLink, "workspaceId" | "projectId" | "envFileId">) {
  return [
    "/api/cli/v1/workspaces",
    encodeURIComponent(link.workspaceId),
    "projects",
    encodeURIComponent(link.projectId),
    "env-files",
    encodeURIComponent(link.envFileId),
    "variables",
  ].join("/");
}

export async function fetchWorkspaces(
  credentials: StoredCliCredentials,
  options: RemoteOptions = {}
): Promise<RemoteWorkspace[]> {
  const payload = await apiRequest<WorkspacesResponse>({
    apiUrl: credentials.apiUrl,
    token: credentials.token,
    path: "/api/cli/v1/projects",
    ...withFetch(options),
  });

  if (!Array.isArray(payload.workspaces)) {
    throw new Error("Env Garden returned an invalid project list.");
  }

  return payload.workspaces;
}

export async function fetchRemoteState(
  credentials: StoredCliCredentials,
  link: Pick<ProjectLink, "workspaceId" | "projectId" | "envFileId">,
  options: RemoteOptions = {}
): Promise<RemoteState> {
  const account = await unlockAccount(credentials, options);
  const payload = await apiRequest<CipherVariablesResponse>({
    apiUrl: credentials.apiUrl,
    token: credentials.token,
    path: variablesPath(link),
    ...withFetch(options),
  });

  if (!Array.isArray(payload.variables) || !payload.environmentKey) {
    throw new Error("Env Garden returned an invalid variable list.");
  }

  const material = await openRemoteEnvironmentKey({
    credentials,
    account,
    environmentKey: payload.environmentKey,
  });

  try {
    const plainVariables = await decryptRemoteVariables({
      variables: payload.variables,
      envFileId: link.envFileId,
      material,
    });

    return {
      variables: plainVariables,
      entries: plainVariables.map((plain, index) => ({ plain, cipher: payload.variables![index]! })),
      keyVersion: payload.environmentKey.version,
      material,
    };
  } catch (error) {
    await wipeEnvironmentKey(material);
    throw error;
  }
}

export async function fetchVariables(
  credentials: StoredCliCredentials,
  link: Pick<ProjectLink, "workspaceId" | "projectId" | "envFileId">,
  options: RemoteOptions = {}
): Promise<RemoteVariable[]> {
  const state = await fetchRemoteState(credentials, link, options);
  await wipeEnvironmentKey(state.material);
  return state.variables;
}

export async function pushVariables(
  credentials: StoredCliCredentials,
  link: Pick<ProjectLink, "workspaceId" | "projectId" | "envFileId">,
  variables: RemoteVariable[],
  state: RemoteState,
  options: RemoteOptions = {}
): Promise<number> {
  const body: PushPayload = {
    variables: await encryptForPush({
      local: variables,
      remote: state.entries,
      envFileId: link.envFileId,
      keyVersion: state.keyVersion,
      material: state.material,
    }),
  };
  const payload = await apiRequest<PushVariablesResponse>({
    apiUrl: credentials.apiUrl,
    token: credentials.token,
    path: variablesPath(link),
    method: "PUT",
    body,
    ...withFetch(options),
  });

  return typeof payload.count === "number" ? payload.count : variables.length;
}

export function matchByIdOrName<T extends NamedEntity>(
  items: T[],
  query: string,
  extraField?: (item: T) => string
): T | undefined {
  const normalized = query.trim().toLowerCase();

  return (
    items.find((item) => item.id === query)
    ?? items.find((item) => item.name.toLowerCase() === normalized)
    ?? (extraField
      ? items.find((item) => extraField(item).toLowerCase() === normalized)
      : undefined)
  );
}

export async function resolveTargetEnvFile(
  credentials: StoredCliCredentials,
  link: ProjectLink,
  envQuery: string | undefined,
  options: RemoteOptions = {}
): Promise<ProjectLink> {
  if (!envQuery) {
    return link;
  }

  const workspaces = await fetchWorkspaces(credentials, options);
  const project = workspaces
    .find((workspace) => workspace.id === link.workspaceId)
    ?.projects.find((candidate) => candidate.id === link.projectId);

  if (!project) {
    throw new Error(`Linked project "${link.projectName}" is no longer accessible.`);
  }

  const envFile: RemoteEnvFile | undefined = matchByIdOrName(
    project.envFiles,
    envQuery,
    (file) => file.environment
  );

  if (!envFile) {
    const available = project.envFiles.map((file) => file.name).join(", ") || "none";
    throw new Error(`No env file "${envQuery}" in ${project.name}. Available: ${available}.`);
  }

  return { ...link, envFileId: envFile.id, envFileName: envFile.name };
}
