import { readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { PROJECT_CONFIG_FILENAME } from "../constants/index.js";
import type { ProjectLink } from "../types/project.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isProjectLink(value: unknown): value is ProjectLink {
  return (
    isRecord(value)
    && ["workspaceId", "workspaceName", "projectId", "projectName", "envFileId", "envFileName"]
      .every((field) => typeof value[field] === "string")
  );
}

/** Finds the nearest `.eit.json`, walking up from `startDirectory`. */
export async function findProjectLink(
  startDirectory = process.cwd()
): Promise<{ link: ProjectLink; path: string } | null> {
  let directory = startDirectory;

  for (;;) {
    const path = join(directory, PROJECT_CONFIG_FILENAME);

    try {
      const payload: unknown = JSON.parse(await readFile(path, "utf8"));

      if (!isProjectLink(payload)) {
        throw new Error(`${path} is invalid. Run \`eit link\` again.`);
      }

      return { link: payload, path };
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
        throw error instanceof SyntaxError
          ? new Error(`${path} is not valid JSON. Run \`eit link\` again.`)
          : error;
      }
    }

    const parent = dirname(directory);

    if (parent === directory) {
      return null;
    }

    directory = parent;
  }
}

export async function requireProjectLink() {
  const found = await findProjectLink();

  if (!found) {
    throw new Error("This folder isn't linked to an env file. Run `eit link` first.");
  }

  return found;
}

export async function writeProjectLink(link: ProjectLink, directory = process.cwd()) {
  const path = join(directory, PROJECT_CONFIG_FILENAME);
  await writeFile(path, `${JSON.stringify(link, null, 2)}\n`, "utf8");
  return path;
}

export async function deleteProjectLink(directory = process.cwd()) {
  try {
    await unlink(join(directory, PROJECT_CONFIG_FILENAME));
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return false;
    }

    throw error;
  }
}
