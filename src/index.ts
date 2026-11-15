#!/usr/bin/env node

import { CLI_VALUE_FLAGS, CLI_VERSION } from "./constants/index.js";
import { link, unlink } from "./commands/link.js";
import { list } from "./commands/list.js";
import { login } from "./commands/login.js";
import { logout } from "./commands/logout.js";
import { pull } from "./commands/pull.js";
import { push } from "./commands/push.js";
import { run as runCommand } from "./commands/run.js";
import { status } from "./commands/status.js";
import {
  assertKnownFlags,
  booleanFlag,
  parseArgs,
  stringFlag,
} from "./lib/args.js";

function printHelp() {
  console.log(`eit - Env Garden CLI

Usage:
  eit login [--api-url <url>] [--no-browser]   Sign in (session lasts 7 days)
  eit logout [--local]                         Sign out and revoke this device
  eit status                                   Show account, session and link

  eit link [--workspace <name>] [--project <name>] [--env <name>]
                                               Link this folder to an env file
  eit unlink                                   Remove the link from this folder
  eit list                                     List workspaces, projects, env files

  eit pull [--env <name>] [-o <file>] [--force]
                                               Download variables into .env
  eit push [--env <name>] [-f <file>] [--yes]  Upload .env, replacing remote values
  eit run [--env <name>] -- <command>          Run a command with variables injected

  eit --help | --version

Environment variables:
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
