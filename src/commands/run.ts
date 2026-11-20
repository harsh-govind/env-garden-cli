import { spawn } from "node:child_process";
import { requireProjectLink } from "../lib/project-config.js";
import { fetchVariables, resolveTargetEnvFile } from "../lib/remote.js";
import { requireCredentials } from "../lib/session.js";
import type { RunOptions } from "../types/commands.js";

export async function run(options: RunOptions): Promise<number> {
  const [executable, ...args] = options.command;

  if (!executable) {
    throw new Error("Usage: eit run [--env <name>] -- <command> [args...]");
  }

  const credentials = await requireCredentials();
  const { link } = await requireProjectLink();
  const remoteOptions = options.fetchImplementation
    ? { fetchImplementation: options.fetchImplementation }
    : {};
  const target = await resolveTargetEnvFile(credentials, link, options.env, remoteOptions);
  const variables = await fetchVariables(credentials, target, remoteOptions);
  const injected = Object.fromEntries(
    variables
      .filter((variable) => !variable.isCommented)
      .map((variable) => [variable.key, variable.value])
  );

  return new Promise((resolvePromise, reject) => {
    const child = spawn(executable, args, {
      stdio: "inherit",
      env: { ...process.env, ...injected },
      shell: process.platform === "win32",
    });
    const forward = (signal: NodeJS.Signals) => {
      child.kill(signal);
    };

    process.on("SIGINT", forward);
    process.on("SIGTERM", forward);

    child.on("error", (error) => {
      reject(
        "code" in error && error.code === "ENOENT"
          ? new Error(`Command not found: ${executable}`)
          : error
      );
    });

    child.on("exit", (code, signal) => {
      process.off("SIGINT", forward);
      process.off("SIGTERM", forward);
      resolvePromise(code ?? (signal ? 1 : 0));
    });
  });
}
