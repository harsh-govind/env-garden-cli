import { COMMAND_USAGE, ENVIRONMENT_TYPES } from "../constants/index.js";
import { stringFlag } from "../lib/args.js";
import { confirmDestructive, createCommandContext, requirePositional } from "../lib/command-context.js";
import { pluralize, printTable } from "../lib/format.js";
import { resolveProject, resolveWorkspace } from "../lib/resolve.js";
import type { ManageCommandInput } from "../types/manage.js";

export function parseEnvironments(value: string | undefined): string[] | undefined {
  if (!value) {
    return undefined;
  }

  const environments = value.split(",").map((item) => item.trim().toUpperCase()).filter(Boolean);
  const invalid = environments.filter((item) => !(ENVIRONMENT_TYPES as readonly string[]).includes(item));

  if (invalid.length > 0) {
    throw new Error(`Unknown environment: ${invalid.join(", ")}. Use: ${ENVIRONMENT_TYPES.join(", ").toLowerCase()}.`);
  }

  return environments;
}

export async function projectCommand(input: ManageCommandInput): Promise<void> {
  const api = await createCommandContext(input);
  const action = input.parsed.positionals[0] ?? "list";
  const workspace = await resolveWorkspace(api, stringFlag(input.parsed, "--workspace"));
  const projectQuery = (index: number) => input.parsed.positionals[index] ?? stringFlag(input.parsed, "--project");

  switch (action) {
    case "list": {
      if (workspace.projects.length === 0) {
        console.log(`No projects in ${workspace.name}. Create one with: eit project create <name>`);
        return;
      }

      const projects = await Promise.all(workspace.projects.map((project) => api.getProject(workspace.id, project.id)));
      printTable([
        ["NAME", "ROLE", "ENV FILES", "ID"],
        ...projects.map((project) => [project.name, project.role, String(project.envFiles.length), project.id]),
      ]);
      return;
    }

    case "show": {
      const project = await resolveProject(api, workspace, projectQuery(1));
      console.log(`${workspace.name} / ${project.name}  (${project.role.toLowerCase()})`);

      if (project.description) {
        console.log(project.description);
      }

      printTable([
        ["ENV FILE", "ENVIRONMENT", "VARIABLES", "ID"],
        ...project.envFiles.map((envFile) => [
          envFile.name,
          envFile.environment.toLowerCase(),
          String(envFile.variableCount),
          envFile.id,
        ]),
      ]);
      return;
    }

    case "create": {
      const name = requirePositional(input, 1, "eit project create <name> [--environments production,development]");
      const environments = parseEnvironments(stringFlag(input.parsed, "--environments"));
      const created = await api.createProject(workspace.id, name, environments, stringFlag(input.parsed, "--description"));
      const project = await api.getProject(workspace.id, created.id);
      console.log(`Created project ${project.name} in ${workspace.name} with ${pluralize(project.envFiles.length, "env file")}: ${project.envFiles.map((envFile) => envFile.name).join(", ")}.`);
      return;
    }

    case "rename": {
      const usage = "eit project rename <project> <new-name>";
      const project = await resolveProject(api, workspace, requirePositional(input, 1, usage));
      const name = requirePositional(input, 2, usage);
      await api.renameProject(workspace.id, project.id, name);
      console.log(`Renamed ${project.name} to ${name}.`);
      return;
    }

    case "delete": {
      const project = await resolveProject(api, workspace, requirePositional(input, 1, "eit project delete <project> [--yes]"));

      if (await confirmDestructive(input, `Delete project ${project.name} and its ${pluralize(project.envFiles.length, "env file")}?`)) {
        await api.deleteProject(workspace.id, project.id);
        console.log(`Deleted project ${project.name}.`);
      }

      return;
    }

    default:
      throw new Error(`Unknown action "${action}". Usage: ${COMMAND_USAGE.project}`);
  }
}
