import { readFile } from "node:fs/promises";
import { DEFAULT_ENV_FILENAME } from "../constants/index.js";
import { wipeEnvironmentKey } from "../lib/crypto/environment.js";
import { parseEnvText } from "../lib/env-file.js";
import { pluralize } from "../lib/format.js";
import { confirm, isInteractive } from "../lib/prompt.js";
import { requireProjectLink } from "../lib/project-config.js";
import { fetchRemoteState, pushVariables, resolveTargetEnvFile } from "../lib/remote.js";
import { requireCredentials } from "../lib/session.js";
import type { RemoteState, RemoteVariable } from "../types/api.js";
import type { PushOptions, VariableDiff } from "../types/commands.js";
import type { StoredCliCredentials } from "../types/credentials.js";
import type { ProjectLink } from "../types/project.js";

export function diffVariables(local: RemoteVariable[], remote: RemoteVariable[]): VariableDiff {
  const remoteByKey = new Map(remote.map((variable) => [variable.key, variable]));
  const localKeys = new Set(local.map((variable) => variable.key));
  const diff: VariableDiff = { added: [], removed: [], changed: [] };

  for (const variable of local) {
    const existing = remoteByKey.get(variable.key);

    if (!existing) {
      diff.added.push(variable.key);
    } else if (
      existing.value !== variable.value
      || (existing.note ?? "") !== (variable.note ?? "")
      || existing.isCommented !== variable.isCommented
    ) {
      diff.changed.push(variable.key);
    }
  }

  diff.removed = remote.filter((variable) => !localKeys.has(variable.key)).map((variable) => variable.key);
  return diff;
}

async function readLocalVariables(filePath: string): Promise<RemoteVariable[]> {
  let text: string;

  try {
    text = await readFile(filePath, "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      throw new Error(`${filePath} not found. Pass --file to push a different file.`);
    }

    throw error;
  }

  const local: RemoteVariable[] = parseEnvText(text).map((entry) => ({
    key: entry.key,
    value: entry.value,
    note: entry.note || null,
    isCommented: entry.isCommented,
  }));
  const seen = new Set<string>();

  for (const variable of local) {
    if (seen.has(variable.key)) {
      throw new Error(`Duplicate key in ${filePath}: ${variable.key}`);
    }

    seen.add(variable.key);
  }

  return local;
}

async function pushToRemote(input: {
  credentials: StoredCliCredentials;
  target: ProjectLink;
  filePath: string;
  local: RemoteVariable[];
  state: RemoteState;
  options: PushOptions;
}): Promise<void> {
  const { credentials, target, filePath, local, state, options } = input;
  const remote = state.variables;
  const diff = diffVariables(local, remote);
  const hasValueChanges = diff.added.length + diff.removed.length + diff.changed.length > 0;
  const orderChanged =
    !hasValueChanges
    && local.map((variable) => variable.key).join("\n") !== remote.map((variable) => variable.key).join("\n");

  if (!hasValueChanges && !orderChanged) {
    console.log(`${target.envFileName} is already up to date.`);
    return;
  }

  console.log(`Changes to ${target.projectName} / ${target.envFileName}:`);
  diff.added.forEach((key) => console.log(`  + ${key}`));
  diff.changed.forEach((key) => console.log(`  ~ ${key}`));
  diff.removed.forEach((key) => console.log(`  - ${key}`));

  if (orderChanged) {
    console.log("  (variable order changed)");
  }

  if (!options.yes) {
    if (!isInteractive()) {
      throw new Error("Re-run with --yes to push without confirmation.");
    }

    if (!(await confirm(`Replace ${target.envFileName} on Env Garden with ${filePath}?`))) {
      console.log("Cancelled.");
      return;
    }
  }

  const remoteOptions = options.fetchImplementation
    ? { fetchImplementation: options.fetchImplementation }
    : {};
  const count = await pushVariables(credentials, target, local, state, remoteOptions);
  console.log(`Pushed ${pluralize(count, "variable")} to ${target.envFileName}.`);
}

export async function push(options: PushOptions = {}): Promise<void> {
  const credentials = await requireCredentials();
  const { link } = await requireProjectLink();
  const filePath = options.file ?? DEFAULT_ENV_FILENAME;
  const local = await readLocalVariables(filePath);
  const remoteOptions = options.fetchImplementation
    ? { fetchImplementation: options.fetchImplementation }
    : {};
  const target = await resolveTargetEnvFile(credentials, link, options.env, remoteOptions);
  const state = await fetchRemoteState(credentials, target, remoteOptions);

  try {
    await pushToRemote({ credentials, target, filePath, local, state, options });
  } finally {
    await wipeEnvironmentKey(state.material);
  }
}
