#!/usr/bin/env node

import { CLI_VERSION } from "./constants/index.js";
import { login } from "./commands/login.js";
import { logout } from "./commands/logout.js";
import { status } from "./commands/status.js";

function printHelp() {
  console.log(`eit - Env Garden CLI

Usage:
  eit login [--api-url <url>] [--no-browser]
  eit logout [--local]
  eit status
  eit --status
  eit --help
  eit --version

Environment variables:
  EIT_API_URL        Env Garden API URL
  EIT_TOKEN_NAME     Name shown on the authorization screen
  EIT_CONFIG_DIR     Override the credentials directory`);
}

function readOption(args: string[], name: string) {
  const index = args.indexOf(name);

  if (index === -1) {
    return undefined;
  }

  const value = args[index + 1];

  if (!value || value.startsWith("-")) {
    throw new Error(`${name} requires a value.`);
  }

  return value;
}

export async function run(args: string[]) {
  try {
    if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
      printHelp();
      return;
    }

    if (args.includes("--version") || args.includes("-v")) {
      console.log(CLI_VERSION);
      return;
    }

    const [command] = args;

    if (command === "status" || command === "--status") {
      if (args.length > 1) {
        throw new Error("Status does not accept additional arguments.");
      }

      await status();
      return;
    }

    if (command === "login") {
      const allowedArguments = new Set(["login", "--api-url", "--no-browser"]);
      const unknownArgument = args.find(
        (argument, index) =>
          !allowedArguments.has(argument)
          && args[index - 1] !== "--api-url"
      );

      if (unknownArgument) {
        throw new Error(`Unknown argument: ${unknownArgument}`);
      }

      const apiUrl = readOption(args, "--api-url");

      await login({
        ...(apiUrl ? { apiUrl } : {}),
        openBrowser: !args.includes("--no-browser"),
      });
      return;
    }

    if (command === "logout") {
      const allowedArguments = new Set(["logout", "--local"]);
      const unknownArgument = args.find(
        (argument) => !allowedArguments.has(argument)
      );

      if (unknownArgument) {
        throw new Error(`Unknown argument: ${unknownArgument}`);
      }

      await logout({ localOnly: args.includes("--local") });
      return;
    }

    throw new Error(`Unknown command: ${command}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error.";
    console.error(`Error: ${message}`);
    process.exitCode = 1;
  }
}

await run(process.argv.slice(2));
