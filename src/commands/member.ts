import { ASSIGNABLE_PROJECT_ROLES, ASSIGNABLE_WORKSPACE_ROLES, COMMAND_USAGE } from "../constants/index.js";
import { stringFlag } from "../lib/args.js";
import { confirmDestructive, createCommandContext, requirePositional } from "../lib/command-context.js";
import { formatDateTime, printTable } from "../lib/format.js";
import { matchByIdOrName } from "../lib/remote.js";
import { resolveWorkspace } from "../lib/resolve.js";
import type {
  ManageCommandInput,
  MemberAccessPayload,
  ProjectRole,
  WorkspaceDetail,
  WorkspaceRole,
} from "../types/manage.js";

function parseRole<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T, label: string): T {
  if (!value) {
    return fallback;
  }

  const upper = value.toUpperCase() as T;

  if (!allowed.includes(upper)) {
    throw new Error(`--${label} must be one of: ${allowed.join(", ").toLowerCase()}.`);
  }

  return upper;
}

/** Builds the access payload the web app sends from CLI flags. */
export function buildMemberAccess(input: ManageCommandInput, workspace: WorkspaceDetail): MemberAccessPayload {
  const role = parseRole<WorkspaceRole>(
    stringFlag(input.parsed, "--role"),
    ASSIGNABLE_WORKSPACE_ROLES as readonly WorkspaceRole[],
    "MEMBER",
    "role"
  );
  const projectRole = parseRole<ProjectRole>(
    stringFlag(input.parsed, "--project-role"),
    ASSIGNABLE_PROJECT_ROLES as readonly ProjectRole[],
    "VIEWER",
    "project-role"
  );
  const projectsFlag = stringFlag(input.parsed, "--projects");

  if (role === "ADMIN" || !projectsFlag) {
    return { role, projectAccessScope: "ALL_PROJECTS", defaultProjectRole: projectRole };
  }

  const projects = projectsFlag.split(",").map((query) => {
    const project = matchByIdOrName(workspace.projects, query.trim());

    if (!project) {
      throw new Error(`Project "${query.trim()}" not found in ${workspace.name}.`);
    }

    return { projectId: project.id, role: projectRole, environmentAccessScope: "ALL_ENVIRONMENTS" as const, environments: [] };
  });

  return { role, projectAccessScope: "SELECTED_PROJECTS", defaultProjectRole: projectRole, projects };
}

export async function memberCommand(input: ManageCommandInput): Promise<void> {
  const api = await createCommandContext(input);
  const action = input.parsed.positionals[0] ?? "list";
  const workspace = await resolveWorkspace(api, stringFlag(input.parsed, "--workspace"));

  switch (action) {
    case "list": {
      const { members, invites } = await api.listMembers(workspace.id);
      printTable([
        ["EMAIL", "NAME", "ROLE", "PROJECT ACCESS"],
        ...members.map((member) => [
          member.email,
          member.name ?? "",
          member.role.toLowerCase(),
          member.projectAccessScope === "ALL_PROJECTS" ? `all (${member.defaultProjectRole.toLowerCase()})` : "selected",
        ]),
      ]);

      const pending = invites.filter((invite) => invite.status === "PENDING");

      if (pending.length > 0) {
        console.log("\nPending invites:");
        printTable([
          ["EMAIL", "ROLE", "EXPIRES"],
          ...pending.map((invite) => [invite.email, invite.role.toLowerCase(), formatDateTime(invite.expiresAt)]),
        ]);
      }

      return;
    }

    case "invite": {
      const email = requirePositional(input, 1, "eit member invite <email> [--role member|admin] [--projects a,b] [--project-role viewer|contributor]");
      await api.inviteMember(workspace.id, email, buildMemberAccess(input, workspace));
      console.log(`Invited ${email} to ${workspace.name}.`);
      return;
    }

    case "update": {
      const email = requirePositional(input, 1, "eit member update <email> --role member|admin [--projects a,b] [--project-role viewer|contributor]");
      const { members } = await api.listMembers(workspace.id);
      const member = members.find((candidate) => candidate.email.toLowerCase() === email.toLowerCase());

      if (!member) {
        throw new Error(`${email} isn't a member of ${workspace.name}.`);
      }

      const updated = await api.updateMember(workspace.id, member.id, buildMemberAccess(input, workspace));
      console.log(`Updated ${updated.email}: ${updated.role.toLowerCase()}.`);
      return;
    }

    case "remove": {
      const email = requirePositional(input, 1, "eit member remove <email> [--yes]");
      const { members } = await api.listMembers(workspace.id);
      const member = members.find((candidate) => candidate.email.toLowerCase() === email.toLowerCase());

      if (!member) {
        throw new Error(`${email} isn't a member of ${workspace.name}.`);
      }

      if (await confirmDestructive(input, `Remove ${member.email} from ${workspace.name}?`)) {
        await api.removeMember(workspace.id, member.id);
        console.log(`Removed ${member.email} from ${workspace.name}.`);
      }

      return;
    }

    default:
      throw new Error(`Unknown action "${action}". Usage: ${COMMAND_USAGE.member}`);
  }
}

export async function inviteCommand(input: ManageCommandInput): Promise<void> {
  const api = await createCommandContext(input);
  const action = input.parsed.positionals[0];

  if (action !== "revoke") {
    throw new Error("Usage: eit invite revoke <email> [--workspace <name>]. List invites with: eit member list");
  }

  const workspace = await resolveWorkspace(api, stringFlag(input.parsed, "--workspace"));
  const email = requirePositional(input, 1, "eit invite revoke <email>");
  const { invites } = await api.listMembers(workspace.id);
  const invite = invites.find((candidate) => candidate.status === "PENDING" && candidate.email.toLowerCase() === email.toLowerCase());

  if (!invite) {
    throw new Error(`No pending invite for ${email} in ${workspace.name}.`);
  }

  await api.revokeInvite(workspace.id, invite.id);
  console.log(`Revoked invite for ${invite.email}.`);
}
