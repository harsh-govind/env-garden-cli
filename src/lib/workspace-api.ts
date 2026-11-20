import { DEFAULT_PROJECT_ENVIRONMENTS } from "../constants/crypto.js";
import { unlockAccount } from "./account-keys.js";
import { apiRequest } from "./api.js";
import { createEnvironmentKeysForSelf } from "./environment-keys.js";
import type { CliFetch } from "../types/api.js";
import type { StoredCliCredentials } from "../types/credentials.js";
import type {
  CreatedProjectResponse,
  CreatedWorkspaceResponse,
  EnvFileResponse,
  HistoryPage,
  MemberAccessPayload,
  MemberResponse,
  ProjectResponse,
  WorkspaceMembers,
  WorkspaceResponse,
  WorkspacesResponse,
} from "../types/manage.js";

/** Thin typed client over the same /api/workspaces routes the web app uses. */
export function createWorkspaceApi(credentials: StoredCliCredentials, fetchImplementation?: CliFetch) {
  const request = <T>(path: string, method: "GET" | "POST" | "PATCH" | "DELETE" = "GET", body?: unknown) =>
    apiRequest<T>({
      apiUrl: credentials.apiUrl,
      token: credentials.token,
      path: `/api/workspaces${path}`,
      method,
      ...(body === undefined ? {} : { body }),
      ...(fetchImplementation ? { fetchImplementation } : {}),
    });
  const id = encodeURIComponent;
  const unlock = () => unlockAccount(credentials, fetchImplementation ? { fetchImplementation } : {});
  const getProject = async (workspaceId: string, projectId: string) =>
    (await request<ProjectResponse>(`/${id(workspaceId)}/projects/${id(projectId)}`)).project;

  return {
    listWorkspaces: async () => (await request<WorkspacesResponse>("")).workspaces,
    getWorkspace: async (workspaceId: string) =>
      (await request<WorkspaceResponse>(`/${id(workspaceId)}`)).workspace,
    createWorkspace: async (name: string, description?: string) =>
      (await request<CreatedWorkspaceResponse>("", "POST", { name, ...(description ? { description } : {}) })).workspaceId,
    renameWorkspace: (workspaceId: string, name: string) => request(`/${id(workspaceId)}`, "PATCH", { name }),
    deleteWorkspace: (workspaceId: string) => request(`/${id(workspaceId)}`, "DELETE"),

    getProject,
    createProject: async (workspaceId: string, name: string, environments?: string[], description?: string) => {
      const selectedEnvironments = environments?.length ? environments : [...DEFAULT_PROJECT_ENVIRONMENTS];
      const environmentKeys = await createEnvironmentKeysForSelf(await unlock(), selectedEnvironments);

      return (await request<CreatedProjectResponse>(`/${id(workspaceId)}/projects`, "POST", {
        name,
        environments: selectedEnvironments,
        environmentKeys,
        ...(description ? { description } : {}),
      })).project;
    },
    renameProject: (workspaceId: string, projectId: string, name: string) =>
      request(`/${id(workspaceId)}/projects/${id(projectId)}`, "PATCH", { name }),
    deleteProject: (workspaceId: string, projectId: string) =>
      request(`/${id(workspaceId)}/projects/${id(projectId)}`, "DELETE"),

    createEnvFile: async (workspaceId: string, projectId: string, name: string, environment: string, description?: string) => {
      const project = await getProject(workspaceId, projectId);
      const needsKey = !project.environmentKeys.some((key) => key.environment === environment);
      const [environmentKey] = needsKey
        ? await createEnvironmentKeysForSelf(await unlock(), [environment])
        : [];

      return (await request<EnvFileResponse>(`/${id(workspaceId)}/projects/${id(projectId)}/env-files`, "POST", {
        name,
        environment,
        ...(environmentKey
          ? {
            environmentKey: {
              id: environmentKey.id,
              sealedSecret: environmentKey.sealedSecret,
              signature: environmentKey.signature,
            },
          }
          : {}),
        ...(description ? { description } : {}),
      })).envFile;
    },
    renameEnvFile: (workspaceId: string, projectId: string, envFileId: string, name: string) =>
      request(`/${id(workspaceId)}/projects/${id(projectId)}/env-files/${id(envFileId)}`, "PATCH", { name }),
    deleteEnvFile: (workspaceId: string, projectId: string, envFileId: string) =>
      request(`/${id(workspaceId)}/projects/${id(projectId)}/env-files/${id(envFileId)}`, "DELETE"),

    listMembers: (workspaceId: string) => request<WorkspaceMembers>(`/${id(workspaceId)}/members`),
    inviteMember: (workspaceId: string, email: string, access: MemberAccessPayload) =>
      request(`/${id(workspaceId)}/members`, "POST", { email, ...access }),
    updateMember: async (workspaceId: string, memberId: string, access: MemberAccessPayload) =>
      (await request<MemberResponse>(`/${id(workspaceId)}/members/${id(memberId)}`, "PATCH", access)).member,
    removeMember: (workspaceId: string, memberId: string) =>
      request(`/${id(workspaceId)}/members/${id(memberId)}`, "DELETE"),
    revokeInvite: (workspaceId: string, inviteId: string) =>
      request(`/${id(workspaceId)}/invites/${id(inviteId)}`, "DELETE"),

    getHistory: (workspaceId: string, search?: string, cursor?: string) => {
      const query = new URLSearchParams();
      if (search) query.set("q", search);
      if (cursor) query.set("cursor", cursor);
      const suffix = query.size > 0 ? `?${query.toString()}` : "";
      return request<HistoryPage>(`/${id(workspaceId)}/history${suffix}`);
    },
  };
}
