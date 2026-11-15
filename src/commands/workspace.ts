import { COMMAND_USAGE } from "../constants/index.js";
import { stringFlag } from "../lib/args.js";
import { confirmDestructive, createCommandContext, requirePositional } from "../lib/command-context.js";
import { pluralize, printTable } from "../lib/format.js";
import { resolveWorkspace } from "../lib/resolve.js";
import type { ManageCommandInput } from "../types/manage.js";

export async function workspaceCommand(input: ManageCommandInput): Promise<void> {
  const api = await createCommandContext(input);
  const action = input.parsed.positionals[0] ?? "list";
  const target = (index: number) => input.parsed.positionals[index] ?? stringFlag(input.parsed, "--workspace");

  switch (action) {
    case "list": {
      const workspaces = await api.listWorkspaces();
      const details = await Promise.all(workspaces.map((workspace) => api.getWorkspace(workspace.id)));
      printTable([
        ["NAME", "ROLE", "PROJECTS", "MEMBERS", "ID"],
        ...details.map((workspace) => [
          workspace.name,
          workspace.role,
          String(workspace.projectCount),
          String(workspace.memberCount),
          workspace.id,
        ]),
      ]);
      return;
    }

    case "show": {
      const workspace = await resolveWorkspace(api, target(1));
      console.log(`${workspace.name}  (${workspace.role.toLowerCase()})`);
      console.log(`${pluralize(workspace.projectCount, "project")} · ${pluralize(workspace.memberCount, "member")} · ${pluralize(workspace.historyCount, "history entry", "history entries")}`);
      workspace.projects.forEach((project) => console.log(`  ${project.name}`));
      return;
    }

    case "create": {
      const name = requirePositional(input, 1, "eit workspace create <name> [--description <text>]");
      const workspaceId = await api.createWorkspace(name, stringFlag(input.parsed, "--description"));
      console.log(`Created workspace ${name} (${workspaceId}).`);
      return;
    }

    case "rename": {
      const name = requirePositional(input, 2, "eit workspace rename <workspace> <new-name>");
      const workspace = await resolveWorkspace(api, requirePositional(input, 1, "eit workspace rename <workspace> <new-name>"));
      await api.renameWorkspace(workspace.id, name);
      console.log(`Renamed ${workspace.name} to ${name}.`);
      return;
    }

    case "delete": {
      const workspace = await resolveWorkspace(api, requirePositional(input, 1, "eit workspace delete <workspace> [--yes]"));

      if (await confirmDestructive(input, `Delete workspace ${workspace.name} and all its projects and env files?`)) {
        await api.deleteWorkspace(workspace.id);
        console.log(`Deleted workspace ${workspace.name}.`);
      }

      return;
    }

    default:
      throw new Error(`Unknown action "${action}". Usage: ${COMMAND_USAGE.workspace}`);
  }
}
