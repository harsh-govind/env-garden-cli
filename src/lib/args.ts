export type ParsedArgs = {
  command: string | undefined;
  flags: Map<string, string | true>;
  /** Everything after a standalone `--` (used by `eit run`). */
  passthrough: string[];
};

/**
 * Parses `eit <command> [--flag value] [--switch] [-- cmd args]`.
 * `valueFlags` lists flags that take a value; anything else is a boolean switch.
 */
export function parseArgs(args: string[], valueFlags: Set<string>): ParsedArgs {
  const flags = new Map<string, string | true>();
  const separatorIndex = args.indexOf("--");
  const ownArgs = separatorIndex === -1 ? args : args.slice(0, separatorIndex);
  const passthrough = separatorIndex === -1 ? [] : args.slice(separatorIndex + 1);
  let command: string | undefined;

  for (let index = 0; index < ownArgs.length; index += 1) {
    const argument = ownArgs[index] as string;

    if (!argument.startsWith("-")) {
      if (command !== undefined) {
        throw new Error(`Unexpected argument: ${argument}`);
      }

      command = argument;
      continue;
    }

    const [name, inlineValue] = argument.split(/=(.*)/s, 2) as [string, string | undefined];

    if (!valueFlags.has(name)) {
      flags.set(name, true);
      continue;
    }

    const value = inlineValue ?? ownArgs[index + 1];

    if (value === undefined || (inlineValue === undefined && value.startsWith("-"))) {
      throw new Error(`${name} requires a value.`);
    }

    flags.set(name, value);

    if (inlineValue === undefined) {
      index += 1;
    }
  }

  return { command, flags, passthrough };
}

export function assertKnownFlags(parsed: ParsedArgs, allowed: string[]) {
  const allowedSet = new Set(allowed);

  for (const name of parsed.flags.keys()) {
    if (!allowedSet.has(name)) {
      throw new Error(`Unknown option for ${parsed.command ?? "eit"}: ${name}`);
    }
  }
}

export function stringFlag(parsed: ParsedArgs, name: string): string | undefined {
  const value = parsed.flags.get(name);
  return typeof value === "string" ? value : undefined;
}

export function booleanFlag(parsed: ParsedArgs, ...names: string[]): boolean {
  return names.some((name) => parsed.flags.get(name) === true);
}
