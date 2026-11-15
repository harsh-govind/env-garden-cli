import { matchByIdOrName, fetchWorkspaces } from "../lib/remote.js";
import { select } from "../lib/prompt.js";
import { deleteProjectLink, writeProjectLink } from "../lib/project-config.js";
import { requireCredentials } from "../lib/session.js";
import type { CliFetch, RemoteEnvFile, RemoteProject, RemoteWorkspace } from "../types/api.js";

export type LinkOptions = {
  workspace?: string;
  project?: string;
  env?: string;
  fetchImplementation?: CliFetch;
};

async function pick<T extends { id: string; name: string }>(
  label: string,
  items: T[],
  query: string | undefined,
  describe: (item: T) => string = (item) => item.name,
  extraField?: (item: T) => string
): Promise<T> {
  if (query) {
    const match = matchByIdOrName(items, query, extraField);

    if (!match) {
      throw new Error(`${label} "${query}" not found.`);
    }

    return match;
  }

  return select(label, items.map((item) => ({ title: describe(item), value: item })));
}

export async function link(options: LinkOptions = {}): Promise<void> {
  const credentials = await requireCredentials();
  const workspaces = await fetchWorkspaces(
    credentials,
    options.fetchImplementation ? { fetchImplementation: options.fetchImplementation } : {}
  );

  const workspace: RemoteWorkspace = await pick("Workspace", workspaces, options.workspace);
  const project: RemoteProject = await pick("Project", workspace.projects, options.project);
  const envFile: RemoteEnvFile = await pick(
    "Env file",
    project.envFiles,
    options.env,
    (file) => `${file.name} (${file.environment}, ${file.variableCount} vars)`,
    (file) => file.environment
  );

  const path = await writeProjectLink({
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    projectId: project.id,
    projectName: project.name,
    envFileId: envFile.id,
    envFileName: envFile.name,
  });

  console.log(`Linked to ${workspace.name} / ${project.name} / ${envFile.name}.`);
  console.log(`Saved ${path}. It contains no secrets and can be committed.`);
}

export async function unlink(): Promise<void> {
  const removed = await deleteProjectLink();
  console.log(removed ? "Unlinked this folder." : "This folder isn't linked.");
}
