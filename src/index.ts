#!/usr/bin/env node

import { CLI_VALUE_FLAGS, CLI_VERSION, MANAGE_COMMANDS, MANAGE_FLAGS } from "./constants/index.js";
import { link, unlink } from "./commands/link.js";
import { list } from "./commands/list.js";
import { login } from "./commands/login.js";
import { logout } from "./commands/logout.js";
import { pull } from "./commands/pull.js";
import { push } from "./commands/push.js";
import { run as runCommand } from "./commands/run.js";
import { status } from "./commands/status.js";
import { envFileCommand } from "./commands/env-file.js";
import { historyCommand } from "./commands/history.js";
import { keysCommand } from "./commands/keys.js";
import { inviteCommand, memberCommand } from "./commands/member.js";
import { projectCommand } from "./commands/project.js";
import { workspaceCommand } from "./commands/workspace.js";
import {
  assertKnownFlags,
  booleanFlag,
  parseArgs,
  stringFlag,
} from "./lib/args.js";

function printHelp() {
  console.log(`eit - Env Garden CLI

Account:
  eit login [--api-url <url>] [--no-browser]   Sign in (session lasts 7 days)
  eit logout [--local]                         Sign out and revoke this device
  eit status                                   Show account, session and link
  eit keys [fingerprint]                       Show this account's key fingerprint
  eit keys trust <email>                       Accept a teammate's new key after they reset it

Env files in this folder:
  eit link [--workspace] [--project] [--env]   Link this folder to an env file
  eit unlink                                   Remove the link
  eit pull [--env <name>] [-o <file>] [--force]
  eit push [--env <name>] [-f <file>] [--yes]
  eit run [--env <name>] -- <command>
  eit list                                     Workspaces, projects and env files

Workspaces:
  eit workspace list | show [<ws>] | create <name> | rename <ws> <name> | delete <ws>

Projects (--workspace <name>):
  eit project list | show [<project>] | create <name> [--environments production,development]
  eit project rename <project> <name> | delete <project>

Env files (--workspace, --project):
  eit env list | create <name> --environment <type> | rename <file> <name> | delete <file>

Members (--workspace <name>):
  eit member list
  eit member invite <email> [--role member|admin] [--projects a,b] [--project-role viewer|contributor]
  eit member update <email> --role member|admin [--projects a,b] [--project-role ...]
  eit member remove <email>
  eit invite revoke <email>

History (--workspace <name>):
  eit history [--search <text>] [--limit <n>]

--workspace and --project accept a name or id and default to the folder link.
Deletes and removals ask first; pass --yes to skip.

Environment variables:
  EIT_TOKEN          Service account token for CI (overrides eit login)
  EIT_API_URL        Env Garden API URL
  EIT_TOKEN_NAME     Name shown on the authorization screen
  EIT_CONFIG_DIR     Override the credentials directory`);
}

export async function run(args: string[]) {
  try {
    if (args.length === 0 || args[0] === "--help" || args[0] === "-h" || args[0] === "help") {
      printHelp();
      return;
    }

    if (args[0] === "--version" || args[0] === "-v") {
      console.log(CLI_VERSION);
      return;
    }

    const parsed = parseArgs(args, CLI_VALUE_FLAGS);
    const env = stringFlag(parsed, "--env");

    if (parsed.passthrough.length > 0 && parsed.command !== "run") {
      throw new Error("Only `eit run` accepts a command after --.");
    }

    const manage = { parsed };
    const manageFlags = [...MANAGE_FLAGS];

    if (
      parsed.positionals.length > 0
      && !(MANAGE_COMMANDS as readonly string[]).includes(parsed.command ?? "")
    ) {
      throw new Error(`Unexpected argument: ${parsed.positionals[0]}`);
    }

    switch (parsed.command) {
      case "status":
      case undefined: {
        if (parsed.command === undefined && !parsed.flags.has("--status")) {
          throw new Error("Missing command. Run eit --help.");
        }

        assertKnownFlags(parsed, ["--status"]);
        await status();
        return;
      }

      case "login": {
        assertKnownFlags(parsed, ["--api-url", "--no-browser"]);
        const apiUrl = stringFlag(parsed, "--api-url");
        await login({
          ...(apiUrl ? { apiUrl } : {}),
          openBrowser: !booleanFlag(parsed, "--no-browser"),
        });
        return;
      }

      case "logout":
        assertKnownFlags(parsed, ["--local"]);
        await logout({ localOnly: booleanFlag(parsed, "--local") });
        return;

      case "link": {
        assertKnownFlags(parsed, ["--workspace", "--project", "--env"]);
        const workspace = stringFlag(parsed, "--workspace");
        const project = stringFlag(parsed, "--project");
        await link({
          ...(workspace ? { workspace } : {}),
          ...(project ? { project } : {}),
          ...(env ? { env } : {}),
        });
        return;
      }

      case "unlink":
        assertKnownFlags(parsed, []);
        await unlink();
        return;

      case "list":
      case "ls":
        assertKnownFlags(parsed, []);
        await list();
        return;

      case "pull": {
        assertKnownFlags(parsed, ["--env", "--output", "-o", "--force"]);
        const output = stringFlag(parsed, "--output") ?? stringFlag(parsed, "-o");
        await pull({
          ...(env ? { env } : {}),
          ...(output ? { output } : {}),
          force: booleanFlag(parsed, "--force"),
        });
        return;
      }

      case "push": {
        assertKnownFlags(parsed, ["--env", "--file", "-f", "--yes", "-y"]);
        const file = stringFlag(parsed, "--file") ?? stringFlag(parsed, "-f");
        await push({
          ...(env ? { env } : {}),
          ...(file ? { file } : {}),
          yes: booleanFlag(parsed, "--yes", "-y"),
        });
        return;
      }

      case "run": {
        assertKnownFlags(parsed, ["--env"]);
        process.exitCode = await runCommand({
          ...(env ? { env } : {}),
          command: parsed.passthrough,
        });
        return;
      }

      case "workspace":
      case "workspaces":
        assertKnownFlags(parsed, manageFlags);
        await workspaceCommand(manage);
        return;

      case "project":
      case "projects":
        assertKnownFlags(parsed, [...manageFlags, "--environments"]);
        await projectCommand(manage);
        return;

      case "env":
      case "envs":
        assertKnownFlags(parsed, [...manageFlags, "--environment"]);
        await envFileCommand(manage);
        return;

      case "member":
      case "members":
        assertKnownFlags(parsed, [...manageFlags, "--role", "--projects", "--project-role"]);
        await memberCommand(manage);
        return;

      case "invite":
        assertKnownFlags(parsed, manageFlags);
        await inviteCommand(manage);
        return;

      case "history":
        assertKnownFlags(parsed, ["--workspace", "--search", "--limit"]);
        await historyCommand(manage);
        return;

      case "keys": {
        assertKnownFlags(parsed, []);
        const [action, subject] = parsed.positionals;
        await keysCommand({ action, ...(subject ? { subject } : {}) });
        return;
      }

      default:
        throw new Error(`Unknown command: ${parsed.command}. Run eit --help.`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error.";
    console.error(`Error: ${message}`);
    process.exitCode = 1;
  }
}

await run(process.argv.slice(2));
