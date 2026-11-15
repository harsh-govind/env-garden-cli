import { findProjectLink } from "./project-config.js";
import { matchByIdOrName } from "./remote.js";
import type {
  EnvFileSummary,
  ProjectDetail,
  WorkspaceApi,
  WorkspaceDetail,
} from "../types/manage.js";
import type { NamedEntity } from "../types/project.js";

function names(items: NamedEntity[]) {
  return items.map((item) => item.name).join(", ") || "none";
}

/** Workspace from `--workspace`, else the folder link, else the only workspace. */
export async function resolveWorkspace(api: WorkspaceApi, query: string | undefined): Promise<WorkspaceDetail> {
  const workspaces = await api.listWorkspaces();
  let workspaceId: string | undefined;

  if (query) {
    workspaceId = matchByIdOrName(workspaces, query)?.id;

    if (!workspaceId) {
      throw new Error(`Workspace "${query}" not found. Available: ${names(workspaces)}.`);
    }
  } else {
    const linked = (await findProjectLink())?.link;

    if (linked && workspaces.some((workspace) => workspace.id === linked.workspaceId)) {
      workspaceId = linked.workspaceId;
    } else if (workspaces.length === 1) {
      workspaceId = workspaces[0]?.id;
    } else {
      throw new Error(`Pass --workspace <name>. Available: ${names(workspaces)}.`);
    }
  }

  return api.getWorkspace(workspaceId as string);
}

/** Project from a name/id, else the folder link (within the workspace). */
export async function resolveProject(
  api: WorkspaceApi,
  workspace: WorkspaceDetail,
  query: string | undefined
): Promise<ProjectDetail> {
  let projectId: string | undefined;

  if (query) {
    projectId = matchByIdOrName(workspace.projects, query)?.id;

    if (!projectId) {
      throw new Error(`Project "${query}" not found in ${workspace.name}. Available: ${names(workspace.projects)}.`);
    }
  } else {
    const linked = (await findProjectLink())?.link;

    if (linked?.workspaceId === workspace.id) {
      projectId = linked.projectId;
    } else if (workspace.projects.length === 1) {
      projectId = workspace.projects[0]?.id;
    } else {
      throw new Error(`Pass --project <name>. Available: ${names(workspace.projects)}.`);
    }
  }

  return api.getProject(workspace.id, projectId as string);
}

export function resolveEnvFile(project: ProjectDetail, query: string): EnvFileSummary {
  const envFile = matchByIdOrName(project.envFiles, query, (file) => file.environment);

  if (!envFile) {
    throw new Error(`Env file "${query}" not found in ${project.name}. Available: ${names(project.envFiles)}.`);
  }

  return envFile;
}
