import { spawnSync } from "node:child_process";
import { chmod, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { DEFAULT_ENV_FILENAME } from "../constants/index.js";
import { buildEnvText } from "../lib/env-file.js";
import { pluralize } from "../lib/format.js";
import { confirm, isInteractive } from "../lib/prompt.js";
import { requireProjectLink } from "../lib/project-config.js";
import { fetchVariables, resolveTargetEnvFile } from "../lib/remote.js";
import { requireCredentials } from "../lib/session.js";
import type { CliFetch } from "../types/api.js";

export type PullOptions = {
  env?: string;
  output?: string;
  force?: boolean;
  fetchImplementation?: CliFetch;
};

async function readExisting(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

/** Returns false only when git positively reports the file is not ignored. */
function isGitIgnored(path: string): boolean {
  const result = spawnSync("git", ["check-ignore", "-q", path], { stdio: "ignore" });
  return result.status !== 1;
}

export async function pull(options: PullOptions = {}): Promise<void> {
  const credentials = await requireCredentials();
  const { link } = await requireProjectLink();
  const remoteOptions = options.fetchImplementation
    ? { fetchImplementation: options.fetchImplementation }
    : {};
  const target = await resolveTargetEnvFile(credentials, link, options.env, remoteOptions);
  const variables = await fetchVariables(credentials, target, remoteOptions);
  const outputPath = resolve(options.output ?? DEFAULT_ENV_FILENAME);
  const contents = variables.length > 0 ? `${buildEnvText(variables)}\n` : "";
  const existing = await readExisting(outputPath);

  if (existing === contents) {
    console.log(`${options.output ?? DEFAULT_ENV_FILENAME} is already up to date.`);
    return;
  }

  if (existing !== null && !options.force) {
    if (!isInteractive()) {
      throw new Error(
        `${options.output ?? DEFAULT_ENV_FILENAME} already exists. Re-run with --force to overwrite it.`
      );
    }

    if (!(await confirm(`Overwrite ${options.output ?? DEFAULT_ENV_FILENAME} with ${target.envFileName}?`))) {
      console.log("Cancelled.");
      return;
    }
  }

  await writeFile(outputPath, contents, { encoding: "utf8", mode: 0o600 });
  await chmod(outputPath, 0o600);

  console.log(
    `Pulled ${pluralize(variables.length, "variable")} from ${target.projectName} / ${target.envFileName} into ${options.output ?? DEFAULT_ENV_FILENAME}.`
  );

  if (!isGitIgnored(outputPath)) {
    console.warn(
      `Warning: ${options.output ?? DEFAULT_ENV_FILENAME} is not in .gitignore. Add it so secrets aren't committed.`
    );
  }
}
