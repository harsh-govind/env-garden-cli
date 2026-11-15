import { pluralize } from "../lib/format.js";
import { findProjectLink } from "../lib/project-config.js";
import { fetchWorkspaces } from "../lib/remote.js";
import { requireCredentials } from "../lib/session.js";
import type { CliFetch } from "../types/api.js";

export async function list(options: { fetchImplementation?: CliFetch } = {}): Promise<void> {
  const credentials = await requireCredentials();
  const [workspaces, found] = await Promise.all([
    fetchWorkspaces(
      credentials,
      options.fetchImplementation ? { fetchImplementation: options.fetchImplementation } : {}
    ),
    findProjectLink(),
  ]);
  const linkedEnvFileId = found?.link.envFileId;

  if (workspaces.length === 0) {
    console.log("No workspaces yet. Create one at env.garden.");
    return;
  }

  for (const workspace of workspaces) {
    console.log(workspace.name);

    if (workspace.projects.length === 0) {
      console.log("  (no projects)");
    }

    for (const project of workspace.projects) {
      console.log(`  ${project.name}`);

      for (const envFile of project.envFiles) {
        const marker = envFile.id === linkedEnvFileId ? "  ← linked" : "";
        console.log(
          `    ${envFile.name}  ${envFile.environment} · ${pluralize(envFile.variableCount, "var")}${marker}`
        );
      }
    }
  }
}
