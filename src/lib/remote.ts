import { apiRequest } from "./api.js";
import type {
  CliFetch,
  RemoteEnvFile,
  RemoteVariable,
  RemoteWorkspace,
} from "../types/api.js";
import type { StoredCliCredentials } from "../types/credentials.js";
import type { ProjectLink } from "../types/project.js";

type RemoteOptions = {
  fetchImplementation?: CliFetch;
};

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
  const payload = await apiRequest<{ workspaces?: RemoteWorkspace[] }>({
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

export async function fetchVariables(
  credentials: StoredCliCredentials,
  link: Pick<ProjectLink, "workspaceId" | "projectId" | "envFileId">,
  options: RemoteOptions = {}
): Promise<RemoteVariable[]> {
  const payload = await apiRequest<{ variables?: RemoteVariable[] }>({
    apiUrl: credentials.apiUrl,
    token: credentials.token,
    path: variablesPath(link),
    ...withFetch(options),
  });

  if (!Array.isArray(payload.variables)) {
    throw new Error("Env Garden returned an invalid variable list.");
  }

  return payload.variables;
}

export async function pushVariables(
  credentials: StoredCliCredentials,
  link: Pick<ProjectLink, "workspaceId" | "projectId" | "envFileId">,
  variables: RemoteVariable[],
  options: RemoteOptions = {}
): Promise<number> {
  const payload = await apiRequest<{ count?: number }>({
    apiUrl: credentials.apiUrl,
    token: credentials.token,
    path: variablesPath(link),
    method: "PUT",
    body: { variables },
    ...withFetch(options),
  });

  return typeof payload.count === "number" ? payload.count : variables.length;
}

/** Case-insensitive match on id or name (or environment for env files). */
export function matchByIdOrName<T extends { id: string; name: string }>(
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

/**
 * Picks the env file for a command: the linked one, or `--env <name>` within
 * the linked project.
 */
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
