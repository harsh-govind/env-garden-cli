import { readFile } from "node:fs/promises";
import { DEFAULT_ENV_FILENAME } from "../constants/index.js";
import { parseEnvText } from "../lib/env-file.js";
import { pluralize } from "../lib/format.js";
import { confirm, isInteractive } from "../lib/prompt.js";
import { requireProjectLink } from "../lib/project-config.js";
import { fetchVariables, pushVariables, resolveTargetEnvFile } from "../lib/remote.js";
import { requireCredentials } from "../lib/session.js";
import type { RemoteVariable } from "../types/api.js";
import type { PushOptions, VariableDiff } from "../types/commands.js";

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

export async function push(options: PushOptions = {}): Promise<void> {
  const credentials = await requireCredentials();
  const { link } = await requireProjectLink();
  const filePath = options.file ?? DEFAULT_ENV_FILENAME;
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

  const remoteOptions = options.fetchImplementation
    ? { fetchImplementation: options.fetchImplementation }
    : {};
  const target = await resolveTargetEnvFile(credentials, link, options.env, remoteOptions);
  const remote = await fetchVariables(credentials, target, remoteOptions);
  const diff = diffVariables(local, remote);
  const orderChanged =
    diff.added.length + diff.removed.length + diff.changed.length === 0
    && local.map((variable) => variable.key).join("\n") !== remote.map((variable) => variable.key).join("\n");

  if (diff.added.length + diff.removed.length + diff.changed.length === 0 && !orderChanged) {
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

  const count = await pushVariables(credentials, target, local, remoteOptions);
  console.log(`Pushed ${pluralize(count, "variable")} to ${target.envFileName}.`);
}
