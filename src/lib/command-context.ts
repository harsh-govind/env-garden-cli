import { booleanFlag } from "./args.js";
import { confirm, isInteractive } from "./prompt.js";
import { requireCredentials } from "./session.js";
import { createWorkspaceApi } from "./workspace-api.js";
import type { ManageCommandInput } from "../types/manage.js";

export async function createCommandContext(input: ManageCommandInput) {
  const credentials = await requireCredentials();
  return createWorkspaceApi(credentials, input.fetchImplementation);
}

export function requirePositional(input: ManageCommandInput, index: number, usage: string): string {
  const value = input.parsed.positionals[index];

  if (!value) {
    throw new Error(`Usage: ${usage}`);
  }

  return value;
}

export async function confirmDestructive(input: ManageCommandInput, question: string): Promise<boolean> {
  if (booleanFlag(input.parsed, "--yes", "-y")) {
    return true;
  }

  if (!isInteractive()) {
    throw new Error("Re-run with --yes to confirm.");
  }

  const confirmed = await confirm(question);

  if (!confirmed) {
    console.log("Cancelled.");
  }

  return confirmed;
}
