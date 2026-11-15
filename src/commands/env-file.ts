import { COMMAND_USAGE, ENVIRONMENT_TYPES } from "../constants/index.js";
import { stringFlag } from "../lib/args.js";
import { confirmDestructive, createCommandContext, requirePositional } from "../lib/command-context.js";
import { pluralize, printTable } from "../lib/format.js";
import { resolveEnvFile, resolveProject, resolveWorkspace } from "../lib/resolve.js";
import type { ManageCommandInput } from "../types/manage.js";

export async function envFileCommand(input: ManageCommandInput): Promise<void> {
  const api = await createCommandContext(input);
  const action = input.parsed.positionals[0] ?? "list";
  const workspace = await resolveWorkspace(api, stringFlag(input.parsed, "--workspace"));
  const project = await resolveProject(api, workspace, stringFlag(input.parsed, "--project"));

  switch (action) {
    case "list": {
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
      const usage = `eit env create <name> --environment <${ENVIRONMENT_TYPES.join("|").toLowerCase()}>`;
      const name = requirePositional(input, 1, usage);
      const environment = stringFlag(input.parsed, "--environment")?.toUpperCase();

      if (!environment || !(ENVIRONMENT_TYPES as readonly string[]).includes(environment)) {
        throw new Error(`Usage: ${usage}`);
      }

      const envFile = await api.createEnvFile(workspace.id, project.id, name, environment, stringFlag(input.parsed, "--description"));
      console.log(`Created ${envFile.name} (${environment.toLowerCase()}) in ${project.name}.`);
      return;
    }

    case "rename": {
      const usage = "eit env rename <env-file> <new-name>";
      const envFile = resolveEnvFile(project, requirePositional(input, 1, usage));
      const name = requirePositional(input, 2, usage);
      await api.renameEnvFile(workspace.id, project.id, envFile.id, name);
      console.log(`Renamed ${envFile.name} to ${name}.`);
      return;
    }

    case "delete": {
      const envFile = resolveEnvFile(project, requirePositional(input, 1, "eit env delete <env-file> [--yes]"));

      if (await confirmDestructive(input, `Delete ${envFile.name} and its ${pluralize(envFile.variableCount, "variable")}?`)) {
        await api.deleteEnvFile(workspace.id, project.id, envFile.id);
        console.log(`Deleted ${envFile.name}.`);
      }

      return;
    }

    default:
      throw new Error(`Unknown action "${action}". Usage: ${COMMAND_USAGE.envFile}`);
  }
}
